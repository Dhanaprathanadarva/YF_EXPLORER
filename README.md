# YF Explorer

A developer tool for exploring Yahoo Finance APIs — pick an endpoint, set parameters, and inspect live responses in a clean dark UI. Also includes a recursive fan-out feature powered by BullMQ to demonstrate parallel vs sequential execution at scale.

## Project Structure

```
YF_EXPLORER/
├── backend/
│   └── src/
│       ├── index.ts              # All standard route handlers + MongoDB connection
│       └── fanout/               # BullMQ fan-out feature (standalone)
│           ├── types.ts          # FanoutJobPayload interface
│           ├── redis.ts          # Redis connections (BullMQ + aggregator)
│           ├── queue.ts          # BullMQ queue definition
│           ├── apiAdapter.ts     # API calls per depth level
│           ├── aggregator.ts     # Redis-based result store + timing
│           ├── worker.ts         # Job processor + MongoDB write
│           ├── producer.ts       # Starts root job
│           ├── board.ts          # Bull Board UI at /admin/queues
│           ├── router.ts         # Fan-out HTTP routes
│           └── db.ts             # Mongoose model for fanout results
└── frontend/
    └── app/
        ├── page.tsx              # Home — API card grid
        ├── [apiId]/page.tsx      # Detail — params + response panel
        ├── fanout/page.tsx       # Fan-out UI — parallel vs sequential comparison
        ├── lib/api-configs.ts    # Single source of truth for all endpoint configs
        └── components/
            ├── ApiCard.tsx       # Card on home page
            ├── ParamForm.tsx     # Left panel — parameter inputs
            ├── ResponsePanel.tsx # Right panel — response viewer
            └── JsonTree.tsx      # Collapsible JSON tree renderer
```

## Prerequisites

- **MongoDB** running on `localhost:27017`
- **Memurai** (Redis for Windows) running on `localhost:6379`

```bash
memurai-cli ping   # should reply PONG
```

## Getting Started

### 1. Backend

Create `backend/.env` with the required environment variables (ask the project owner for values).

```bash
cd backend
npm install
npm run dev        # ts-node-dev with hot reload on port 5000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev        # Next.js dev server on port 3000
```

Then open [http://localhost:3000](http://localhost:3000).

## Standard Endpoints

| ID | Name | Yahoo Finance URL |
|---|---|---|
| `dashboard` | Dashboard | Aggregates Search + Chart + Market Summary + Trending |
| `chart` | Chart (Historical) | `/v8/finance/chart/{symbol}` |
| `search` | Search | `/v1/finance/search` |
| `market-summary` | Market Summary | `/v6/finance/quote/marketSummary` |
| `trending` | Trending Tickers | `/v1/finance/trending/{region}` |

## How It Works

The frontend never calls Yahoo Finance directly. Every request goes through the Express backend, which adds the required headers (User-Agent, Referer, Origin) that Yahoo expects.

### Dashboard endpoint — two-stage execution

```
POST /api/dashboard  { q, region }
        │
        ▼
   Search API   ──── resolves symbol (e.g. "Apple" → "AAPL")
        │
        ▼
   Promise.all([
     Chart API,          ─┐
     Market Summary API,  ├── concurrent, not sequential
     Trending API         ─┘
   ])
        │
        ▼
   { search, chart, marketSummary, trending }
```

## Fan-out Feature (BullMQ)

A job queue system at `/fanout` that demonstrates parallel vs sequential execution at scale. Takes a region as input and fans out across Trending and Market Summary APIs, then fetches Chart data for every trending symbol in parallel.

### Execution flow

```
POST /api/fanout/start { region }
        ↓
Level 1 (parallel) — two jobs enqueued simultaneously:
    ├── Trending API  → resolves region to ~20 trending symbols
    └── Market Summary API → market snapshot for the region (leaf)
        ↓
Level 2 (parallel, rolling window of 5 via BullMQ concurrency) —
    Chart API for each trending symbol (up to 20 jobs)
        ↓
Results stored in Redis → written to MongoDB per job as each finishes
        ↓
Frontend auto-runs sequential comparison first, then parallel fan-out
Both timings rendered side by side for comparison
```

### Fan-out API endpoints

| Method | URL | What |
|---|---|---|
| `POST` | `/api/fanout/start` | Start with `{ region }`, returns `rootJobId` |
| `GET` | `/api/fanout/status/:rootJobId` | Poll `{ total, completed, done }` |
| `GET` | `/api/fanout/results/:rootJobId` | All results + timing (202 if still running) |
| `DELETE` | `/api/fanout/cleanup/:rootJobId` | Remove Redis keys + obliterate BullMQ queue |
| `DELETE` | `/api/fanout/records` | Delete all MongoDB fanout records |
| `POST` | `/api/fanout/sequential` | Run same calls sequentially, returns timing |
| `GET` | `/admin/queues` | Bull Board visual queue UI |

### MongoDB storage

Fan-out results are saved to the `fanoutrecords` collection — one document per job, written immediately when each job completes (fire-and-forget, never blocks the worker). Re-running the same region updates existing documents instead of creating duplicates (upsert on `query + key + depth`). The `query` field stores the region (lowercased) as the root identifier.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Backend framework | Express 4 |
| Language | TypeScript |
| HTTP client | Axios |
| Job queue | BullMQ |
| Queue storage | Redis (Memurai on Windows) |
| Database | MongoDB + Mongoose |
| Backend runtime | ts-node-dev (dev), Node.js (prod) |
