import { fanoutQueue } from './queue';
import { incrementTotal, setStartTime } from './aggregator';
import { FanoutJobPayload } from './types';

// Kicks off the entire fan-out tree from a root query
export async function startFanout(query: string): Promise<string> {
  const rootJobId = `root-${Date.now()}-${query.replace(/\s+/g, '_')}`;

  const payload: FanoutJobPayload = {
    key:          query,
    depth:        1,
    parentJobId:  null,
    rootJobId,
    path:         [],
  };

  // Register 1 job in the total counter and record start time
  await Promise.all([
    incrementTotal(rootJobId, 1),
    setStartTime(rootJobId),
  ]);

  await (fanoutQueue as any).add(`fanout » ${query}`, payload, {
    jobId: rootJobId,
  });

  return rootJobId;
}
