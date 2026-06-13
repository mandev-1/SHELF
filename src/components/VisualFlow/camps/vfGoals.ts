import type { StrategieState, VfGoal, VfGoalStatus, Debt } from "../../../types/grid";
import { fmtMoney } from "../../Strategie/strategie";

// ─── Trail geometry (percentage coords on the camps map) ─────────────────────
export const VF_START = { x: 7, y: 87 };
export const VF_END = { x: 96, y: 8 };
export const VF_SLOTS = [
  { x: 21, y: 73 }, { x: 28, y: 55 }, { x: 45, y: 46 },
  { x: 62, y: 41 }, { x: 72, y: 26 }, { x: 87, y: 14 },
];

export const VF_STATUS: { id: VfGoalStatus; label: string; hue: string }[] = [
  { id: "notstarted", label: "Not started", hue: "#8b8b95" },
  { id: "ontrack",    label: "On track",    hue: "var(--accent)" },
  { id: "atrisk",     label: "At risk",     hue: "#e0a020" },
  { id: "done",       label: "Reached",     hue: "#34c891" },
];
export const vfStatusMeta = (id: VfGoalStatus) => VF_STATUS.find((s) => s.id === id) ?? VF_STATUS[0];

/** Smooth trail through start → slots → horizon (catmull-rom → cubic beziers). */
export function vfTrailPath(): string {
  const pts = [VF_START, ...VF_SLOTS, VF_END];
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}` +
         `, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}` +
         `, ${p2.x} ${p2.y}`;
  }
  return d;
}

// ─── Live finance read (pots + debts with paid/remaining), READ-ONLY ─────────
export type VfPot = StrategieState["pots"][number];
export type VfDebt = Debt & { paid: number; remaining: number };
export interface VfFinance { pots: VfPot[]; debts: VfDebt[]; }

/** Compute pots + debt paid/remaining from the Strategie slice. Never mutates it. */
export function vfReadFinance(strategie: StrategieState): VfFinance {
  const byMonth = strategie.statements.byMonth;
  const debtPaid: Record<string, number> = {};
  for (const mo of Object.values(byMonth))
    for (const e of mo.expenses)
      if (e.debtId) debtPaid[e.debtId] = (debtPaid[e.debtId] ?? 0) + e.amt;
  const debts: VfDebt[] = (strategie.debts ?? []).map((d) => ({
    ...d,
    paid: Math.min(d.principal || 0, debtPaid[d.id] || 0),
    remaining: Math.max(0, (d.principal || 0) - (debtPaid[d.id] || 0)),
  }));
  return { pots: strategie.pots ?? [], debts };
}

export interface VfProgress { pct: number; auto: boolean; line: string; name: string | null; }

/** Resolve a goal's progress + supply line against the live money data. */
export function vfProgress(g: VfGoal, fin: VfFinance, currency: string): VfProgress {
  if (g.link?.type === "pot") {
    const p = fin.pots.find((x) => x.id === g.link!.id);
    if (p) {
      const pct = p.target > 0 ? Math.min(100, Math.round((p.saved / p.target) * 100)) : 0;
      return {
        pct, auto: pct >= 100,
        line: `${fmtMoney(p.saved, currency, { abbr: true })} of ${fmtMoney(p.target, currency, { abbr: true })} saved`,
        name: p.name,
      };
    }
  }
  if (g.link?.type === "debt") {
    const d = fin.debts.find((x) => x.id === g.link!.id);
    if (d) {
      const pct = d.principal > 0 ? Math.min(100, Math.round((d.paid / d.principal) * 100)) : 0;
      return {
        pct, auto: d.remaining <= 0,
        line: d.remaining <= 0 ? "paid off" : `${fmtMoney(d.remaining, currency, { abbr: true })} still owed`,
        name: d.name,
      };
    }
  }
  const ms = g.milestones ?? [];
  const done = ms.filter((m) => m.done).length;
  return { pct: ms.length ? Math.round((done / ms.length) * 100) : 0, auto: false, line: `${done} of ${ms.length} subgoals`, name: null };
}

export interface VfSmartCheck { k: string; label: string; ok: boolean; }

/** SMART meter — is this goal set well? (0–5). */
export function vfSmart(g: VfGoal, reached: boolean): { checks: VfSmartCheck[]; score: number } {
  const ms = g.milestones ?? [];
  const checks: VfSmartCheck[] = [
    { k: "S", label: "Specific — Point B named",                 ok: !!(g.outcome || "").trim() },
    { k: "M", label: "Measurable — wired to money or ≥2 subgoals", ok: !!g.link || ms.length >= 2 },
    { k: "A", label: "Achievable — clear next subgoal",          ok: reached || ms.some((m) => !m.done) },
    { k: "R", label: "Relevant — journal says why",              ok: !!(g.notes || "").trim() },
    { k: "T", label: "Time-bound — target date set",             ok: !!g.due },
  ];
  return { checks, score: checks.filter((c) => c.ok).length };
}
