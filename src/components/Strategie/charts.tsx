import { niceCeil, project, fmtMoney, STMT_CATS, CAT_KEYS } from "./strategie";
import type { CatKey, MonthStatement } from "../../types/grid";

/** Per-day spending for one month: stacked bars, one stack segment per category. */
export function DailySpendChart({ stmt, monthKey, cur }: { stmt: MonthStatement; monthKey: string; cur: string }) {
  const W = 760; const H = 220;
  const PAD = { top: 16, right: 20, bottom: 28, left: 52 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;

  const [yy, mm] = monthKey.split("-").map(Number);
  const daysInMonth = yy && mm ? new Date(yy, mm, 0).getDate() : 31;

  // bucket dated expenses of this month into day × category (base amounts)
  const days: Partial<Record<CatKey, number>>[] = Array.from({ length: daysInMonth }, () => ({}));
  let undated = 0;
  for (const e of stmt.expenses) {
    if (e.savingsPlanId) continue; // savings contributions are transfers, not spending
    const d = e.date?.startsWith(monthKey) ? Number(e.date.slice(8, 10)) : 0;
    if (d >= 1 && d <= daysInMonth) days[d - 1][e.cat] = (days[d - 1][e.cat] ?? 0) + e.amt;
    else undated += e.amt;
  }

  const dayTotals = days.map((d) => CAT_KEYS.reduce((s, k) => s + (d[k] ?? 0), 0));
  const monthTotal = dayTotals.reduce((a, b) => a + b, 0);
  if (monthTotal <= 0) {
    return (
      <div style={{ padding: 20, fontSize: 12, color: "var(--faint)" }}>
        No dated expenses in {monthKey} yet — import a statement to see daily spending.
      </div>
    );
  }

  const yMax = niceCeil(Math.max(...dayTotals, 1));
  const avg = monthTotal / daysInMonth;
  const yOf = (v: number) => PAD.top + ch - (v / yMax) * ch;
  const slot = cw / daysInMonth;
  const barW = Math.max(3, slot * 0.62);
  const xOf = (dayIdx: number) => PAD.left + dayIdx * slot + (slot - barW) / 2;

  const fmt = (v: number) => fmtMoney(v, cur, { abbr: true });
  const avgY = yOf(avg);
  const yTicks = 4;
  const xLabelDays = [1, 5, 10, 15, 20, 25, daysInMonth].filter((d, i, a) => d <= daysInMonth && a.indexOf(d) === i);

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
      {xLabelDays.map((d) => (
        <text key={d} className="proj-xlab" x={xOf(d - 1) + barW / 2} y={H - 4}>{d}</text>
      ))}
      {days.map((d, i) => {
        if (dayTotals[i] <= 0) return null;
        let acc = 0;
        return (
          <g key={i}>
            {CAT_KEYS.map((k) => {
              const v = d[k] ?? 0;
              if (v <= 0) return null;
              const y0 = yOf(acc);
              acc += v;
              const y1 = yOf(acc);
              return (
                <rect
                  key={k}
                  className="dsp-rect"
                  x={xOf(i)} y={y1}
                  width={barW} height={Math.max(1, y0 - y1)}
                  rx={1.5}
                  fill={STMT_CATS[k].hue}
                >
                  <title>{`${i + 1}. — ${STMT_CATS[k].label}: ${fmt(v)} (day total ${fmt(dayTotals[i])})`}</title>
                </rect>
              );
            })}
          </g>
        );
      })}
      <line className="spend-avgline" x1={PAD.left} y1={avgY} x2={W - PAD.right} y2={avgY} />
      <text className="spend-avglab" x={PAD.left + 4} y={avgY - 5}>avg/day</text>
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
