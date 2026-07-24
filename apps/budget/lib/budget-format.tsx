// Shared budget helpers — extracted so the Trips components and BudgetPanel
// share one settle-up engine, formatting, and avatar. (BudgetPanel keeps its
// own private copies; these are the canonical versions for new components.)

import { useEffect, useRef, useState, type ReactNode } from "react";
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

// Category → dot/segment hue (ledger dots, daily-spend bars). Handoff 009.
export const CATEGORY_HUE: Record<string, string> = {
  Groceries: "#34c891",
  Dining: "#e0905a",
  Coffee: "#8d6748",
  Drinks: "#d4a017",
  Transport: "#0070f2",
  Housing: "#a384df",
  Fun: "#e07a93",
  Health: "#16b6c8",
  Fees: "#8fa5c4",
  Other: "#5e7698",
  Settlement: "#2fb46b",
};

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

/** Per-member owed shares for ONE expense — the exact math computeBalances
 *  uses (custom amounts > per-expense basis > group basis), exported so UI can
 *  show a line-by-line breakdown that's guaranteed to match the engine. */
export function expenseShares(
  members: BudgetMember[],
  e: BudgetExpense,
  splitBasis: BudgetSplitBasis,
): Map<string, number> {
  const out = new Map<string, number>();
  if (e.amount <= 0) return out;
  const byId = new Map(members.map((m) => [m.id, m]));
  const among = (e.splitAmong.length ? e.splitAmong : members.map((m) => m.id)).filter((id) =>
    byId.has(id),
  );
  if (among.length === 0) return out;
  const basis = e.basis ?? splitBasis;
  const cw = e.customWeights;
  let weights =
    cw && among.some((id) => typeof cw[id] === "number" && cw[id]! > 0)
      ? among.map((id) => ({ id, w: Math.max(0, cw[id] ?? 0) }))
      : among.map((id) => ({ id, w: memberWeight(byId.get(id)!, basis) }));
  let totalW = weights.reduce((s, x) => s + x.w, 0);
  if (totalW <= 0) {
    weights = among.map((id) => ({ id, w: 1 }));
    totalW = among.length;
  }
  for (const { id, w } of weights) out.set(id, (e.amount * w) / totalW);
  return out;
}

/** Per-member balances + greedy settle-up transfers for a member/expense set. */
export function computeBalances(
  members: BudgetMember[],
  expenses: BudgetExpense[],
  splitBasis: BudgetSplitBasis,
): { balances: Balance[]; total: number; transfers: Transfer[] } {
  const paid = new Map<string, number>();
  const owed = new Map<string, number>();
  members.forEach((m) => {
    paid.set(m.id, 0);
    owed.set(m.id, 0);
  });
  let total = 0;

  for (const e of expenses) {
    if (e.amount <= 0) continue;
    // Settlements shift balances (payer up, recipient down) but aren't spending.
    if (!e.settlement) total += e.amount;
    paid.set(e.paidBy, (paid.get(e.paidBy) ?? 0) + e.amount);
    for (const [id, share] of expenseShares(members, e, splitBasis)) {
      owed.set(id, (owed.get(id) ?? 0) + share);
    }
  }

  const balances: Balance[] = members.map((m) => {
    const p = paid.get(m.id) ?? 0;
    const o = owed.get(m.id) ?? 0;
    return { member: m, paid: p, owed: o, net: p - o };
  });

  return { balances, total, transfers: greedyTransfers(balances) };
}

/** Fewest-payments plan: repeatedly match the biggest debtor to the biggest
 *  creditor until everyone is square. The default reconcile mode. */
export function greedyTransfers(balances: Balance[]): Transfer[] {
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
  return transfers;
}

/** "Banker" plan: everyone settles through one person — debtors pay the hub,
 *  the hub pays out everyone who is owed. Falls back to greedy without a hub. */
export function hubTransfers(balances: Balance[], hubId: string): Transfer[] {
  const hub = balances.find((b) => b.member.id === hubId)?.member;
  if (!hub) return greedyTransfers(balances);
  const out: Transfer[] = [];
  for (const b of balances) {
    if (b.member.id === hubId) continue;
    if (b.net < -0.5) out.push({ from: b.member, to: hub, amount: -b.net });
    else if (b.net > 0.5) out.push({ from: hub, to: b.member, amount: b.net });
  }
  return out.sort((a, b) => b.amount - a.amount);
}

/** Rules plan: each debtor only pays the people on their `payTo` list
 *  ("I will only pay Mark and Petra"). Debt that can't reach a creditor
 *  directly is forwarded one hop along an allowed pair (the receiver settles
 *  it onward), so money still flows to whoever is owed. If the rules make a
 *  route impossible (cycles), the leftover closes unrestricted — the plan
 *  always squares the trip. */
