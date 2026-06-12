/* ShELF — Strategie panel. Faithful prototype mirror of
   src/components/Strategie/StrategiePanel.tsx + StatementEditor (branch
   mandev-1/strategie-savings-and-import). State lives in localStorage so the
   prototype behaves like the real useShelfStorage slice. */

/* local icon set for the statement editor (kept from v1) */
const SI = {
  check: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5"/></svg>,
  plus: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14"/></svg>,
  arrow: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  x: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 6 6 18M6 6l12 12"/></svg>,
  trash: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14"/></svg>,
  in: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 19V5M5 12l7 7 7-7"/></svg>,
  out: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 5v14M5 12l7-7 7 7"/></svg>,
  file: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14 3v5h5"/><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>,
};

const cloneMonth = (mo, newKey) => ({
  income: mo.income.map((r) => ({ ...r, id: r.id + "-c" + Date.now() })),
  expenses: mo.expenses.map((r) => {
    const next = { ...r, id: r.id + "-c" + Date.now() };
    if (!newKey || !r.date) return next;
    const day = Math.min(window.daysInMonth(newKey), Number(r.date.split("-")[2]) || 1);
    return { ...next, date: window.dayStr(newKey, day) };
  }),
});

/* ---------- the statement editor ---------- */
function StatementEditor({ open, book, order, startMonth, currency, savingsPlans = [], defaultImportOpen = false, initialWeek = null, initialRange = null, initialBulk = false, initialIds = null, onClose, onSave }) {
  const { useState, useEffect } = React;
  const cur = window.CURRENCIES[currency] || window.CURRENCIES.USD;

  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(book)));
  const [keys, setKeys] = useState(() => [...order]);
  const [viewKey, setViewKey] = useState(startMonth);
  const [gran, setGran] = useState("month");
  const [weekIdx, setWeekIdx] = useState(1);
  const [importOpen, setImportOpen] = useState(defaultImportOpen);
  const [bulk, setBulk] = useState(null); // null | { range: {startIso,endIso} | null }
  const [range, setRange] = useState(null); // {startIso, endIso} day filter from a chart selection

  useEffect(() => {
    if (!open) return;
    setDraft(JSON.parse(JSON.stringify(book)));
    setKeys([...order]);
    setViewKey(startMonth);
    setGran(initialRange ? "month" : initialWeek ? "week" : "month");
    setWeekIdx(initialWeek || 1);
    setRange(initialRange || null);
    setBulk(initialBulk ? { range: initialRange || null, ids: initialIds || null } : null);
    setImportOpen(defaultImportOpen);
  }, [open]);

  useEffect(() => {
    const n = window.monthWeeks(viewKey).length;
    setWeekIdx((w) => Math.min(Math.max(1, w), n));
  }, [viewKey]);

  // esc to close (the import modal handles its own Escape and stops propagation)
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape" && !importOpen && !bulk) onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose, importOpen, bulk]);

  if (!open) return null;

  const sym = cur.code === "CZK" ? "Kč" : cur.code === "EUR" ? "€" : cur.code === "GBP" ? "£" : "$";
  const fmt = (base) =>
    new Intl.NumberFormat(cur.locale, { style: "currency", currency: cur.code, maximumFractionDigits: 0 })
      .format((base || 0) * cur.rate);
  const shown = (base) => Math.round((base || 0) * cur.rate);
  const toBase = (shownVal) => Math.round(shownVal / cur.rate);

  const cm = draft[viewKey] || { income: [], expenses: [] };
  const incomeBase = cm.income.reduce((a, r) => a + (r.amt || 0), 0);
  const expenseBase = cm.expenses.reduce((a, r) => a + (r.amt || 0), 0);
  const surplusBase = incomeBase - expenseBase;
  const saveRate = surplusBase > 0 && incomeBase > 0 ? (surplusBase / incomeBase) * 100 : 0;

  const weeks = window.monthWeeks(viewKey);
  const dim = window.daysInMonth(viewKey);
  const weekTotals = weeks.map((w) =>
    cm.expenses.filter((r) => window.weekOfDate(viewKey, r.date) === w.idx).reduce((a, r) => a + (r.amt || 0), 0));
  const maxWeek = Math.max(1, ...weekTotals);
  const safeWeek = Math.min(Math.max(1, weekIdx), weeks.length);
  const weekSpend = weekTotals[safeWeek - 1] || 0;
  const avgWeek = weeks.length ? expenseBase / weeks.length : 0;
  const activeWeek = weeks[safeWeek - 1] || weeks[0];
  // day-range filter only applies while viewing the month it came from
  const rangeActive = !!range && gran !== "week" && range.startIso.slice(0, 7) === viewKey;
  const inRange = (r) => !rangeActive || (r.date && r.date >= range.startIso && r.date <= range.endIso);
  const defaultDay = gran === "week" && activeWeek
    ? activeWeek.startDay
    : rangeActive ? Number(range.startIso.slice(8, 10)) : Math.min(dim, 15);

  const sortedEx = [...cm.expenses].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const shownEx = gran === "week"
    ? sortedEx.filter((r) => window.weekOfDate(viewKey, r.date) === safeWeek)
    : sortedEx.filter(inRange);
  const expShownSum = gran === "week" ? weekSpend : shownEx.reduce((a, r) => a + (r.amt || 0), 0);
  const fmtRangeDay = (iso) => Number(iso.slice(8, 10)) + ".";
  const rangeLabel = rangeActive
    ? (range.startIso === range.endIso
        ? fmtRangeDay(range.startIso) + " " + window.monthAbbr(viewKey)
        : fmtRangeDay(range.startIso) + "–" + fmtRangeDay(range.endIso) + " " + window.monthAbbr(viewKey))
    : null;

  const pickWeek = (i) => { setWeekIdx(i); setGran("week"); setRange(null); };

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
            ? { id: "in" + Date.now(), label: "", amt: 0, kind: "other" }
            : { id: "ex" + Date.now(), label: "", amt: 0, cat: "other", date: window.dayStr(viewKey, defaultDay) },
        ],
      },
    }));

  const goPrev = () => { if (canPrev) setViewKey(keys[idx - 1]); };
  const goNext = () => {
    if (idx < keys.length - 1) { setViewKey(keys[idx + 1]); return; }
    const nk = window.stepMonth(viewKey, 1);
    setDraft((d) => ({ ...d, [nk]: cloneMonth(d[viewKey], nk) }));
    setKeys((k) => [...k, nk]);
    setViewKey(nk);
  };

  // merge a StatementImport result into the draft book
  const mergeImport = (additions) => {
    const mks = Object.keys(additions).sort();
    if (mks.length === 0) { setImportOpen(false); return; }
    setDraft((d) => {
      const nd = { ...d };
      for (const mk of mks) {
        const curMo = nd[mk] || { income: [], expenses: [] };
        nd[mk] = {
          income: [...curMo.income, ...additions[mk].income],
          expenses: [...curMo.expenses, ...additions[mk].expenses],
        };
      }
      return nd;
    });
    setKeys((k) => {
      const nk = [...k];
      for (const mk of mks) if (!nk.includes(mk)) nk.push(mk);
      nk.sort();
      return nk;
    });
    setViewKey(mks[mks.length - 1]);
    setImportOpen(false);
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

  const catDot = (r) => r.savingsPlanId
    ? ((savingsPlans.find((p) => p.id === r.savingsPlanId) || {}).hue || "var(--accent)")
    : (window.STMT_CATS[r.cat] || window.STMT_CATS.other).hue;

  return (
    <div className="se-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="se-modal" role="dialog" aria-modal="true" aria-label="Edit statement">
        <div className="se-head">
          <div className="se-head-l">
            <div className="se-eyebrow"><SI.file /> Statement</div>
            <h2 className="se-title">What's coming in &amp; going out</h2>
            <p className="se-lede">Type in your income and what you spend on, month by month. Everything feeds your cashflow, savings rate and 5-year projection — live.</p>
          </div>
          <button className="se-import" onClick={() => setImportOpen(true)}>
            <IcoUpload /> Import statement
          </button>
          <button className="se-close" onClick={onClose} aria-label="Close"><SI.x /></button>
        </div>

        <div className="se-periodbar">
          <div className="se-stepper">
            <button className="se-nav" onClick={goPrev} disabled={!canPrev} aria-label="Previous month"><SI.arrow style={{ transform: "scaleX(-1)" }} /></button>
            <div className="se-month">
              <span className="se-month-name">{window.monthLabel(viewKey)}</span>
              <span className={"se-month-net" + (surplusBase < 0 ? " neg" : "")}>{surplusBase < 0 ? "−" : "+"}{fmt(Math.abs(surplusBase))} /mo</span>
            </div>
            <button className="se-nav" onClick={goNext} aria-label="Next month" title={idx === keys.length - 1 ? "Start " + window.monthAbbr(window.stepMonth(viewKey, 1)) : "Next month"}>
              {idx === keys.length - 1 ? <SI.plus /> : <SI.arrow />}
            </button>
          </div>
          <div className="se-gran">
            <span className="se-gran-lab">Spending</span>
            <div className="seg">
              {[["month", "Whole month"], ["week", "By week"]].map(([id, lab]) => (
                <button key={id} className={"seg-btn" + (gran === id && !(id === "month" && rangeActive) ? " on" : "")} onClick={() => { setGran(id); setRange(null); }}>{lab}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="se-body">
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

          <section className="se-col se-col--out">
            <div className="se-col-head">
              <span className="se-col-title"><span className="se-pill se-pill--out"><SI.out /></span> Spending
                {gran === "week"
                  ? <small className="se-col-hint">{activeWeek.label} · {activeWeek.range}</small>
                  : rangeActive
                    ? <button className="se-rangechip" onClick={() => setRange(null)} title="Showing only the days you selected on the chart — click to show the whole month">
                        {rangeLabel} · {shownEx.length} item{shownEx.length === 1 ? "" : "s"} <SI.x />
                      </button>
                    : <small className="se-col-hint">dated</small>}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <button
                  className="si-link"
                  onClick={(e) => { e.stopPropagation(); setBulk({ range: rangeActive ? range : null, ids: null }); }}
                  disabled={cm.expenses.length === 0}
                  title={rangeActive
                    ? "Open the selected days in the big review table — sort, drag-select, bulk-rewrite"
                    : "Open this month's expenses in the big review table — sort, drag-select, bulk-rewrite"}>
                  <IcoPencil /> Bulk edit{rangeActive ? " selection" : ""}
                </button>
                <span className="se-col-sum">{fmt(expShownSum)}</span>
              </span>
            </div>

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
                  <span className="se-catdot" style={{ background: catDot(r) }}></span>
                  <input className="se-label" placeholder="What did you spend on?" value={r.label}
                    onChange={(e) => editRow("expenses", r.id, { label: e.target.value })} />
                  <input className="se-date" type="date" value={r.date || ""}
                    min={window.dayStr(viewKey, 1)} max={window.dayStr(viewKey, dim)}
                    onChange={(e) => e.target.value && editRow("expenses", r.id, { date: e.target.value })} />
                  <select className="se-cat" value={r.savingsPlanId ? "plan:" + r.savingsPlanId : r.cat}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v.startsWith("plan:")) editRow("expenses", r.id, { savingsPlanId: v.slice(5) });
                      else editRow("expenses", r.id, { cat: v, savingsPlanId: undefined });
                    }}>
                    {window.CAT_KEYS_BY_LABEL.map((k) => <option key={k} value={k}>{window.STMT_CATS[k].label}</option>)}
                    {savingsPlans.length > 0 && (
                      <optgroup label="Savings plans">
                        {savingsPlans.map((p) => <option key={p.id} value={"plan:" + p.id}>→ {p.name}</option>)}
                      </optgroup>
                    )}
                  </select>
                  {renderAmt("expenses", r)}
                  <button className="se-del" onClick={() => removeRow("expenses", r.id)} aria-label="Remove"><SI.trash /></button>
                </div>
              ))}
              {shownEx.length === 0 && <div className="se-empty">{gran === "week" ? "Nothing spent in " + activeWeek.label + " — add a row or pick another week." : rangeActive ? "Nothing spent on " + rangeLabel + " — add a row or clear the filter." : "Nothing spent yet — add a row."}</div>}
            </div>
            <button className="se-add" onClick={() => addRow("expenses")}><SI.plus /> Add expense{gran === "week" ? " in " + activeWeek.label : rangeActive ? " on " + rangeLabel : ""}</button>
          </section>
        </div>

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
            ) : rangeActive ? (
              <React.Fragment>
                <div className="se-tally"><span className="se-tally-lab">{rangeLabel} spent</span><b>{fmt(expShownSum)}</b></div>
                <span className="se-op">·</span>
                <div className="se-tally"><span className="se-tally-lab">Whole month</span><b>{fmt(expenseBase)}</b></div>
                <span className="se-op">=</span>
                <div className="se-tally se-tally--net">
                  <span className="se-tally-lab">Share of month</span>
                  <b>{expenseBase > 0 ? Math.round((expShownSum / expenseBase) * 100) : 0}%</b>
                  <small>{shownEx.length} item{shownEx.length === 1 ? "" : "s"} in selection</small>
                </div>
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

      {importOpen && (
        <StatementImport
          currency={currency}
          existing={draft}
          savingsPlans={savingsPlans}
          onClose={() => setImportOpen(false)}
          onImport={mergeImport}
        />
      )}

      {bulk && (() => {
        const br = bulk.range;
        const idSet = bulk.ids && bulk.ids.length ? new Set(bulk.ids) : null;
        const inBulk = (r) => idSet ? idSet.has(r.id) : (!br || (r.date && r.date >= br.startIso && r.date <= br.endIso));
        const scoped = cm.expenses.filter(inBulk);
        const dayLab = br
          ? (br.startIso === br.endIso
              ? Number(br.startIso.slice(8, 10)) + ". " + window.monthAbbr(viewKey)
              : Number(br.startIso.slice(8, 10)) + ".–" + Number(br.endIso.slice(8, 10)) + ". " + window.monthAbbr(viewKey))
          : null;
        const scopeLabel = dayLab ? dayLab + (idSet ? " · amount band · " + scoped.length + (scoped.length === 1 ? " row" : " rows") : "") : null;
        return (
          <StatementImport
            currency={currency}
            savingsPlans={savingsPlans}
            editRows={{ monthKey: viewKey, expenses: scoped, scopeLabel }}
            onApplyEdits={(mk, expenses) => {
              // replace only the scoped rows; everything outside the range is untouched
              setDraft((d) => ({
                ...d,
                [mk]: { ...d[mk], expenses: d[mk].expenses.filter((r) => !inBulk(r)).concat(expenses) },
              }));
              setBulk(null);
            }}
            onClose={() => setBulk(null)}
            onImport={() => {}}
          />
        );
      })()}
    </div>
  );
}

