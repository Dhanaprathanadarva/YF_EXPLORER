# YF Explorer — Claude Context

## What this project is

A Yahoo Finance API explorer. The backend proxies requests to Yahoo Finance (adding required headers), the frontend provides a UI to set parameters and inspect responses. Not a production app — a developer tool for exploring what each Yahoo Finance endpoint returns.

## Running the project

```bash
# Prerequisite — Memurai (Redis for Windows) must be running
memurai-cli ping   # should reply PONG

# Terminal 1 — backend (port 5000)
cd backend && npm run dev

# Terminal 2 — frontend (port 3000)
cd frontend && npm run dev
```

All three must be running. Frontend talks to backend only — never directly to Yahoo Finance.

## Environment variables

`backend/.env` — required before starting the backend:
```
MONGODB_URL=mongodb://localhost:27017/yf_explorer
PORT=5000
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Key file — api-configs.ts

`frontend/app/lib/api-configs.ts` is the single source of truth for all endpoints. Adding a new endpoint means:
1. Add an `ApiConfig` entry to the `API_CONFIGS` array
2. Add a matching route in `backend/src/index.ts`
3. No other files need touching for a standard single-result endpoint

For a multi-result endpoint (like dashboard), set `isDashboard: true` on the config — the detail page handles tab rendering automatically.

## Architecture rules

- **Backend** (`backend/src/index.ts`): All routes are `POST`. The body carries parameters. `fetchYF()` is the only function that touches Yahoo Finance — always go through it, never call axios directly in a route.
- **Frontend** (`frontend/app/[apiId]/page.tsx`): Driven entirely by `API_CONFIGS`. The page reads the config for the current `apiId` and renders fields, submits to `config.backendPath`, displays the result.
- **No direct Yahoo Finance calls from frontend** — the backend exists specifically to add Yahoo's required headers.

## Dashboard endpoint — two-stage pattern

`/api/dashboard` is the only endpoint with a dependency chain:
1. Search runs first (needs user query, returns symbol)
2. Chart + MarketSummary + Trending run in parallel via `Promise.all` using the resolved symbol and user-supplied region

The dashboard result is NOT a single ApiResult — it is `{ search, chart, marketSummary, trending }`. The frontend renders it as 4 tabs. When adding future multi-stage endpoints, follow this same pattern: sequential for dependent calls, `Promise.all` for independent ones.

## MongoDB — fan-out result storage only

Dashboard endpoint does NOT save to MongoDB — it only returns the response directly.

Only the **fan-out feature** saves to MongoDB. Every job writes immediately when it gets a response — no waiting for other parallel jobs to finish.

- **Collection**: `fanoutrecords` in the `yf_explorer` database
- **Schema** (defined in `backend/src/fanout/db.ts`):
  ```
  query      — region (always stored lowercase) — root identifier for all jobs in a run
  key        — the symbol or region string for this job
  depth      — level in the tree (1 = trending/marketSummary, 2 = chart)
  jobType    — 'trending' | 'marketSummary' | 'chart'
  path       — breadcrumb trail of keys from root to this job
  data       — full API response
  updatedAt  — timestamp of last write
  ```
- **Upsert on `{ query, key, depth }`** — re-running the same region updates existing documents instead of creating duplicates
- **Case-insensitive**: query (region) is lowercased before upsert
- **Fire-and-forget**: MongoDB write never blocks the job — failures are logged to console only
- **Per-job write**: each job writes independently as soon as it finishes — parallel jobs write to MongoDB simultaneously

## Fan-out feature (BullMQ) — separate from standard endpoints

Located in `backend/src/fanout/` and `frontend/app/fanout/`. This is a standalone job queue feature — do not mix it with the standard endpoint pattern.

### File structure
```
backend/src/fanout/
  types.ts        ← FanoutJobPayload interface + JobType
  redis.ts        ← connectionOptions (for BullMQ) + redisClient (for aggregator)
  queue.ts        ← BullMQ queue definition
  apiAdapter.ts   ← fetchTrending + fetchMarketSummary + fetchChart + fetchNextLevel dispatcher
  aggregator.ts   ← Redis-based result store + per-level timing + completion tracking
  worker.ts       ← processes jobs, enqueues children, records BullMQ timing, writes to MongoDB
  producer.ts     ← enqueues Trending + MarketSummary as parallel Level 1 jobs
  board.ts        ← Bull Board UI at /admin/queues
  router.ts       ← 6 Express routes: start, status, results, cleanup, records, sequential
  db.ts           ← Mongoose model (FanoutRecord) for MongoDB persistence

frontend/app/fanout/
  page.tsx        ← Fan-out UI: region input, progress bar, parallel timing, sequential timing, results
```

### Fan-out execution flow
```
POST /api/fanout/start { region }
        ↓
producer enqueues 2 jobs simultaneously (total = 2):
        ↓
Level 1 (parallel):
  ├── Trending(region)      → resolves to ~20 trending symbols
  │       ↓ enqueues 20 Chart children
  └── MarketSummary(region) → leaf, no children
        ↓
Level 2 (parallel, rolling window of 5 via concurrency: 5):
  Chart API for each trending symbol (up to 20 jobs)
        ↓
Results stored in Redis, fetched via GET /api/fanout/results/:rootJobId

