# Budget

Shared budget app for friends. Next.js 15 + Supabase (Postgres + Auth), hosted on Vercel.

Independent of the ShELF extension at the repo root — it has its own `package.json`
and deploys from its own Vercel **Root Directory** (`apps/budget`).

## Quick start

```bash
cd apps/budget
npm install
cp .env.local.example .env.local   # fill in Supabase URL + anon key
npm run dev                          # http://localhost:3000
```

Then run `supabase/schema.sql` in your Supabase project's SQL Editor.

Full hosting/setup/deploy walkthrough and free-tier caveats: **[HOSTING.md](./HOSTING.md)**.

No login — the app opens straight onto one shared budget the friend group reaches by URL.
See **[HOSTING.md](./HOSTING.md)** for the privacy trade-off and deploy steps.

## Layout

```
app/
  layout.tsx          root layout
  page.tsx            renders BudgetView (no auth)
  BudgetView.tsx      client: load budget, render panel
components/
  BudgetPanel.tsx     the feature, ported verbatim from the extension
  budget.css          its stylesheet (self-contained design tokens)
lib/
  budget-types.ts     BudgetState model + normalizeBudget (from grid.ts)
  useBudget.ts        Supabase-backed budget: load · debounced save · Realtime
  supabase/client.ts  anon Supabase client (database only, no Auth)
supabase/schema.sql   single budgets(jsonb blob) table + open RLS + Realtime
```

The port swapped **only** persistence: the extension fed `BudgetPanel` from
`chrome.storage.local`; here `useBudget` feeds it from Supabase. The component and its
settle-up math are unchanged.
