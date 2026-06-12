import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { StrategieState, MonthStatement, BuylistItem, MembershipRow, AccountDictEntry, RungAccountRef, SavingsPlanKind, CatKey, Debt, DebtStrategy, CardLayout } from "../../types/grid";
import { SAVINGS_PLAN_KINDS } from "../../types/grid";
import { useCardGrid } from "../../hooks/useCardGrid";
import { CardSlot, LayoutUndoChip } from "./CardSlot";
import { DebtCard } from "./DebtCard";
import {
  daysInMonth as _daysInMonth,
  monthWeeks, weekOfDate,
  monthLabel, monthAbbr, project,
  fmtMoney, STMT_CATS, CAT_KEYS,
  RETURN_SCENARIOS, DEFAULT_LADDER, DEFAULT_PILLARS,
  DEFAULT_STATEMENTS, CURRENCIES,
} from "./strategie";
import type { LadderRung } from "./strategie";
import { IcoCheck, IcoLock, IcoPlus, IcoFile, IcoHopper, IcoUpload, IcoFlip, IcoChev } from "./icons";
import { StatementEditor } from "./StatementEditor";
import { totalIncome, totalExpenses, expensesByCat } from "./helpers";
import { DailySpendChart, ProjectionChart, type SpendRangeOpenInfo } from "./charts";
import { LadderDetail } from "./LadderDetail";
import { MonthCloseDiff } from "./MonthCloseDiff";
import { AccountsCard } from "./AccountsCard";

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
  onSetActiveMonth: (key: string) => void;
  onSetHeroFace: (face: "grow" | "spend") => void;
  onToggleCompareCurrency: () => void;
  onSetRungAccounts: (rungId: number, rows: RungAccountRef[]) => void;
  onUpsertAccountDictEntry: (entry: AccountDictEntry) => void;
  onSetAccountsDirectory: (dir: AccountDictEntry[]) => void;
  onAddSavingsPlan: (name: string, kind: SavingsPlanKind) => void;
  onRenameSavingsPlan: (id: string, name: string) => void;
  onRemoveSavingsPlan: (id: string) => void;
  onSetDebts: (next: Debt[]) => void;
  onSetDebtStrategy: (v: DebtStrategy) => void;
  onSetCardLayout: (layout: CardLayout) => void;
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
  onSetActiveMonth,
  onSetHeroFace,
  onToggleCompareCurrency,
  onSetRungAccounts,
  onUpsertAccountDictEntry,
  onSetAccountsDirectory,
  onAddSavingsPlan,
  onRenameSavingsPlan,
  onRemoveSavingsPlan,
  onSetDebts,
  onSetDebtStrategy,
  onSetCardLayout,
  onToast,
}: StrategiePanelProps) {
  const grid = useCardGrid(state.cardLayout, onSetCardLayout);
  const [spName, setSpName] = useState("");
  const [spKind, setSpKind] = useState<SavingsPlanKind>("savings");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorImportOpen, setEditorImportOpen] = useState(false);
  const [editorTarget, setEditorTarget] = useState<{
    month: string;
    week: number | null;
    range: { startIso: string; endIso: string } | null;
    ids: string[] | null;
    bulk: boolean;
  } | null>(null);
  const [potMenuOpen, setPotMenuOpen] = useState(false);
  const potMenuRef = useRef<HTMLDivElement>(null);
  const ladderRef = useRef<HTMLDivElement>(null);
  const [rungTip, setRungTip] = useState<{
    rung: LadderRung;
    x: number;
    y: number;
    flipX: boolean;
    flipY: boolean;
  } | null>(null);

  const [scenarioId, setScenarioId] = useState("balanced");
  const [horizon, setHorizon] = useState(120);
  const [monthly, setMonthly] = useState(300);
  const heroFace = state.heroFace;
  const [hiddenCats, setHiddenCats] = useState<CatKey[]>([]);
  const [detailRung, setDetailRung] = useState<LadderRung | null>(null);
  // month-switch toast (top-right, slides in then away)
  const [monthToast, setMonthToast] = useState<{ seq: number; label: string } | null>(null);
  const [toastLeaving, setToastLeaving] = useState(false);
  const toastSeqRef = useRef(0);
  const toastTimersRef = useRef<number[]>([]);

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
  // edge arrows step the active month through the months on file
  const nextKey = activeIdx >= 0 && activeIdx < sortedKeys.length - 1 ? sortedKeys[activeIdx + 1] : undefined;

  const inc = totalIncome(stmt);
  const expAll = totalExpenses(stmt);                 // everything, incl. transfers
  const toPlansMonth = stmt.expenses.reduce((s, e) => s + (e.savingsPlanId ? e.amt : 0), 0);
  const toDebtMonth = stmt.expenses.reduce((s, e) => s + (e.debtId ? e.amt : 0), 0);
  const exp = expAll - toPlansMonth - toDebtMonth;    // true spending (transfers excluded)
  const surplus = inc - expAll;                       // cash left after everything
  void Math.min(200, surplus > 0 ? surplus : 0); // toPots removed from KPI

  // savings-plan + debt contributions: active month + all time, per id
  const savingsPlans = state.savingsPlans;
  const debts = state.debts;
  const planMonth: Record<string, number> = {};
  const planTotal: Record<string, number> = {};
  const debtMonth: Record<string, number> = {};
  const debtTotal: Record<string, number> = {};
  for (const [mk, mo] of Object.entries(byMonth)) {
    for (const e of mo.expenses) {
      if (e.savingsPlanId) {
        planTotal[e.savingsPlanId] = (planTotal[e.savingsPlanId] ?? 0) + e.amt;
        if (mk === activeKey) planMonth[e.savingsPlanId] = (planMonth[e.savingsPlanId] ?? 0) + e.amt;
      } else if (e.debtId) {
        debtTotal[e.debtId] = (debtTotal[e.debtId] ?? 0) + e.amt;
        if (mk === activeKey) debtMonth[e.debtId] = (debtMonth[e.debtId] ?? 0) + e.amt;
      }
    }
  }
  const plansContribTotal = Object.values(planTotal).reduce((a, b) => a + b, 0);

  // statement-driven debt balances + net worth
  const debtRemaining = (d: Debt) => Math.max(0, (d.principal || 0) - (debtTotal[d.id] || 0));
  const openDebtTotal = debts.reduce((s, d) => s + debtRemaining(d), 0);

  const addPlan = () => {
    const name = spName.trim();
    if (!name) return;
    onAddSavingsPlan(name, spKind);
    setSpName("");
    onToast?.(`Added program: ${name}`);
  };

  // spend chart spans the entire statement history; the in-chart timeline
  // scrubber (1M / 3M / 6M / ALL) handles focusing a sub-period.
  const spendMonths = sortedKeys.map((mk) => ({ key: mk, stmt: byMonth[mk] ?? { income: [], expenses: [] } }));
  const spendCats = CAT_KEYS.filter((k) =>
    spendMonths.some((m) => m.stmt.expenses.some((e) => !e.savingsPlanId && !e.debtId && e.cat === k && e.amt > 0))
  );
  const toggleCat = (k: CatKey) =>
    setHiddenCats((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k]));

  const scenario = RETURN_SCENARIOS.find((s) => s.id === scenarioId) ?? RETURN_SCENARIOS[1];
  const projPts = project(positions.invested, monthly, scenario.rate, horizon);
  const projFinal = projPts[projPts.length - 1]?.bal ?? positions.invested;

  const byCat = expensesByCat(stmt);
  const totalExp = exp || 1;
  const emergencyPct = Math.min(100, Math.round((positions.emergencySaved / positions.emergencyTarget) * 100));

  const netWorth = positions.invested + positions.emergencySaved + extraAssets - openDebtTotal;

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

  // ladder step-3 tie-in: goes live whenever any debt ≥8% APR is still open
  const hiDebts = debts.filter((d) => (d.rate || 0) >= 8);
  const hiOpen = hiDebts.reduce((s, d) => s + debtRemaining(d), 0);
  const hiPrincipal = hiDebts.reduce((s, d) => s + (d.principal || 0), 0);

  // every statement row tagged as a debt payment, oldest first — feeds step-3 detail
  const debtHistory = (() => {
    const out: { date: string; label: string; amt: number }[] = [];
    for (const [mk, mo] of Object.entries(byMonth)) {
      for (const e of mo.expenses) {
        if (!e.debtId) continue;
        const d = debts.find((x) => x.id === e.debtId);
        out.push({ date: e.date || `${mk}-01`, label: `${e.label || "Payment"}${d ? ` — ${d.name}` : ""}`, amt: e.amt });
      }
    }
    out.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    return out;
  })();

  const rungLive = useCallback((rung: LadderRung): LadderRung => {
    if (rung.id !== 3 || hiOpen <= 0) return rung;
    return {
      ...rung,
      status: "active",
      pct: hiPrincipal > 0 ? Math.round(((hiPrincipal - hiOpen) / hiPrincipal) * 100) : 0,
      note: `${fmtMoney(hiOpen, cur, { abbr: true })} open above 8% APR — pay down first`,
      blurb: "Expensive debt grows faster than any investment. Clear everything above ~8% APR before putting more into the market — payments you tag in your statement track the progress here.",
    };
  }, [hiOpen, hiPrincipal, cur]);

  // live rung rows: step 3 lists open high-interest debts; else persisted edits, else seed
  const rungRows = useCallback((rung: LadderRung) => {
    if (rung.id === 3 && hiOpen > 0) {
      return hiDebts
        .filter((d) => debtRemaining(d) > 0)
        .map((d) => ({ name: d.name, tag: `${d.rate || 0}% APR`, balance: debtRemaining(d) }));
    }
    const persisted = state.rungAccounts[rung.id];
    if (persisted) {
      return persisted.map((p) => {
        const d = state.accountsDirectory.find((x) => x.name === p.accountRef);
        return { name: p.accountRef, tag: d?.tag ?? "", balance: p.balance };
      });
    }
    return (rung.accounts ?? []).map((a) => ({ name: a.name, tag: a.tag, balance: a.balance }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.rungAccounts, state.accountsDirectory, hiOpen, hiDebts]);

  // step-3 high-interest balances are excluded from the "all parked money" grand total
  const ladderGrand = DEFAULT_LADDER.reduce(
    (s, r) => (r.id === 3 && hiOpen > 0 ? s : s + rungRows(r).reduce((a, x) => a + (x.balance || 0), 0)),
    0,
  );

  const moveRungTip = (e: React.MouseEvent, rung: LadderRung) => {
    const card = ladderRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setRungTip({ rung, x, y, flipX: x > rect.width * 0.45, flipY: y > rect.height * 0.62 });
  };

  const openRangeInEditor = useCallback((info: SpendRangeOpenInfo) => {
    const month = byMonth[info.monthKey] ? info.monthKey : activeKey;
    setEditorTarget({
      month,
      week: null,
      range: month === info.monthKey ? { startIso: info.startIso, endIso: info.endIso } : null,
      ids: info.ids?.length ? info.ids : null,
      bulk: true,
    });
    setEditorOpen(true);
  }, [byMonth, activeKey]);

  // pop a brief top-right toast naming the month we just moved to
  const showMonthToast = useCallback((key: string) => {
    const seq = (toastSeqRef.current += 1);
    toastTimersRef.current.forEach((t) => window.clearTimeout(t));
    setToastLeaving(false);
    setMonthToast({ seq, label: monthLabel(key) });
    toastTimersRef.current = [
      window.setTimeout(() => { if (toastSeqRef.current === seq) setToastLeaving(true); }, 1450),
      window.setTimeout(() => { if (toastSeqRef.current === seq) { setMonthToast(null); setToastLeaving(false); } }, 1450 + 380),
    ];
  }, []);
  useEffect(() => () => { toastTimersRef.current.forEach((t) => window.clearTimeout(t)); }, []);

  const stepMonthTo = useCallback((key: string | undefined) => {
    if (!key) return;
    onSetActiveMonth(key);
    showMonthToast(key);
  }, [onSetActiveMonth, showMonthToast]);

  const allWeeks = monthWeeks(activeKey);

  return (
    <div className="strat">
      {/* edge month steppers — page the whole panel through the months on file */}
      <button
        type="button"
        className="strat-monthnav strat-monthnav--prev"
        disabled={!prevKey}
        onClick={() => stepMonthTo(prevKey)}
        title={prevKey ? `Previous month · ${monthAbbr(prevKey)}` : "No earlier month on file"}
        aria-label="Previous month"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16 16 8 8" />
          <path d="M8 15V8h7" />
        </svg>
      </button>
      <button
        type="button"
        className="strat-monthnav strat-monthnav--next"
        disabled={!nextKey}
        onClick={() => stepMonthTo(nextKey)}
        title={nextKey ? `Next month · ${monthAbbr(nextKey)}` : "No later month on file"}
        aria-label="Next month"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M8 16 16 8" />
          <path d="M9 8h7v7" />
        </svg>
      </button>

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
            className="ghost-btn"
            onClick={() => setEditorOpen(true)}
            title="Open the statement editor"
          >
            <IcoFile /> Statement
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="kpi-row" style={{ marginBottom: 16 }}>
        <div className="kpi">
          <div className="kpi-lab">Net worth</div>
          <div className="kpi-val">{fmtMoney(netWorth, cur, { abbr: true })}</div>
          {compareOn && cur2 && <div className="kpi-cmp">≈ {fmtMoney(netWorth, cur2, { abbr: true })}</div>}
          <div className="kpi-sub">Invested + emergency{extraAssets > 0 ? " + assets" : ""}{openDebtTotal > 0 ? " − debt" : ""}</div>
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
      <div className={`strat-grid${grid.active ? " is-sorting" : ""}`} ref={grid.gridRef}>

        {/* projection — span 8 */}
        <CardSlot grid={grid} id="hero">
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
                onClick={() => onSetHeroFace(heroFace === "grow" ? "spend" : "grow")}
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
                    {toDebtMonth > 0 && (
                      <div className="split-item" title="Statement rows tagged as debt payments — not counted as spending">
                        {fmtMoney(toDebtMonth, cur, { abbr: true })} to debt
                      </div>
                    )}
                  </div>
                  <div className="dsp-controls">
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
                  <DailySpendChart months={spendMonths} cur={cur} hidden={hiddenCats} activeKey={activeKey} onOpenRange={openRangeInEditor} />
                </div>
              </div>
            </div>
          </div>
        </div>
        </CardSlot>

        {/* order of operations — span 4 */}
        <CardSlot grid={grid} id="ladder">
        <div className="card span-4 ladder-card" ref={ladderRef}>
          <div className="card-head">
            <div>
              <div className="card-eyebrow">The method</div>
              <div className="card-title">Order of operations</div>
            </div>
          </div>
          <ol className="ladder" onMouseLeave={() => setRungTip(null)}>
            {DEFAULT_LADDER.map((rung0) => {
              const rung = rungLive(rung0);
              return (
              <li key={rung.id} className={`rung rung--${rung.status}`}>
                <button
                  className="rung-hit"
                  onClick={() => setDetailRung(rung)}
                  onMouseMove={(e) => moveRungTip(e, rung)}
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
              );
            })}
          </ol>
          {rungTip && (() => {
            const rows = rungRows(rungTip.rung).slice().sort((a, b) => (b.balance || 0) - (a.balance || 0));
            const total = rows.reduce((a, r) => a + (r.balance || 0), 0);
            const share = ladderGrand > 0 ? Math.round((total / ladderGrand) * 100) : 0;
            const OPS = [1, 0.68, 0.45, 0.3, 0.2];
            return (
              <div
                className="rung-tip"
                style={{
                  left: rungTip.x + 14,
                  top: rungTip.y + 14,
                  transform: `${rungTip.flipX ? "translateX(calc(-100% - 28px))" : ""} ${rungTip.flipY ? "translateY(calc(-100% - 28px))" : ""}`,
                  ["--step-hue" as string]: rungTip.rung.hue || "var(--accent)",
                } as React.CSSProperties}
              >
                <div className="rung-tip-head">
                  <b>Step {rungTip.rung.id} · {rungTip.rung.title}</b>
                  <span>{fmtMoney(total, cur, { abbr: true })}</span>
                </div>
                {rows.length > 0 ? (
                  <>
                    {total > 0 && (
                      <div className="rung-tip-bar">
                        {rows.map((r, i) => (
                          <span
                            key={i}
                            style={{
                              width: `${((r.balance || 0) / total) * 100}%`,
                              background: "var(--step-hue)",
                              opacity: OPS[i % OPS.length],
                            }}
                          />
                        ))}
                      </div>
                    )}
                    {rows.map((r, i) => (
                      <div className="rung-tip-row" key={i}>
                        <span className="rung-tip-dot" style={{ background: "var(--step-hue)", opacity: OPS[i % OPS.length] }} />
                        <span className="rung-tip-lab">
                          {r.name}
                          {r.tag ? <span className="rung-tip-tag"> · {r.tag}</span> : null}
                        </span>
                        <span className="rung-tip-pct">{total > 0 ? `${Math.round(((r.balance || 0) / total) * 100)}%` : "—"}</span>
                        <span className="rung-tip-amt">{fmtMoney(r.balance || 0, cur, { abbr: true })}</span>
                      </div>
                    ))}
                    {rungTip.rung.id === 3 && hiOpen > 0 ? (
                      <div className="rung-tip-foot">Open balances above 8% APR — clear these before investing more.</div>
                    ) : (
                      <div className="rung-tip-foot">
                        <span className="rung-tip-foot-bar"><span style={{ width: `${share}%` }} /></span>
                        {share}% of all parked money sits in this step
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rung-tip-empty">Nothing parked here yet — unlocks once the earlier steps are funded.</div>
                )}
              </div>
            );
          })()}
        </div>
        </CardSlot>

        {/* month-close diff — span 4 */}
        <CardSlot grid={grid} id="diff">
        <MonthCloseDiff
          prevKey={prevKey}
          currKey={activeKey}
          prevStmt={prevStmt}
          currStmt={stmt}
          currency={cur}
        />
        </CardSlot>

        {/* weekly spending — span 8 */}
        <CardSlot grid={grid} id="weekly">
        <div className="card span-8">
          <div
            className="card-head"
            role="button"
            tabIndex={0}
            style={{ cursor: "pointer" }}
            onClick={() => { setEditorImportOpen(true); setEditorOpen(true); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditorImportOpen(true); setEditorOpen(true); } }}
            title="Bring in a bank statement"
          >
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
                        const catAmt = wExp.filter((e) => e.cat === cat && !e.savingsPlanId && !e.debtId).reduce((s, e) => s + e.amt, 0);
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
        </CardSlot>

        {/* cash flow — span 4 */}
        <CardSlot grid={grid} id="flow">
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
        </CardSlot>

        {/* open debt — span 4 */}
        <CardSlot grid={grid} id="debt">
        <DebtCard
          debts={debts}
          paidTotal={debtTotal}
          paidMonth={debtMonth}
          strategy={state.debtStrategy}
          activeKey={activeKey}
          currency={cur}
          onChange={onSetDebts}
          onStrategy={onSetDebtStrategy}
          onToast={onToast}
        />
        </CardSlot>

        {/* portfolio: savings programs — span 4 */}
        <CardSlot grid={grid} id="programs">
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
        </CardSlot>

        {/* savings pots — span 4 */}
        <CardSlot grid={grid} id="pots">
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
        </CardSlot>

        {/* accounts — span 4 */}
        <CardSlot grid={grid} id="accounts">
        <AccountsCard
          accounts={state.accountsDirectory}
          currency={cur}
          onChange={onSetAccountsDirectory}
          onToast={onToast}
        />
        </CardSlot>

        {/* pillars — span 4 */}
        <CardSlot grid={grid} id="pillars">
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
        </CardSlot>

        {/* expense categories — span 8 */}
        <CardSlot grid={grid} id="cats">
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
        </CardSlot>

      </div>

      {/* layout undo chip (drag/resize) */}
      <LayoutUndoChip chip={grid.undoChip} onUndo={grid.undoNow} />

      {/* editor modal */}
      {editorOpen && (
        <StatementEditor
          statements={{ ...statements, byMonth, current: editorTarget?.month ?? statements.current }}
          currency={cur}
          memberships={state.memberships}
          savingsPlans={savingsPlans}
          debts={debts}
          onSave={(book, order, active, memberships) => {
            onSaveStatement(book, order, active, memberships);
            setEditorTarget(null);
          }}
          onClose={() => { setEditorOpen(false); setEditorImportOpen(false); setEditorTarget(null); }}
          defaultImportOpen={editorImportOpen}
          initialWeek={editorTarget?.week ?? null}
          initialRange={editorTarget?.range ?? null}
          initialBulk={editorTarget?.bulk ?? false}
          initialIds={editorTarget?.ids ?? null}
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
          debtView={detailRung.id === 3 ? {
            rows: debts.map((d) => ({
              name: d.name,
              tag: `${d.rate || 0}% APR`,
              balance: debtRemaining(d),
              cleared: debtRemaining(d) <= 0,
            })),
            history: debtHistory,
            paid: debts.reduce((s, d) => s + Math.min(d.principal || 0, debtTotal[d.id] || 0), 0),
            principal: debts.reduce((s, d) => s + (d.principal || 0), 0),
          } : undefined}
          onSetRungAccounts={onSetRungAccounts}
          onUpsertAccountDictEntry={onUpsertAccountDictEntry}
          onClose={() => setDetailRung(null)}
        />
      )}

      {/* month-switch toast — top-right, slides in then away */}
      {monthToast && createPortal(
        <div
          key={monthToast.seq}
          className={`strat-month-toast${toastLeaving ? " is-leaving" : ""}`}
          role="status"
          aria-live="polite"
        >
          <span className="strat-month-toast-eyebrow">Statement</span>
          <span className="strat-month-toast-label">{monthToast.label}</span>
        </div>,
        document.body,
      )}
    </div>
  );
}
