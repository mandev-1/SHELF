// Shared budget helpers — extracted so the Trips components and BudgetPanel
// share one settle-up engine, formatting, and avatar. (BudgetPanel keeps its
// own private copies; these are the canonical versions for new components.)

import type {
  BudgetCurrency,
  BudgetMember,
  BudgetExpense,
  BudgetSplitBasis,
} from "./budget-types";

export const CURRENCIES: BudgetCurrency[] = ["CZK", "PLN", "EUR"];

// Member avatar hues, cycled by index.
export const AV_HUES = [
  "var(--hue-blue)",
  "var(--hue-rose)",
  "var(--hue-purple)",
  "var(--hue-orange)",
  "var(--hue-green)",
  "var(--hue-zinc)",
];

// Trip accent dots (the "ACCENT" row in the Plan-a-trip modal).
export const TRIP_ACCENTS = [
  "var(--accent)",
  "var(--hue-rose)",
  "var(--hue-green)",
  "var(--hue-orange)",
  "var(--hue-purple)",
];

// Cover-icon choices (the "COVER ICON" row in the Plan-a-trip modal).
export const TRIP_EMOJIS = [
  "🏖️", "⛰️", "🎷", "🛶", "🏝️", "🚗", "✈️", "⛺", "🍷", "🎿", "🖼️", "🎡",
];

export function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "b" + Math.random().toString(36).slice(2);
}

export function nowIso() {
  return new Date().toISOString();
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function fmt(amount: number, c: BudgetCurrency): string {
  const n = Math.round(amount);
  if (c === "CZK") return `${n.toLocaleString()} Kč`;
  if (c === "PLN") return `${n.toLocaleString()} zł`;
  return `€${n.toLocaleString()}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function memberWeight(m: BudgetMember, basis: BudgetSplitBasis): number {
  if (basis === "share") return m.share && m.share > 0 ? m.share : 1;
  if (basis === "income") return m.income && m.income > 0 ? m.income : 0;
  return 1;
}

export interface Balance {
  member: BudgetMember;
  paid: number;
  owed: number;
  net: number; // paid - owed; positive => others owe them
}

export interface Transfer {
  from: BudgetMember;
  to: BudgetMember;
  amount: number;
}

/** Per-member balances + greedy settle-up transfers for a member/expense set. */
export function computeBalances(
  members: BudgetMember[],
  expenses: BudgetExpense[],
  splitBasis: BudgetSplitBasis,
): { balances: Balance[]; total: number; transfers: Transfer[] } {
  const byId = new Map(members.map((m) => [m.id, m]));
  const paid = new Map<string, number>();
  const owed = new Map<string, number>();
  members.forEach((m) => {
    paid.set(m.id, 0);
    owed.set(m.id, 0);
  });
  let total = 0;

  for (const e of expenses) {
    if (e.amount <= 0) continue;
    total += e.amount;
    paid.set(e.paidBy, (paid.get(e.paidBy) ?? 0) + e.amount);
    const among = (e.splitAmong.length ? e.splitAmong : members.map((m) => m.id)).filter((id) =>
      byId.has(id),
    );
    if (among.length === 0) continue;
    const basis = e.basis ?? splitBasis;
    let weights = among.map((id) => ({ id, w: memberWeight(byId.get(id)!, basis) }));
    let totalW = weights.reduce((s, x) => s + x.w, 0);
    if (totalW <= 0) {
      weights = among.map((id) => ({ id, w: 1 }));
      totalW = among.length;
    }
    for (const { id, w } of weights) {
      owed.set(id, (owed.get(id) ?? 0) + (e.amount * w) / totalW);
    }
  }

  const balances: Balance[] = members.map((m) => {
    const p = paid.get(m.id) ?? 0;
    const o = owed.get(m.id) ?? 0;
    return { member: m, paid: p, owed: o, net: p - o };
  });

  const creditors = balances
    .filter((b) => b.net > 0.5)
    .map((b) => ({ m: b.member, amt: b.net }))
    .sort((a, b) => b.amt - a.amt);
  const debtors = balances
    .filter((b) => b.net < -0.5)
    .map((b) => ({ m: b.member, amt: -b.net }))
    .sort((a, b) => b.amt - a.amt);
  const transfers: Transfer[] = [];
  let ci = 0,
    di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const give = Math.min(creditors[ci].amt, debtors[di].amt);
    if (give > 0.5) transfers.push({ from: debtors[di].m, to: creditors[ci].m, amount: give });
    creditors[ci].amt -= give;
    debtors[di].amt -= give;
    if (creditors[ci].amt < 0.5) ci++;
    if (debtors[di].amt < 0.5) di++;
  }

  return { balances, total, transfers };
}

export function Avatar({
  member,
  idx,
  size = 30,
}: {
  member: BudgetMember;
  idx: number;
  size?: number;
}) {
  const hue = member.color || AV_HUES[idx % AV_HUES.length];
  return (
    <span
      className="gb-av"
      style={{ width: size, height: size, fontSize: size * 0.4, background: hue }}
    >
      {initials(member.name)}
    </span>
  );
}
