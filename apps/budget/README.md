# Budget

Shared budget app for friends. Next.js 15 on Vercel, talking to a **Go API**
(`apps/budget-api/`) that fronts Supabase Postgres. The browser never touches the
database directly — it calls a same-origin `/api/*` proxy that injects a server-side
bearer token. No auth product; one shared budget reached by URL.

Independent of the ShELF extension at the repo root — it has its own `package.json`
and deploys from its own Vercel **Root Directory** (`apps/budget`).

**Porting more features from the design prototype?** See
[`docs/handoff-006-port-map.md`](./docs/handoff-006-port-map.md) — it maps the full handoff
(Trips, guest view, receipt import, spend charts, …) to a porting plan. Read it before
building any new budget view.

## Quick start

```bash
cd apps/budget
npm install
cp .env.local.example .env.local   # fill in BUDGET_API_URL + BUDGET_API_TOKEN
npm run dev                          # http://localhost:3000
```

Point `BUDGET_API_URL` at the deployed Go API, or run it locally
(`cd ../budget-api && docker compose up --build` → `http://localhost:8080`). The
Supabase connection string and DB migrations live with the **API**, not here —
see [`../budget-api/README.md`](../budget-api/README.md).

Full hosting/setup/deploy walkthrough and free-tier caveats: **[HOSTING.md](./HOSTING.md)**.

No login — the app opens straight onto one shared budget the friend group reaches by URL.
See **[HOSTING.md](./HOSTING.md)** for the privacy trade-off and deploy steps.

## Layout

```
app/
  layout.tsx          root layout
  page.tsx            renders BudgetView (no auth)
  BudgetView.tsx      client: load budget, render panel
  api/[...path]/      server-side proxy → Go API (injects the bearer token)
components/
  BudgetPanel.tsx     the feature, ported verbatim from the extension
  budget.css          its stylesheet (self-contained design tokens)
lib/
  budget-types.ts     BudgetState model + normalizeBudget (from grid.ts)
  api.ts              typed client for the same-origin /api/* proxy
  useBudget.ts        API-backed budget: load · debounced save · focus-refresh
  useUsers.ts         people via /api/users (optimistic + 404 reconcile)
  useTrips.ts         trips via /api/trips (optimistic + 404 reconcile)
supabase/migrations/   ordered SQL migrations (run against the DB the API connects to)
```

The port swapped **only** persistence: the extension fed `BudgetPanel` from
`chrome.storage.local`; here the hooks feed it from the Go API (which fronts Postgres).
The component and its settle-up math are unchanged.
