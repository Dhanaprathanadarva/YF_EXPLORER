import { Worker, Job } from 'bullmq';
import { connectionOptions as connection } from './redis';
import { fanoutQueue } from './queue';
import { FanoutJobPayload } from './types';
import { fetchNextLevel, LevelResponse } from './apiAdapter';
import { storeResult, incrementCompleted, incrementTotal, setCompletedTime, recordLevelJobTiming } from './aggregator';
import { FanoutRecord } from './db';

const MAX_DEPTH = 3;

export function startFanoutWorker() {
  const worker = new Worker<FanoutJobPayload>(
    'yf-fanout',
    async (job: Job<FanoutJobPayload>) => {
      const { key, depth, jobType, rootJobId, path, region } = job.data;

      console.log(`[fanout] depth:${depth} | type:${jobType} | key:${key} | path:${path.join(' → ')}`);

      const processedOn = job.processedOn ?? Date.now();
      const waitTimeMs  = processedOn - job.timestamp;

      const { data, children }: LevelResponse = await fetchNextLevel(key, jobType, region);

      await storeResult(rootJobId, job.id!, { key, depth, jobType, path, data });

      // Fire-and-forget MongoDB write
      const query = (depth === 1 ? key : path[0]).toLowerCase();
      FanoutRecord.updateOne(
        { query, key, depth },
        { $set: { jobType, path, data: data as object, updatedAt: new Date() } },
        { upsert: true }
      )
        .then((res) => console.log(`[MongoDB] ${res.upsertedCount ? 'Inserted' : 'Updated'} — query:${query} | type:${jobType} | key:${key} | depth:${depth}`))
        .catch((err) => console.error(`[MongoDB] Save error — key:${key} | ${err}`));

      if (depth < MAX_DEPTH && children.length > 0) {
        const childJobs = children.map((child) => ({
          name: `fanout » ${[...path, key, child.key].join(' » ')}`,
          data: {
            key:         child.key,
            depth:       depth + 1,
            jobType:     child.jobType,
            parentJobId: job.id!,
            rootJobId,
            path:        [...path, key],
            region,
          } as FanoutJobPayload,
        }));

        await (fanoutQueue as any).addBulk(childJobs);
        await incrementTotal(rootJobId, childJobs.length);
      }

      const finishedOn      = Date.now();
      const processingTimeMs = finishedOn - processedOn;

      await recordLevelJobTiming(rootJobId, depth, key, waitTimeMs, processingTimeMs, processedOn, finishedOn);

      const treeDone = await incrementCompleted(rootJobId);
      if (treeDone) {
        await setCompletedTime(rootJobId);
        console.log(`[fanout] Tree complete for root: ${rootJobId}`);
      }

      return { key, depth, jobType, childCount: children.length };
    },
    {
      connection,
      concurrency: 5,
      limiter: {
        max:      10,
        duration: 1000,
      },
    }
  );

  worker.on('completed', (job) =>
    console.log(`[fanout] ✓ Job ${job.id} done | depth:${job.data.depth} | type:${job.data.jobType} | key:${job.data.key}`)
  );

  worker.on('failed', (job, err) =>
    console.error(`[fanout] ✗ Job ${job?.id} failed | type:${job?.data.jobType} | key:${job?.data.key} | ${err.message}`)
  );

  return worker;
}
