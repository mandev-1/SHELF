import { useState, useEffect, useRef } from "react";
import type {
  StrategieState, MonthStatement, CatKey, IncomeRow, ExpenseRow, MembershipRow, SavingsPlan,
} from "../../types/grid";
import {
  dayStr, daysInMonth, monthWeeks, weekOfDate, stepMonth, monthLabel, monthAbbr,
  cloneMonth, fmtMoney, CURRENCIES, STMT_CATS, CAT_KEYS_BY_LABEL,
} from "./strategie";
import { brandMatch, BrandMark, BRAND_COLORS } from "./brandLogos";
import {
  IcoX, IcoChev, IcoPlus, IcoTrash, IcoIn, IcoOut,
  IcoFile, IcoCheck, IcoRepeat, IcoPencil, IcoUpload,
} from "./icons";
import { StatementImport } from "./StatementImport";

const MEM_PALETTE = [
  "#E50914", "#FF6B2C", "#F59E0B", "#1DB954", "#10A37F",
  "#3B82F6", "#1A47BE", "#8B5CF6", "#EC4899", "#8E8E93",
];

function memInitials(name: string): string {
  return (name || "")
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export interface StatementEditorProps {
  statements: StrategieState["statements"] & { byMonth: Record<string, MonthStatement> };
  currency: string;
  memberships: MembershipRow[];
  savingsPlans?: SavingsPlan[];
  onSave: (
    book: Record<string, MonthStatement>,
    order: string[],
    active: string,
    memberships: MembershipRow[],
  ) => void;
  onClose: () => void;
  /** Open the "Bring in a bank statement" modal as soon as the editor mounts. */
  defaultImportOpen?: boolean;
}

type MemEditorState = {
  mode: "add" | "edit";
  id?: string;
  name: string;
  plan: string;
  price: string;
  color: string;
  mono: string;
  monoTouched: boolean;
};

export function StatementEditor({ statements, currency, memberships, savingsPlans = [], onSave, onClose, defaultImportOpen = false }: StatementEditorProps) {
  const cur = CURRENCIES[currency] ?? CURRENCIES["USD"];
  const sym = cur.code === "CZK" ? "Kč" : cur.code === "EUR" ? "€" : "$";

  const shown = (base: number) => Math.round((base || 0) * cur.rate);
  const toBase = (n: number) => n / cur.rate;
  const fmt = (base: number) =>
    new Intl.NumberFormat(cur.locale, {
      style: "currency",
      currency: cur.code,
      maximumFractionDigits: 0,
    }).format((base || 0) * cur.rate);

  const [draft, setDraft] = useState<Record<string, MonthStatement>>(() =>
    JSON.parse(JSON.stringify(statements.byMonth))
  );
  const [keys, setKeys] = useState<string[]>([...statements.order]);
  const [viewKey, setViewKey] = useState(statements.current);
  const [gran, setGran] = useState<"month" | "week">("month");
  // full-screen mode (same footprint as the import's review view) — toggled
  // by clicking the Spending column header
  const [maximized, setMaximized] = useState(false);
  const [weekIdx, setWeekIdx] = useState(1);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(defaultImportOpen);
  const [bulkOpen, setBulkOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const [members, setMembers] = useState<MembershipRow[]>(() => memberships.map((m) => ({ ...m })));
  const [memEditor, setMemEditor] = useState<MemEditorState | null>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const h = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [pickerOpen]);

  useEffect(() => {
    const n = monthWeeks(viewKey).length;
    setWeekIdx((w) => Math.min(Math.max(1, w), n));
  }, [viewKey]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (importOpen || bulkOpen) return; // StatementImport owns Escape while open
      if (pickerOpen) setPickerOpen(false);
      else onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [pickerOpen, onClose, importOpen, bulkOpen]);

  const cm: MonthStatement = draft[viewKey] ?? { income: [], expenses: [] };
  const incomeBase = cm.income.reduce((a, r) => a + (r.amt || 0), 0);
  const expenseBase = cm.expenses.reduce((a, r) => a + (r.amt || 0), 0);
  const surplusBase = incomeBase - expenseBase;
  const saveRate = surplusBase > 0 && incomeBase > 0 ? (surplusBase / incomeBase) * 100 : 0;

  const weeks = monthWeeks(viewKey);
  const dim = daysInMonth(viewKey);
  const weekTotals = weeks.map((w) =>
    cm.expenses
      .filter((r) => weekOfDate(viewKey, r.date) === w.idx)
      .reduce((a, r) => a + (r.amt || 0), 0)
  );
  const maxWeek = Math.max(1, ...weekTotals);
  const safeWeek = Math.min(Math.max(1, weekIdx), weeks.length);
  const weekSpend = weekTotals[safeWeek - 1] || 0;
  const avgWeek = weeks.length ? expenseBase / weeks.length : 0;
  const activeWeek = weeks[safeWeek - 1] || weeks[0];
  const defaultDay = gran === "week" && activeWeek ? activeWeek.startDay : Math.min(dim, 15);

  const sortedEx = [...cm.expenses].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const shownEx = gran === "week"
    ? sortedEx.filter((r) => weekOfDate(viewKey, r.date) === safeWeek)
    : sortedEx;
  const expShownSum = gran === "week" ? weekSpend : expenseBase;

  const pickWeek = (i: number) => { setWeekIdx(i); setGran("week"); };

  const idx = keys.indexOf(viewKey);
  const canPrev = idx > 0;

  const editIncome = (id: string, patch: Partial<IncomeRow>) =>
    setDraft((d) => ({
      ...d,
      [viewKey]: {
        ...d[viewKey],
        income: d[viewKey].income.map((r) => r.id === id ? { ...r, ...patch } : r),
      },
    }));
  const editExpense = (id: string, patch: Partial<ExpenseRow>) =>
    setDraft((d) => ({
      ...d,
      [viewKey]: {
        ...d[viewKey],
        expenses: d[viewKey].expenses.map((r) => r.id === id ? { ...r, ...patch } : r),
      },
    }));
  const removeIncome = (id: string) =>
    setDraft((d) => ({
      ...d,
      [viewKey]: { ...d[viewKey], income: d[viewKey].income.filter((r) => r.id !== id) },
    }));
  const removeExpense = (id: string) =>
    setDraft((d) => ({
      ...d,
      [viewKey]: { ...d[viewKey], expenses: d[viewKey].expenses.filter((r) => r.id !== id) },
    }));
  const addIncome = () =>
    setDraft((d) => ({
      ...d,
      [viewKey]: {
        ...d[viewKey],
        income: [...d[viewKey].income, { id: crypto.randomUUID(), label: "", amt: 0, kind: "other" }],
      },
    }));
  const addExpense = () =>
    setDraft((d) => ({
      ...d,
      [viewKey]: {
        ...d[viewKey],
        expenses: [
          ...d[viewKey].expenses,
          {
            id: crypto.randomUUID(), label: "", amt: 0,
            cat: "other" as CatKey, date: dayStr(viewKey, defaultDay),
          },
        ],
      },
    }));

  const goPrev = () => { if (canPrev) setViewKey(keys[idx - 1]); };
  const goNext = () => {
    if (idx < keys.length - 1) { setViewKey(keys[idx + 1]); return; }
    const nk = stepMonth(viewKey, 1);
    setDraft((d) => ({ ...d, [nk]: cloneMonth(d[viewKey], nk) }));
    setKeys((k) => [...k, nk]);
    setViewKey(nk);
  };
  const jumpTo = (k: string) => { setViewKey(k); setPickerOpen(false); };
  const addMonthAtEnd = () => {
    const last = keys[keys.length - 1];
    const nk = stepMonth(last, 1);
    setDraft((d) => ({ ...d, [nk]: cloneMonth(d[last], nk) }));
    setKeys((k) => [...k, nk]);
    setViewKey(nk);
    setPickerOpen(false);
  };

  const netOf = (k: string) => {
    const mo = draft[k] || { income: [], expenses: [] };
    return mo.income.reduce((a, r) => a + (r.amt || 0), 0)
         - mo.expenses.reduce((a, r) => a + (r.amt || 0), 0);
  };

  const commit = () => {
    const cleaned: Record<string, MonthStatement> = {};
    keys.forEach((k) => {
      const mo = draft[k];
      if (!mo) return;
      cleaned[k] = {
        income:   mo.income.filter((r) => r.label.trim() || r.amt),
        expenses: mo.expenses.filter((r) => r.label.trim() || r.amt),
      };
    });
    onSave(cleaned, keys, viewKey, members);
    onClose();
  };

  // Merge parsed bank-statement rows into the draft (one month-key per row's
  // month, created on demand). Nothing persists until the user hits Save.
  const handleImport = (additions: Record<string, MonthStatement>) => {
    const added = Object.keys(additions).filter(
      (k) => additions[k].income.length + additions[k].expenses.length > 0
    );
    if (added.length === 0) { setImportOpen(false); return; }
    setDraft((d) => {
      const next = { ...d };
      for (const mk of added) {
        const ex = next[mk] ?? { income: [], expenses: [] };
        next[mk] = {
          income: [...ex.income, ...additions[mk].income],
          expenses: [...ex.expenses, ...additions[mk].expenses],
        };
      }
      return next;
    });
    setKeys((k) => {
      const set = new Set(k);
      added.forEach((mk) => set.add(mk));
      return [...set].sort();
    });
    setViewKey([...added].sort()[0]);
    setGran("month");
    setImportOpen(false);
  };

  const renderAmt = (side: "income" | "expenses", r: IncomeRow | ExpenseRow) => (
    <div className="se-amt">
      <span className="se-cur">{sym}</span>
      <input
        type="text" inputMode="numeric" className="se-amt-input"
        value={r.amt ? shown(r.amt).toLocaleString(cur.locale) : ""}
        placeholder="0"
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/[^\d]/g, ""), 10);
          const amt = isNaN(n) ? 0 : toBase(n);
          if (side === "income") editIncome(r.id, { amt });
          else editExpense(r.id, { amt });
        }}
      />
    </div>
  );

  const activeMems = members.filter((m) => !m.paused);
  const memTotal = activeMems.reduce((a, m) => a + m.price, 0);
  const pausedCount = members.length - activeMems.length;
  const toggleMem = (id: string) =>
    setMembers((ms) => ms.map((m) => m.id === id ? { ...m, paused: !m.paused } : m));
  const openAddMem = () => setMemEditor({
    mode: "add", name: "", plan: "", price: "",
    color: MEM_PALETTE[5], mono: "", monoTouched: false,
  });
  const openEditMem = (m: MembershipRow) => setMemEditor({
    mode: "edit", id: m.id, name: m.name, plan: m.plan,
    price: String(shown(m.price)), color: m.color, mono: m.mono, monoTouched: true,
  });
  const updMem = (patch: Partial<MemEditorState>) =>
    setMemEditor((e) => e ? { ...e, ...patch } : e);
  const saveMem = () => {
    const ed = memEditor; if (!ed) return;
    const name = ed.name.trim() || "Untitled";
    const mono = (ed.monoTouched && ed.mono.trim())
      ? ed.mono.trim().slice(0, 2).toUpperCase()
      : (memInitials(name) || "?");
    const price = toBase(parseInt(String(ed.price).replace(/[^\d]/g, ""), 10) || 0);
    if (ed.mode === "add") {
      setMembers((ms) => [...ms, {
        id: crypto.randomUUID(),
        name, plan: ed.plan.trim(), price, color: ed.color, mono,
      }]);
    } else {
      setMembers((ms) => ms.map((x) =>
        x.id === ed.id ? { ...x, name, plan: ed.plan.trim(), price, color: ed.color, mono } : x
      ));
    }
    setMemEditor(null);
  };
  const removeMem = () => {
    if (!memEditor?.id) return;
    setMembers((ms) => ms.filter((x) => x.id !== memEditor.id));
    setMemEditor(null);
  };
  const previewMono = memEditor
    ? ((memEditor.monoTouched && memEditor.mono.trim())
      ? memEditor.mono.trim().slice(0, 2).toUpperCase()
      : (memInitials(memEditor.name) || "?"))
    : "?";

  return (
    <>
    <div className="se-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={"se-modal" + (maximized ? " se-modal--max" : "")} role="dialog" aria-modal="true" aria-label="Edit statement">
        <div className="se-head">
          <div className="se-head-l">
            <div className="se-eyebrow"><IcoFile /> Statement</div>
            <h2 className="se-title">What's coming in &amp; going out</h2>
            <p className="se-lede">
              Type in your income and what you spend on, month by month. Everything feeds your cashflow,
              savings rate and 5-year projection — live.
            </p>
          </div>
          <button className="se-import" onClick={() => setImportOpen(true)}>
            <IcoUpload /> Import statement
          </button>
          <button className="se-close" onClick={onClose} aria-label="Close"><IcoX /></button>
        </div>

        <div className="se-periodbar">
          <div className="se-stepper">
            <button className="se-nav" onClick={goPrev} disabled={!canPrev} aria-label="Previous month">
              <IcoChev dir="left" />
            </button>
            <div className="se-monthpick" ref={pickerRef}>
              <button
                className={"se-month se-month--btn" + (pickerOpen ? " open" : "")}
                onClick={() => setPickerOpen((o) => !o)}
                aria-haspopup="listbox" aria-expanded={pickerOpen}
              >
                <span className="se-month-name">
                  {monthLabel(viewKey)}
                  <span className="se-month-caret"><IcoChev dir="down" /></span>
                </span>
                <span className={"se-month-net" + (surplusBase < 0 ? " neg" : "")}>
                  {surplusBase < 0 ? "−" : "+"}{fmt(Math.abs(surplusBase))} /mo
                </span>
              </button>
              {pickerOpen && (
                <div className="se-monthmenu" role="listbox" aria-label="Pick a month">
                  {keys.map((k) => {
                    const net = netOf(k);
                    return (
                      <button
                        key={k} role="option" aria-selected={k === viewKey}
                        className={"se-mo-opt" + (k === viewKey ? " on" : "")}
                        onClick={() => jumpTo(k)}
                      >
                        <span className="se-mo-check">{k === viewKey ? <IcoCheck /> : null}</span>
                        <span className="se-mo-name">{monthLabel(k)}</span>
                        <span className={"se-mo-net" + (net < 0 ? " neg" : "")}>
                          {net < 0 ? "−" : "+"}{fmt(Math.abs(net))}
                        </span>
                      </button>
                    );
                  })}
                  <button className="se-mo-opt se-mo-add" onClick={addMonthAtEnd}>
                    <span className="se-mo-check"><IcoPlus /></span>
                    <span className="se-mo-name">Start {monthAbbr(stepMonth(keys[keys.length - 1], 1))}</span>
                  </button>
                </div>
              )}
            </div>
            <button
              className="se-nav" onClick={goNext}
              aria-label={idx === keys.length - 1 ? "Add next month" : "Next month"}
              title={idx === keys.length - 1 ? "Start " + monthAbbr(stepMonth(viewKey, 1)) : "Next month"}
            >
              {idx === keys.length - 1 ? <IcoPlus /> : <IcoChev dir="right" />}
            </button>
          </div>
          <div className="se-gran">
            <span className="se-gran-lab">Spending</span>
            <div className="seg">
              {(["month", "week"] as const).map((id) => (
                <button
                  key={id} className={"seg-btn" + (gran === id ? " on" : "")}
                  onClick={() => setGran(id)}
                >
                  {id === "month" ? "Whole month" : "By week"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="se-body">
          <section className="se-col se-col--in">
            <div className="se-col-head">
              <span className="se-col-title">
                <span className="se-pill se-pill--in"><IcoIn /></span>
                Income <small className="se-col-hint">monthly</small>
              </span>
              <span className="se-col-sum">{fmt(incomeBase)}</span>
            </div>
            <div className="se-rows">
              {cm.income.map((r) => (
                <div className="se-row" key={r.id}>
                  <input
                    className="se-label" placeholder="Source (e.g. Salary)" value={r.label}
                    onChange={(e) => editIncome(r.id, { label: e.target.value })}
                  />
                  {renderAmt("income", r)}
                  <button className="se-del" onClick={() => removeIncome(r.id)} aria-label="Remove">
                    <IcoTrash />
                  </button>
                </div>
              ))}
              {cm.income.length === 0 && <div className="se-empty">No income yet — add a row.</div>}
            </div>
            <button className="se-add" onClick={addIncome}><IcoPlus /> Add income</button>

            <div className="se-mem">
              <div className="se-mem-head">
                <span className="se-mem-title">
                  <span className="se-pill se-pill--mem"><IcoRepeat /></span>
                  Memberships <small className="se-col-hint">recurring</small>
                </span>
                <span className="se-mem-sum">{fmt(memTotal)}<small>/mo</small></span>
              </div>
              <div className="se-mem-grid">
                {members.map((m) => {
                  const off = !!m.paused;
                  const brand = brandMatch(m.name);
                  const brandColor = brand ? BRAND_COLORS[brand] : m.color;
                  return (
                    <button
                      key={m.id} type="button"
                      className={"se-tile" + (off ? " off" : "") + (brand ? " se-tile--brand" : "")}
                      style={{ ["--brand" as string]: brandColor } as React.CSSProperties}
                      onClick={() => toggleMem(m.id)}
                      aria-pressed={!off}
                      aria-label={`${m.name}${m.plan ? " · " + m.plan : ""}${off ? " (paused)" : ""}`}
                    >
                      {brand
                        ? <span className="se-tile-logo"><BrandMark brand={brand} /></span>
                        : <span className="se-tile-mono">{m.mono}</span>}
                      <span
                        className="se-tile-edit" role="button" tabIndex={-1}
                        onClick={(e) => { e.stopPropagation(); openEditMem(m); }}
                        aria-label={`Edit ${m.name}`}
                      >
                        <IcoPencil />
                      </span>
                      <span className="se-tile-tip">
                        <b>{m.name}</b>
                        {m.plan ? <i>{m.plan}</i> : null}
                        <em>{fmt(m.price)}/mo</em>
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button" className="se-tile se-tile--add"
                  aria-label="Add membership" onClick={openAddMem}
                >
                  <IcoPlus />
                </button>
              </div>

              {memEditor && (() => {
                const previewBrand = brandMatch(memEditor.name);
                const previewBrandColor = previewBrand ? BRAND_COLORS[previewBrand] : memEditor.color;
                return (
                <div className="se-mem-editor">
                  <div className="se-mem-ed-top">
                    <span
                      className={"se-tile se-tile--preview" + (previewBrand ? " se-tile--brand" : "")}
                      style={{ ["--brand" as string]: previewBrandColor } as React.CSSProperties}
                    >
                      {previewBrand
                        ? <span className="se-tile-logo"><BrandMark brand={previewBrand} /></span>
                        : <span className="se-tile-mono">{previewMono}</span>}
                    </span>
                    <div className="se-mem-ed-fields">
                      <input
                        className="se-mem-in" placeholder="Name (e.g. Netflix)"
                        value={memEditor.name} autoFocus
                        onChange={(e) => updMem({ name: e.target.value })}
                      />
                      <input
                        className="se-mem-in se-mem-in--sub" placeholder="Plan (optional)"
                        value={memEditor.plan}
                        onChange={(e) => updMem({ plan: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="se-mem-ed-row">
                    <label className="se-mem-field">
                      <span className="se-mem-flab">Price /mo</span>
                      <span className="se-mem-price">
                        <i>{cur.code}</i>
                        <input
                          inputMode="numeric" value={memEditor.price} placeholder="0"
                          onChange={(e) => updMem({ price: e.target.value.replace(/[^\d]/g, "") })}
                        />
                      </span>
                    </label>
                    <label className="se-mem-field se-mem-field--mono">
                      <span className="se-mem-flab">Badge</span>
                      <input
                        className="se-mem-in se-mem-mono-in" maxLength={2}
                        value={memEditor.mono}
                        placeholder={memInitials(memEditor.name) || "AB"}
                        onChange={(e) => updMem({ mono: e.target.value, monoTouched: true })}
                      />
                    </label>
                  </div>
                  <div className="se-mem-swatches">
                    {MEM_PALETTE.map((c) => (
                      <button
                        key={c} type="button"
                        className={"se-sw" + (memEditor.color === c ? " on" : "")}
                        style={{ ["--brand" as string]: c } as React.CSSProperties}
                        onClick={() => updMem({ color: c })}
                        aria-label={`Color ${c}`}
                      />
                    ))}
                  </div>
                  <div className="se-mem-ed-actions">
                    {memEditor.mode === "edit"
                      ? <button type="button" className="se-mem-btn se-mem-btn--del" onClick={removeMem}><IcoTrash /> Remove</button>
                      : <span />}
                    <div className="se-mem-ed-right">
                      <button type="button" className="se-mem-btn" onClick={() => setMemEditor(null)}>Cancel</button>
                      <button type="button" className="se-mem-btn se-mem-btn--save" onClick={saveMem}>
                        {memEditor.mode === "edit" ? "Save" : "Add"}
                      </button>
                    </div>
                  </div>
                </div>
                );
              })()}

              <div className="se-mem-foot">
                <span>{activeMems.length} active{pausedCount ? ` · ${pausedCount} paused` : ""}</span>
                <span className="se-mem-hint">tap to pause · ✎ to edit</span>
              </div>
            </div>
          </section>

          <section className="se-col se-col--out">
            <div
              className="se-col-head se-col-head--expand"
              onClick={() => setMaximized((v) => !v)}
              title={maximized ? "Shrink the editor back down" : "Expand the editor to full screen"}
              role="button"
              aria-expanded={maximized}
            >
              <span className="se-col-title">
                <span className="se-pill se-pill--out"><IcoOut /></span>
                Spending
                {gran === "week" && activeWeek
                  ? <small className="se-col-hint">{activeWeek.label} · {activeWeek.range}</small>
                  : <small className="se-col-hint">dated</small>}
                <span className="se-expand-glyph" aria-hidden="true">{maximized ? "⤡" : "⤢"}</span>
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <button
                  className="si-link"
                  onClick={(e) => { e.stopPropagation(); setBulkOpen(true); }}
                  disabled={cm.expenses.length === 0}
                  title="Open this month's expenses in the big review table — sort, drag-select, bulk-rewrite"
                >
                  <IcoPencil /> Bulk edit
                </button>
                <span className="se-col-sum">{fmt(expShownSum)}</span>
              </span>
            </div>

            <div className="se-weekrow">
              <button
                type="button" className="se-wkflip" aria-label="Previous week"
                onClick={() => pickWeek(Math.max(1, safeWeek - 1))}
                disabled={gran === "week" && safeWeek <= 1}
              >
                <IcoChev dir="left" />
              </button>
              <div className="se-weekstrip" role="group" aria-label="Weekly spending">
                {weeks.map((w, i) => (
                  <button
                    key={w.idx} type="button"
                    className={"se-wk" + (gran === "week" && safeWeek === w.idx ? " on" : "")}
                    onClick={() => (gran === "week" && safeWeek === w.idx ? setGran("month") : pickWeek(w.idx))}
                    title={`${w.range} · ${fmt(weekTotals[i])}`}
                  >
                    <span className="se-wk-bar">
                      <span
                        className="se-wk-fill"
                        style={{ height: Math.round((weekTotals[i] / maxWeek) * 100) + "%" }}
                      />
                    </span>
                    <span className="se-wk-amt">{fmtMoney(weekTotals[i], currency, { abbr: true })}</span>
                    <span className="se-wk-lab">{w.label}</span>
                  </button>
                ))}
              </div>
              <button
                type="button" className="se-wkflip" aria-label="Next week"
                onClick={() => pickWeek(Math.min(weeks.length, safeWeek + 1))}
                disabled={gran === "week" && safeWeek >= weeks.length}
              >
                <IcoChev dir="right" />
              </button>
            </div>

            <div className="se-rows">
              {shownEx.map((r) => (
                <div className="se-row" key={r.id}>
                  <span
                    className="se-catdot"
                    style={{
                      background: r.savingsPlanId
                        ? (savingsPlans.find((p) => p.id === r.savingsPlanId)?.hue ?? "var(--accent)")
                        : (STMT_CATS[r.cat] || STMT_CATS.other).hue,
                    }}
                  />
                  <input
                    className="se-label" placeholder="What did you spend on?" value={r.label}
                    onChange={(e) => editExpense(r.id, { label: e.target.value })}
                  />
                  <input
                    className="se-date" type="date" value={r.date || ""}
                    min={dayStr(viewKey, 1)} max={dayStr(viewKey, dim)}
                    onChange={(e) => e.target.value && editExpense(r.id, { date: e.target.value })}
                  />
                  <select
                    className="se-cat" value={r.savingsPlanId ? `plan:${r.savingsPlanId}` : r.cat}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v.startsWith("plan:")) editExpense(r.id, { savingsPlanId: v.slice(5) });
                      else editExpense(r.id, { cat: v as CatKey, savingsPlanId: undefined });
                    }}
                  >
                    {CAT_KEYS_BY_LABEL.map((k) => <option key={k} value={k}>{STMT_CATS[k].label}</option>)}
                    {savingsPlans.length > 0 && (
                      <optgroup label="Savings plans">
                        {savingsPlans.map((p) => (
                          <option key={p.id} value={`plan:${p.id}`}>→ {p.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  {renderAmt("expenses", r)}
                  <button className="se-del" onClick={() => removeExpense(r.id)} aria-label="Remove">
                    <IcoTrash />
                  </button>
                </div>
              ))}
              {shownEx.length === 0 && (
                <div className="se-empty">
                  {gran === "week" && activeWeek
                    ? `Nothing spent in ${activeWeek.label} — add a row or pick another week.`
                    : "Nothing spent yet — add a row."}
                </div>
              )}
            </div>
            <button className="se-add" onClick={addExpense}>
              <IcoPlus /> Add expense{gran === "week" && activeWeek ? " in " + activeWeek.label : ""}
            </button>
          </section>
        </div>

        <div className="se-foot">
          <div className="se-tallies">
            {gran === "week" && activeWeek ? (
              <>
                <div className="se-tally">
                  <span className="se-tally-lab">{activeWeek.label} spent</span><b>{fmt(weekSpend)}</b>
                </div>
                <span className="se-op">·</span>
                <div className="se-tally">
                  <span className="se-tally-lab">Weekly avg</span><b>{fmt(avgWeek)}</b>
                </div>
                <span className="se-op">·</span>
                {(() => {
                  const d = weekSpend - avgWeek;
                  const over = d > 0;
                  return (
                    <div className={"se-tally se-tally--net" + (over ? " neg" : "")}>
                      <span className="se-tally-lab">{over ? "Over avg" : "Under avg"}</span>
                      <b>{over ? "+" : "−"}{fmt(Math.abs(d))}</b>
                      <small>{activeWeek.range}</small>
                    </div>
                  );
                })()}
              </>
            ) : (
              <>
                <div className="se-tally"><span className="se-tally-lab">Income</span><b>{fmt(incomeBase)}</b></div>
                <span className="se-op">−</span>
                <div className="se-tally"><span className="se-tally-lab">Spending</span><b>{fmt(expenseBase)}</b></div>
                <span className="se-op">=</span>
                <div className={"se-tally se-tally--net" + (surplusBase < 0 ? " neg" : "")}>
                  <span className="se-tally-lab">{surplusBase < 0 ? "Shortfall" : "Left to save"}</span>
                  <b>{fmt(surplusBase)}</b>
                  <small>{saveRate.toFixed(0)}% saved · per month</small>
                </div>
              </>
            )}
          </div>
          <div className="se-actions">
            <button className="se-btn se-btn--ghost" onClick={onClose}>Cancel</button>
            <button className="se-btn se-btn--primary" onClick={commit}>
              <IcoCheck /> Save to dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
    {importOpen && (
      <StatementImport
        currency={currency}
        existing={draft}
        savingsPlans={savingsPlans}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
      />
    )}
    {bulkOpen && (
      <StatementImport
        currency={currency}
        savingsPlans={savingsPlans}
        editRows={{ monthKey: viewKey, expenses: cm.expenses }}
        onApplyEdits={(mk, expenses) => {
          setDraft((d) => ({ ...d, [mk]: { ...d[mk], expenses } }));
          setBulkOpen(false);
        }}
        onClose={() => setBulkOpen(false)}
        onImport={() => {}}
      />
    )}
    </>
  );
}
