/* ShELF — Strategie panel: a rigid, mature financial dashboard.
   Centerpiece: a 5-year compound-growth projection. Surrounded by a textbook
   order-of-operations, asset allocation, sinking-fund pots, cashflow + import,
   and a four-pillar life view. Kept in its own babel script (isolated scope). */

/* local icon set — named SI to avoid colliding with components.jsx's `I` */
const SI = {
  check: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5"/></svg>,
  lock: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>,
  plus: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14"/></svg>,
  upload: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"/></svg>,
  chev: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m6 9 6 6 6-6"/></svg>,
  arrow: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  hopper: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 5h18l-7 8v6l-4-2v-4z"/></svg>,
  x: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 6 6 18M6 6l12 12"/></svg>,
  trash: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14"/></svg>,
  in: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 19V5M5 12l7 7 7-7"/></svg>,
  out: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 5v14M5 12l7-7 7 7"/></svg>,
  file: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14 3v5h5"/><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>,
};

/* ---------- helpers ---------- */
function niceCeil(x) {
  if (x <= 0) return 1;
  const exp = Math.floor(Math.log10(x));
  const base = Math.pow(10, exp);
  const f = x / base;
  const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return step * base;
}

/* ---------- the projection chart ---------- */
function ProjectionChart({ pts, currency }) {
  const W = 760, H = 300, ml = 12, mr = 16, mt = 16, mb = 24;
  const plotW = W - ml - mr, plotH = H - mt - mb;
  const months = pts.length - 1;
  const finalTotal = pts[months].bal;
  const max = niceCeil(finalTotal);
  const x = (m) => ml + (m / months) * plotW;
  const y = (v) => mt + (1 - v / max) * plotH;
  const base = mt + plotH;

  const linePath = (key) => pts.map((p, i) => `${i ? "L" : "M"} ${x(p.m).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(" ");
  const areaPath = (key) => `${linePath(key)} L ${x(months).toFixed(1)} ${base} L ${ml} ${base} Z`;

  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);

  return (
    <svg className="proj-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Projection">
      {/* horizontal gridlines + y labels */}
      {gridVals.map((v, i) => (
        <g key={i}>
          <line x1={ml} x2={W - mr} y1={y(v)} y2={y(v)} className="proj-grid" />
          <text x={W - mr} y={y(v) - 4} className="proj-ylab" textAnchor="end">{window.fmtMoney(v, currency, { abbr: true })}</text>
        </g>
      ))}
      {/* total area (accent) then contributions area (neutral) on top → visible accent band = growth */}
      <path d={areaPath("bal")} className="proj-area-total" />
      <path d={areaPath("contrib")} className="proj-area-contrib" />
      {/* lines */}
      <path d={linePath("contrib")} className="proj-line-contrib" />
      <path d={linePath("bal")} className="proj-line-total" />
      {/* end marker */}
      <circle cx={x(months)} cy={y(finalTotal)} r="4.5" className="proj-dot" />
      {/* x labels */}
      {[0, 1, 2, 3, 4, 5].map((yr) => (
        <text key={yr} x={x(yr * 12)} y={H - 6} className="proj-xlab" textAnchor={yr === 0 ? "start" : yr === 5 ? "end" : "middle"}>
          {yr === 0 ? "Now" : "Y" + yr}
        </text>
      ))}
    </svg>
  );
}

/* ---------- small ring (savings rate / coverage) ---------- */
function Ring({ pct, label, sub }) {
  const r = 26, c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(1, pct / 100));
  return (
    <div className="ring">
      <svg viewBox="0 0 64 64" width="64" height="64">
        <circle cx="32" cy="32" r={r} className="ring-track" />
        <circle cx="32" cy="32" r={r} className="ring-fill" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 32 32)" />
      </svg>
      <div className="ring-mid"><b>{Math.round(pct)}%</b></div>
      <div className="ring-cap"><span>{label}</span><small>{sub}</small></div>
    </div>
  );
}

/* ---------- expense category palette ---------- */
const STMT_CATS = {
  housing:   { label: "Housing",   hue: "var(--hue-blue)" },
  food:      { label: "Food",      hue: "var(--hue-green)" },
  transport: { label: "Transport", hue: "var(--hue-orange)" },
  home:      { label: "Home & bills", hue: "var(--hue-purple)" },
  fun:       { label: "Fun",       hue: "var(--hue-rose)" },
  health:    { label: "Health",    hue: "var(--accent)" },
  shopping:  { label: "Shopping",  hue: "var(--hue-zinc)" },
  other:     { label: "Other",     hue: "var(--faint)" },
};
const CAT_KEYS = Object.keys(STMT_CATS);

/* ---------- month-key helpers ---------- */
const WEEKS_PER_MONTH = 52 / 12; // 4.333…
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (key) => { const [y, m] = key.split("-").map(Number); return MONTH_NAMES[m - 1] + " " + y; };
const monthAbbr = (key) => { const [y, m] = key.split("-").map(Number); return MONTH_ABBR[m - 1] + " " + y; };
const stepMonth = (key, dir) => {
  let [y, m] = key.split("-").map(Number);
  m += dir; if (m > 12) { m = 1; y++; } if (m < 1) { m = 12; y--; }
  return y + "-" + String(m).padStart(2, "0");
};
const cloneMonth = (mo, newKey) => ({
  income: mo.income.map((r) => ({ ...r })),
  expenses: mo.expenses.map((r) => {
    if (!newKey || !r.date) return { ...r };
    const day = Math.min(window.daysInMonth(newKey), Number(r.date.split("-")[2]) || 1);
    return { ...r, date: window.dayStr(newKey, day) };
  }),
});

/* ---------- the statement editor (the "Import statement" experience) ---------- */
function StatementEditor({ open, book, order, startMonth, currency, onClose, onSave }) {
  const { useState, useEffect } = React;
  const cur = window.CURRENCIES[currency] || window.CURRENCIES.USD;

  // draft holds amounts in USD-base MONTHLY (canonical); display rescales for currency + granularity
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(book)));
  const [keys, setKeys] = useState(() => [...order]);
  const [viewKey, setViewKey] = useState(startMonth);
  const [gran, setGran] = useState("month"); // "month" | "week"
  const [weekIdx, setWeekIdx] = useState(1); // active week within the month (1-indexed)

  // reset when (re)opened
  useEffect(() => {
    if (!open) return;
    setDraft(JSON.parse(JSON.stringify(book)));
    setKeys([...order]);
    setViewKey(startMonth);
    setGran("month");
    setWeekIdx(1);
  }, [open]);

  // keep the active week valid as the month changes
  useEffect(() => {
    const n = window.monthWeeks(viewKey).length;
    setWeekIdx((w) => Math.min(Math.max(1, w), n));
  }, [viewKey]);

  // esc to close
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  const sym = cur.code === "CZK" ? "Kč" : cur.code === "EUR" ? "€" : "$";
  // amounts are now real (dated) — only currency conversion, no period rescaling
  const fmt = (base) =>
    new Intl.NumberFormat(cur.locale, { style: "currency", currency: cur.code, maximumFractionDigits: 0 })
      .format((base || 0) * cur.rate);
  const shown = (base) => Math.round((base || 0) * cur.rate);   // USD base → shown integer
  const toBase = (shownVal) => Math.round(shownVal / cur.rate); // shown integer → USD base

  const cm = draft[viewKey] || { income: [], expenses: [] };
  const incomeBase = cm.income.reduce((a, r) => a + (r.amt || 0), 0);
  const expenseBase = cm.expenses.reduce((a, r) => a + (r.amt || 0), 0);
  const surplusBase = incomeBase - expenseBase;
  const saveRate = surplusBase > 0 && incomeBase > 0 ? (surplusBase / incomeBase) * 100 : 0;

  // ---- weekly roll-up of dated spending ----
  const weeks = window.monthWeeks(viewKey);
  const dim = window.daysInMonth(viewKey);
  const weekTotals = weeks.map((w) =>
    cm.expenses.filter((r) => window.weekOfDate(viewKey, r.date) === w.idx).reduce((a, r) => a + (r.amt || 0), 0));
  const maxWeek = Math.max(1, ...weekTotals);
  const safeWeek = Math.min(Math.max(1, weekIdx), weeks.length);
  const weekSpend = weekTotals[safeWeek - 1] || 0;
  const avgWeek = weeks.length ? expenseBase / weeks.length : 0;
  const activeWeek = weeks[safeWeek - 1] || weeks[0];
  const defaultDay = gran === "week" && activeWeek ? activeWeek.startDay : Math.min(dim, 15);

  // spending rows: chronological; filtered to the active week in week view
  const sortedEx = [...cm.expenses].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const shownEx = gran === "week" ? sortedEx.filter((r) => window.weekOfDate(viewKey, r.date) === safeWeek) : sortedEx;
  const expShownSum = gran === "week" ? weekSpend : expenseBase;

  const pickWeek = (i) => { setWeekIdx(i); setGran("week"); };

  const idx = keys.indexOf(viewKey);
  const canPrev = idx > 0;

  const editRow = (side, id, patch) =>
    setDraft((d) => ({ ...d, [viewKey]: { ...d[viewKey], [side]: d[viewKey][side].map((r) => (r.id === id ? { ...r, ...patch } : r)) } }));
  const removeRow = (side, id) =>
    setDraft((d) => ({ ...d, [viewKey]: { ...d[viewKey], [side]: d[viewKey][side].filter((r) => r.id !== id) } }));
  const addRow = (side) =>
    setDraft((d) => ({
      ...d,
      [viewKey]: {
        ...d[viewKey],
        [side]: [
          ...d[viewKey][side],
          side === "income"
            ? { id: "in" + Date.now(), label: "", amt: 0, kind: "Other" }
            : { id: "ex" + Date.now(), label: "", amt: 0, cat: "other", date: window.dayStr(viewKey, defaultDay) },
        ],
      },
    }));

  const goPrev = () => { if (canPrev) setViewKey(keys[idx - 1]); };
  const goNext = () => {
    if (idx < keys.length - 1) { setViewKey(keys[idx + 1]); return; }
    // create the next month, seeded from this month's lines as a starting budget
    const nk = stepMonth(viewKey, 1);
    setDraft((d) => ({ ...d, [nk]: cloneMonth(d[viewKey], nk) }));
    setKeys((k) => [...k, nk]);
    setViewKey(nk);
  };

  const commit = () => {
    const cleaned = {};
    keys.forEach((k) => {
      const mo = draft[k];
      cleaned[k] = {
        income: mo.income.filter((r) => r.label.trim() || r.amt),
        expenses: mo.expenses.filter((r) => r.label.trim() || r.amt),
      };
    });
    onSave(cleaned, keys, viewKey);
  };

  const renderAmt = (side, r) => (
    <div className="se-amt">
      <span className="se-cur">{sym}</span>
      <input
        type="text" inputMode="numeric" className="se-amt-input"
        value={r.amt ? shown(r.amt).toLocaleString(cur.locale) : ""}
        placeholder="0"
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/[^\d]/g, ""), 10);
          editRow(side, r.id, { amt: isNaN(n) ? 0 : toBase(n) });
        }}
      />
    </div>
  );

  return (
    <div className="se-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="se-modal" role="dialog" aria-modal="true" aria-label="Edit statement">
        {/* header */}
        <div className="se-head">
          <div className="se-head-l">
            <div className="se-eyebrow"><SI.file /> Statement</div>
            <h2 className="se-title">What's coming in &amp; going out</h2>
            <p className="se-lede">Type in your income and what you spend on, month by month. Everything feeds your cashflow, savings rate and 5-year projection — live.</p>
          </div>
          <button className="se-close" onClick={onClose} aria-label="Close"><SI.x /></button>
        </div>

        {/* period bar — month stepper + month/week toggle */}
        <div className="se-periodbar">
          <div className="se-stepper">
            <button className="se-nav" onClick={goPrev} disabled={!canPrev} aria-label="Previous month"><SI.arrow style={{ transform: "scaleX(-1)" }} /></button>
            <div className="se-month">
              <span className="se-month-name">{monthLabel(viewKey)}</span>
              <span className={"se-month-net" + (surplusBase < 0 ? " neg" : "")}>{surplusBase < 0 ? "−" : "+"}{fmt(Math.abs(surplusBase))} /mo</span>
            </div>
            <button className="se-nav" onClick={goNext} aria-label="Next month" title={idx === keys.length - 1 ? "Start " + monthAbbr(stepMonth(viewKey, 1)) : "Next month"}>
              {idx === keys.length - 1 ? <SI.plus /> : <SI.arrow />}
            </button>
          </div>
          <div className="se-gran">
            <span className="se-gran-lab">Spending</span>
            <div className="seg">
              {[["month", "Whole month"], ["week", "By week"]].map(([id, lab]) => (
                <button key={id} className={"seg-btn" + (gran === id ? " on" : "")} onClick={() => setGran(id)}>{lab}</button>
              ))}
            </div>
          </div>
        </div>

        {/* two columns */}
        <div className="se-body">
          {/* INCOME */}
          <section className="se-col se-col--in">
            <div className="se-col-head">
              <span className="se-col-title"><span className="se-pill se-pill--in"><SI.in /></span> Income <small className="se-col-hint">monthly</small></span>
              <span className="se-col-sum">{fmt(incomeBase)}</span>
            </div>
            <div className="se-rows">
              {cm.income.map((r) => (
                <div className="se-row" key={r.id}>
                  <input className="se-label" placeholder="Source (e.g. Salary)" value={r.label}
                    onChange={(e) => editRow("income", r.id, { label: e.target.value })} />
                  {renderAmt("income", r)}
                  <button className="se-del" onClick={() => removeRow("income", r.id)} aria-label="Remove"><SI.trash /></button>
                </div>
              ))}
              {cm.income.length === 0 && <div className="se-empty">No income yet — add a row.</div>}
            </div>
            <button className="se-add" onClick={() => addRow("income")}><SI.plus /> Add income</button>
          </section>

          {/* SPENDING */}
          <section className="se-col se-col--out">
            <div className="se-col-head">
              <span className="se-col-title"><span className="se-pill se-pill--out"><SI.out /></span> Spending
                {gran === "week" ? <small className="se-col-hint">{activeWeek.label} · {activeWeek.range}</small> : <small className="se-col-hint">dated</small>}
              </span>
              <span className="se-col-sum">{fmt(expShownSum)}</span>
            </div>

            {/* weekly breakdown — flip between weeks with the arrows, or click a bar to focus it */}
            <div className="se-weekrow">
              <button type="button" className="se-wkflip" aria-label="Previous week"
                onClick={() => pickWeek(Math.max(1, safeWeek - 1))}
                disabled={gran === "week" && safeWeek <= 1}><SI.arrow style={{ transform: "scaleX(-1)" }} /></button>
              <div className="se-weekstrip" role="group" aria-label="Weekly spending">
                {weeks.map((w, i) => (
                  <button key={w.idx} type="button"
                    className={"se-wk" + (gran === "week" && safeWeek === w.idx ? " on" : "")}
                    onClick={() => (gran === "week" && safeWeek === w.idx ? setGran("month") : pickWeek(w.idx))}
                    title={w.range + " · " + fmt(weekTotals[i])}>
                    <span className="se-wk-bar"><span className="se-wk-fill" style={{ height: Math.round((weekTotals[i] / maxWeek) * 100) + "%" }}></span></span>
                    <span className="se-wk-amt">{window.fmtMoney(weekTotals[i], currency, { abbr: true })}</span>
                    <span className="se-wk-lab">{w.label}</span>
                  </button>
                ))}
              </div>
              <button type="button" className="se-wkflip" aria-label="Next week"
                onClick={() => pickWeek(Math.min(weeks.length, safeWeek + 1))}
                disabled={gran === "week" && safeWeek >= weeks.length}><SI.arrow /></button>
            </div>

            <div className="se-rows">
              {shownEx.map((r) => (
                <div className="se-row" key={r.id}>
                  <span className="se-catdot" style={{ background: (STMT_CATS[r.cat] || STMT_CATS.other).hue }}></span>
                  <input className="se-label" placeholder="What did you spend on?" value={r.label}
                    onChange={(e) => editRow("expenses", r.id, { label: e.target.value })} />
                  <input className="se-date" type="date" value={r.date || ""}
                    min={window.dayStr(viewKey, 1)} max={window.dayStr(viewKey, dim)}
                    onChange={(e) => e.target.value && editRow("expenses", r.id, { date: e.target.value })} />
                  <select className="se-cat" value={r.cat} onChange={(e) => editRow("expenses", r.id, { cat: e.target.value })}>
                    {CAT_KEYS.map((k) => <option key={k} value={k}>{STMT_CATS[k].label}</option>)}
                  </select>
                  {renderAmt("expenses", r)}
                  <button className="se-del" onClick={() => removeRow("expenses", r.id)} aria-label="Remove"><SI.trash /></button>
                </div>
              ))}
              {shownEx.length === 0 && <div className="se-empty">{gran === "week" ? "Nothing spent in " + activeWeek.label + " — add a row or pick another week." : "Nothing spent yet — add a row."}</div>}
            </div>
            <button className="se-add" onClick={() => addRow("expenses")}><SI.plus /> Add expense{gran === "week" ? " in " + activeWeek.label : ""}</button>
          </section>
        </div>

        {/* footer summary + actions */}
        <div className="se-foot">
          <div className="se-tallies">
            {gran === "week" ? (
              <React.Fragment>
                <div className="se-tally"><span className="se-tally-lab">{activeWeek.label} spent</span><b>{fmt(weekSpend)}</b></div>
                <span className="se-op">·</span>
                <div className="se-tally"><span className="se-tally-lab">Weekly avg</span><b>{fmt(avgWeek)}</b></div>
                <span className="se-op">·</span>
                {(() => {
                  const d = weekSpend - avgWeek; const over = d > 0;
                  return (
                    <div className={"se-tally se-tally--net" + (over ? " neg" : "")}>
                      <span className="se-tally-lab">{over ? "Over avg" : "Under avg"}</span>
                      <b>{over ? "+" : "−"}{fmt(Math.abs(d))}</b>
                      <small>{activeWeek.range}</small>
                    </div>
                  );
                })()}
              </React.Fragment>
            ) : (
              <React.Fragment>
                <div className="se-tally"><span className="se-tally-lab">Income</span><b>{fmt(incomeBase)}</b></div>
                <span className="se-op">−</span>
                <div className="se-tally"><span className="se-tally-lab">Spending</span><b>{fmt(expenseBase)}</b></div>
                <span className="se-op">=</span>
                <div className={"se-tally se-tally--net" + (surplusBase < 0 ? " neg" : "")}>
                  <span className="se-tally-lab">{surplusBase < 0 ? "Shortfall" : "Left to save"}</span>
                  <b>{fmt(surplusBase)}</b>
                  <small>{saveRate.toFixed(0)}% saved · per month</small>
                </div>
              </React.Fragment>
            )}
          </div>
          <div className="se-actions">
            <button className="se-btn se-btn--ghost" onClick={onClose}>Cancel</button>
            <button className="se-btn se-btn--primary" onClick={commit}><SI.check /> Save to dashboard</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- main panel ---------- */
function StrategiePanel({ currency, onCurrency, onToast }) {
  const { useState, useMemo } = React;
  const S = window.STRAT;
  const months = S.assumptions.horizonYears * 12;

  const [retId, setRetId] = useState(S.assumptions.defaultReturn);
  const [book, setBook] = useState(S.statements.byMonth);
  const [order, setOrder] = useState(S.statements.order);
  const [activeMonth, setActiveMonth] = useState(S.statements.current);
  const [edited, setEdited] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [pots, setPots] = useState(S.pots);
  const [hopperOpen, setHopperOpen] = useState(false);

  const ret = S.assumptions.returns.find((r) => r.id === retId);

  // cashflow derives from the *active* month of the statement book (USD base, monthly)
  const activeStmt = book[activeMonth] || { income: [], expenses: [] };
  const income = activeStmt.income.reduce((a, r) => a + (r.amt || 0), 0);
  const expenses = activeStmt.expenses.reduce((a, r) => a + (r.amt || 0), 0);
  const surplus = income - expenses;
  const toPots = Math.max(0, Math.min(S.cashflow.toPots, surplus));
  const toInvest = Math.max(0, surplus - toPots);

  const [monthly, setMonthly] = useState(toInvest);

  const pts = useMemo(() => window.project(S.positions.invested, monthly, ret.rate, months), [monthly, ret.rate, months]);
  const finalTotal = pts[months].bal;
  const finalContrib = pts[months].contrib;
  const finalGrowth = finalTotal - finalContrib;

  const savingsRate = income > 0 ? surplus / income * 100 : 0;
  const potsSaved = pots.reduce((a, p) => a + p.saved, 0);
  const netWorth = S.positions.invested + S.positions.emergencySaved + potsSaved;
  const coverMonths = expenses > 0 ? S.positions.emergencySaved / expenses : 0;
  const coverPct = S.positions.emergencySaved / S.positions.emergencyTarget * 100;

  // ---- weekly roll-up of the active month's dated spending ----
  const aWeeks = window.monthWeeks(activeMonth);
  const weekData = aWeeks.map((w) => {
    const rows = activeStmt.expenses.filter((r) => window.weekOfDate(activeMonth, r.date) === w.idx);
    const byCat = {};
    rows.forEach((r) => { byCat[r.cat] = (byCat[r.cat] || 0) + (r.amt || 0); });
    return { ...w, total: rows.reduce((a, r) => a + (r.amt || 0), 0), byCat };
  });
  const maxWeekSpend = Math.max(1, ...weekData.map((w) => w.total));
  const weekAvg = weekData.length ? weekData.reduce((a, w) => a + w.total, 0) / weekData.length : 0;
  const catTotals = {};
  activeStmt.expenses.forEach((r) => { catTotals[r.cat] = (catTotals[r.cat] || 0) + (r.amt || 0); });
  const catList = CAT_KEYS.filter((k) => catTotals[k]).sort((a, b) => catTotals[b] - catTotals[a]);

  const saveStatement = (nextBook, nextOrder, nextActive) => {
    setBook(nextBook);
    setOrder(nextOrder);
    setActiveMonth(nextActive);
    setEdited(true);
    setEditorOpen(false);
    const mo = nextBook[nextActive] || { income: [], expenses: [] };
    const nextSurplus = mo.income.reduce((a, r) => a + (r.amt || 0), 0) - mo.expenses.reduce((a, r) => a + (r.amt || 0), 0);
    setMonthly(Math.max(0, nextSurplus - S.cashflow.toPots)); // route fresh surplus into the projection
    onToast && onToast("Statement saved · cashflow updated");
  };

  const f = (v, o) => window.fmtMoney(v, currency, o);
  const hopperNames = (window.SHELF_DATA.hopper || []).map((h) => h.name);

  const addPot = (name) => {
    setPots((p) => [...p, { id: "po" + Date.now(), name, target: 500, saved: 0, monthly: 50, fromHopper: true }]);
    setHopperOpen(false);
  };

  return (
    <div className="strat">
      {/* header */}
      <div className="strat-head">
        <div>
          <div className="strat-eyebrow">Strategie · Life &amp; capital plan</div>
          <h2 className="strat-title">Your 5-year strategy</h2>
        </div>
        <div className="strat-tools">
          <div className="seg">
            {["USD", "EUR", "CZK"].map((c) => (
              <button key={c} className={"seg-btn" + (currency === c ? " on" : "")} onClick={() => onCurrency(c)}>{c}</button>
            ))}
          </div>
          <button className={"ghost-btn" + (edited ? " ok" : "")} onClick={() => setEditorOpen(true)}>
            <SI.upload /> {edited ? `Statement · ${monthAbbr(activeMonth)}` : "Import statement"}
          </button>
        </div>
      </div>

      <StatementEditor open={editorOpen} book={book} order={order} startMonth={activeMonth} currency={currency}
        onClose={() => setEditorOpen(false)} onSave={saveStatement} />

      {/* KPI row */}
      <div className="kpi-row">
        <div className="kpi">
          <div className="kpi-lab">Net worth</div>
          <div className="kpi-val">{f(netWorth)}</div>
          <div className="kpi-sub up">▲ invested + reserves</div>
        </div>
        <div className="kpi">
          <div className="kpi-lab">Monthly surplus</div>
          <div className="kpi-val">{f(surplus)}</div>
          <div className="kpi-sub">{savingsRate.toFixed(0)}% savings rate</div>
        </div>
        <div className="kpi accent">
          <div className="kpi-lab">Projected · 5Y</div>
          <div className="kpi-val">{f(finalTotal, { abbr: false })}</div>
          <div className="kpi-sub up">+{f(finalGrowth)} compounding</div>
        </div>
        <div className="kpi">
          <div className="kpi-lab">Emergency cover</div>
          <div className="kpi-val">{coverMonths.toFixed(1)}<span className="kpi-unit">mo</span></div>
          <div className="kpi-sub">target 6 mo</div>
        </div>
      </div>

      {/* main grid */}
      <div className="strat-grid">
        {/* projection (hero) */}
        <section className="card span-8">
          <div className="card-head">
            <div>
              <div className="card-eyebrow">Compounding engine</div>
              <h3 className="card-title">If you invest {f(monthly)}/mo at {(ret.rate * 100).toFixed(0)}%</h3>
            </div>
            <div className="seg">
              {S.assumptions.returns.map((r) => (
                <button key={r.id} className={"seg-btn" + (retId === r.id ? " on" : "")} onClick={() => setRetId(r.id)}>{r.label}</button>
              ))}
            </div>
          </div>

          <div className="proj-figure">
            <div className="proj-head">
              <div>
                <div className="proj-big">{f(finalTotal)}</div>
                <div className="proj-cap">projected in {S.assumptions.horizonYears} years</div>
              </div>
              <div className="proj-split">
                <div className="split-item"><span className="sw sw-contrib"></span>Contributions <b>{f(finalContrib)}</b></div>
                <div className="split-item"><span className="sw sw-growth"></span>Compound growth <b>{f(finalGrowth)}</b></div>
              </div>
            </div>

            <ProjectionChart pts={pts} currency={currency} />

            <div className="proj-controls">
              <label className="ctl-lab">Monthly investment</label>
              <input type="range" className="slider" min="0" max="2500" step="50" value={monthly}
                onChange={(e) => setMonthly(Number(e.target.value))} />
              <span className="ctl-val">{f(monthly)}</span>
            </div>
          </div>
        </section>

        {/* order of operations */}
        <section className="card span-4">
          <div className="card-head">
            <div>
              <div className="card-eyebrow">The method</div>
              <h3 className="card-title">Order of operations</h3>
            </div>
          </div>
          <ol className="ladder">
            {S.ladder.map((t) => (
              <li key={t.id} className={"rung rung--" + t.status}>
                <span className="rung-mark">
                  {t.status === "done" ? <SI.check /> : t.status === "queued" ? <SI.lock /> : <span className="rung-i">{t.id}</span>}
                </span>
                <span className="rung-body">
                  <span className="rung-title">{t.title}</span>
                  <span className="rung-note">{t.note}</span>
                  {t.status === "active" && typeof t.pct === "number" && (
                    <span className="rung-bar"><span style={{ width: t.pct + "%" }}></span></span>
                  )}
                </span>
                {t.status === "active" && <span className="rung-tag">{t.pct === 100 ? "ongoing" : "focus"}</span>}
              </li>
            ))}
          </ol>
        </section>

        {/* spending by week */}
        <section className="card span-8">
          <div className="card-head">
            <div>
              <div className="card-eyebrow">{monthLabel(activeMonth)} · dated spending</div>
              <h3 className="card-title">Spending by week</h3>
            </div>
            <button className="mini-ghost" onClick={() => setEditorOpen(true)}><SI.file style={{ width: 13, height: 13 }} /> Edit</button>
          </div>
          <div className="wk-chart">
            {weekData.map((w) => {
              const over = w.total > weekAvg;
              return (
                <div className="wk-row" key={w.idx}>
                  <div className="wk-meta">
                    <span className="wk-name">{w.label}</span>
                    <span className="wk-range">{w.range}</span>
                  </div>
                  <div className="wk-track">
                    <div className="wk-bar" style={{ width: Math.max(2, (w.total / maxWeekSpend) * 100) + "%" }}>
                      {catList.filter((k) => w.byCat[k]).map((k) => (
                        <span key={k} className="wk-seg" style={{ flexGrow: w.byCat[k], background: STMT_CATS[k].hue }}
                          title={STMT_CATS[k].label + " · " + f(w.byCat[k], { abbr: true })}></span>
                      ))}
                    </div>
                    <span className="wk-avgtick" style={{ left: (weekAvg / maxWeekSpend) * 100 + "%" }} title={"Weekly avg · " + f(weekAvg)}></span>
                  </div>
                  <span className={"wk-amt" + (over ? " over" : "")}>{f(w.total, { abbr: true })}</span>
                </div>
              );
            })}
          </div>
          <div className="wk-foot">
            <span className="wk-avg-key"><span className="wk-avg-dash"></span> Weekly avg {f(weekAvg)}</span>
            <div className="wk-legend">
              {catList.map((k) => (
                <span className="wk-leg" key={k}><span className="wk-leg-dot" style={{ background: STMT_CATS[k].hue }}></span>{STMT_CATS[k].label}</span>
              ))}
            </div>
          </div>
        </section>

        {/* cashflow */}
        <section className="card span-4">
          <div className="card-head">
            <div><div className="card-eyebrow">{monthLabel(activeMonth)}</div><h3 className="card-title">Cashflow</h3></div>
            <button className="mini-ghost" onClick={() => setEditorOpen(true)}><SI.file style={{ width: 13, height: 13 }} /> Edit</button>
          </div>
          <div className="flow">
            <div className="flow-rows">
              <div className="flow-row"><span>Income</span><b>{f(income)}</b></div>
              <div className="flow-row"><span>Expenses</span><b className="neg">−{f(expenses)}</b></div>
              <div className="flow-row total"><span>Surplus</span><b className="pos">{f(surplus)}</b></div>
              <div className="flow-row sub"><span>→ Invested</span><b>{f(toInvest)}</b></div>
              <div className="flow-row sub"><span>→ Pots</span><b>{f(toPots)}</b></div>
            </div>
            <Ring pct={savingsRate} label="Saved" sub="of income" />
          </div>
        </section>

        {/* allocation */}
        <section className="card span-4">
          <div className="card-head">
            <div><div className="card-eyebrow">{S.allocation.profile}</div><h3 className="card-title">Allocation</h3></div>
          </div>
          <div className="alloc-bar">
            {S.allocation.slices.map((s) => (
              <span key={s.id} className="alloc-seg" style={{ width: s.pct + "%", background: s.hue }} title={s.label}></span>
            ))}
          </div>
          <div className="alloc-legend">
            {S.allocation.slices.map((s) => (
              <div className="alloc-row" key={s.id}>
                <span className="alloc-dot" style={{ background: s.hue }}></span>
                <span className="alloc-name">{s.label}</span>
                <span className="alloc-pct">{s.pct}%</span>
                <span className="alloc-amt">{f(S.positions.invested * s.pct / 100, { abbr: true })}</span>
              </div>
            ))}
          </div>
        </section>

        {/* pots */}
        <section className="card span-8">
          <div className="card-head">
            <div><div className="card-eyebrow">Sinking funds</div><h3 className="card-title">Pots</h3></div>
            <div className="pot-add">
              <button className="mini-ghost" onClick={() => setHopperOpen((o) => !o)}><SI.hopper /> From Hopper <SI.chev style={{ width: 12, height: 12 }} /></button>
              {hopperOpen && (
                <div className="pot-menu">
                  {hopperNames.length === 0 && <div className="pot-menu-empty">Hopper is empty</div>}
                  {hopperNames.map((n, i) => (
                    <button key={i} className="pot-menu-item" onClick={() => addPot(n)}><SI.plus style={{ width: 13, height: 13 }} /> {n}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="pot-list">
            {pots.map((p) => {
              const pct = Math.min(100, p.saved / p.target * 100);
              const eta = p.monthly > 0 ? Math.ceil((p.target - p.saved) / p.monthly) : null;
              return (
                <div className="pot" key={p.id}>
                  <div className="pot-top">
                    <span className="pot-name">{p.name}{p.fromHopper && <span className="pot-flag"><SI.hopper style={{ width: 11, height: 11 }} /> Hopper</span>}</span>
                    <span className="pot-fig">{f(p.saved, { abbr: true })} <i>/ {f(p.target, { abbr: true })}</i></span>
                  </div>
                  <div className="pot-bar"><span style={{ width: pct + "%" }}></span></div>
                  <div className="pot-foot">
                    <span>{f(p.monthly)}/mo</span>
                    <span>{eta !== null ? (eta <= 0 ? "Funded ✓" : `~${eta} mo to go`) : "—"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* life pillars */}
      <div className="pillars">
        <div className="pillars-lab">Life pillars</div>
        <div className="pillar-row">
          {S.pillars.map((p) => (
            <div className={"life-card tone-" + p.tone} key={p.id}>
              <div className="life-top"><span className="life-label">{p.label}</span><span className="life-state">{p.state}</span></div>
              <div className="life-metric">{p.metric}</div>
              <div className="life-note">{p.note}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { StrategiePanel });
