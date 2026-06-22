"use client";

import type { BudgetTrip } from "../lib/budget-types";
import { convert } from "../lib/currency";
import { fmt } from "../lib/budget-format";

// Desktop-only "evolution of spend" card: a cumulative spend curve over the trip,
// shown under "Who paid what" in the left board column (.tc-board-main). Hidden at
// ≤900px so the phone layout stays untouched (see budget.css). Returns null until
// there's at least one dated expense.
export function SpendTrend({ trip }: { trip: BudgetTrip }) {
  const main = trip.mainCurrency ?? "CZK";

  // Sum each day's expenses (converted to the trip's main currency), then run a
  // cumulative total across the days in date order.
  const byDay = new Map<string, number>();
  for (const e of trip.expenses ?? []) {
    if (!e.date) continue;
    byDay.set(e.date, (byDay.get(e.date) ?? 0) + convert(e.amount, e.currency, main));
  }
  const days = [...byDay.keys()].sort();
  if (days.length === 0) return null;

  let run = 0;
  const points = days.map((day) => ({ day, cum: (run += byDay.get(day)!) }));
  const total = run;

  // Always begin the curve at 0 — from the trip's start date when it precedes the
  // first expense, otherwise from the first expense day.
  const startDay = trip.startDate && trip.startDate <= points[0].day ? trip.startDate : points[0].day;
  const series = [{ day: startDay, cum: 0 }, ...points];

  // Plot space (the SVG stretches horizontally to the card; vertical is 1:1).
  const W = 600;
  const H = 150;
  const top = 12;
  const baseline = 140;
  const tOf = (iso: string) => new Date(`${iso}T00:00:00`).getTime();
  const ts = series.map((p) => tOf(p.day));
  const tMin = Math.min(...ts);
  const tMax = Math.max(...ts);
  const yMax = total || 1;
  // Time-based x, falling back to even index spacing when every point shares a day
  // (e.g. a single-day trip) so the curve never collapses to zero width.
  const xAt = (i: number, t: number) =>
    tMax === tMin
      ? series.length === 1
        ? W / 2
        : (i / (series.length - 1)) * W
      : ((t - tMin) / (tMax - tMin)) * W;
  const yAt = (c: number) => baseline - (c / yMax) * (baseline - top);

  const xy = series.map((p, i) => [round(xAt(i, ts[i])), round(yAt(p.cum))] as const);
  const line = xy.map(([x, y]) => `${x},${y}`).join(" ");
  const area =
    `M${xy[0][0]},${baseline} ` +
    xy.map(([x, y]) => `L${x},${y}`).join(" ") +
    ` L${xy[xy.length - 1][0]},${baseline} Z`;
  const gid = `spend-grad-${trip.id}`;

  const lab = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("en", { day: "numeric", month: "short" });

  return (
    <section className="tc-card tc-spend">
      <div className="tc-head">
        <div>
          <div className="tc-eyebrow">Trend</div>
          <div className="tc-title">Spend over time</div>
        </div>
        <div className="tc-spend-total">{fmt(total, main)}</div>
      </div>
      <div className="tc-spend-chart">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gid})`} />
          <polyline
            points={line}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="tc-spend-axis">
          <span>{lab(series[0].day)}</span>
          <span>{lab(points[points.length - 1].day)}</span>
        </div>
      </div>
    </section>
  );
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}
