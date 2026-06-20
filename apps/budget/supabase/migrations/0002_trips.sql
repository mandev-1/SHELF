-- ============================================================================
-- Migration 0002 — trips → own table
--
-- Trips used to live inside budgets.data (the shared jsonb blob), so any save of
-- the blob could overwrite a concurrently-added trip (last-writer-wins). Moving
-- each trip to its own row means adding/editing a trip only writes that one row,
-- so concurrent tabs/sessions can't wipe each other's trips.
--
-- Each trip keeps its own expenses as a jsonb column (one row per trip is enough
-- to stop the cross-trip wipe; same-trip concurrent edits are a much narrower
-- race we accept for now). Idempotent + migrates existing blob trips.
-- ============================================================================
create table if not exists public.trips (
  id          text primary key,
  name        text not null,
  emoji       text,
  destination text,
  start_date  text,
  end_date    text,
  dates_tbd   boolean not null default false,
  color       text,
  cover       text,
  member_ids  jsonb not null default '[]'::jsonb,
  expenses    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.trips enable row level security;

drop policy if exists "open trips access" on public.trips;
create policy "open trips access" on public.trips
  for all
  to anon, authenticated
  using (true)
  with check (true);

do $$
begin
  alter publication supabase_realtime add table public.trips;
exception
  when duplicate_object then null;
end $$;

-- One-time migration: lift any existing blob trips into the trips table.
insert into public.trips
  (id, name, emoji, destination, start_date, end_date, dates_tbd, color, cover, member_ids, expenses, created_at, updated_at)
select t ->> 'id',
       t ->> 'name',
       t ->> 'emoji',
       t ->> 'destination',
       t ->> 'startDate',
       t ->> 'endDate',
       coalesce((t ->> 'datesTBD')::boolean, false),
       t ->> 'color',
       t ->> 'cover',
       coalesce(t -> 'memberIds', '[]'::jsonb),
       coalesce(t -> 'expenses', '[]'::jsonb),
       coalesce(nullif(t ->> 'createdAt', '')::timestamptz, now()),
       coalesce(nullif(t ->> 'updatedAt', '')::timestamptz, now())
from public.budgets b,
     jsonb_array_elements(b.data -> 'trips') t
where coalesce(t ->> 'id', '') <> ''
  and coalesce(t ->> 'name', '') <> ''
on conflict (id) do nothing;
