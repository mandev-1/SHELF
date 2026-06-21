-- Migration 0003 — per-trip main + secondary currency.
--
-- Each trip now picks a main currency (the one its totals are shown in) and a
-- secondary currency (shown in parentheses for reference). Expenses can be
-- logged in main / secondary / EUR and are converted for the trip totals.
-- Idempotent. Existing trips default to CZK (main) + EUR (secondary).

alter table public.trips
  add column if not exists main_currency      text not null default 'CZK',
  add column if not exists secondary_currency text not null default 'EUR';