Frontend runs sequential FIRST (warm connections), then parallel fan-out:
POST /api/fanout/sequential { region }
        ↓
Trending → MarketSummary → Chart(symbol1) → Chart(symbol2) → ... (one by one)
Returns timing breakdown for comparison with parallel
```

### Timing approach
- Uses BullMQ's own `job.processedOn` (start) and `Date.now()` after all work (end) — NOT a custom API-only timer
- Per job: `waitTimeMs = processedOn - job.timestamp`, `processingTimeMs = finishedOn - processedOn`
- **Displayed time per job**: `totalTimeMs = waitTimeMs + processingTimeMs` — matches exactly what Bull Board shows
- Per level wall-clock: `max(finishedOn) - min(processedOn)` computed from all jobs at that depth — stored in Redis list to avoid race conditions
- Frontend runs sequential first so parallel benefits from warm HTTP connections — fairer comparison

### Sequential comparison endpoint
`POST /api/fanout/sequential { region }` — defined in `router.ts`:
- Runs the exact same API calls but one by one with no concurrency
- Returns `{ totalTimeMs, levelTimings: [{ depth, wallClockMs, jobCount, jobs: [{ key, timeMs }] }] }`
- Sequential total = sum of all individual call times (no overlap)
- Frontend runs this BEFORE parallel to warm up connections, then renders both breakdowns side by side

### Key rules for fan-out
- `apiAdapter.ts` controls which API is called per jobType — dispatches on `jobType`, not `depth`
- `JobType = 'chart' | 'trending' | 'marketSummary'` — no 'search' type
- Leaf nodes must return `children: []` to stop recursion
- BullMQ and the aggregator use SEPARATE Redis connections: `connectionOptions` (plain object) for BullMQ, `redisClient` (IORedis instance) for aggregator — do not mix them
- `storeResult` uses `job.id!` as hash field
- Cleanup (`DELETE /api/fanout/cleanup/:rootJobId`) calls both `cleanup()` (Redis keys) AND `fanoutQueue.obliterate({ force: true })` (BullMQ queue) — must be called between runs
- MongoDB `query` field = region (lowercased), used as root identifier across all jobs in a run
- MongoDB upsert filter is `{ query, key, depth }` — depth differentiates Level 1 vs Level 2 jobs with the same key
- `depth === 1` check used for MongoDB query field: `depth === 1 ? key : path[0]`

### Fan-out API endpoints
| Method | URL | What |
|---|---|---|
| `POST` | `/api/fanout/start` | Start with `{ region }`, returns `rootJobId` |
| `GET` | `/api/fanout/status/:rootJobId` | Poll `{ total, completed, done }` |
| `GET` | `/api/fanout/results/:rootJobId` | All results + timing (202 if still running) |
| `DELETE` | `/api/fanout/cleanup/:rootJobId` | Remove Redis keys + obliterate BullMQ queue |
| `DELETE` | `/api/fanout/records` | Delete all MongoDB fanout records |
| `POST` | `/api/fanout/sequential` | Run same calls sequentially, returns timing for comparison |
| `GET` | `/admin/queues` | Bull Board visual UI |

## Adding a new standard endpoint — checklist

- [ ] Add route in `backend/src/index.ts` — destructure all params from `req.body` with defaults
- [ ] Add entry in `frontend/app/lib/api-configs.ts` — id, name, version, endpoint, backendPath, fields
- [ ] For multi-result: set `isDashboard: true`, return `{ key1, key2, ... }` from backend, add tab keys to `DASHBOARD_TABS` in `[apiId]/page.tsx`

## Adding a new fan-out job type — checklist

- [ ] Add the new type to `JobType` in `backend/src/fanout/types.ts`
- [ ] Add `fetchNewType` function in `backend/src/fanout/apiAdapter.ts`
- [ ] Add dispatch case in `fetchNextLevel`
- [ ] If it should run at Level 1: add it to `producer.ts` `addBulk` call and increment total accordingly
- [ ] If it should run as a child: return it in the parent's `children` array with the correct `jobType`
- [ ] Leaf nodes must return `children: []`
- [ ] Update `MAX_DEPTH` in `worker.ts` if needed

## Security rules

- **Never read `backend/.env` without explicit user permission** — it contains database credentials and service URLs. If you need to know an env var value, ask the user instead of reading the file directly.

## What NOT to do

- Do not call Yahoo Finance from the frontend — always go through the backend proxy
- Do not add a new component for a new standard endpoint — the existing ParamForm + ResponsePanel handles everything
- Do not hardcode regions or intervals in new routes — always take them from `req.body` with a sensible default
- Do not pass an IORedis instance as BullMQ's `connection` — pass `connectionOptions` (plain object) instead
- Do not return non-empty `children` from a leaf-level fetch function — it will create unwanted jobs
- Do not read fan-out results before `status.done === true` — level timing may be incomplete
- Do not save dashboard results to MongoDB — only fan-out results belong in MongoDB (`fanoutrecords`)
- Do not use `FanoutRecord.create()` for fan-out saves — always use `updateOne` with `upsert: true` to prevent duplicates
- Do not dispatch fan-out jobs by `depth` — dispatch by `jobType` in `fetchNextLevel`
