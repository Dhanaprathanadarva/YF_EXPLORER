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
      const { key, depth, rootJobId, path } = job.data;

      console.log(`[fanout] depth:${depth} | key:${key} | path:${path.join(' → ')}`);

      // BullMQ's own start time — when the worker picked up this job
      const processedOn = job.processedOn ?? Date.now();

      // Queue wait time — how long the job sat idle before being picked up
      const waitTimeMs = processedOn - job.timestamp;

      // Hit the API for this depth level
      const { data, children }: LevelResponse = await fetchNextLevel(key, depth);

      // Store result in Redis
      await storeResult(rootJobId, job.id!, { key, depth, path, data });

      // Write this job's result to MongoDB immediately — upsert so re-running same query updates instead of duplicating
      const query = (depth === 1 ? key : path[0]).toLowerCase();
      FanoutRecord.updateOne(
        { query, key, depth },
        { $set: { path, data: data as object, updatedAt: new Date() } },
        { upsert: true }
      )
        .then((res) => console.log(`[MongoDB] ${res.upsertedCount ? 'Inserted' : 'Updated'} — query:${query} | key:${key} | depth:${depth}`))
        .catch((err) => console.error(`[MongoDB] Save error — key:${key} | ${err}`));

      // Enqueue children if we haven't hit max depth and there are children
      if (depth < MAX_DEPTH && children.length > 0) {
        const childJobs = children.map((child) => ({
          name: `fanout » ${[...path, key, child.key].join(' » ')}`,
          data: {
            key:          child.key,
            depth:        depth + 1,
            parentJobId:  job.id!,
            rootJobId,
            path:         [...path, key],
          } as FanoutJobPayload,
        }));

        await (fanoutQueue as any).addBulk(childJobs);
        await incrementTotal(rootJobId, childJobs.length);
      }

      // Capture end time after all work is done — matches BullMQ's finishedOn closely
      const finishedOn = Date.now();
      const processingTimeMs = finishedOn - processedOn;

      // Record timing using BullMQ's measurements
      await recordLevelJobTiming(rootJobId, depth, key, waitTimeMs, processingTimeMs, processedOn, finishedOn);

      // Mark this job complete and check if the whole tree is done
      const treeDone = await incrementCompleted(rootJobId);
      if (treeDone) {
        await setCompletedTime(rootJobId);
        console.log(`[fanout] Tree complete for root: ${rootJobId}`);
      }

      return { key, depth, childCount: children.length };
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
    console.log(`[fanout] ✓ Job ${job.id} done | depth:${job.data.depth} | key:${job.data.key}`)
  );

  worker.on('failed', (job, err) =>
    console.error(`[fanout] ✗ Job ${job?.id} failed | key:${job?.data.key} | ${err.message}`)
  );

  return worker;
}
