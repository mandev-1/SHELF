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

-- ============================================================================
-- users — the people in the budget. Source of truth for the roster + sessions.
-- Ids are reused as the member ids that expenses/trips reference. `id` is text
-- (not uuid) so it accepts the client-generated ids the app already created.
-- Open RLS — soft model, same as budgets. (Sessions/superuser are client-side;
-- the password is hardcoded in the app, so this is a guardrail, not security.)
-- ============================================================================
create table if not exists public.users (
  id         text primary key,
  name       text not null,
  role       text not null default 'member', -- 'member' | 'superuser'
  share      numeric,
  income     numeric,
  color      text,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

drop policy if exists "open users access" on public.users;
create policy "open users access" on public.users
  for all
  to anon, authenticated
  using (true)
  with check (true);

do $$
begin
  alter publication supabase_realtime add table public.users;
exception
  when duplicate_object then null;
end $$;

-- One-time migration: lift any existing blob members into the users table
-- (same ids), so nothing is lost when members move out of budgets.data.
insert into public.users (id, name, share, income, color, created_at)
select m ->> 'id',
       m ->> 'name',
       nullif(m ->> 'share', '')::numeric,
       nullif(m ->> 'income', '')::numeric,
       m ->> 'color',
       coalesce(nullif(m ->> 'createdAt', '')::timestamptz, now())
from public.budgets b,
     jsonb_array_elements(b.data -> 'members') m
where coalesce(m ->> 'id', '') <> ''
  and coalesce(m ->> 'name', '') <> ''
on conflict (id) do nothing;
