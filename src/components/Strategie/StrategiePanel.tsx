import { useState, useRef, useEffect, useCallback } from "react";
import type { StrategieState, MonthStatement, CatKey, BuylistItem, MembershipRow } from "../../types/grid";
import {
  daysInMonth as _daysInMonth,
  monthWeeks, weekOfDate,
  monthLabel, monthAbbr, project, fmtMoney,
  niceCeil, STMT_CATS, CAT_KEYS,
  RETURN_SCENARIOS, DEFAULT_LADDER, DEFAULT_ALLOCATION, DEFAULT_PILLARS,
  DEFAULT_STATEMENTS, CURRENCIES,
} from "./strategie";
import type { LadderRung } from "./strategie";
import { IcoCheck, IcoLock, IcoPlus, IcoFile, IcoHopper, IcoUpload, IcoFlip, IcoX, IcoChev,
  IcoShield, IcoFlame, IcoGift, IcoVault, IcoGrowth, IcoTarget, IcoLeaf } from "./icons";
import { StatementEditor } from "./StatementEditor";

void _daysInMonth;

// ─── Props ────────────────────────────────────────────────────────────────────
interface StrategiePanelProps {
  state: StrategieState;
  buylistItems: BuylistItem[];
  extraAssets?: number;
  onSaveStatement: (
    book: Record<string, MonthStatement>,
    order: string[],
    active: string,
    memberships: MembershipRow[],
  ) => void;
  onAddPot: (name: string) => void;
  onSetCurrency: (c: string) => void;
  onToast?: (msg: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function totalIncome(stmt: MonthStatement) {
  return stmt.income.reduce((s, r) => s + r.amt, 0);
}
function totalExpenses(stmt: MonthStatement) {
  return stmt.expenses.reduce((s, r) => s + r.amt, 0);
}
function expensesByCat(stmt: MonthStatement): Record<CatKey, number> {
  const out = {} as Record<CatKey, number>;
  for (const k of CAT_KEYS) out[k] = 0;
  for (const e of stmt.expenses) out[e.cat] = (out[e.cat] ?? 0) + e.amt;
  return out;
}

// ─── Rung icon ────────────────────────────────────────────────────────────────
function RungIcon({ icon }: { icon?: string }) {
  switch (icon) {
    case "shield": return <IcoShield />;
    case "flame":  return <IcoFlame />;
    case "gift":   return <IcoGift />;
    case "vault":  return <IcoVault />;
    case "growth": return <IcoGrowth />;
    case "leaf":   return <IcoLeaf />;
    case "target": return <IcoTarget />;
    default:       return null;
  }
}

// ─── SpendingChart ────────────────────────────────────────────────────────────
function SpendingChart({ series }: { series: { label: string; total: number }[] }) {
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

// ─── LadderDetail modal ───────────────────────────────────────────────────────
function LadderDetail({ rung, currency, onClose }: { rung: LadderRung; currency: string; onClose: () => void }) {
  const statusClass = rung.status === "done" ? "ld-status--done" : rung.status === "active" ? "ld-status--active" : "ld-status--queued";
  const statusLabel = rung.status === "done" ? "Complete" : rung.status === "active" ? "In progress" : "Queued";
  return (
    <div className="ld-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ld-modal" style={{ ["--ld-hue" as string]: rung.hue ?? "var(--accent)" }}>
        <div className="ld-hero">
          <div className="ld-hero-wash" />
          <div className="ld-hero-ghost"><RungIcon icon={rung.icon} /></div>
          <button className="ld-close" onClick={onClose}><IcoX /></button>
          <div className="ld-step-num">Step {rung.id}</div>
          <div className="ld-title">{rung.title}</div>
          <div className={`ld-status ${statusClass}`}>{statusLabel}</div>
          {rung.status === "active" && typeof rung.pct === "number" && (
            <div className="rung-bar" style={{ marginTop: 10, maxWidth: 200 }}>
              <span style={{ width: `${rung.pct}%` }} />
            </div>
          )}
        </div>
        <div className="ld-body">
          {rung.blurb && <p className="ld-blurb">{rung.blurb}</p>}
          {(rung.accounts?.length ?? 0) > 0 && (
            <div>
              <div className="ld-section-head">Where the money sits</div>
              <div className="ld-accounts">
                {rung.accounts!.map((acc, i) => (
                  <div key={i} className="ld-account-row">
                    <div className="ld-account-name">{acc.name}</div>
                    <div className="ld-account-tag">{acc.tag}</div>
                    <div className="ld-account-bal">{fmtMoney(acc.balance, currency, { abbr: true })}</div>
                    {acc.target && (
                      <div style={{ flex: "0 0 60px" }}>
                        <div className="ld-account-progress">
                          <span style={{ width: `${Math.min(100, (acc.balance / acc.target) * 100)}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {(rung.history?.length ?? 0) > 0 && (
            <div>
              <div className="ld-section-head">History</div>
              <div className="ld-history">
                {[...rung.history!].reverse().map((h, i) => (
                  <div key={i} className="ld-hist-row">
                    <div className="ld-hist-dot" />
                    <div className="ld-hist-date">{h.date}</div>
                    <div className="ld-hist-label">{h.label}</div>
                    {h.amt > 0 && <div className="ld-hist-amt">{fmtMoney(h.amt, currency, { abbr: true })}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ProjectionChart ─────────────────────────────────────────────────────────
function ProjectionChart({
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


// ─── Main Panel ───────────────────────────────────────────────────────────────
export function StrategiePanel({
  state,
  buylistItems,
  extraAssets = 0,
  onSaveStatement,
  onAddPot,
  onSetCurrency,
  onToast,
}: StrategiePanelProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [potMenuOpen, setPotMenuOpen] = useState(false);
  const potMenuRef = useRef<HTMLDivElement>(null);

  const [scenarioId, setScenarioId] = useState("balanced");
  const [horizon, setHorizon] = useState(120);
  const [monthly, setMonthly] = useState(300);
  const [heroFace, setHeroFace] = useState<"grow" | "spend">("grow");
  const [detailRung, setDetailRung] = useState<LadderRung | null>(null);

  const { statements, positions, pots, currency } = state;
  const cur = currency;

  const byMonth: Record<string, MonthStatement> =
    Object.keys(statements.byMonth).length > 0
      ? statements.byMonth
      : DEFAULT_STATEMENTS;

  const activeKey = statements.current in byMonth
    ? statements.current
    : (statements.order[0] ?? "2026-04");
  const stmt = byMonth[activeKey] ?? { income: [], expenses: [] };

  const inc = totalIncome(stmt);
  const exp = totalExpenses(stmt);
  const surplus = inc - exp;
  void Math.min(200, surplus > 0 ? surplus : 0); // toPots removed from KPI

  const scenario = RETURN_SCENARIOS.find((s) => s.id === scenarioId) ?? RETURN_SCENARIOS[1];
  const projPts = project(positions.invested, monthly, scenario.rate, horizon);
  const projFinal = projPts[projPts.length - 1]?.bal ?? positions.invested;

  const byCat = expensesByCat(stmt);
  const totalExp = exp || 1;
  const emergencyPct = Math.min(100, Math.round((positions.emergencySaved / positions.emergencyTarget) * 100));

  const netWorth = positions.invested + positions.emergencySaved + extraAssets;

  const spendSeries = Object.keys(byMonth)
    .sort()
    .map((k) => ({ label: monthAbbr(k), total: totalExpenses(byMonth[k]) }));

  useEffect(() => {
    if (!potMenuOpen) return;
    function handle(e: MouseEvent) {
      if (potMenuRef.current && !potMenuRef.current.contains(e.target as Node)) {
        setPotMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [potMenuOpen]);

  const handleAddFromHopper = useCallback((item: BuylistItem) => {
    onAddPot(item.title);
    setPotMenuOpen(false);
    onToast?.(`Added pot: ${item.title}`);
  }, [onAddPot, onToast]);

  const handleAddBlankPot = useCallback(() => {
    const name = window.prompt("Pot name:");
    if (name?.trim()) onAddPot(name.trim());
    setPotMenuOpen(false);
  }, [onAddPot]);

  const allWeeks = monthWeeks(activeKey);

  return (
    <div className="strat">
      {/* header */}
      <div className="strat-head">
        <div>
          <div className="strat-eyebrow">Strategie · Life &amp; capital plan</div>
          <div className="strat-title">Your 5-year strategy</div>
        </div>
        <div className="strat-tools">
          <div className="seg">
            {Object.keys(CURRENCIES).slice(0, 6).map((c) => (
              <button key={c} className={`seg-btn${cur === c ? " on" : ""}`} onClick={() => onSetCurrency(c)}>{c}</button>
            ))}
          </div>
          <button
            className={`ghost-btn${Object.keys(statements.byMonth).length > 0 ? " ok" : ""}`}
            onClick={() => setEditorOpen(true)}
          >
            <IcoFile />
            {Object.keys(statements.byMonth).length > 0
              ? `Statement · ${monthAbbr(activeKey)}`
              : "Import statement"}
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="kpi-row" style={{ marginBottom: 16 }}>
        <div className="kpi">
          <div className="kpi-lab">Net worth</div>
          <div className="kpi-val">{fmtMoney(netWorth, cur, { abbr: true })}</div>
          <div className="kpi-sub">Invested + emergency{extraAssets > 0 ? " + assets" : ""}</div>
        </div>
        <div className="kpi accent">
          <div className="kpi-lab">Monthly surplus</div>
          <div className="kpi-val">{fmtMoney(surplus, cur, { abbr: true })}</div>
          <div className={`kpi-sub${surplus > 0 ? " up" : ""}`}>{surplus > 0 ? "Positive cashflow" : "Negative cashflow"}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lab">Projected 5Y</div>
          <div className="kpi-val">{fmtMoney(project(positions.invested, monthly, RETURN_SCENARIOS[1].rate, 60).at(-1)?.bal ?? 0, cur, { abbr: true })}</div>
          <div className="kpi-sub">At {RETURN_SCENARIOS[1].rate}% p.a.</div>
        </div>
        <div className="kpi">
          <div className="kpi-lab">Emergency cover</div>
          <div className="kpi-val">{emergencyPct}%</div>
          <div className="kpi-sub">{fmtMoney(positions.emergencySaved, cur, { abbr: true })} of {fmtMoney(positions.emergencyTarget, cur, { abbr: true })}</div>
        </div>
      </div>

      {/* main grid */}
      <div className="strat-grid">

        {/* projection — span 8 */}
        <div className="card span-8">
          <div className="card-head">
            <div>
              <div className="card-eyebrow">Wealth projection</div>
              <div className="card-title">{heroFace === "grow" ? "Compounding engine" : "Where the money goes"}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {heroFace === "grow" && (
                <div className="seg">
                  {RETURN_SCENARIOS.map((s) => (
                    <button key={s.id} className={`seg-btn${scenarioId === s.id ? " on" : ""}`} onClick={() => setScenarioId(s.id)}>
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
              <button
                className={`hero-flip-btn${heroFace === "spend" ? " on" : ""}`}
                onClick={() => setHeroFace((f) => f === "grow" ? "spend" : "grow")}
                title="Flip card"
              >
                <IcoFlip />
              </button>
            </div>
          </div>
          <div className="hero-scene">
            <div className={`hero-stack${heroFace === "spend" ? " flipped" : ""}`}>
              <div className="hero-face hero-front">
                <div className="proj-figure">
                  <div className="proj-head">
                    <div className="proj-big">{fmtMoney(projFinal, cur, { abbr: true })}</div>
                    <div className="proj-cap">in {Math.round(horizon / 12)} years at {scenario.rate}% p.a.</div>
                  </div>
                  <div className="proj-split">
                    <div className="split-item">
                      <span className="sw sw-contrib" />
                      {fmtMoney(positions.invested + monthly * horizon, cur, { abbr: true })} contrib.
                    </div>
                    <div className="split-item">
                      <span className="sw sw-growth" />
                      {fmtMoney(Math.max(0, projFinal - positions.invested - monthly * horizon), cur, { abbr: true })} growth
                    </div>
                  </div>
                  <ProjectionChart
                    principal={positions.invested}
                    monthly={monthly}
                    scenarioRate={scenario.rate}
                    horizon={horizon}
                  />
                </div>
                <div className="proj-controls">
                  <div>
                    <div className="ctl-lab">
                      Monthly contribution <span className="ctl-val">{fmtMoney(monthly, cur)}</span>
                    </div>
                    <input
                      className="slider"
                      type="range" min={0} max={2500} step={50}
                      value={monthly}
                      onChange={(e) => setMonthly(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <div className="ctl-lab">
                      Horizon <span className="ctl-val">{Math.round(horizon / 12)} years</span>
                    </div>
                    <input
                      className="slider"
                      type="range" min={12} max={360} step={12}
                      value={horizon}
                      onChange={(e) => setHorizon(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
              <div className={`hero-face hero-back${heroFace === "grow" ? " is-hidden" : ""}`}>
                <div className="proj-figure">
                  <div className="proj-head">
                    <div className="proj-big">{fmtMoney(exp, cur, { abbr: true })}</div>
                    <div className="proj-cap">monthly spending · {monthAbbr(activeKey)}</div>
                  </div>
                  <div className="proj-split">
                    <div className="split-item">
                      <span className="sw sw-spend" />
                      {((exp / (inc || 1)) * 100).toFixed(0)}% of income
                    </div>
                    <div className="split-item" style={{ color: surplus >= 0 ? "var(--accent)" : "#ef4444" }}>
                      {surplus >= 0 ? "+" : ""}{fmtMoney(surplus, cur, { abbr: true })} surplus
                    </div>
                  </div>
                  <SpendingChart series={spendSeries} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* priority ladder — span 4 */}
        <div className="card span-4">
          <div className="card-head">
            <div>
              <div className="card-eyebrow">Priority</div>
              <div className="card-title">Financial ladder</div>
            </div>
          </div>
          <div style={{ paddingTop: 12 }}>
            {DEFAULT_LADDER.map((rung, i) => (
              <button key={rung.id} className={`rung rung--${rung.status} rung-hit`} onClick={() => setDetailRung(rung)}>
                <div className="rung-mark">
                  {rung.status === "done" ? <IcoCheck /> : rung.status === "active" ? <IcoLock /> : <span>{i + 1}</span>}
                </div>
                <div className="rung-body">
                  <div className="rung-title">{rung.title}</div>
                  <div className="rung-note">{rung.note}</div>
                  {rung.status === "active" && typeof rung.pct === "number" && (
                    <div className="rung-bar"><span style={{ width: `${rung.pct}%` }} /></div>
                  )}
                </div>
                <span className="rung-tag">
                  {rung.status === "done" ? "Done" : rung.status === "active" ? "Active" : "Queued"}
                </span>
                <span className="rung-chev"><IcoChev dir="right" /></span>
              </button>
            ))}
          </div>
        </div>

        {/* weekly spending — span 8 */}
        <div className="card span-8">
          <div className="card-head">
            <div>
              <div className="card-eyebrow">Spending</div>
              <div className="card-title">Weekly breakdown — {monthLabel(activeKey)}</div>
            </div>
          </div>
          <div className="wk-chart">
            {allWeeks.map((w) => {
              const wExp = stmt.expenses.filter((e) => weekOfDate(activeKey, e.date) === w.idx);
              const wTotal = wExp.reduce((s, e) => s + e.amt, 0);
              const weekAvg = exp / (allWeeks.length || 1);
              const trackMax = Math.max(
                ...allWeeks.map((ww) =>
                  stmt.expenses.filter((e) => weekOfDate(activeKey, e.date) === ww.idx).reduce((s, e) => s + e.amt, 0)
                ),
                1
              );
              const avgtickPct = (weekAvg / trackMax) * 100;
              return (
                <div key={w.idx} className="wk-row">
                  <div className="wk-meta">
                    <div className="wk-name">{w.label}</div>
                    <div className="wk-range">{w.range}</div>
                  </div>
                  <div className="wk-track">
                    <div className="wk-bar" style={{ width: `${(wTotal / trackMax) * 100}%` }}>
                      {CAT_KEYS.map((cat) => {
                        const catAmt = wExp.filter((e) => e.cat === cat).reduce((s, e) => s + e.amt, 0);
                        if (!catAmt) return null;
                        return (
                          <div
                            key={cat}
                            className="wk-seg"
                            style={{ width: `${(catAmt / (wTotal || 1)) * 100}%`, background: STMT_CATS[cat].hue }}
                            title={`${STMT_CATS[cat].label}: ${fmtMoney(catAmt, cur)}`}
                          />
                        );
                      })}
                    </div>
                    <div className="wk-avgtick" style={{ left: `${avgtickPct}%` }} />
                  </div>
                  <div className={`wk-amt${wTotal > weekAvg * 1.3 ? " over" : ""}`}>
                    {fmtMoney(wTotal, cur, { abbr: true })}
                  </div>
                </div>
              );
            })}
            <div className="wk-foot">
              <div className="wk-avg-key">
                <div className="wk-avg-dash" />
                Weekly avg {fmtMoney(exp / (allWeeks.length || 1), cur, { abbr: true })}
              </div>
              <div className="wk-legend">
                {CAT_KEYS.filter((k) => byCat[k] > 0).map((k) => (
                  <div key={k} className="wk-leg">
                    <div className="wk-leg-dot" style={{ background: STMT_CATS[k].hue }} />
                    {STMT_CATS[k].label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* cash flow — span 4 */}
        <div className="card span-4">
          <div className="card-head">
            <div>
              <div className="card-eyebrow">Cashflow</div>
              <div className="card-title">Monthly summary</div>
            </div>
          </div>
          <div className="flow">
            <div className="flow-rows">
              <div className="flow-row total">
                <span>Total income</span><span>{fmtMoney(inc, cur)}</span>
              </div>
              {stmt.income.map((r) => (
                <div key={r.id} className="flow-row sub">
                  <span style={{ color: "var(--dim)" }}>{r.label || r.kind}</span>
                  <span>{fmtMoney(r.amt, cur)}</span>
                </div>
              ))}
              <div className="flow-row total">
                <span>Total expenses</span>
                <span style={{ color: "#ef4444" }}>{fmtMoney(exp, cur)}</span>
              </div>
              {CAT_KEYS.filter((k) => byCat[k] > 0).map((k) => (
                <div key={k} className="flow-row sub">
                  <span style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--dim)" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: STMT_CATS[k].hue, display: "inline-block" }} />
                    {STMT_CATS[k].label}
                  </span>
                  <span>{fmtMoney(byCat[k], cur)}</span>
                </div>
              ))}
              <div className="flow-row total" style={{ color: surplus >= 0 ? "var(--accent)" : "#ef4444" }}>
                <span>Net surplus</span>
                <span>{surplus >= 0 ? "+" : ""}{fmtMoney(surplus, cur)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* allocation — span 4 */}
        <div className="card span-4">
          <div className="card-head">
            <div>
              <div className="card-eyebrow">Portfolio</div>
              <div className="card-title">{DEFAULT_ALLOCATION.profile}</div>
            </div>
          </div>
          <div style={{ padding: "14px 20px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <svg viewBox="0 0 36 36" style={{ width: 100, height: 100, flexShrink: 0 }}>
                <circle className="ring-track" cx="18" cy="18" r="13" />
                {(() => {
                  const r = 13;
                  const c = 2 * Math.PI * r;
                  let offset = 0;
                  return DEFAULT_ALLOCATION.slices.map((s) => {
                    const dash = (s.pct / 100) * c;
                    const el = (
                      <circle
                        key={s.id}
                        className="ring-fill"
                        cx="18" cy="18" r={r}
                        stroke={s.hue}
                        strokeDasharray={`${dash} ${c - dash}`}
                        strokeDashoffset={-offset}
                        transform="rotate(-90 18 18)"
                      />
                    );
                    offset += dash;
                    return el;
                  });
                })()}
              </svg>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ring-cap">{fmtMoney(positions.invested, cur, { abbr: true })}</div>
                <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>Invested</div>
              </div>
            </div>
            <div className="alloc-bar">
              {DEFAULT_ALLOCATION.slices.map((s) => (
                <div key={s.id} className="alloc-seg" style={{ width: `${s.pct}%`, background: s.hue }} />
              ))}
            </div>
            <div className="alloc-legend">
              {DEFAULT_ALLOCATION.slices.map((s) => (
                <div key={s.id} className="alloc-row">
                  <div className="alloc-dot" style={{ background: s.hue }} />
                  <div className="alloc-name">{s.label}</div>
                  <div className="alloc-pct">{s.pct}%</div>
                  <div className="alloc-amt">{fmtMoney((positions.invested * s.pct) / 100, cur, { abbr: true })}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* savings pots — span 4 */}
        <div className="card span-4">
          <div className="card-head">
            <div>
              <div className="card-eyebrow">Goals</div>
              <div className="card-title">Savings pots</div>
            </div>
            <div style={{ position: "relative" }} ref={potMenuRef}>
              <button className="ghost-btn" onClick={() => setPotMenuOpen((v) => !v)}>
                <IcoPlus /> Add pot
              </button>
              {potMenuOpen && (
                <div className="pot-menu">
                  {buylistItems.length > 0 && (
                    <>
                      <div style={{ fontSize: 10, color: "var(--dim)", padding: "4px 10px 2px", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 4 }}>
                        <IcoHopper /> From hopper
                      </div>
                      {buylistItems.map((item) => (
                        <div key={item.id} className="pot-menu-item" onClick={() => handleAddFromHopper(item)}>
                          {item.title}
                        </div>
                      ))}
                    </>
                  )}
                  {buylistItems.length === 0 && (
                    <div className="pot-menu-empty">No hopper items.</div>
                  )}
                  <div className="pot-menu-item" onClick={handleAddBlankPot}>
                    <IcoPlus /> New blank pot…
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="pot-list">
            {pots.map((pot) => {
              const pct = pot.target > 0 ? Math.min(100, Math.round((pot.saved / pot.target) * 100)) : 0;
              const remaining = Math.max(0, pot.target - pot.saved);
              const mos = pot.monthly > 0 ? Math.ceil(remaining / pot.monthly) : null;
              return (
                <div key={pot.id} className="pot">
                  <div className="pot-top">
                    <div>
                      <div className="pot-name">{pot.name}</div>
                      <div className="pot-fig">{fmtMoney(pot.saved, cur)} of {fmtMoney(pot.target, cur)}</div>
                    </div>
                    {pot.fromHopper && <span className="pot-flag"><IcoHopper /></span>}
                  </div>
                  <div className="pot-bar"><span style={{ width: `${pct}%` }} /></div>
                  <div className="pot-foot">
                    <span>{pct}% complete</span>
                    {mos !== null && <span>{mos} mo at {fmtMoney(pot.monthly, cur)}/mo</span>}
                  </div>
                </div>
              );
            })}
            {pots.length === 0 && (
              <div style={{ padding: "20px", fontSize: 12, color: "var(--faint)" }}>No pots yet.</div>
            )}
          </div>
        </div>

        {/* pillars — span 4 */}
        <div className="card span-4">
          <div className="card-head">
            <div>
              <div className="card-eyebrow">Health check</div>
              <div className="card-title">Financial pillars</div>
            </div>
          </div>
          <div className="pillars">
            <div className="pillars-lab">Key metrics</div>
            {DEFAULT_PILLARS.map((p) => (
              <div key={p.id} className="pillar-row">
                <div className={`life-card${p.tone === "warn" ? " tone-warn" : ""}`} style={{ flex: 1 }}>
                  <div className="life-top">
                    <div className="life-label">{p.label}</div>
                    <div className="life-state">{p.state}</div>
                  </div>
                  <div className="life-metric">{p.metric}</div>
                  <div className="life-note">{p.note}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* expense categories — span 8 */}
        <div className="card span-8">
          <div className="card-head">
            <div>
              <div className="card-eyebrow">Categories</div>
              <div className="card-title">Expense breakdown</div>
            </div>
            <button className="ghost-btn" onClick={() => setEditorOpen(true)}>
              <IcoUpload /> Edit
            </button>
          </div>
          <div style={{ padding: "14px 20px 18px" }}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {CAT_KEYS.filter((k) => byCat[k] > 0).map((k) => {
                const pct = (byCat[k] / totalExp) * 100;
                return (
                  <div key={k} style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 100, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: STMT_CATS[k].hue }} />
                      <span style={{ fontSize: 12, color: "var(--fg-2)" }}>{STMT_CATS[k].label}</span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--fg)" }}>{fmtMoney(byCat[k], cur)}</div>
                    <div style={{ height: 4, background: "var(--surface-2)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: STMT_CATS[k].hue, borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--dim)" }}>{pct.toFixed(0)}%</div>
                  </div>
                );
              })}
              {CAT_KEYS.every((k) => !byCat[k]) && (
                <div style={{ fontSize: 12, color: "var(--faint)", padding: "8px 0" }}>No expenses recorded.</div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* editor modal */}
      {editorOpen && (
        <StatementEditor
          statements={{ ...statements, byMonth }}
          currency={cur}
          memberships={state.memberships}
          onSave={onSaveStatement}
          onClose={() => setEditorOpen(false)}
        />
      )}

      {/* ladder detail modal */}
      {detailRung && (
        <LadderDetail rung={detailRung} currency={cur} onClose={() => setDetailRung(null)} />
      )}
    </div>
  );
}
