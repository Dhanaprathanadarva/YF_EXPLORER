export interface FanoutJobPayload {
  key: string       // the value passed to the next API (e.g. symbol, id)
  depth: number     // current level in the tree (starts at 1)
  parentJobId: string | null
  rootJobId: string
  path: string[]    // breadcrumb trail of keys from root to this job
}

export interface LevelResult {
  key: string
  data: unknown
}
