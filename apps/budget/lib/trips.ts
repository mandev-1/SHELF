// Trip math — each trip is its own shared-spend pool (own members + expenses).
// Reuses the group settle-up engine scoped to the trip.

import type {
  BudgetTrip,
  BudgetMember,
  BudgetSplitBasis,
} from "./budget-types";
import { computeBalances, type Balance, type Transfer } from "./budget-format";
import { convert } from "./currency";

/** Nights between start and end (0 if dates missing/invalid). */
export function tripNights(t: BudgetTrip): number {
  if (!t.startDate || !t.endDate) return 0;
  const ms = new Date(t.endDate).getTime() - new Date(t.startDate).getTime();
  return ms > 0 ? Math.round(ms / 86400000) : 0;
}

/** "17–21 Jun · 4 nights", or "Dates TBD". */
export function tripDateLabel(t: BudgetTrip): string {
  if (t.datesTBD || !t.startDate || !t.endDate) return "Dates TBD";
  const a = new Date(t.startDate);
  const b = new Date(t.endDate);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return "Dates TBD";
  const mon = (d: Date) => d.toLocaleDateString("en", { month: "short" });
  const range =
    a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
      ? `${a.getDate()}–${b.getDate()} ${mon(b)}`
      : `${a.getDate()} ${mon(a)} – ${b.getDate()} ${mon(b)}`;
  const n = tripNights(t);
  return `${range} · ${n} night${n === 1 ? "" : "s"}`;
}

/** Hero/card meta line: "Krakow · 17–21 Jun · 4 nights". */
export function tripMetaLabel(t: BudgetTrip): string {
  return [t.destination?.trim(), tripDateLabel(t)].filter(Boolean).join(" · ");
}

/** The members on this trip (all budget members if none explicitly chosen). */
export function tripMembers(t: BudgetTrip, all: BudgetMember[]): BudgetMember[] {
  const ids = t.memberIds && t.memberIds.length ? t.memberIds : all.map((m) => m.id);
  return all.filter((m) => ids.includes(m.id));
}

export interface TripStats {
  total: number;
  perPerson: number;
  toSettle: number; // total amount that needs to move to square up
  squared: boolean;
  travellers: number;
  balances: Balance[];
  transfers: Transfer[];
}

export function tripStats(
  t: BudgetTrip,
  all: BudgetMember[],
  basis: BudgetSplitBasis,
): TripStats {
  const members = tripMembers(t, all);
  // Convert every expense into the trip's main currency so mixed-currency spends
  // settle correctly; all returned amounts are then in the main currency.
  const main = t.mainCurrency ?? "CZK";
  const expenses = (t.expenses ?? []).map((e) => ({
    ...e,
    amount: convert(e.amount, e.currency, main),
    currency: main,
  }));
  const { balances, total, transfers } = computeBalances(members, expenses, basis);
  const travellers = members.length;
  const perPerson = travellers > 0 ? total / travellers : 0;
  const toSettle = transfers.reduce((s, x) => s + x.amount, 0);
  return { total, perPerson, toSettle, squared: toSettle < 0.5, travellers, balances, transfers };
}
