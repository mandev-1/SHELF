-- ============================================================================
-- Budget — database-only schema (NO Supabase Auth).
-- Run once in Supabase → SQL Editor.
--
-- One shared budget for the friend group, stored as a jsonb BLOB in budgets.data
-- (the same shape the extension keeps in chrome.storage.local). The app reaches
-- it with the public anon key; RLS below is intentionally OPEN, so anyone with
-- the app URL can read/edit. Realtime syncs edits live. Last-writer-wins.
--
-- This is the "shared link" model — simple, not private. If you later want a
-- gate, add a shared passcode in the app or a hard-to-guess slug per budget.
-- ============================================================================

create table if not exists public.budgets (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'Our Budget',
  data       jsonb not null default
             '{"currency":"CZK","splitBasis":"equal","members":[],"expenses":[],"trips":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS enabled but fully open to the anon (public) role used by the app.
alter table public.budgets enable row level security;

drop policy if exists "open budget access" on public.budgets;
create policy "open budget access" on public.budgets
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- Realtime: broadcast budget row updates to everyone's open tab.
do $$
begin
  alter publication supabase_realtime add table public.budgets;
exception
  when duplicate_object then null; -- already added; ignore on re-run
end $$;
