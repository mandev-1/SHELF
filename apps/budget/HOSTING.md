# Budget — Hosting Plan (database-only, no auth)

> The budget feature was built in the ShELF extension (a separate shell) and **ported
> here verbatim** — `components/BudgetPanel.tsx` + `components/budget.css` are copied
> from `src/components/Budget/`. The only change is persistence: `chrome.storage.local`
> → Supabase Postgres. **No Supabase Auth** — one shared budget the friend group reaches
> by URL, synced live via Realtime. Last-writer-wins.

## 1. Stack

| Concern  | Choice                                   | Why |
|----------|------------------------------------------|-----|
| Where    | `apps/budget/` subfolder                 | Independent Vercel deploy; ShELF extension untouched. |
| Framework| Next.js 15 + React 19 + Tailwind v4      | One-click Vercel deploy; matches your stack. |
| Hosting  | Vercel Hobby (free)                      | Plenty for a few friends. Non-commercial. |
| Database | Supabase Postgres (free)                 | Just the DB — no Auth product. |
| Auth     | **None**                                 | Shared-link model. Anyone with the URL can edit. |
| Sync     | Supabase Realtime                        | Edits appear live in everyone's open tab. |

## 2. The privacy trade-off (know this)

No login means the public anon key ships in the browser bundle and RLS is open, so
**anyone who has your deployed URL can view and edit the budget.** For a friends' holiday
budget that's usually fine. It is *not* private from someone who finds the link.

Want a gate later? Easiest options, in order of effort: a shared passcode prompt in the
app; a hard-to-guess `/[slug]` per budget; or turn Supabase Auth back on (it was here in
git history). None are needed to ship.

## 3. Free-tier caveats

- **Supabase free projects pause after ~7 days idle** — first request after is slow, data
  is safe. A weekly Vercel Cron ping avoids it if it annoys you.
- **Vercel Hobby is non-commercial** — fine for friends sharing a budget.

## 4. Environment variables

Two, in `apps/budget/.env.local` (and the same two in Vercel → Settings → Env Vars):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
```

From Supabase → Settings → API (Project URL + the `anon`/`public` key). The anon key is
browser-safe by design. **Never** add the `service_role` key — the app doesn't use it.

## 5. One-time setup

### Supabase
1. Create a project at supabase.com (free plan, region near your friends).
2. SQL Editor → run `supabase/schema.sql` (creates the `budgets` table, open RLS, Realtime).
3. Copy Project URL + anon key into your env vars.

That's it — no auth/URL/email configuration needed.

### Vercel
1. Import this GitHub repo.
2. **Root Directory → `apps/budget`** (critical — else it builds the extension).
3. Add the two env vars. Deploy.

## 6. Local dev

```bash
cd apps/budget
npm install
cp .env.local.example .env.local   # fill in URL + anon key
npm run dev                          # http://localhost:3000
```

## 7. How it works

- `useBudget()` loads the single `budgets` row (creating it on first run), feeds the blob
  to `BudgetPanel`, debounce-saves edits (600ms), and subscribes to Realtime.
- Everyone hitting the URL reads/writes the **same** `budgets.data` blob. Conflict model:
  last-writer-wins on the whole blob — acceptable at friend scale.

## 8. Done vs. next

**Done:** full budget UI (members, expenses, settle-up, split basis) on Supabase; cloud
persistence; live sync; zero-login hosting.

**Possible next:** the import feature (from the handoff); an optional passcode/slug gate;
normalized tables only if concurrent-edit safety ever becomes a real need.

boo
