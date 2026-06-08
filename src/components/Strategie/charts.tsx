import { niceCeil, project } from "./strategie";

export function SpendingChart({ series }: { series: { label: string; total: number }[] }) {
  const W = 760; const H = 220;
  const PAD = { top: 16, right: 20, bottom: 28, left: 52 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;
  if (series.length < 2) return <div style={{ padding: 20, fontSize: 12, color: "var(--faint)" }}>Not enough data.</div>;
  const maxVal = Math.max(...series.map((s) => s.total), 1);
  const avg = series.reduce((s, p) => s + p.total, 0) / series.length;
  const yMax = niceCeil(maxVal);
  const xOf = (i: number) => PAD.left + (i / (series.length - 1)) * cw;
  const yOf = (v: number) => PAD.top + ch - (v / yMax) * ch;
  const area: string[] = [];
  const line: string[] = [];
  series.forEach((p, i) => {
    const x = xOf(i); const y = yOf(p.total);
    if (i === 0) { area.push(`M${x},${yOf(0)}`); }
    area.push(`L${x},${y}`);
    line.push(i === 0 ? `M${x},${y}` : `L${x},${y}`);
  });
  area.push(`L${xOf(series.length - 1)},${yOf(0)}Z`);
  const avgY = yOf(avg);
  const yTicks = 4;
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
        return <text key={i} className="proj-ylab" x={PAD.left - 6} y={yOf(v) + 4}>{v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}</text>;
      })}
      {series.map((p, i) => (
        <text key={i} className="proj-xlab" x={xOf(i)} y={H - 4}>{p.label}</text>
      ))}
      <path className="spend-area" d={area.join(" ")} />
      <path className="spend-line" d={line.join(" ")} />
      <line className="spend-avgline" x1={PAD.left} y1={avgY} x2={W - PAD.right} y2={avgY} />
      <text className="spend-avglab" x={PAD.left + 4} y={avgY - 5}>avg</text>
      {series.map((p, i) => {
        const x = xOf(i); const y = yOf(p.total);
        return i === series.length - 1
          ? <circle key={i} className="spend-dot-end" cx={x} cy={y} r={5} />
          : <circle key={i} className="spend-dot" cx={x} cy={y} r={3} />;
      })}
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
