"use client";

import { useState } from "react";
import type { BudgetTrip, BudgetMember } from "../lib/budget-types";
import { convert } from "../lib/currency";
import { fmt, AV_HUES, CATEGORY_HUE } from "../lib/budget-format";

// Desktop-only "spend per day" card: one stacked bar per day, under the Trend
// card in the left board column. The stack splits by who paid or by expense
// type (toggle top-right). Hidden ≤900px like the Trend card (.tc-spend rule);
// returns null until there's at least one dated expense.
export function DailyBars({ trip, members }: { trip: BudgetTrip; members: BudgetMember[] }) {
  const [mode, setMode] = useState<"payer" | "category">("payer");
  const main = trip.mainCurrency ?? "CZK";

  const hueOfMember = (id: string) => {
    const i = members.findIndex((m) => m.id === id);
    return i >= 0 ? members[i].color || AV_HUES[i % AV_HUES.length] : "#8fa5c4";
  };
  const keyOf = (paidBy: string, category?: string) =>
    mode === "payer" ? paidBy : category || "Other";
  const labelOf = (k: string) =>
    mode === "payer" ? members.find((m) => m.id === k)?.name ?? "?" : k;
  const hueFor = (k: string) => (mode === "payer" ? hueOfMember(k) : CATEGORY_HUE[k] || "#8fa5c4");

  // day → stack key → amount (main currency), plus per-key trip totals for the legend.
  const byDay = new Map<string, Map<string, number>>();
  const keyTotals = new Map<string, number>();
  for (const e of trip.expenses ?? []) {
    if (!e.date || e.settlement) continue; // settlements aren't spend
    const amt = convert(e.amount, e.currency, main);
    const k = keyOf(e.paidBy, e.category);
    const day = byDay.get(e.date) ?? new Map<string, number>();
    day.set(k, (day.get(k) ?? 0) + amt);
    byDay.set(e.date, day);
    keyTotals.set(k, (keyTotals.get(k) ?? 0) + amt);
  }
  const days = [...byDay.keys()].sort();
  if (days.length === 0) return null;

  const dayTotal = (d: string) => [...byDay.get(d)!.values()].reduce((s, v) => s + v, 0);
  const maxTotal = Math.max(...days.map(dayTotal)) || 1;
  // Stable stack order: biggest spender/type sits at the bottom of every bar.
  const keys = [...keyTotals.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);

  const lab = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en", { day: "numeric", month: "short" });

  return (
    <section className="tc-card tc-spend tc-daily">
      <div className="tc-head">
        <div>
          <div className="tc-eyebrow">By day</div>
          <div className="tc-title">Daily spend</div>
        </div>
        <div className="seg tc-daily-seg">
          <button
            type="button"
            className={`seg-btn${mode === "payer" ? " on" : ""}`}
            onClick={() => setMode("payer")}
          >
            Who paid
          </button>
          <button
            type="button"
            className={`seg-btn${mode === "category" ? " on" : ""}`}
            onClick={() => setMode("category")}
          >
            Type
          </button>
        </div>
      </div>

      <div className="tc-daily-bars">
        {days.map((d) => {
          const stack = byDay.get(d)!;
          const total = dayTotal(d);
          return (
            <div key={d} className="tc-daily-col">
              <span className="tc-daily-amt">{fmt(total, main)}</span>
              <div className="tc-daily-bar" title={`${lab(d)} · ${fmt(total, main)}`}>
                {keys
                  .filter((k) => (stack.get(k) ?? 0) > 0)
                  .map((k) => (
                    <span
                      key={k}
                      className="tc-daily-piece"
                      title={`${labelOf(k)}: ${fmt(stack.get(k)!, main)}`}
                      style={{
                        height: `${(stack.get(k)! / maxTotal) * 100}%`,
                        background: hueFor(k),
                      }}
                    />
                  ))}
              </div>
              <span className="tc-daily-lab">{lab(d)}</span>
            </div>
          );
        })}
      </div>

      <div className="tc-daily-legend">
        {keys.map((k) => (
          <span key={k} className="tc-daily-key">
            <span className="tc-daily-dot" style={{ background: hueFor(k) }} />
            {labelOf(k)} · {fmt(keyTotals.get(k)!, main)}
          </span>
        ))}
      </div>
    </section>
  );
}
