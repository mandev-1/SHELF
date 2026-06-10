import { useState, useRef, useEffect, useCallback } from "react";
import type { StrategieState, MonthStatement, BuylistItem, MembershipRow, AccountDictEntry, RungAccountRef, SavingsPlanKind, CatKey } from "../../types/grid";
import { SAVINGS_PLAN_KINDS } from "../../types/grid";
import {
  daysInMonth as _daysInMonth,
  monthWeeks, weekOfDate,
  monthLabel, monthAbbr, stepMonth, project,
  fmtMoney, STMT_CATS, CAT_KEYS,
  RETURN_SCENARIOS, DEFAULT_LADDER, DEFAULT_PILLARS,
  DEFAULT_STATEMENTS, CURRENCIES,
} from "./strategie";
import type { LadderRung } from "./strategie";
import { IcoCheck, IcoLock, IcoPlus, IcoFile, IcoHopper, IcoUpload, IcoFlip, IcoChev } from "./icons";
import { StatementEditor } from "./StatementEditor";
import { totalIncome, totalExpenses, expensesByCat } from "./helpers";
import { DailySpendChart, ProjectionChart } from "./charts";
import { LadderDetail } from "./LadderDetail";
import { MonthCloseDiff } from "./MonthCloseDiff";

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
  onToggleCompareCurrency: () => void;
  onSetRungAccounts: (rungId: number, rows: RungAccountRef[]) => void;
  onUpsertAccountDictEntry: (entry: AccountDictEntry) => void;
  onAddSavingsPlan: (name: string, kind: SavingsPlanKind) => void;
  onRenameSavingsPlan: (id: string, name: string) => void;
  onRemoveSavingsPlan: (id: string) => void;
  onToast?: (msg: string) => void;
}