/* ---------- accounts: where the money lives ---------- */
function AccountsCard({ accounts, currency, onAdd, onUpdate, onRemove, onToast }) {
  const { useState } = React;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("checking");
  const [bal, setBal] = useState("");

  const kinds = window.ACCOUNT_KINDS;
  const kindOf = (id) => kinds.find((k) => k.id === id) || kinds[kinds.length - 1];
  const total = accounts.reduce((a, x) => a + (x.balance || 0), 0);

  // group by kind, in the canonical kind order
  const groups = kinds
    .map((k) => ({ k, rows: accounts.filter((a) => (a.kind || "cash") === k.id) }))
    .filter((g) => g.rows.length > 0);
  const untyped = accounts.filter((a) => !a.kind || !kinds.some((k) => k.id === a.kind));

  const add = () => {
    const nm = name.trim();
    if (!nm) return;
    onAdd({ name: nm, kind, tag: kindOf(kind).label, balance: bal ? Math.round(Number(bal)) : 0 });
    setName(""); setBal(""); setOpen(false);
    onToast && onToast("Added account: " + nm);
  };
  const editBalance = (a) => {
    const cur = window.CURRENCIES[currency] || window.CURRENCIES.USD;
    const shown = Math.round((a.balance || 0) * cur.rate);
    const v = window.prompt('Balance for "' + a.name + '" (' + cur.code + ")", shown || "");
    if (v == null) return;
    const n = parseFloat(String(v).replace(/[^\d.-]/g, ""));
    if (Number.isFinite(n)) onUpdate({ name: a.name, balance: Math.round(n / cur.rate) });
  };
  const rename = (a) => {
    const nm = (window.prompt('Rename "' + a.name + '"', a.name) || "").trim();
    if (nm && nm !== a.name) { onRemove(a.name); onAdd({ ...a, name: nm }); }
  };

  const Row = (a) => {
    const h = kindOf(a.kind || "cash");
    return (
      <div className="alloc-row sp-row acct-row" key={a.name}>
        <div className="alloc-dot" style={{ background: h.hue }}></div>
        <div className="alloc-name" title="Double-click to rename" onDoubleClick={() => rename(a)}>
          {a.url
            ? <a href={a.url} target="_blank" rel="noreferrer" className="acct-link">{a.name}</a>
            : <span>{a.name}</span>}
          <span className="sp-kind">{a.tag || h.label}</span>
        </div>
        <button className="alloc-amt acct-bal" title="Click to edit balance" onClick={() => editBalance(a)}>
          {window.fmtMoney(a.balance || 0, currency, { abbr: true })}
        </button>
        <button className="sp-del" title={"Remove " + a.name}
          onClick={() => { if (window.confirm('Remove "' + a.name + '"?')) onRemove(a.name); }}>×</button>
      </div>
    );
  };

  return (
    <div className="card span-4">
      <div className="card-head">
        <div>
          <div className="card-eyebrow">Net worth</div>
          <div className="card-title">Accounts</div>
        </div>
        <button className="ghost-btn" onClick={() => setOpen((v) => !v)}><IcoPlus /> Add</button>
      </div>
      <div style={{ padding: "14px 20px 18px" }}>
        <div className="acct-total">
          <span className="acct-total-lab">Total across {accounts.length} account{accounts.length === 1 ? "" : "s"}</span>
          <span className="acct-total-val">{window.fmtMoney(total, currency, { abbr: true })}</span>
        </div>
        {/* allocation bar by kind */}
        {total > 0 && (
          <div className="alloc-bar" style={{ marginTop: 12 }}>
            {groups.map(({ k, rows }) => {
              const sum = rows.reduce((a, x) => a + (x.balance || 0), 0);
              return sum > 0 ? <div key={k.id} className="alloc-seg" style={{ width: (sum / total) * 100 + "%", background: k.hue }} title={k.label + " · " + window.fmtMoney(sum, currency, { abbr: true })}></div> : null;
            })}
          </div>
        )}

        {open && (
          <div className="sp-add acct-add" style={{ marginTop: 14, marginBottom: 6, flexWrap: "wrap" }}>
            <input className="sp-add-name" placeholder="Account name (e.g. Revolut · main)" value={name}
              onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} autoFocus />
            <select className="se-cat sp-add-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              {kinds.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
            <input className="sp-add-name acct-add-bal" style={{ flex: "0 0 110px" }} type="number" inputMode="numeric"
              placeholder={"Balance " + ((window.CURRENCIES[currency] || {}).code || "")} value={bal}
              onChange={(e) => setBal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
            <button className="ghost-btn" onClick={add} disabled={!name.trim()}><IcoPlus /> Save</button>
          </div>
        )}

        <div className="acct-groups" style={{ marginTop: 14 }}>
          {groups.map(({ k, rows }) => (
            <div className="acct-group" key={k.id}>
              <div className="acct-group-head">
                <span className="acct-group-lab" style={{ color: k.hue }}>{k.label}</span>
                <span className="acct-group-sum">{window.fmtMoney(rows.reduce((a, x) => a + (x.balance || 0), 0), currency, { abbr: true })}</span>
              </div>
              {rows.map(Row)}
            </div>
          ))}
          {untyped.length > 0 && (
            <div className="acct-group">
              <div className="acct-group-head"><span className="acct-group-lab">Other</span></div>
              {untyped.map(Row)}
            </div>
          )}
          {accounts.length === 0 && (
            <div className="sp-empty">No accounts yet. Add your banks, brokerage and pension accounts to track total net worth.</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- main panel ---------- */
const STRAT_LS_KEY = "shelf-strategie-v2";

function StrategiePanel({ currency, onCurrency, onToast }) {
  const { useState, useRef, useEffect, useCallback } = React;

  const [state, setState] = useState(() => {
    try {
      const s = localStorage.getItem(STRAT_LS_KEY);
      if (s) {
        const parsed = JSON.parse(s);
        if (parsed && parsed.statements && parsed.positions) {
          const merged = { ...window.STRAT_STATE, ...parsed };
          // schema migration: accounts gained kind/balance — refresh the slice if the
          // stored one predates it (no entry has a `kind`), preserving everything else.
          const dir = merged.accountsDirectory || [];
          if (dir.length === 0 || !dir.some((a) => a.kind) || merged.acctSchemaV !== window.STRAT_STATE.acctSchemaV) {
            merged.accountsDirectory = window.STRAT_STATE.accountsDirectory;
            merged.acctSchemaV = window.STRAT_STATE.acctSchemaV;
          }
          return merged;
        }
      }
    } catch (e) { /* fall through */ }
    return window.STRAT_STATE;
  });
  useEffect(() => {
    try { localStorage.setItem(STRAT_LS_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }, [state]);

  const [spName, setSpName] = useState("");
  const [spKind, setSpKind] = useState("savings");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorImportOpen, setEditorImportOpen] = useState(false);
  const [editorTarget, setEditorTarget] = useState(null); // {month, week} from a chart selection
  const [potMenuOpen, setPotMenuOpen] = useState(false);
  const potMenuRef = useRef(null);

  const [scenarioId, setScenarioId] = useState("balanced");
  const [horizon, setHorizon] = useState(120);
  const [monthly, setMonthly] = useState(300);
  const [heroFace, setHeroFace] = useState("grow");
  const [spendRange, setSpendRange] = useState(1);
  const [hiddenCats, setHiddenCats] = useState([]);
  const [detailRung, setDetailRung] = useState(null);
  const [rungTip, setRungTip] = useState(null);
  const ladderRef = useRef(null);

  const { statements, positions, pots, savingsPlans } = state;
  const cur = currency;
  const cur2 = state.secondaryCurrency;
  const compareOn = state.compareCurrencyOn && !!cur2 && cur2 !== cur;

  const byMonth = Object.keys(statements.byMonth).length > 0 ? statements.byMonth : window.DEFAULT_STATEMENTS;
  const activeKey = statements.current in byMonth ? statements.current : (statements.order[0] || "2026-04");
  const stmt = byMonth[activeKey] || { income: [], expenses: [] };

  const sortedKeys = Object.keys(byMonth).sort();
  const activeIdx = sortedKeys.indexOf(activeKey);
  const prevKey = activeIdx > 0 ? sortedKeys[activeIdx - 1] : undefined;
  const prevStmt = prevKey ? byMonth[prevKey] : undefined;

  const inc = window.totalIncome(stmt);
  const expAll = window.totalExpenses(stmt);
  const toPlansMonth = stmt.expenses.reduce((s, e) => s + (e.savingsPlanId ? e.amt : 0), 0);
  const exp = expAll - toPlansMonth;
  const surplus = inc - expAll;

  // savings-plan contributions: active month + all time, per plan
  const planMonth = {}, planTotal = {};
  for (const [mk, mo] of Object.entries(byMonth)) {
    for (const e of mo.expenses) {
      if (!e.savingsPlanId) continue;
      planTotal[e.savingsPlanId] = (planTotal[e.savingsPlanId] || 0) + e.amt;
      if (mk === activeKey) planMonth[e.savingsPlanId] = (planMonth[e.savingsPlanId] || 0) + e.amt;
    }
  }
  const plansContribTotal = Object.values(planTotal).reduce((a, b) => a + b, 0);

  const SP_HUES = ["#6595ee", "#34c891", "#a384df", "#e08648", "#e07a93", "#8b8b95"];
  const addPlan = () => {
    const name = spName.trim();
    if (!name) return;
    setState((s) => ({
      ...s,
      savingsPlans: [...s.savingsPlans, { id: "sp" + Date.now(), name, kind: spKind, hue: SP_HUES[s.savingsPlans.length % SP_HUES.length] }],
    }));
    setSpName("");
    onToast && onToast("Added program: " + name);
  };
  const renamePlan = (id, name) => setState((s) => ({ ...s, savingsPlans: s.savingsPlans.map((p) => (p.id === id ? { ...p, name } : p)) }));
  const removePlan = (id) => setState((s) => ({ ...s, savingsPlans: s.savingsPlans.filter((p) => p.id !== id) }));

  // spend chart range: consecutive months ending at the active month
  const spendMonths = (() => {
    const earliest = [...sortedKeys, activeKey].sort()[0];
    const keys = [];
    let k = activeKey;
    while (keys.length < (spendRange === 0 ? 600 : spendRange) && (spendRange !== 0 || k >= earliest)) {
      keys.unshift(k);
      if (spendRange !== 0 && keys.length >= spendRange) break;
      if (spendRange === 0 && k <= earliest) break;
      k = window.stepMonth(k, -1);
    }
    return keys.map((mk) => ({ key: mk, stmt: byMonth[mk] || { income: [], expenses: [] } }));
  })();
  const spendCats = window.CAT_KEYS.filter((k) =>
    spendMonths.some((m) => m.stmt.expenses.some((e) => !e.savingsPlanId && e.cat === k && e.amt > 0))
  );
  const toggleCat = (k) => setHiddenCats((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k]));

  const scenario = window.RETURN_SCENARIOS.find((s) => s.id === scenarioId) || window.RETURN_SCENARIOS[1];
  const projPts = window.project(positions.invested, monthly, scenario.rate, horizon);
  const projFinal = projPts.length ? projPts[projPts.length - 1].bal : positions.invested;

  const byCat = window.expensesByCat(stmt);
  const totalExp = exp || 1;
  const emergencyPct = Math.min(100, Math.round((positions.emergencySaved / positions.emergencyTarget) * 100));
  const netWorth = positions.invested + positions.emergencySaved;
  const proj5y = (() => { const p = window.project(positions.invested, monthly, window.RETURN_SCENARIOS[1].rate, 60); return p.length ? p[p.length - 1].bal : 0; })();

  useEffect(() => {
    if (!potMenuOpen) return;
    function handle(e) {
      if (potMenuRef.current && !potMenuRef.current.contains(e.target)) setPotMenuOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [potMenuOpen]);

  const buylistItems = (window.SHELF_DATA && window.SHELF_DATA.hopper ? window.SHELF_DATA.hopper : []).map((h, i) => ({ id: "bl" + i, title: h.name }));

  const addPot = useCallback((name, fromHopper) => {
    setState((s) => ({
      ...s,
      pots: [...s.pots, { id: "pot" + Date.now(), name, saved: 0, target: 1000, monthly: 100, fromHopper: !!fromHopper }],
    }));
  }, []);
  const handleAddFromHopper = useCallback((item) => {
    addPot(item.title, true);
    setPotMenuOpen(false);
    onToast && onToast("Added pot: " + item.title);
  }, [addPot, onToast]);
  const handleAddBlankPot = useCallback(() => {
    const name = window.prompt("Pot name:");
    if (name && name.trim()) addPot(name.trim(), false);
    setPotMenuOpen(false);
  }, [addPot]);

  // a range selected on the spend chart → straight into the bulk-edit review table for those days
  const openRangeInEditor = useCallback((info) => {
    const month = byMonth[info.monthKey] ? info.monthKey : activeKey;
    setEditorTarget({
      month,
      week: null,
      range: month === info.monthKey ? { startIso: info.startIso, endIso: info.endIso } : null,
      ids: info.ids && info.ids.length ? info.ids : null,
      bulk: true,
    });
    setEditorOpen(true);
  }, [byMonth, activeKey]);

  const onSaveStatement = (book, order, active) => {
    setState((s) => ({ ...s, statements: { byMonth: book, order, current: active } }));
    setEditorOpen(false);
    setEditorImportOpen(false);
    setEditorTarget(null);
    onToast && onToast("Statement saved");
  };
  const onSetRungAccounts = (rungId, rows) =>
    setState((s) => ({ ...s, rungAccounts: { ...s.rungAccounts, [rungId]: rows } }));

  // live rung rows: persisted edits win, else the seed accounts (same rule as LadderDetail)
  const rungRows = (rung) => {
    const persisted = state.rungAccounts[rung.id];
    if (persisted) {
      return persisted.map((p) => {
        const d = state.accountsDirectory.find((x) => x.name === p.accountRef);
        return { name: p.accountRef, tag: d ? d.tag : "", balance: p.balance };
      });
    }
    return (rung.accounts || []).map((a) => ({ name: a.name, tag: a.tag, balance: a.balance }));
  };
  const ladderGrand = window.DEFAULT_LADDER.reduce(
    (s, r) => s + rungRows(r).reduce((a, x) => a + (x.balance || 0), 0), 0);
  const moveRungTip = (e, rung) => {
    const card = ladderRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setRungTip({ rung, x, y, flipX: x > rect.width * 0.45, flipY: y > rect.height * 0.62 });
  };
  const onUpsertAccountDictEntry = (entry) =>
    setState((s) => {
      const dir = [...s.accountsDirectory];
      const i = dir.findIndex((d) => d.name === entry.name);
      if (i >= 0) dir[i] = { ...dir[i], ...entry };
      else dir.push(entry);
      return { ...s, accountsDirectory: dir };
    });
  const onRemoveAccount = (name) =>
    setState((s) => ({ ...s, accountsDirectory: s.accountsDirectory.filter((d) => d.name !== name) }));
  const onAddAccount = (entry) =>
    setState((s) => {
      if (s.accountsDirectory.some((d) => d.name === entry.name)) return s;
      return { ...s, accountsDirectory: [...s.accountsDirectory, entry] };
    });

  const allWeeks = window.monthWeeks(activeKey);

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
            {Object.keys(window.CURRENCIES).slice(0, 6).map((c) => (
              <button key={c} className={"seg-btn" + (cur === c ? " on" : "")} onClick={() => onCurrency(c)}>{c}</button>
            ))}
          </div>
          {cur2 && (
            <button
              className={"ghost-btn cur-compare" + (compareOn ? " on" : "")}
              onClick={() => setState((s) => ({ ...s, compareCurrencyOn: !s.compareCurrencyOn }))}
              title={compareOn ? "Hide " + cur2 + " comparison" : "Show " + cur2 + " comparison"}>
              <span className="cur-compare-arr" aria-hidden="true">↔</span>
              <span>{cur2}</span>
            </button>
          )}
          <button className={"ghost-btn" + (Object.keys(statements.byMonth).length > 0 ? " ok" : "")} onClick={() => setEditorOpen(true)}>
            <IcoFile />
            {Object.keys(statements.byMonth).length > 0 ? "Statement · " + window.monthAbbr(activeKey) : "Import statement"}
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="kpi-row" style={{ marginBottom: 16 }}>
        <div className="kpi">
          <div className="kpi-lab">Net worth</div>
          <div className="kpi-val">{window.fmtMoney(netWorth, cur, { abbr: true })}</div>
          {compareOn && <div className="kpi-cmp">≈ {window.fmtMoney(netWorth, cur2, { abbr: true })}</div>}
          <div className="kpi-sub">Invested + emergency</div>
        </div>
        <div className="kpi accent">
          <div className="kpi-lab">Monthly surplus</div>
          <div className="kpi-val">{window.fmtMoney(surplus, cur, { abbr: true })}</div>
          {compareOn && <div className="kpi-cmp">≈ {window.fmtMoney(surplus, cur2, { abbr: true })}</div>}
          <div className={"kpi-sub" + (surplus > 0 ? " up" : "")}>{surplus > 0 ? "Positive cashflow" : "Negative cashflow"}</div>
        </div>
        <div className="kpi">
          <div className="kpi-lab">Projected 5Y</div>
          <div className="kpi-val">{window.fmtMoney(proj5y, cur, { abbr: true })}</div>
          {compareOn && <div className="kpi-cmp">≈ {window.fmtMoney(proj5y, cur2, { abbr: true })}</div>}
          <div className="kpi-sub">At {window.RETURN_SCENARIOS[1].rate}% p.a.</div>
        </div>
        <div className="kpi">
          <div className="kpi-lab">Emergency cover</div>
          <div className="kpi-val">{emergencyPct}%</div>
          <div className="kpi-sub">{window.fmtMoney(positions.emergencySaved, cur, { abbr: true })} of {window.fmtMoney(positions.emergencyTarget, cur, { abbr: true })}</div>
        </div>
      </div>

      {/* main grid */}
      <div className="strat-grid">

        {/* hero: projection ↔ spending flip — span 8 */}
        <div className="card span-8">
          <div className="card-head">
            <div>
              <div className="card-eyebrow">Wealth projection</div>
              <div className="card-title">{heroFace === "grow" ? "Compounding engine" : "Where the money goes"}</div>
            </div>
            <div className="hero-head-r">
              {heroFace === "grow" && (
                <div className="seg">
                  {window.RETURN_SCENARIOS.map((s) => (
                    <button key={s.id} className={"seg-btn" + (scenarioId === s.id ? " on" : "")} onClick={() => setScenarioId(s.id)}>
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
              <button className={"hero-flip-btn" + (heroFace === "spend" ? " on" : "")}
                onClick={() => setHeroFace((f) => (f === "grow" ? "spend" : "grow"))} title="Flip card">
                <IcoFlip />
              </button>
            </div>
          </div>
          <div className="hero-scene">
            <div className={"hero-stack" + (heroFace === "spend" ? " flipped" : "")}>
              <div className="hero-face hero-front">
                <div className="proj-figure">
                  <div className="proj-head">
                    <div className="proj-big">{window.fmtMoney(projFinal, cur, { abbr: true })}</div>
                    <div className="proj-cap">in {Math.round(horizon / 12)} years at {scenario.rate}% p.a.</div>
                  </div>
                  <div className="proj-split">
                    <div className="split-item">
                      <span className="sw sw-contrib"></span>
                      {window.fmtMoney(positions.invested + monthly * horizon, cur, { abbr: true })} contrib.
                    </div>
                    <div className="split-item">
                      <span className="sw sw-growth"></span>
                      {window.fmtMoney(Math.max(0, projFinal - positions.invested - monthly * horizon), cur, { abbr: true })} growth
                    </div>
                  </div>
                  <ProjectionChart principal={positions.invested} monthly={monthly} scenarioRate={scenario.rate} horizon={horizon} />
                </div>
                <div className="proj-controls">
                  <div>
                    <div className="ctl-lab">
                      Monthly contribution <span className="ctl-val">{window.fmtMoney(monthly, cur)}</span>
                    </div>
                    <input className="slider" type="range" min={0} max={2500} step={50}
                      value={monthly} onChange={(e) => setMonthly(Number(e.target.value))} />
                  </div>
                  <div>
                    <div className="ctl-lab">
                      Horizon <span className="ctl-val">{Math.round(horizon / 12)} years</span>
                    </div>
                    <input className="slider" type="range" min={12} max={360} step={12}
                      value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} />
                  </div>
                </div>
              </div>
              <div className={"hero-face hero-back" + (heroFace === "grow" ? " is-hidden" : "")}>
                <div className="proj-figure">
                  <div className="proj-head">
                    <div className="proj-big">{window.fmtMoney(exp, cur, { abbr: true })}</div>
                    <div className="proj-cap">monthly spending · {window.monthAbbr(activeKey)}</div>
                  </div>
                  <div className="proj-split">
                    <div className="split-item">
                      <span className="sw sw-spend"></span>
                      {((exp / (inc || 1)) * 100).toFixed(0)}% of income
                    </div>
                    <div className="split-item" style={{ color: surplus >= 0 ? "var(--accent)" : "#ef4444" }}>
                      {surplus >= 0 ? "+" : ""}{window.fmtMoney(surplus, cur, { abbr: true })} surplus
                    </div>
                    {toPlansMonth > 0 && (
                      <div className="split-item" title="Statement rows tagged as savings-plan contributions — not counted as spending">
                        {window.fmtMoney(toPlansMonth, cur, { abbr: true })} to savings
                      </div>
                    )}
                  </div>
                  <div className="dsp-controls">
                    <div className="seg">
                      {[[1, "Month"], [3, "3 mo"], [6, "6 mo"], [0, "All"]].map(([v, l]) => (
                        <button key={v} className={"seg-btn" + (spendRange === v ? " on" : "")} onClick={() => setSpendRange(v)}>
                          {l}
                        </button>
                      ))}
                    </div>
                    <div className="dsp-cats">
                      {spendCats.map((k) => (
                        <button key={k} className={"dsp-cat" + (hiddenCats.includes(k) ? " off" : "")}
                          onClick={() => toggleCat(k)}
                          title={hiddenCats.includes(k) ? "Show " + window.STMT_CATS[k].label : "Hide " + window.STMT_CATS[k].label}
                          aria-pressed={!hiddenCats.includes(k)}>
                          <span className="dsp-cat-dot" style={{ background: window.STMT_CATS[k].hue }}></span>
                          {window.STMT_CATS[k].label}
                        </button>
                      ))}
                      {hiddenCats.length > 0 && (
                        <button className="dsp-cat dsp-cat--reset" onClick={() => setHiddenCats([])}>show all</button>
                      )}
                    </div>
                  </div>
                  <DailySpendChart months={spendMonths} cur={cur} hidden={hiddenCats} onOpenRange={openRangeInEditor} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* order of operations — span 4 */}
        <div className="card span-4 ladder-card" ref={ladderRef}>
          <div className="card-head">
            <div>
              <div className="card-eyebrow">The method</div>
              <div className="card-title">Order of operations</div>
            </div>
          </div>
          <ol className="ladder" onMouseLeave={() => setRungTip(null)}>
            {window.DEFAULT_LADDER.map((rung) => (
              <li key={rung.id} className={"rung rung--" + rung.status}>
                <button className="rung-hit" onClick={() => setDetailRung(rung)}
                  onMouseMove={(e) => moveRungTip(e, rung)}
                  aria-label={"Open " + rung.title + " details"}>
                  <span className="rung-mark">
                    {rung.status === "done" ? <IcoCheck /> : rung.status === "queued" ? <IcoLock /> : <span className="rung-i">{rung.id}</span>}
                  </span>
                  <span className="rung-body">
                    <span className="rung-title">{rung.title}</span>
                    <span className="rung-note">{rung.note}</span>
                    {rung.status === "active" && typeof rung.pct === "number" && (
                      <span className="rung-bar"><span style={{ width: rung.pct + "%" }}></span></span>
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
          {rungTip && (() => {
            const rows = rungRows(rungTip.rung).slice().sort((a, b) => (b.balance || 0) - (a.balance || 0));
            const total = rows.reduce((a, r) => a + (r.balance || 0), 0);
            const share = ladderGrand > 0 ? Math.round((total / ladderGrand) * 100) : 0;
            const OPS = [1, 0.68, 0.45, 0.3, 0.2];
            return (
              <div className="rung-tip"
                style={{
                  left: rungTip.x + 14, top: rungTip.y + 14,
                  transform: (rungTip.flipX ? "translateX(calc(-100% - 28px))" : "") + " " + (rungTip.flipY ? "translateY(calc(-100% - 28px))" : ""),
                  "--step-hue": rungTip.rung.hue || "var(--accent)",
                }}>
                <div className="rung-tip-head">
                  <b>Step {rungTip.rung.id} · {rungTip.rung.title}</b>
                  <span>{window.fmtMoney(total, cur, { abbr: true })}</span>
                </div>
                {rows.length > 0 ? (
                  <React.Fragment>
                    {total > 0 && (
                      <div className="rung-tip-bar">
                        {rows.map((r, i) => (
                          <span key={i} style={{ width: ((r.balance || 0) / total) * 100 + "%", background: "var(--step-hue)", opacity: OPS[i % OPS.length] }}></span>
                        ))}
                      </div>
                    )}
                    {rows.map((r, i) => (
                      <div className="rung-tip-row" key={i}>
                        <span className="rung-tip-dot" style={{ background: "var(--step-hue)", opacity: OPS[i % OPS.length] }}></span>
                        <span className="rung-tip-lab">{r.name}{r.tag ? <span className="rung-tip-tag"> · {r.tag}</span> : null}</span>
                        <span className="rung-tip-pct">{total > 0 ? Math.round(((r.balance || 0) / total) * 100) + "%" : "—"}</span>
                        <span className="rung-tip-amt">{window.fmtMoney(r.balance || 0, cur, { abbr: true })}</span>
                      </div>
                    ))}
                    <div className="rung-tip-foot">
                      <span className="rung-tip-foot-bar"><span style={{ width: share + "%" }}></span></span>
                      {share}% of all parked money sits in this step
                    </div>
                  </React.Fragment>
                ) : (
                  <div className="rung-tip-empty">Nothing parked here yet — unlocks once the earlier steps are funded.</div>
                )}
              </div>
            );
          })()}
        </div>

        {/* month-close diff — span 4 */}
        <MonthCloseDiff prevKey={prevKey} currKey={activeKey} prevStmt={prevStmt} currStmt={stmt} currency={cur} />

        {/* weekly spending — span 8 */}
        <div className="card span-8">
          <div className="card-head" role="button" tabIndex={0} style={{ cursor: "pointer" }}
            onClick={() => { setEditorImportOpen(true); setEditorOpen(true); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditorImportOpen(true); setEditorOpen(true); } }}
            title="Bring in a bank statement">
            <div>
              <div className="card-eyebrow">Spending</div>
              <div className="card-title">Weekly breakdown — {window.monthLabel(activeKey)}</div>
            </div>
          </div>
          <div className="wk-chart">
            {allWeeks.map((w) => {
              const wExp = stmt.expenses.filter((e) => window.weekOfDate(activeKey, e.date) === w.idx);
              const wTotal = wExp.reduce((s, e) => s + e.amt, 0);
              const weekAvg = exp / (allWeeks.length || 1);
              const trackMax = Math.max(
                ...allWeeks.map((ww) =>
                  stmt.expenses.filter((e) => window.weekOfDate(activeKey, e.date) === ww.idx).reduce((s, e) => s + e.amt, 0)
                ), 1);
              const avgtickPct = (weekAvg / trackMax) * 100;
              return (
                <div key={w.idx} className="wk-row">
                  <div className="wk-meta">
                    <div className="wk-name">{w.label}</div>
                    <div className="wk-range">{w.range}</div>
                  </div>
                  <div className="wk-track">
                    <div className="wk-bar" style={{ width: (wTotal / trackMax) * 100 + "%" }}>
                      {window.CAT_KEYS.map((cat) => {
                        const catAmt = wExp.filter((e) => e.cat === cat && !e.savingsPlanId).reduce((s, e) => s + e.amt, 0);
                        if (!catAmt) return null;
                        return (
                          <div key={cat} className="wk-seg"
                            style={{ width: (catAmt / (wTotal || 1)) * 100 + "%", background: window.STMT_CATS[cat].hue }}
                            title={window.STMT_CATS[cat].label + ": " + window.fmtMoney(catAmt, cur)} />
                        );
                      })}
                    </div>
                    <div className="wk-avgtick" style={{ left: avgtickPct + "%" }}></div>
                  </div>
                  <div className={"wk-amt" + (wTotal > weekAvg * 1.3 ? " over" : "")}>
                    {window.fmtMoney(wTotal, cur, { abbr: true })}
                  </div>
                </div>
              );
            })}
            <div className="wk-foot">
              <div className="wk-avg-key">
                <div className="wk-avg-dash"></div>
                Weekly avg {window.fmtMoney(exp / (allWeeks.length || 1), cur, { abbr: true })}
              </div>
              <div className="wk-legend">
                {window.CAT_KEYS.filter((k) => byCat[k] > 0).map((k) => (
                  <div key={k} className="wk-leg">
                    <div className="wk-leg-dot" style={{ background: window.STMT_CATS[k].hue }}></div>
                    {window.STMT_CATS[k].label}
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
                <span>Total income</span><span>{window.fmtMoney(inc, cur)}</span>
              </div>
              {stmt.income.map((r) => (
                <div key={r.id} className="flow-row sub">
                  <span style={{ color: "var(--dim)" }}>{r.label || r.kind}</span>
                  <span>{window.fmtMoney(r.amt, cur)}</span>
                </div>
              ))}
              <div className="flow-row total">
                <span>Total expenses</span>
                <span style={{ color: "#ef4444" }}>{window.fmtMoney(exp, cur)}</span>
              </div>
              {window.CAT_KEYS.filter((k) => byCat[k] > 0).map((k) => (
                <div key={k} className="flow-row sub">
                  <span style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--dim)" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: window.STMT_CATS[k].hue, display: "inline-block" }}></span>
                    {window.STMT_CATS[k].label}
                  </span>
                  <span>{window.fmtMoney(byCat[k], cur)}</span>
                </div>
              ))}
              <div className="flow-row total" style={{ color: surplus >= 0 ? "var(--accent)" : "#ef4444" }}>
                <span>Net surplus</span>
                <span>{surplus >= 0 ? "+" : ""}{window.fmtMoney(surplus, cur)}</span>
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
              <React.Fragment>
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <svg viewBox="0 0 36 36" style={{ width: 100, height: 100, flexShrink: 0 }}>
                    <circle className="ring-track" cx="18" cy="18" r="13" />
                    {(() => {
                      if (plansContribTotal <= 0) return null;
                      const r = 13;
                      const c = 2 * Math.PI * r;
                      let offset = 0;
                      return savingsPlans.map((p) => {
                        const share = (planTotal[p.id] || 0) / plansContribTotal;
                        if (share <= 0) return null;
                        const dash = share * c;
                        const el = (
                          <circle key={p.id} className="ring-fill" cx="18" cy="18" r={r}
                            stroke={p.hue}
                            strokeDasharray={dash + " " + (c - dash)}
                            strokeDashoffset={-offset}
                            transform="rotate(-90 18 18)" />
                        );
                        offset += dash;
                        return el;
                      });
                    })()}
                  </svg>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ring-cap">{window.fmtMoney(plansContribTotal, cur, { abbr: true })}</div>
                    <div style={{ fontSize: 11, color: "var(--dim)", marginTop: 2 }}>
                      Contributed{toPlansMonth > 0 ? " · " + window.fmtMoney(toPlansMonth, cur, { abbr: true }) + " this month" : ""}
                    </div>
                  </div>
                </div>
                {plansContribTotal > 0 && (
                  <div className="alloc-bar">
                    {savingsPlans.map((p) => {
                      const share = (planTotal[p.id] || 0) / plansContribTotal;
                      return share > 0
                        ? <div key={p.id} className="alloc-seg" style={{ width: share * 100 + "%", background: p.hue }}></div>
                        : null;
                    })}
                  </div>
                )}
                <div className="alloc-legend" style={{ marginTop: plansContribTotal > 0 ? 0 : 14 }}>
                  {savingsPlans.map((p) => (
                    <div key={p.id} className="alloc-row sp-row">
                      <div className="alloc-dot" style={{ background: p.hue }}></div>
                      <div className="alloc-name" title="Double-click to rename"
                        onDoubleClick={() => {
                          const name = (window.prompt('Rename "' + p.name + '"', p.name) || "").trim();
                          if (name && name !== p.name) renamePlan(p.id, name);
                        }}>
                        <span>{p.name}</span>
                        <span className="sp-kind">{(window.SAVINGS_PLAN_KINDS.find((k) => k.id === p.kind) || {}).label || p.kind}</span>
                      </div>
                      <div className="alloc-pct" title={"Contributed in " + window.monthAbbr(activeKey)}>
                        {planMonth[p.id] ? window.fmtMoney(planMonth[p.id], cur, { abbr: true }) : "—"}
                      </div>
                      <div className="alloc-amt" title="Contributed all time">
                        {window.fmtMoney(planTotal[p.id] || 0, cur, { abbr: true })}
                      </div>
                      <button className="sp-del" title={"Remove " + p.name}
                        onClick={() => {
                          if (window.confirm('Remove "' + p.name + '"? Statement rows keep their amounts but lose the link to this program.'))
                            removePlan(p.id);
                        }}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </React.Fragment>
            )}
            {savingsPlans.length === 0 && (
              <div className="sp-empty">
                No savings programs yet. Add one below, then tag statement rows
                (in the import or the statement editor) as contributions — they'll
                stop counting as spending and show up here instead.
              </div>
            )}
            <div className="sp-add">
              <input className="sp-add-name" placeholder="e.g. Building savings ČS" value={spName}
                onChange={(e) => setSpName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addPlan(); }} />
              <select className="se-cat sp-add-kind" value={spKind} onChange={(e) => setSpKind(e.target.value)}>
                {window.SAVINGS_PLAN_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
              <button className="ghost-btn" onClick={addPlan} disabled={!spName.trim()}><IcoPlus /> Add</button>
            </div>
          </div>
        </div>

        {/* accounts — where the money lives — span 4 */}
        <AccountsCard accounts={state.accountsDirectory} currency={cur}
          onAdd={onAddAccount} onUpdate={onUpsertAccountDictEntry} onRemove={onRemoveAccount} onToast={onToast} />

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
                    <React.Fragment>
                      <div style={{ fontSize: 10, color: "var(--dim)", padding: "4px 10px 2px", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 4 }}>
                        <IcoHopper /> From hopper
                      </div>
                      {buylistItems.map((item) => (
                        <div key={item.id} className="pot-menu-item" onClick={() => handleAddFromHopper(item)}>
                          {item.title}
                        </div>
                      ))}
                    </React.Fragment>
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
                      <div className="pot-fig">{window.fmtMoney(pot.saved, cur)} of {window.fmtMoney(pot.target, cur)}</div>
                    </div>
                    {pot.fromHopper && <span className="pot-flag"><IcoHopper /></span>}
                  </div>
                  <div className="pot-bar"><span style={{ width: pct + "%" }}></span></div>
                  <div className="pot-foot">
                    <span>{pct}% complete</span>
                    {mos !== null && <span>{mos} mo at {window.fmtMoney(pot.monthly, cur)}/mo</span>}
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
            {window.DEFAULT_PILLARS.map((p) => (
              <div key={p.id} className="pillar-row">
                <div className={"life-card" + (p.tone === "warn" ? " tone-warn" : "")} style={{ flex: 1 }}>
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
              {window.CAT_KEYS.filter((k) => byCat[k] > 0).map((k) => {
                const pct = (byCat[k] / totalExp) * 100;
                return (
                  <div key={k} style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 100, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: window.STMT_CATS[k].hue }}></div>
                      <span style={{ fontSize: 12, color: "var(--fg-2)" }}>{window.STMT_CATS[k].label}</span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--fg)" }}>{window.fmtMoney(byCat[k], cur)}</div>
                    <div style={{ height: 4, background: "var(--surface-2)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: pct + "%", height: "100%", background: window.STMT_CATS[k].hue, borderRadius: 2 }}></div>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--dim)" }}>{pct.toFixed(0)}%</div>
                  </div>
                );
              })}
              {window.CAT_KEYS.every((k) => !byCat[k]) && (
                <div style={{ fontSize: 12, color: "var(--faint)", padding: "8px 0" }}>No expenses recorded.</div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* editor modal (contains the import) */}
      {editorOpen && (
        <StatementEditor
          open={editorOpen}
          book={byMonth}
          order={sortedKeys}
          startMonth={editorTarget ? editorTarget.month : activeKey}
          initialWeek={editorTarget ? editorTarget.week : null}
          initialRange={editorTarget ? editorTarget.range : null}
          initialBulk={editorTarget ? !!editorTarget.bulk : false}
          initialIds={editorTarget ? editorTarget.ids : null}
          currency={cur}
          savingsPlans={savingsPlans}
          defaultImportOpen={editorImportOpen}
          onClose={() => { setEditorOpen(false); setEditorImportOpen(false); setEditorTarget(null); }}
          onSave={onSaveStatement}
        />
      )}

      {/* ladder detail modal */}
      {detailRung && (
        <LadderDetail
          rung={detailRung}
          currency={cur}
          totalSteps={window.DEFAULT_LADDER.length}
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

Object.assign(window, { StrategiePanel, StatementEditor });
