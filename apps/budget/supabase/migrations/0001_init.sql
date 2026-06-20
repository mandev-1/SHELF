-- ============================================================================
-- Migration 0001 — initial schema (budgets + users)
--
-- Idempotent: safe on a fresh project AND safe to re-run on an existing one.
-- Apply in Supabase → SQL Editor (paste + Run), or via the Supabase CLI
-- (`supabase db push`). Future schema changes go in new numbered files:
-- 0002_*.sql, 0003_*.sql, … — never edit an applied migration, add a new one.
--
-- Model: database-only (NO Supabase Auth). The whole budget is one jsonb BLOB in
-- budgets.data; people live in the users table. RLS is intentionally OPEN (anon
-- read/write) — a soft "shared link" model, not real security. Realtime syncs
-- edits live. Last-writer-wins.
-- ============================================================================

-- ── budgets: one shared budget, stored as a jsonb blob ──────────────────────
create table if not exists public.budgets (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'Our Budget',
  data       jsonb not null default
             '{"currency":"CZK","splitBasis":"equal","members":[],"expenses":[],"trips":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.budgets enable row level security;

drop policy if exists "open budget access" on public.budgets;
create policy "open budget access" on public.budgets
  for all
  to anon, authenticated
  using (true)
  with check (true);

do $$
begin
  alter publication supabase_realtime add table public.budgets;
exception
  when duplicate_object then null; -- already added; ignore on re-run
end $$;

-- ── users: the people in the budget (roster + sessions) ─────────────────────
-- Ids are reused as the member ids that expenses/trips reference. `id` is text
-- (not uuid) so it accepts the client-generated ids the app already created.
-- Sessions/superuser are client-side (hardcoded password) — a guardrail, not
-- security.
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

-- One-time data migration: lift any existing blob members into the users table
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