export function constrainedTransfers(
  balances: Balance[],
  payTo: Record<string, string[]>,
): Transfer[] {
  const byId = new Map(balances.map((b) => [b.member.id, b.member]));
  const nets = new Map(balances.map((b) => [b.member.id, b.net]));
  const ids = balances.map((b) => b.member.id);
  // No rule = pays anyone; an explicit empty list = pays NO ONE (debt stays open).
  const allowedOf = (id: string) => {
    const raw = payTo[id];
    if (raw === undefined) return ids.filter((x) => x !== id);
    return raw.filter((x) => byId.has(x) && x !== id);
  };

  const flow = new Map<string, number>();
  const push = (from: string, to: string, amt: number) => {
    flow.set(`${from}|${to}`, (flow.get(`${from}|${to}`) ?? 0) + amt);
    nets.set(from, (nets.get(from) ?? 0) + amt);
    nets.set(to, (nets.get(to) ?? 0) - amt);
  };

  for (let round = 0; round < balances.length + 2; round++) {
    const debtors = ids
      .filter((id) => (nets.get(id) ?? 0) < -0.5)
      .sort((a, b) => nets.get(a)! - nets.get(b)!);
    if (!debtors.length) break;
    for (const d of debtors) {
      // First fill allowed creditors (biggest credit first)…
      const targets = allowedOf(d)
        .map((id) => ({ id, credit: nets.get(id) ?? 0 }))
        .filter((t) => t.credit > 0.5)
        .sort((x, y) => y.credit - x.credit);
      for (const t of targets) {
        const owe = -(nets.get(d) ?? 0);
        if (owe <= 0.5) break;
        push(d, t.id, Math.min(owe, t.credit));
      }
      // …then forward what's left to the least-indebted allowed person, who
      // settles it onward next round.
      const owe = -(nets.get(d) ?? 0);
      if (owe > 0.5) {
        const fwd = allowedOf(d).sort((a, b) => (nets.get(b) ?? 0) - (nets.get(a) ?? 0))[0];
        if (fwd) push(d, fwd, owe);
      }
    }
  }
  // Close anything the rules couldn't route (e.g. mutual-only cycles) — but a
  // "pays no one" member's debt is deliberately left open, never force-closed.
  const rem = balances.map((b) => {
    const net = nets.get(b.member.id) ?? 0;
    const noPay = net < -0.5 && allowedOf(b.member.id).length === 0;
    return { ...b, net: noPay ? 0 : net };
  });
  for (const t of greedyTransfers(rem)) push(t.from.id, t.to.id, t.amount);

  // Net opposite flows (A→B minus B→A) into the final transfer list.
  const out: Transfer[] = [];
  const seen = new Set<string>();
  for (const [k, v] of flow) {
    if (seen.has(k)) continue;
    const [f, t] = k.split("|");
    const back = flow.get(`${t}|${f}`) ?? 0;
    seen.add(k);
    seen.add(`${t}|${f}`);
    const net = v - back;
    if (net > 0.5) out.push({ from: byId.get(f)!, to: byId.get(t)!, amount: net });
    else if (net < -0.5) out.push({ from: byId.get(t)!, to: byId.get(f)!, amount: -net });
  }
  return out.sort((a, b) => b.amount - a.amount);
}

/** Pair-by-pair plan: each pair settles directly what one fronted for the
 *  other (netted within the pair), so every payment is self-explanatory. */
export function pairwiseTransfers(
  members: BudgetMember[],
  expenses: BudgetExpense[],
  splitBasis: BudgetSplitBasis,
): Transfer[] {
  // owes[a][b] = how much a owes b (b fronted a's share, or a received b's settlement)
  const owes = new Map<string, Map<string, number>>();
  const add = (a: string, b: string, amt: number) => {
    const m = owes.get(a) ?? new Map<string, number>();
    m.set(b, (m.get(b) ?? 0) + amt);
    owes.set(a, m);
  };
  for (const e of expenses) {
    if (e.amount <= 0) continue;
    for (const [id, share] of expenseShares(members, e, splitBasis)) {
      if (id !== e.paidBy) add(id, e.paidBy, share);
    }
  }
  const out: Transfer[] = [];
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i];
      const b = members[j];
      const net = (owes.get(a.id)?.get(b.id) ?? 0) - (owes.get(b.id)?.get(a.id) ?? 0);
      if (net > 0.5) out.push({ from: a, to: b, amount: net });
      else if (net < -0.5) out.push({ from: b, to: a, amount: -net });
    }
  }
  return out.sort((a, b) => b.amount - a.amount);
}

/** Animated stat number (handoff 0001): eases to new values over 650 ms with a
 *  cubic ease-out; renders via the caller's formatter so rounding/format is
 *  unchanged. No animation on first mount — only on value change; a change
 *  mid-flight restarts from the currently displayed value. */
export function CountUp({ value, fmt }: { value: number; fmt: (v: number) => ReactNode }) {
  const [v, setV] = useState(value);
  const shown = useRef(value);
  shown.current = v;
  useEffect(() => {
    const from = shown.current, to = value;
    if (from === to) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 650);
      const e = 1 - Math.pow(1 - k, 3); // cubic ease-out
      setV(from + (to - from) * e);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{fmt(v)}</>;
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
