import { niceCeil, project, fmtMoney, monthAbbr, STMT_CATS, CAT_KEYS } from "./strategie";
import type { CatKey, MonthStatement } from "../../types/grid";

/** Per-day spending: stacked bars, one stack segment per category. Accepts one
 *  or more consecutive months (the range selector concatenates them on one
 *  axis). `hidden` categories are left out of bars, totals, scale and average.
 *  H matches the projection face's chart+controls envelope so the flip card's
 *  back face fills the same height (no dead space under the chart). */
export function DailySpendChart({ months, cur, hidden = [] }: {
  months: { key: string; stmt: MonthStatement }[];
  cur: string;
  hidden?: CatKey[];
}) {
  const W = 760; const H = 330;
  const PAD = { top: 16, right: 20, bottom: 28, left: 52 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;

  const hiddenSet = new Set(hidden);

  // concatenate the months' calendars into one day axis, bucketing dated
  // expenses into day × category (base amounts)
  const days: Partial<Record<CatKey, number>>[] = [];
  const dayLabel: string[] = [];
  const monthStarts: { idx: number; key: string; dim: number }[] = [];
  let undated = 0;
  for (const { key, stmt } of months) {
    const [yy, mm] = key.split("-").map(Number);
    const dim = yy && mm ? new Date(yy, mm, 0).getDate() : 31;
    const base = days.length;
    monthStarts.push({ idx: base, key, dim });
    for (let d = 1; d <= dim; d++) {
      days.push({});
      dayLabel.push(months.length > 1 ? `${monthAbbr(key)} ${d}` : `${d}.`);
    }
    for (const e of stmt.expenses) {
      if (e.savingsPlanId) continue; // savings contributions are transfers, not spending
      if (hiddenSet.has(e.cat)) continue;
      const d = e.date?.startsWith(key) ? Number(e.date.slice(8, 10)) : 0;
      if (d >= 1 && d <= dim) days[base + d - 1][e.cat] = (days[base + d - 1][e.cat] ?? 0) + e.amt;
      else undated += e.amt;
    }
  }

  const totalDays = days.length;
  const rangeTotal = days.reduce((s, d) => s + CAT_KEYS.reduce((a, k) => a + (d[k] ?? 0), 0), 0);
  if (rangeTotal <= 0 || totalDays === 0) {
    return (
      <div style={{ padding: 20, fontSize: 12, color: "var(--faint)" }}>
        Nothing to show — no dated expenses in this range{hidden.length > 0 ? " (some categories are hidden)" : ""}.
      </div>
    );
  }

  // long ranges (6 months+) get one column per calendar week (Monday-aligned)
  // instead of per day — daily slivers stop being readable around there
  const weekly = months.length >= 6;
  const [y0, m0] = months[0].key.split("-").map(Number);
  const startDate = new Date(y0, (m0 || 1) - 1, 1);
  const offset = weekly ? (startDate.getDay() + 6) % 7 : 0; // days since Monday
  const unit = weekly ? 7 : 1;
  const totalCols = Math.ceil((totalDays + offset) / unit);
  const colIdxOf = (dayIdx: number) => Math.floor((dayIdx + offset) / unit);

  const cols: Partial<Record<CatKey, number>>[] = Array.from({ length: totalCols }, () => ({}));
  days.forEach((d, i) => {
    const c = colIdxOf(i);
    for (const k of CAT_KEYS) {
      const v = d[k] ?? 0;
      if (v > 0) cols[c][k] = (cols[c][k] ?? 0) + v;
    }
  });
  const colTotals = cols.map((d) => CAT_KEYS.reduce((s, k) => s + (d[k] ?? 0), 0));
  const colLabel = (c: number): string => {
    if (!weekly) return dayLabel[c];
    const monday = new Date(y0, (m0 || 1) - 1, 1 + (c * 7 - offset));
    return `wk of ${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  };

  // scale to the data: the tallest column IS the top of the chart (no rounded-up headroom)
  const yMax = Math.max(...colTotals, 1);
  const avg = rangeTotal / totalCols;
  const yOf = (v: number) => PAD.top + ch - (v / yMax) * ch;
  const slot = cw / totalCols;
  const barW = Math.max(1.5, slot * 0.62);
  const xOf = (col: number) => PAD.left + col * slot + (slot - barW) / 2;
  // day-index → fractional column position, for month labels / boundary lines
  const colPosOf = (dayIdx: number) => (dayIdx + offset) / unit;

  const fmt = (v: number) => fmtMoney(v, cur, { abbr: true });
  const avgY = yOf(avg);
  const yTicks = 5;
  const singleDim = monthStarts[0]?.dim ?? 31;
  const xLabelDays = [1, 5, 10, 15, 20, 25, singleDim].filter((d, i, a) => d <= singleDim && a.indexOf(d) === i);

  return (
    <svg className="proj-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <g className="proj-grid">
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const v = (yMax / yTicks) * i;
          return <line key={i} x1={PAD.left} y1={yOf(v)} x2={W - PAD.right} y2={yOf(v)} />;
        })}
      </g>
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const v = (yMax / yTicks) * i;
        return <text key={i} className="proj-ylab" x={PAD.left - 6} y={yOf(v) + 4}>{v > 0 ? fmt(v) : "0"}</text>;
      })}
      {months.length === 1
        ? xLabelDays.map((d) => (
            <text key={d} className="proj-xlab" x={xOf(d - 1) + barW / 2} y={H - 4}>{d}</text>
          ))
        : monthStarts.map((ms) => (
            <text key={ms.key} className="proj-xlab" x={PAD.left + colPosOf(ms.idx + ms.dim / 2) * slot} y={H - 4}>
              {monthAbbr(ms.key)}
            </text>
          ))}
      {months.length > 1 && monthStarts.slice(1).map((ms) => (
        <line
          key={ms.key}
          className="dsp-mline"
          x1={PAD.left + colPosOf(ms.idx) * slot} y1={PAD.top}
          x2={PAD.left + colPosOf(ms.idx) * slot} y2={PAD.top + ch}
        />
      ))}
      {cols.map((d, i) => {
        if (colTotals[i] <= 0) return null;
        let acc = 0;
        return (
          <g key={i}>
            {CAT_KEYS.map((k) => {
              const v = d[k] ?? 0;
              if (v <= 0) return null;
              const yA = yOf(acc);
              acc += v;
              const yB = yOf(acc);
              return (
                <rect
                  key={k}
                  className="dsp-rect"
                  x={xOf(i)} y={yB}
                  width={barW} height={Math.max(1, yA - yB)}
                  rx={1.5}
                  fill={STMT_CATS[k].hue}
                >
                  <title>{`${colLabel(i)} — ${STMT_CATS[k].label}: ${fmt(v)} (${weekly ? "week" : "day"} total ${fmt(colTotals[i])})`}</title>
                </rect>
              );
            })}
          </g>
        );
      })}
      <line className="spend-avgline" x1={PAD.left} y1={avgY} x2={W - PAD.right} y2={avgY} />
      <text className="spend-avglab" x={PAD.left + 4} y={avgY - 5}>{weekly ? "avg/wk" : "avg/day"}</text>
      {undated > 0 && (
        <text className="proj-xlab" x={W - PAD.right} y={PAD.top - 4} style={{ fill: "var(--faint)", textAnchor: "end" }}>
          +{fmt(undated)} without a date (not shown)
        </text>
      )}
    </svg>
  );
}

export function ProjectionChart({
  principal, monthly, scenarioRate, horizon,
}: {
  principal: number; monthly: number; scenarioRate: number; horizon: number;
}) {
  const W = 760; const H = 300;
  const PAD = { top: 20, right: 20, bottom: 36, left: 60 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;

  const pts = project(principal, monthly, scenarioRate, horizon);
  if (!pts.length) return null;

  const maxBal = pts[pts.length - 1].bal;
  const yMax = niceCeil(maxBal);

  const xOf = (m: number) => PAD.left + ((m - 1) / Math.max(horizon - 1, 1)) * cw;
  const yOf = (v: number) => PAD.top + ch - (v / yMax) * ch;

  const areaTotal: string[] = [];
  const lineTotal: string[] = [];
  const areaContrib: string[] = [];
  const lineContrib: string[] = [];

  pts.forEach((p, i) => {
    const x = xOf(p.m);
    const yBal = yOf(p.bal);
    const yCon = yOf(p.contrib);
    if (i === 0) {
      areaTotal.push(`M${x},${yOf(0)}`);
      areaContrib.push(`M${x},${yOf(0)}`);
    }
    areaTotal.push(`L${x},${yBal}`);
    lineTotal.push(i === 0 ? `M${x},${yBal}` : `L${x},${yBal}`);
    areaContrib.push(`L${x},${yCon}`);
    lineContrib.push(i === 0 ? `M${x},${yCon}` : `L${x},${yCon}`);
  });
  const lastX = xOf(pts[pts.length - 1].m);
  areaTotal.push(`L${lastX},${yOf(0)}Z`);
  areaContrib.push(`L${lastX},${yOf(0)}Z`);

  const yTicks = 5;
  const xTickCount = Math.min(horizon, 7);

  return (
    <svg className="proj-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <g className="proj-grid">
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const v = (yMax / yTicks) * i;
          const y = yOf(v);
          return <line key={i} x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} />;
        })}
      </g>
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const v = (yMax / yTicks) * i;
        return (
          <text key={i} className="proj-ylab" x={PAD.left - 6} y={yOf(v) + 4}>
            {v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
          </text>
        );
      })}
      {Array.from({ length: xTickCount }, (_, i) => {
        const m = Math.round(1 + (i / Math.max(xTickCount - 1, 1)) * (horizon - 1));
        return (
          <text key={i} className="proj-xlab" x={xOf(m)} y={H - 6}>
            {`Yr ${Math.round(m / 12)}`}
          </text>
        );
      })}
      <path className="proj-area-total"   d={areaTotal.join(" ")} />
      <path className="proj-area-contrib" d={areaContrib.join(" ")} />
      <path className="proj-line-contrib" d={lineContrib.join(" ")} />
      <path className="proj-line-total"   d={lineTotal.join(" ")} />
      <circle className="proj-dot" cx={xOf(pts[pts.length - 1].m)} cy={yOf(pts[pts.length - 1].bal)} r={4} />
    </svg>
  );
}
