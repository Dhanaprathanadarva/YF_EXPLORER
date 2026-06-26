export type JobType = 'chart' | 'trending' | 'marketSummary';

export interface FanoutJobPayload {
  key: string           // the value passed to the next API (e.g. symbol, region, query)
  depth: number         // current level in the tree (starts at 1)
  jobType: JobType      // which API to call for this job
  parentJobId: string | null
  rootJobId: string
  path: string[]        // breadcrumb trail of keys from root to this job
  region: string        // passed down for trending/marketSummary calls
}

export interface LevelResult {
  key: string
  data: unknown
}
