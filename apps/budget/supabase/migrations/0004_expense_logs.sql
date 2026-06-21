-- Migration 0004 — expense audit log.
--
-- One row per expense CRUD action (create / update / delete). A new record is
-- written for every subsequent change so the full history is kept for
-- reconciliation. Key ids: actor (who made the change), trip, expense item.
-- Append-only in practice; never updated. RLS open like the rest of the app.

create table if not exists public.expense_logs (
  id          uuid primary key default gen_random_uuid(),
  trip_id     text not null,
  expense_id  text not null,
  actor_id    text,
  actor_name  text,
  action      text not null,            -- 'create' | 'update' | 'delete'
  amount      numeric,
  currency    text,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists expense_logs_trip_idx    on public.expense_logs (trip_id, created_at desc);
create index if not exists expense_logs_expense_idx on public.expense_logs (expense_id, created_at desc);

alter table public.expense_logs enable row level security;
drop policy if exists "open logs access" on public.expense_logs;
create policy "open logs access" on public.expense_logs
  for all using (true) with check (true);
