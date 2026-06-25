import { redisClient as connection } from './redis';

// ── Store one job's result ─────────────────────────────────────
export async function storeResult(rootJobId: string, jobId: string, result: unknown) {
  await connection.hset(
    `fanout:results:${rootJobId}`,
    jobId,
    JSON.stringify(result)
  );
}

// ── Track total jobs created under a root ─────────────────────
export async function incrementTotal(rootJobId: string, count = 1) {
  await connection.incrby(`fanout:total:${rootJobId}`, count);
}

// ── Track completed jobs and check if the full tree is done ───
export async function incrementCompleted(rootJobId: string): Promise<boolean> {
  const completed = await connection.incr(`fanout:completed:${rootJobId}`);
  const total     = await connection.get(`fanout:total:${rootJobId}`);
  return Number(completed) >= Number(total);
}

// ── Return all collected results for a root job ────────────────
export async function getAllResults(rootJobId: string): Promise<unknown[]> {
  const raw = await connection.hgetall(`fanout:results:${rootJobId}`);
  return Object.values(raw).map((r) => JSON.parse(r));
}

// ── Check completion status ────────────────────────────────────
export async function getStatus(rootJobId: string) {
  const [total, completed] = await Promise.all([
    connection.get(`fanout:total:${rootJobId}`),
    connection.get(`fanout:completed:${rootJobId}`),
  ]);
  return {
    total:     Number(total     ?? 0),
    completed: Number(completed ?? 0),
    done:      Number(completed ?? 0) >= Number(total ?? 1),
  };
}

// ── Overall timing ─────────────────────────────────────────────
export async function setStartTime(rootJobId: string) {
  await connection.set(`fanout:startedAt:${rootJobId}`, Date.now());
}

export async function setCompletedTime(rootJobId: string) {
  await connection.set(`fanout:completedAt:${rootJobId}`, Date.now());
}

// ── Per-level timing (reliable approach) ──────────────────────
// Level start: SET NX — only written by the FIRST job at that depth
// Level end:   always overwritten — last job at that depth wins
// Individual:  appended to a Redis list, one entry per job
export async function recordLevelJobTiming(
  rootJobId: string,
  depth: number,
  key: string,
  waitTimeMs: number,
  processingTimeMs: number,
  processedOn: number,  // absolute timestamp — used for level wall-clock
  finishedOn: number
) {
  const levelKey = `fanout:level:${rootJobId}:${depth}:jobs`;
  await connection.rpush(
    levelKey,
    JSON.stringify({ key, waitTimeMs, processingTimeMs, processedOn, finishedOn })
  );
}

export async function getLevelTimings(rootJobId: string) {
  const listKeys = await connection.keys(`fanout:level:${rootJobId}:*:jobs`);

  const levelTimings: {
    depth: number;
    wallClockMs: number;
    jobCount: number;
    jobs: { key: string; waitTimeMs: number; processingTimeMs: number }[];
  }[] = [];

  await Promise.all(
    listKeys.map(async (listKey) => {
      const parts = listKey.split(':');
      const depth = Number(parts[parts.length - 2]);

      const rawJobs = await connection.lrange(listKey, 0, -1);
      const entries = rawJobs.map(
        (j) => JSON.parse(j) as {
          key: string;
          waitTimeMs: number;
          processingTimeMs: number;
          processedOn: number;
          finishedOn: number;
        }
      );

      // Level wall-clock = max(finishedOn) - min(processedOn) — true parallel span
      const levelStart = Math.min(...entries.map((e) => e.processedOn));
      const levelEnd   = Math.max(...entries.map((e) => e.finishedOn));

      levelTimings.push({
        depth,
        wallClockMs: levelEnd - levelStart,
        jobCount:    entries.length,
        jobs: entries
          .map(({ key, waitTimeMs, processingTimeMs }) => ({
            key,
            waitTimeMs,
            processingTimeMs,
            totalTimeMs: waitTimeMs + processingTimeMs,  // matches Bull Board's job duration
          }))
          .sort((a, b) => b.totalTimeMs - a.totalTimeMs), // slowest first
      });
    })
  );

  return levelTimings.sort((a, b) => a.depth - b.depth);
}



export async function getTiming(rootJobId: string) {
  const [startedAt, completedAt, levelTimings] = await Promise.all([
    connection.get(`fanout:startedAt:${rootJobId}`),
    connection.get(`fanout:completedAt:${rootJobId}`),
    getLevelTimings(rootJobId),
  ]);
  const start = Number(startedAt ?? 0);
  const end   = Number(completedAt ?? 0);
  return {
    totalTimeMs:  start && end ? end - start : null,
    levelTimings,
  };
}

// ── Cleanup Redis keys for a root job ─────────────────────────
export async function cleanup(rootJobId: string) {
  const levelKeys = await connection.keys(`fanout:level:${rootJobId}:*`);
  await Promise.all([
    connection.del(`fanout:results:${rootJobId}`),
    connection.del(`fanout:total:${rootJobId}`),
    connection.del(`fanout:completed:${rootJobId}`),
    connection.del(`fanout:startedAt:${rootJobId}`),
    connection.del(`fanout:completedAt:${rootJobId}`),
    ...levelKeys.map((k) => connection.del(k)),
  ]);
}
