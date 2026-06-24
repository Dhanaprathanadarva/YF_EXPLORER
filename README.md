# YF Explorer

A developer tool for exploring Yahoo Finance APIs — pick an endpoint, set parameters, and inspect live responses in a clean dark UI.

## Project Structure

```
YF_EXPLORER/
├── backend/          # Express + TypeScript API proxy
│   └── src/
│       └── index.ts  # All route handlers
└── frontend/         # Next.js 14 + Tailwind CSS
    └── app/
        ├── page.tsx              # Home — API card grid
        ├── [apiId]/page.tsx      # Detail — params + response panel
        ├── lib/api-configs.ts    # Single source of truth for all endpoint configs
        └── components/
            ├── ApiCard.tsx       # Card on home page
            ├── ParamForm.tsx     # Left panel — parameter inputs
            ├── ResponsePanel.tsx # Right panel — response viewer
            └── JsonTree.tsx      # Collapsible JSON tree renderer
```

## Endpoints

| ID | Name | Yahoo Finance URL |
|---|---|---|
| `dashboard` | Dashboard | Aggregates Search + Chart + Market Summary + Trending |
| `chart` | Chart (Historical) | `/v8/finance/chart/{symbol}` |
| `search` | Search | `/v1/finance/search` |
| `market-summary` | Market Summary | `/v6/finance/quote/marketSummary` |
| `trending` | Trending Tickers | `/v1/finance/trending/{region}` |

## Getting Started

### Backend

```bash
cd backend
npm install
npm run dev        # ts-node-dev with hot reload on port 5000
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # Next.js dev server on port 3000
```

Then open [http://localhost:3000](http://localhost:3000).

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

The three parallel calls use concurrent async I/O (`Promise.all`) — they all start at the same time and the total wait time equals the slowest of the three, not the sum.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Backend framework | Express 4 |
| Language | TypeScript |
| HTTP client | Axios |
| Backend runtime | ts-node-dev (dev), Node.js (prod) |
