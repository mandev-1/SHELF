# Budget API

!! NOTE -- DEPLOYED AT `https://shelf-yh5b.onrender.com/`

A standalone, production-grade Go REST API that fronts the existing Supabase
Postgres database for the ShELF budget app. It is a real persistent HTTP server
(`http.ListenAndServe`, **not** serverless) built on the Go 1.22 stdlib
`net/http.ServeMux` and **github.com/jackc/pgx/v5**. It is designed to run on
[Render](https://render.com) as a Docker web service.

The Next.js frontend (deployed on Vercel) will eventually call this API instead
of hitting Supabase directly, giving you a single, lockable seam in front of the
database.

## Architecture

```
Next.js (Vercel) ──HTTP──▶ Budget API (Render, Go) ──pgx──▶ Supabase Postgres
```

- **Router:** Go 1.22 `net/http.ServeMux` with method+path patterns
  (`"GET /api/users/{id}"`, `r.PathValue("id")`). No third-party router.
- **DB access:** `pgxpool` connection pool; every query is parameterized
  (`$1, $2, …`) and uses `context.Context`.
- **JSON:** stdlib `encoding/json`. The wire format is **camelCase** (the
  frontend's shape) even though the DB columns are snake_case.
- **Middleware chain:** `Recover` → `Logger` → `CORS` → `Auth` (outermost to
  innermost).

## Endpoints

| Method | Path                | Description                                                        |
| ------ | ------------------- | ------------------------------------------------------------------ |
| GET    | `/healthz`          | Liveness probe → `{"status":"ok"}`. Used by Render's health check. |
| GET    | `/api/users`        | List all users (ordered by `created_at`).                          |
| POST   | `/api/users`        | Create a user. Body `{ "name": "..." }` (other fields optional).   |
| PATCH  | `/api/users/{id}`   | Update a user's `name` / `share` / `income` / `color`.             |
| DELETE | `/api/users/{id}`   | Delete a user → `204 No Content`.                                  |
| GET    | `/api/trips`        | List all trips (ordered by `created_at DESC`).                     |
| POST   | `/api/trips`        | Create a trip (upsert). Body is a Trip object.                     |
| PUT    | `/api/trips/{id}`   | Update a trip (upsert with the given id).                          |
| DELETE | `/api/trips/{id}`   | Delete a trip → `204 No Content`.                                  |
| GET    | `/api/budget`       | Get the singleton budget (creates a default if none exists).       |
| PATCH  | `/api/budget`       | Replace the budget's `data` jsonb. Body is the raw new data JSON.  |

All endpoints (except `OPTIONS` preflight and `/healthz`) require a bearer token
**only when** `API_TOKEN` is set — see [Auth](#authentication).

## Environment variables

| Variable         | Required | Default      | Description                                                                 |
| ---------------- | -------- | ------------ | --------------------------------------------------------------------------- |
| `PORT`           | no       | `8080`       | Listen port. **Render sets this automatically** — don't hardcode it.        |
| `DATABASE_URL`   | **yes**  | —            | Supabase Postgres connection string (Session pooler, port 5432).            |
| `ALLOWED_ORIGIN` | no       | none         | CORS allowlist — a single origin, a comma-separated list, or `*`. When unset, **no** CORS header is sent (cross-origin blocked). Set it to the frontend origin(s). |
| `API_TOKEN`      | no       | empty (open) | Optional bearer secret. When empty the API is open (dev mode).              |

Copy `.env.example` to `.env` and fill in the values for local development.

## Running locally

```bash
cd apps/budget-api

# 1. Resolve dependencies and generate go.sum (only needed the first time,
#    or after changing go.mod).
go mod tidy

# 2. Provide the database URL (and any other env vars).
export DATABASE_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres'
export ALLOWED_ORIGIN='http://localhost:3000'
# export API_TOKEN='some-secret'   # optional

# 3. Run.
go run .
# → listening on :8080
```

Quick smoke test:

```bash
curl -s localhost:8080/healthz            # {"status":"ok"}
curl -s localhost:8080/api/users          # []  (or your users)
curl -s localhost:8080/api/budget         # the singleton budget
```

## Getting the Supabase `DATABASE_URL`

1. Open your project in the Supabase dashboard.
2. Go to **Settings → Database → Connection string**.
3. Choose the **Session pooler** connection string (host
   `aws-0-<region>.pooler.supabase.com`, port **5432**). The session pooler is
   the right choice for a long-lived persistent server like this one. (The
   transaction pooler on port 6543 is intended for serverless/short-lived
   connections.)
4. Substitute your database password into the URL and use that as
   `DATABASE_URL`.

## Deploying to Render

> **Monorepo note.** This API lives at `apps/budget-api/` inside a larger repo.
> The Render Blueprint (`render.yaml`) therefore lives at the **repo root** (Render
> only discovers it there) and uses `rootDir: apps/budget-api` to scope the build.
> If you deploy manually instead, you **must** set the service's **Root Directory**
> to `apps/budget-api`, or Render builds from the repo root (no `Dockerfile`/`go.mod`
> there) and fails.

### Option A — Blueprint (recommended)

1. Push this repo to GitHub.
2. In Render, choose **New → Blueprint** and point it at the repo. Render reads
   [`render.yaml` at the repo root](../../render.yaml) (with `rootDir: apps/budget-api`)
   and provisions a Docker web service named `budget-api`, health check `/healthz`.
3. In the service's **Environment** settings, set the secrets marked `sync: false`:
   - `DATABASE_URL` — the Supabase Session pooler URL.
   - `API_TOKEN` — optional bearer secret (leave unset to keep the API open).
   - `ALLOWED_ORIGIN` is preset to the Vercel frontend origin in `render.yaml`;
     change it there or override in the dashboard if needed.
4. Deploy. Render injects `PORT` automatically — **do not set `PORT` yourself.**

### Option B — Web service from the Dockerfile

1. **New → Web Service**, connect the repo, select **Docker** as the runtime.
2. **Set Root Directory to `apps/budget-api`** (Settings → Build & Deploy → Root
   Directory) so the `Dockerfile` and Go module resolve. *(Without this, the build
   fails — it's the #1 monorepo gotcha.)*
3. Set the environment variables `DATABASE_URL`, `ALLOWED_ORIGIN`, and
   (optionally) `API_TOKEN`. **Do not set `PORT`** — Render injects it.
4. Set the health check path to `/healthz`.
5. Deploy.

The image is a multi-stage build: a `golang:1.22-alpine` stage compiles a fully
static binary (`CGO_ENABLED=0`), and the final image is
`gcr.io/distroless/static-debian12` containing only the `/server` binary — small
and with a minimal attack surface.

## Authentication

Auth is optional and controlled by `API_TOKEN`:

- **Unset / empty** → the API is open (intended for local dev). Useful while the
  frontend migration is in progress.
- **Set** → every request (except `OPTIONS` preflight and `/healthz`) must send
  `Authorization: Bearer <API_TOKEN>`. A missing or mismatched token returns
  `401`.

## Hardening (do this after the frontend is migrated)

Right now Supabase RLS still allows the anon key, so the old frontend path keeps
working. Once the Next.js frontend points at **this** API:

1. Lock Supabase **Row Level Security** to deny the anon role so that **only**
   this API (using the service-role/pooler credentials in `DATABASE_URL`) can
   read or write the data.
2. Set `API_TOKEN` on Render and have the frontend send the bearer token.
3. Set `ALLOWED_ORIGIN` to the exact frontend origin (no `*`).

### Realtime caveat

This API is plain request/response and does **not** proxy Supabase Realtime. If
the frontend relies on Realtime subscriptions, keep using Supabase Realtime
directly for those (read-only) channels for now, or migrate that piece to a
WebSocket endpoint on this server later. Locking RLS down hard will also affect
Realtime, so stage that change with the frontend migration in mind.
