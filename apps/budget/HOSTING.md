# Budget — Hosting Plan (API-fronted, no auth product)

> The budget feature was built in the ShELF extension and **ported here verbatim**
> (`components/BudgetPanel.tsx` + `components/budget.css`). The browser no longer
> talks to Supabase directly: it calls a same-origin `/api/*` route handler that
> proxies to a **Go API** (`apps/budget-api/`, hosted on Render), which is the only
> thing that touches Postgres. **No Supabase Auth** — one shared budget the friend
> group reaches by URL. Last-writer-wins.

## 1. Architecture

```
Browser ──/api/*──▶ Next.js proxy (Vercel) ──Bearer token──▶ Go API (Render) ──pgx──▶ Supabase Postgres
```

| Concern  | Choice                                   | Why |
|----------|------------------------------------------|-----|
| Frontend | Next.js 15 + React 19 (this folder)      | One-click Vercel deploy. Root Directory = `apps/budget`. |
| API      | Go `net/http` + pgx (`apps/budget-api/`) | Single lockable seam in front of the DB. Deployed on Render. |
| Database | Supabase Postgres (free)                 | Just the DB — no Auth product, no anon key in the browser. |
| Auth     | Shared-link + a bearer token API gate    | The token lives server-side on Vercel; the browser never sees it. |
| Sync     | Refresh-on-focus (poll the API)          | Tabs re-pull from the API when refocused. No Realtime. |

The browser bundle contains **no** Supabase URL/key and **no** API token — only
relative `/api/*` calls. The token is injected by the server-side proxy.

## 2. The privacy trade-off (know this)

There's still no per-user login: anyone with the deployed URL (and, if set, a way
through the app's soft passcode gate) can view and edit the shared budget. That's
usually fine for a friends' holiday budget. What changed vs. the old model: the
database is no longer directly reachable from the browser — all access goes through
the Go API, which can require a bearer token and (once you lock Supabase RLS) be the
*only* client of the database.

## 3. Free-tier caveats

- **Render free web services spin down when idle** — the first request after wakes
  it (a few seconds). Supabase free projects also pause after ~7 days idle.
- **Vercel Hobby is non-commercial** — fine for friends sharing a budget.

## 4. Environment variables

Set these in **Vercel → Settings → Environment Variables** (and in
`apps/budget/.env.local` for local dev). **Server-only — no `NEXT_PUBLIC_` prefix**,
so they never reach the client bundle:

```
BUDGET_API_URL=https://shelf-yh5b.onrender.com      # the deployed Go API (no trailing slash)
BUDGET_API_TOKEN=<the API_TOKEN set on the Go service>   # leave empty only if the API is open
```

The **Go API** has its own env vars (`DATABASE_URL`, `API_TOKEN`, `ALLOWED_ORIGIN`)
set on Render — see [`../budget-api/README.md`](../budget-api/README.md). The Supabase
connection string lives there, not here.

## 5. One-time setup

### Supabase (database only)
1. Create a project at supabase.com (free plan, region near your friends).
2. SQL Editor → run the migrations in `supabase/migrations/` in order
   (`0001_init.sql` — creates `budgets` + `users`, plus the `trips` table; idempotent).
3. Copy the **Session pooler** connection string — it becomes the Go API's
   `DATABASE_URL` on Render (not a Vercel var).

### Go API (Render)
Deploy `apps/budget-api/` to Render and set `DATABASE_URL` + `API_TOKEN`. Full steps
in [`../budget-api/README.md`](../budget-api/README.md). Note the service URL.

### Vercel (this frontend)
1. Import this GitHub repo.
2. **Root Directory → `apps/budget`** (critical — else it builds the extension).
3. Add `BUDGET_API_URL` (the Render URL) and `BUDGET_API_TOKEN` (match the API's
   `API_TOKEN`). Deploy.

## 6. Local dev

```bash
cd apps/budget
npm install
cp .env.local.example .env.local   # fill in BUDGET_API_URL + BUDGET_API_TOKEN
npm run dev                          # http://localhost:3000
```

Point `BUDGET_API_URL` at the deployed API, or run the API locally
(`cd ../budget-api && docker compose up --build`) and use `http://localhost:8080`.

## 7. How it works

- `useBudget()` loads the `budgets` row via `GET /api/budget` (or `GET /api/budget/{id}`
  for a `?b=` shared link), feeds the blob to `BudgetPanel`, and debounce-saves edits
  (600 ms) via `PATCH`. People and trips come from `useUsers()` / `useTrips()`, which
  read/write the `users` and `trips` tables through `/api/users` and `/api/trips`.
- All three hooks update optimistically and **reconcile on conflict**: if the API
  returns 404 (the row was already removed by someone else), the user is told and the
  list refetches. Tabs also refresh on focus.
- Everyone hitting the URL reads/writes the same data. Conflict model: last-writer-wins.

## 8. Done vs. next

**Done:** full budget UI on Postgres via the Go API; cloud persistence; a single
token-gated seam in front of the database; zero-login hosting; optimistic UI with
conflict reconciliation.

**Possible next:** lock Supabase RLS to deny the anon role (so the Go API is the only
DB client); a real per-user auth layer; server-sent events for instant live sync
instead of focus-refresh.
