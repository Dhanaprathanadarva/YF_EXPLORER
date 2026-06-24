# YF Explorer — Claude Context

## What this project is

A Yahoo Finance API explorer. The backend proxies requests to Yahoo Finance (adding required headers), the frontend provides a UI to set parameters and inspect responses. Not a production app — a developer tool for exploring what each Yahoo Finance endpoint returns.

## Running the project

```bash
# Terminal 1 — backend (port 5000)
cd backend && npm run dev

# Terminal 2 — frontend (port 3000)
cd frontend && npm run dev
```

Both must be running. Frontend talks to backend only — never directly to Yahoo Finance.

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

When adding future multi-stage endpoints, follow this same pattern: sequential for dependent calls, `Promise.all` for independent ones.

## Adding a new endpoint — checklist

- [ ] Add route in `backend/src/index.ts` — destructure all params from `req.body` with defaults
- [ ] Add entry in `frontend/app/lib/api-configs.ts` — id, name, version, endpoint, backendPath, fields
- [ ] For multi-result: set `isDashboard: true`, return `{ key1, key2, ... }` from backend, add tab keys to `DASHBOARD_TABS` in `[apiId]/page.tsx`

## What NOT to do

- Do not call Yahoo Finance from the frontend — always go through the backend proxy
- Do not add a new component for a new endpoint — the existing ParamForm + ResponsePanel handles everything
- Do not hardcode regions or intervals in new routes — always take them from `req.body` with a sensible default