// ─── Main Panel ───────────────────────────────────────────────────────────────
export function StrategiePanel({
  state,
  buylistItems,
  extraAssets = 0,
  onSaveStatement,
  onAddPot,
  onSetCurrency,
  onToggleCompareCurrency,
  onSetRungAccounts,
  onUpsertAccountDictEntry,
  onAddSavingsPlan,
  onRenameSavingsPlan,
  onRemoveSavingsPlan,
  onToast,
}: StrategiePanelProps) {
  const [spName, setSpName] = useState("");
  const [spKind, setSpKind] = useState<SavingsPlanKind>("savings");
  const [editorOpen, setEditorOpen] = useState(false);
  const [potMenuOpen, setPotMenuOpen] = useState(false);
  const potMenuRef = useRef<HTMLDivElement>(null);

  const [scenarioId, setScenarioId] = useState("balanced");
  const [horizon, setHorizon] = useState(120);
  const [monthly, setMonthly] = useState(300);
  const [heroFace, setHeroFace] = useState<"grow" | "spend">("grow");
  const [spendRange, setSpendRange] = useState<1 | 3 | 6 | 0>(1); // months; 0 = all
  const [hiddenCats, setHiddenCats] = useState<CatKey[]>([]);
  const [detailRung, setDetailRung] = useState<LadderRung | null>(null);

  const { statements, positions, pots, currency, secondaryCurrency, compareCurrencyOn } = state;
  const cur = currency;
  const cur2 = secondaryCurrency;
  const compareOn = compareCurrencyOn && !!cur2;

  const byMonth: Record<string, MonthStatement> =
    Object.keys(statements.byMonth).length > 0
      ? statements.byMonth
      : DEFAULT_STATEMENTS;

  const activeKey = statements.current in byMonth
    ? statements.current
    : (statements.order[0] ?? "2026-04");
  const stmt = byMonth[activeKey] ?? { income: [], expenses: [] };

  // The previous month (chronologically) — used by <MonthCloseDiff>.
  const sortedKeys = Object.keys(byMonth).sort();
  const activeIdx = sortedKeys.indexOf(activeKey);
  const prevKey = activeIdx > 0 ? sortedKeys[activeIdx - 1] : undefined;
  const prevStmt = prevKey ? byMonth[prevKey] : undefined;

  const inc = totalIncome(stmt);
  const expAll = totalExpenses(stmt);                 // everything, incl. savings transfers
  const toPlansMonth = stmt.expenses.reduce((s, e) => s + (e.savingsPlanId ? e.amt : 0), 0);
  const exp = expAll - toPlansMonth;                  // true spending (transfers excluded)
  const surplus = inc - expAll;                       // cash left after everything
  void Math.min(200, surplus > 0 ? surplus : 0); // toPots removed from KPI

  // savings-plan contributions: active month + all time, per plan
  const savingsPlans = state.savingsPlans;
  const planMonth: Record<string, number> = {};
  const planTotal: Record<string, number> = {};
  for (const [mk, mo] of Object.entries(byMonth)) {
    for (const e of mo.expenses) {
      if (!e.savingsPlanId) continue;
      planTotal[e.savingsPlanId] = (planTotal[e.savingsPlanId] ?? 0) + e.amt;
      if (mk === activeKey) planMonth[e.savingsPlanId] = (planMonth[e.savingsPlanId] ?? 0) + e.amt;
    }
  }
  const plansContribTotal = Object.values(planTotal).reduce((a, b) => a + b, 0);

  const addPlan = () => {
    const name = spName.trim();
    if (!name) return;
    onAddSavingsPlan(name, spKind);
    setSpName("");
    onToast?.(`Added program: ${name}`);
  };

  // spend chart range: consecutive calendar months ending at the active month
  // (1 / 3 / 6, or back to the earliest month on file for "all")
  const spendMonths = (() => {
    const earliest = [...sortedKeys, activeKey].sort()[0];
    const keys: string[] = [];
    let k = activeKey;
    while (
      keys.length < (spendRange === 0 ? 600 : spendRange) &&
      (spendRange !== 0 || k >= earliest)
    ) {
      keys.unshift(k);
      if (spendRange !== 0 && keys.length >= spendRange) break;
      if (spendRange === 0 && k <= earliest) break;
      k = stepMonth(k, -1);
    }
    return keys.map((mk) => ({ key: mk, stmt: byMonth[mk] ?? { income: [], expenses: [] } }));
  })();
  const spendCats = CAT_KEYS.filter((k) =>
    spendMonths.some((m) => m.stmt.expenses.some((e) => !e.savingsPlanId && e.cat === k && e.amt > 0))
  );
  const toggleCat = (k: CatKey) =>
    setHiddenCats((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k]));

  const scenario = RETURN_SCENARIOS.find((s) => s.id === scenarioId) ?? RETURN_SCENARIOS[1];
  const projPts = project(positions.invested, monthly, scenario.rate, horizon);
  const projFinal = projPts[projPts.length - 1]?.bal ?? positions.invested;

  const byCat = expensesByCat(stmt);
  const totalExp = exp || 1;
  const emergencyPct = Math.min(100, Math.round((positions.emergencySaved / positions.emergencyTarget) * 100));

  const netWorth = positions.invested + positions.emergencySaved + extraAssets;

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
          {cur2 && (
            <button
              className={`ghost-btn cur-compare${compareOn ? " on" : ""}`}
              onClick={onToggleCompareCurrency}
              title={compareOn ? `Hide ${cur2} comparison` : `Show ${cur2} comparison`}
            >
              <span className="cur-compare-arr" aria-hidden="true">↔</span>
              <span>{cur2}</span>
            </button>
          )}
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
          {compareOn && cur2 && <div className="kpi-cmp">≈ {fmtMoney(netWorth, cur2, { abbr: true })}</div>}
          <div className="kpi-sub">Invested + emergency{extraAssets > 0 ? " + assets" : ""}</div>
        </div>
        <div className="kpi accent">
          <div className="kpi-lab">Monthly surplus</div>
          <div className="kpi-val">{fmtMoney(surplus, cur, { abbr: true })}</div>
          {compareOn && cur2 && <div className="kpi-cmp">≈ {fmtMoney(surplus, cur2, { abbr: true })}</div>}
          <div className={`kpi-sub${surplus > 0 ? " up" : ""}`}>{surplus > 0 ? "Positive cashflow" : "Negative cashflow"}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lab">Projected 5Y</div>
          <div className="kpi-val">{fmtMoney(project(positions.invested, monthly, RETURN_SCENARIOS[1].rate, 60).at(-1)?.bal ?? 0, cur, { abbr: true })}</div>
          {compareOn && cur2 && <div className="kpi-cmp">≈ {fmtMoney(project(positions.invested, monthly, RETURN_SCENARIOS[1].rate, 60).at(-1)?.bal ?? 0, cur2, { abbr: true })}</div>}
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
                    {toPlansMonth > 0 && (
                      <div className="split-item" title="Statement rows tagged as savings-plan contributions — not counted as spending">
                        {fmtMoney(toPlansMonth, cur, { abbr: true })} to savings
                      </div>
                    )}
                  </div>
                  <div className="dsp-controls">
                    <div className="seg">
                      {([[1, "Month"], [3, "3 mo"], [6, "6 mo"], [0, "All"]] as const).map(([v, l]) => (
                        <button key={v} className={`seg-btn${spendRange === v ? " on" : ""}`} onClick={() => setSpendRange(v)}>
                          {l}
                        </button>
                      ))}
                    </div>
                    <div className="dsp-cats">
                      {spendCats.map((k) => (
                        <button
                          key={k}
                          className={`dsp-cat${hiddenCats.includes(k) ? " off" : ""}`}
                          onClick={() => toggleCat(k)}
                          title={hiddenCats.includes(k) ? `Show ${STMT_CATS[k].label}` : `Hide ${STMT_CATS[k].label}`}
                          aria-pressed={!hiddenCats.includes(k)}
                        >
                          <span className="dsp-cat-dot" style={{ background: STMT_CATS[k].hue }} />
                          {STMT_CATS[k].label}
                        </button>
                      ))}
                      {hiddenCats.length > 0 && (
                        <button className="dsp-cat dsp-cat--reset" onClick={() => setHiddenCats([])}>show all</button>
                      )}
                    </div>
                  </div>
                  <DailySpendChart months={spendMonths} cur={cur} hidden={hiddenCats} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* order of operations — span 4 */}
        <div className="card span-4">
          <div className="card-head">
            <div>
              <div className="card-eyebrow">The method</div>
              <div className="card-title">Order of operations</div>
            </div>
          </div>
          <ol className="ladder">
            {DEFAULT_LADDER.map((rung) => (
              <li key={rung.id} className={`rung rung--${rung.status}`}>
                <button
                  className="rung-hit"
                  onClick={() => setDetailRung(rung)}
                  aria-label={`Open ${rung.title} details`}
                >
                  <span className="rung-mark">
                    {rung.status === "done" ? <IcoCheck /> : rung.status === "queued" ? <IcoLock /> : <span className="rung-i">{rung.id}</span>}
                  </span>
                  <span className="rung-body">
                    <span className="rung-title">{rung.title}</span>
                    <span className="rung-note">{rung.note}</span>
                    {rung.status === "active" && typeof rung.pct === "number" && (
                      <span className="rung-bar"><span style={{ width: `${rung.pct}%` }} /></span>
                    )}
                  </span>
                  {rung.status === "active" && (
                    <span className="rung-tag">{rung.pct === 100 ? "ongoing" : "focus"}</span>
                  )}
                  <span className="rung-chev"><IcoChev dir="down" /></span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        {/* month-close diff — span 4 */}
        <MonthCloseDiff
          prevKey={prevKey}
          currKey={activeKey}
          prevStmt={prevStmt}
          currStmt={stmt}
          currency={cur}
        />

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

        {/* portfolio: savings programs — span 4 */}
        <div className="card span-4">
          <div className="card-head">
            <div>
              <div className="card-eyebrow">Portfolio</div>
              <div className="card-title">Savings programs</div>
            </div>
          </div>
          <div style={{ padding: "14px 20px 18px" }}>
            {savingsPlans.length > 0 && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <svg viewBox="0 0 36 36" style={{ width: 100, height: 100, flexShrink: 0 }}>
                    <circle className="ring-track" cx="18" cy="18" r="13" />
                    {(() => {
                      if (plansContribTotal <= 0) return null;
                      const r = 13;
                      const c = 2 * Math.PI * r;
                      let offset = 0;
                      return savingsPlans.map((p) => {
                        const share = (planTotal[p.id] ?? 0) / plansContribTotal;
                        if (share <= 0) return null;
                        const dash = share * c;
                        const el = (
                          <circle
                            key={p.id}
                            className="ring-fill"
                            cx="18" cy="18" r={r}
                            stroke={p.hue}
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
                    <div className="ring-cap">{fmtMoney(plansContribTotal, cur, { abbr: true })}</div>
                    <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>
                      Contributed{toPlansMonth > 0 ? ` · ${fmtMoney(toPlansMonth, cur, { abbr: true })} this month` : ""}
                    </div>
                  </div>
                </div>
                {plansContribTotal > 0 && (
                  <div className="alloc-bar">
                    {savingsPlans.map((p) => {
                      const share = (planTotal[p.id] ?? 0) / plansContribTotal;
                      return share > 0
                        ? <div key={p.id} className="alloc-seg" style={{ width: `${share * 100}%`, background: p.hue }} />
                        : null;
                    })}
                  </div>
                )}
                <div className="alloc-legend" style={{ marginTop: plansContribTotal > 0 ? 0 : 14 }}>
                  {savingsPlans.map((p) => (
                    <div key={p.id} className="alloc-row sp-row">
                      <div className="alloc-dot" style={{ background: p.hue }} />
                      <div
                        className="alloc-name"
                        title="Double-click to rename"
                        onDoubleClick={() => {
                          const name = window.prompt(`Rename "${p.name}"`, p.name)?.trim();
                          if (name && name !== p.name) onRenameSavingsPlan(p.id, name);
                        }}
                      >
                        <span>{p.name}</span>
                        <span className="sp-kind">{SAVINGS_PLAN_KINDS.find((k) => k.id === p.kind)?.label ?? p.kind}</span>
                      </div>
                      <div className="alloc-pct" title={`Contributed in ${monthAbbr(activeKey)}`}>
                        {planMonth[p.id] ? fmtMoney(planMonth[p.id], cur, { abbr: true }) : "—"}
                      </div>
                      <div className="alloc-amt" title="Contributed all time">
                        {fmtMoney(planTotal[p.id] ?? 0, cur, { abbr: true })}
                      </div>
                      <button
                        className="sp-del"
                        title={`Remove ${p.name}`}
                        onClick={() => {
                          if (window.confirm(`Remove "${p.name}"? Statement rows keep their amounts but lose the link to this program.`))
                            onRemoveSavingsPlan(p.id);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
            {savingsPlans.length === 0 && (
              <div className="sp-empty">
                No savings programs yet. Add one below, then tag statement rows
                (in the import or the statement editor) as contributions — they'll
                stop counting as spending and show up here instead.
              </div>
            )}
            <div className="sp-add">
              <input
                className="sp-add-name"
                placeholder="e.g. Building savings ČS"
                value={spName}
                onChange={(e) => setSpName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addPlan(); }}
              />
              <select className="se-cat sp-add-kind" value={spKind} onChange={(e) => setSpKind(e.target.value as SavingsPlanKind)}>
                {SAVINGS_PLAN_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
              <button className="ghost-btn" onClick={addPlan} disabled={!spName.trim()}><IcoPlus /> Add</button>
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
          savingsPlans={savingsPlans}
          onSave={onSaveStatement}
          onClose={() => setEditorOpen(false)}
        />
      )}

      {/* ladder detail modal */}
      {detailRung && (
        <LadderDetail
          rung={detailRung}
          currency={cur}
          totalSteps={DEFAULT_LADDER.length}
          directory={state.accountsDirectory}
          persistedRows={state.rungAccounts[detailRung.id]}
          onSetRungAccounts={onSetRungAccounts}
          onUpsertAccountDictEntry={onUpsertAccountDictEntry}
          onClose={() => setDetailRung(null)}
        />
      )}
    </div>
  );
}
