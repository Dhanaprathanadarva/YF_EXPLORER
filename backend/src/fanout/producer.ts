import { fanoutQueue } from './queue';
import { incrementTotal, setStartTime } from './aggregator';
import { FanoutJobPayload } from './types';

export async function startFanout(region: string): Promise<string> {
  const rootJobId = `root-${Date.now()}-${region.replace(/\s+/g, '_')}`;

  const trendingPayload: FanoutJobPayload = {
    key:         region,
    depth:       1,
    jobType:     'trending',
    parentJobId: null,
    rootJobId,
    path:        [],
    region,
  };

  const marketSummaryPayload: FanoutJobPayload = {
    key:         region,
    depth:       1,
    jobType:     'marketSummary',
    parentJobId: null,
    rootJobId,
    path:        [],
    region,
  };

  await Promise.all([
    incrementTotal(rootJobId, 2),
    setStartTime(rootJobId),
  ]);

  await (fanoutQueue as any).addBulk([
    { name: `fanout » trending:${region}`,      data: trendingPayload },
    { name: `fanout » marketSummary:${region}`, data: marketSummaryPayload },
  ]);

  return rootJobId;
}
