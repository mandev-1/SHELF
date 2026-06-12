# Current implementation — DailySpendChart (src/components/Strategie/charts.tsx)

```tsx
import { useRef, useState } from "react";
import { niceCeil, project, fmtMoney, monthAbbr, STMT_CATS, CAT_KEYS } from "./strategie";
import type { CatKey, MonthStatement } from "../../types/grid";

interface SpendItem { label: string; cat: CatKey; amt: number; day: string; }
const TIP_MAX_ITEMS = 24;

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

  // hover tooltip: which column, where (px within the rendered chart)
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [tip, setTip] = useState<{ col: number; x: number; y: number; flipX: boolean; flipY: boolean } | null>(null);

  // concatenate the months' calendars into one day axis, bucketing dated
  // expenses into day × category (base amounts) and keeping the rows
  // themselves per day for the hover breakdown
  const days: Partial<Record<CatKey, number>>[] = [];
  const dayItems: SpendItem[][] = [];
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
      dayItems.push([]);
      dayLabel.push(months.length > 1 ? `${monthAbbr(key)} ${d}` : `${d}.`);
    }
    for (const e of stmt.expenses) {
      if (e.savingsPlanId) continue; // savings contributions are transfers, not spending
      if (hiddenSet.has(e.cat)) continue;
      const d = e.date?.startsWith(key) ? Number(e.date.slice(8, 10)) : 0;
      if (d >= 1 && d <= dim) {
        days[base + d - 1][e.cat] = (days[base + d - 1][e.cat] ?? 0) + e.amt;
        dayItems[base + d - 1].push({ label: e.label, cat: e.cat, amt: e.amt, day: dayLabel[base + d - 1] });
      } else {
        undated += e.amt;
      }
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
  // all expense rows behind each column, biggest first (for the hover popup)
  const colItems: SpendItem[][] = Array.from({ length: totalCols }, () => []);
  dayItems.forEach((items, i) => { colItems[colIdxOf(i)].push(...items); });
  for (const items of colItems) items.sort((a, b) => b.amt - a.amt);

  // one handler on the svg: wrapper-relative coords (offsetX on svg children is
  // relative to the child, not the chart), column derived from the x position —
  // the popup tracks the mouse anywhere over the chart, gaps included
  const onSvgMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const vx = (x / rect.width) * W; // CSS px → viewBox units
    const col = Math.floor((vx - PAD.left) / slot);
    if (col < 0 || col >= totalCols || colTotals[col] <= 0) { setTip(null); return; }
    setTip({ col, x, y, flipX: x > rect.width * 0.6, flipY: y > rect.height * 0.45 });
  };

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
    <div className="dsp-wrap" ref={wrapRef}>
    <svg className="proj-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onMouseMove={onSvgMove} onMouseLeave={() => setTip(null)}>
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
                />
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
    {tip && colItems[tip.col]?.length > 0 && (
      <div
        className="dsp-tip"
        style={{
          left: tip.x + 14,
          top: tip.y + 14,
          transform: `${tip.flipX ? "translateX(calc(-100% - 28px))" : ""} ${tip.flipY ? "translateY(calc(-100% - 28px))" : ""}`,
        }}
      >
        <div className="dsp-tip-head">
          <b>{colLabel(tip.col)}</b>
          <span>{fmt(colTotals[tip.col])}</span>
        </div>
        {colItems[tip.col].slice(0, TIP_MAX_ITEMS).map((it, j) => (
          <div key={j} className="dsp-tip-row">
            <span className="dsp-cat-dot" style={{ background: (STMT_CATS[it.cat] || STMT_CATS.other).hue }} />
            <span className="dsp-tip-lab">{weekly ? `${it.day} · ` : ""}{it.label || "—"}</span>
            <span className="dsp-tip-amt">{fmt(it.amt)}</span>
          </div>
        ))}
        {colItems[tip.col].length > TIP_MAX_ITEMS && (
          <div className="dsp-tip-more">…+{colItems[tip.col].length - TIP_MAX_ITEMS} more</div>
        )}
      </div>
    )}
    </div>
  );
}
```

# Current CSS (src/index.css, .dsp-* block)

```css
.dsp-rect { opacity: 0.9; transition: opacity 0.12s; }
.dsp-rect:hover { opacity: 1; }
.dsp-mline { stroke: var(--line); stroke-width: 1; stroke-dasharray: 2 3; }
.dsp-wrap { position: relative; }
.dsp-tip {
  position: absolute; z-index: 6; pointer-events: none;
  min-width: 220px; max-width: 320px;
  padding: 9px 11px; border-radius: 10px;
  background: var(--surface-2); border: 1px solid var(--line-strong);
  box-shadow: 0 12px 32px -8px rgba(0,0,0,0.5);
  font-size: 11.5px;
}
.dsp-tip-head {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding-bottom: 6px; margin-bottom: 6px; border-bottom: 1px solid var(--line);
}
.dsp-tip-head b { font-size: 12px; color: var(--fg); }
.dsp-tip-head span { font-family: var(--mono); color: var(--fg-2); font-variant-numeric: tabular-nums; }
.dsp-tip-row { display: flex; align-items: center; gap: 7px; padding: 1.5px 0; }
.dsp-tip-lab { flex: 1; min-width: 0; color: var(--fg-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsp-tip-amt { font-family: var(--mono); font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
.dsp-tip-more { margin-top: 4px; font-size: 10.5px; color: var(--dim); }
.dsp-controls {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; flex-wrap: wrap; margin: 10px 0 2px;
}
.dsp-cats { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.dsp-cat {
  display: inline-flex; align-items: center; gap: 5px;
  font-family: inherit; font-size: 10.5px; font-weight: 600; cursor: pointer;
  padding: 3px 8px; border-radius: var(--r-pill);
  background: var(--surface-2); border: 1px solid var(--line); color: var(--fg-2);
  transition: opacity 0.13s, border-color 0.13s, color 0.13s;
}
.dsp-cat:hover { border-color: var(--line-strong); }
.dsp-cat.off { opacity: 0.4; }
.dsp-cat.off .dsp-cat-dot { background: var(--faint) !important; }
.dsp-cat-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.dsp-cat--reset { color: var(--dim); background: transparent; border-color: transparent; }
.dsp-cat--reset:hover { color: var(--fg-2); border-color: var(--line); }
.spend-avgline { stroke: var(--dim); stroke-width: 1.2; stroke-dasharray: 5 4; opacity: 0.7; }
```
