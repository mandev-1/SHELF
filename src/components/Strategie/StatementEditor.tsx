import { useState, useEffect } from "react";
import type { StrategieState, MonthStatement, CatKey, IncomeRow, ExpenseRow, MembershipRow } from "../../types/grid";
import {
  dayStr, monthWeeks, weekOfDate, stepMonth, monthLabel,
  fmtMoney, CURRENCIES, STMT_CATS, CAT_KEYS,
} from "./strategie";
import { IcoX, IcoChev, IcoPlus, IcoTrash, IcoIn, IcoOut, IcoRepeat, IcoPencil } from "./icons";

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
  onSave: (
    book: Record<string, MonthStatement>,
    order: string[],
    active: string,
    memberships: MembershipRow[],
  ) => void;
  onClose: () => void;
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

function totalIncome(stmt: MonthStatement) {
  return stmt.income.reduce((s, r) => s + r.amt, 0);
}
function totalExpenses(stmt: MonthStatement) {
  return stmt.expenses.reduce((s, r) => s + r.amt, 0);
}

export function StatementEditor({ statements, currency, memberships, onSave, onClose }: StatementEditorProps) {
  const curEntry = CURRENCIES[currency] ?? CURRENCIES["USD"];
  const rate = curEntry.rate;
  const sym = currency === "CZK" ? "Kč" : currency === "EUR" ? "€" : "$";
  const toDisplay = (base: number) => Math.round((base || 0) * rate);
  const toBase = (displayed: number) => Math.round(displayed / rate);

  const [localBook, setLocalBook] = useState<Record<string, MonthStatement>>(() =>
    JSON.parse(JSON.stringify(statements.byMonth))
  );
  const [localOrder, setLocalOrder] = useState<string[]>([...statements.order]);
  const [active, setActive] = useState(statements.current);
  const [gran, setGran] = useState<"all" | number>("all");
  const [amtStrings, setAmtStrings] = useState<Record<string, string>>({});
  const [members, setMembers] = useState<MembershipRow[]>(() => memberships.map((m) => ({ ...m })));
  const [memEditor, setMemEditor] = useState<MemEditorState | null>(null);

  useEffect(() => {
    let lastEsc = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      const now = Date.now();
      if (now - lastEsc < 800) { onClose(); lastEsc = 0; }
      else { lastEsc = now; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const stmt = localBook[active] ?? { income: [], expenses: [] };
  const weeks = monthWeeks(active);

  function setStmt(next: MonthStatement) {
    setLocalBook((b) => ({ ...b, [active]: next }));
  }

  function addIncome() {
    setStmt({ ...stmt, income: [...stmt.income, { id: crypto.randomUUID(), label: "", amt: 0, kind: "other" }] });
  }
  function addExpense() {
    setStmt({
      ...stmt,
      expenses: [...stmt.expenses, { id: crypto.randomUUID(), label: "", amt: 0, cat: "other" as CatKey, date: dayStr(active, 1) }],
    });
  }
  function delIncome(id: string) {
    const row = stmt.income.find((r) => r.id === id);
    if (row && (row.label.trim() || row.amt)) {
      const name = row.label.trim() || "this income";
      if (!window.confirm(`Delete "${name}"?`)) return;
    }
    setStmt({ ...stmt, income: stmt.income.filter((r) => r.id !== id) });
  }
  function delExpense(id: string) {
    const row = stmt.expenses.find((r) => r.id === id);
    if (row && (row.label.trim() || row.amt)) {
      const name = row.label.trim() || "this expense";
      if (!window.confirm(`Delete "${name}"?`)) return;
    }
    setStmt({ ...stmt, expenses: stmt.expenses.filter((r) => r.id !== id) });
  }
  function patchIncome(id: string, patch: Partial<IncomeRow>) {
    setStmt({ ...stmt, income: stmt.income.map((r) => r.id === id ? { ...r, ...patch } : r) });
  }
  function patchExpense(id: string, patch: Partial<ExpenseRow>) {
    setStmt({ ...stmt, expenses: stmt.expenses.map((r) => r.id === id ? { ...r, ...patch } : r) });
  }

  function setAmt(side: "income" | "expenses", id: string, raw: string) {
    setAmtStrings((s) => ({ ...s, [id]: raw }));
    const n = parseFloat(raw.replace(/[^\d.]/g, ""));
    const base = isNaN(n) ? 0 : toBase(n);
    if (side === "income") patchIncome(id, { amt: base });
    else patchExpense(id, { amt: base });
  }

  function amtValue(id: string, base: number): string {
    if (id in amtStrings) return amtStrings[id];
    return base ? String(toDisplay(base)) : "";
  }

  function addMonth() {
    const newest = localOrder[localOrder.length - 1] ?? active;
    const next = stepMonth(newest, 1);
    if (localBook[next]) { setActive(next); return; }
    const prev = localBook[newest] ?? { income: [], expenses: [] };
    const seeded: MonthStatement = {
      income: prev.income.map((r) => ({ ...r, id: crypto.randomUUID() })),
      expenses: [],
    };
    setLocalBook((b) => ({ ...b, [next]: seeded }));
    setLocalOrder((o) => [...o, next]);
    setActive(next);
  }

  function stepActive(dir: 1 | -1) {
    const idx = localOrder.indexOf(active);
    const next = localOrder[idx + dir];
    if (next) setActive(next);
  }

  const inc = totalIncome(stmt);
  const exp = totalExpenses(stmt);
  const net = inc - exp;

  const visibleExpenses = gran === "all"
    ? stmt.expenses
    : stmt.expenses.filter((e) => weekOfDate(active, e.date) === gran);

  return (
    <div className="se-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="se-modal" onClick={(e) => e.stopPropagation()}>
        <div className="se-head">
          <div className="se-head-l">
            <div className="se-eyebrow">Statement editor</div>
            <div className="se-title">Monthly cashflow</div>
            <div className="se-lede">Edit income and expenses for each month.</div>
          </div>
          <button className="se-close" onClick={onClose}><IcoX /></button>
        </div>

        <div className="se-periodbar">
          <div className="se-stepper">
            <button className="se-nav" onClick={() => stepActive(-1)} disabled={localOrder.indexOf(active) === 0}>
              <IcoChev dir="left" />
            </button>
            <div className="se-month">
              <div className="se-month-name">{monthLabel(active)}</div>
              <div className={`se-month-net${net < 0 ? " neg" : ""}`}>
                {net >= 0 ? "+" : ""}{fmtMoney(net, currency)}
              </div>
            </div>
            <button
              className="se-nav"
              onClick={() => {
                if (localOrder.indexOf(active) === localOrder.length - 1) addMonth();
                else stepActive(1);
              }}
              aria-label={localOrder.indexOf(active) === localOrder.length - 1 ? "Add next month" : "Next month"}
            >
              {localOrder.indexOf(active) === localOrder.length - 1 ? <IcoPlus /> : <IcoChev dir="right" />}
            </button>
          </div>
          <div className="se-gran">
            <span className="se-gran-lab">Spending</span>
            <div className="seg">
              <button className={`seg-btn${gran === "all" ? " on" : ""}`} onClick={() => setGran("all")}>Whole month</button>
              <button className={`seg-btn${gran !== "all" ? " on" : ""}`} onClick={() => setGran(gran === "all" ? 1 : gran)}>By week</button>
            </div>
          </div>
        </div>

        <div className="se-body">
          <div className="se-col se-col--in">
            <div className="se-col-head">
              <span className="se-col-title">
                <span className="se-pill se-pill--in"><IcoIn /></span>
                Income
                <small className="se-col-hint">monthly</small>
              </span>
              <span className="se-col-sum">{fmtMoney(inc, currency)}</span>
            </div>
            <div className="se-rows">
              {stmt.income.length === 0 && <div className="se-empty">No income yet — add a row.</div>}
              {stmt.income.map((row) => (
                <div key={row.id} className="se-row">
                  <input
                    className="se-label"
                    value={row.label}
                    placeholder="Source (e.g. Salary)"
                    onChange={(e) => patchIncome(row.id, { label: e.target.value })}
                  />
                  <div className="se-amt">
                    <span className="se-cur">{sym}</span>
                    <input
                      className="se-amt-input"
                      type="text"
                      inputMode="numeric"
                      value={amtValue(row.id, row.amt)}
                      placeholder="0"
                      onChange={(e) => setAmt("income", row.id, e.target.value)}
                      onBlur={() => setAmtStrings((s) => { const n = { ...s }; delete n[row.id]; return n; })}
                    />
                  </div>
                  <button className="se-del" onClick={() => delIncome(row.id)}><IcoTrash /></button>
                </div>
              ))}
            </div>
            <button type="button" className="se-add" onClick={addIncome}><IcoPlus /> Add income</button>

            {(() => {
              const activeMems = members.filter((m) => !m.paused);
              const memTotal = activeMems.reduce((a, m) => a + m.price, 0);
              const pausedCount = members.length - activeMems.length;
              const toggle = (id: string) =>
                setMembers((ms) => ms.map((m) => m.id === id ? { ...m, paused: !m.paused } : m));
              const openAdd = () => setMemEditor({
                mode: "add", name: "", plan: "", price: "",
                color: MEM_PALETTE[5], mono: "", monoTouched: false,
              });
              const openEdit = (m: MembershipRow) => setMemEditor({
                mode: "edit", id: m.id, name: m.name, plan: m.plan,
                price: String(toDisplay(m.price)), color: m.color, mono: m.mono, monoTouched: true,
              });
              const upd = (patch: Partial<MemEditorState>) =>
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
                <div className="se-mem">
                  <div className="se-mem-head">
                    <span className="se-mem-title">
                      <span className="se-pill se-pill--mem"><IcoRepeat /></span>
                      Memberships <small className="se-col-hint">recurring</small>
                    </span>
                    <span className="se-mem-sum">{fmtMoney(memTotal, currency)}<small>/mo</small></span>
                  </div>
                  <div className="se-mem-grid">
                    {members.map((m) => {
                      const off = !!m.paused;
                      return (
                        <button
                          key={m.id} type="button"
                          className={"se-tile" + (off ? " off" : "")}
                          style={{ ["--brand" as string]: m.color } as React.CSSProperties}
                          onClick={() => toggle(m.id)}
                          aria-pressed={!off}
                          aria-label={`${m.name}${m.plan ? " · " + m.plan : ""}${off ? " (paused)" : ""}`}
                        >
                          <span className="se-tile-mono">{m.mono}</span>
                          <span
                            className="se-tile-edit" role="button" tabIndex={-1}
                            onClick={(e) => { e.stopPropagation(); openEdit(m); }}
                            aria-label={`Edit ${m.name}`}
                          >
                            <IcoPencil />
                          </span>
                          <span className="se-tile-tip">
                            <b>{m.name}</b>
                            {m.plan ? <i>{m.plan}</i> : null}
                            <em>{fmtMoney(m.price, currency)}/mo</em>
                          </span>
                        </button>
                      );
                    })}
                    <button
                      type="button" className="se-tile se-tile--add"
                      aria-label="Add membership" onClick={openAdd}
                    >
                      <IcoPlus />
                    </button>
                  </div>

                  {memEditor && (
                    <div className="se-mem-editor">
                      <div className="se-mem-ed-top">
                        <span
                          className="se-tile se-tile--preview"
                          style={{ ["--brand" as string]: memEditor.color } as React.CSSProperties}
                        >
                          <span className="se-tile-mono">{previewMono}</span>
                        </span>
                        <div className="se-mem-ed-fields">
                          <input
                            className="se-mem-in" placeholder="Name (e.g. Netflix)"
                            value={memEditor.name} autoFocus
                            onChange={(e) => upd({ name: e.target.value })}
                          />
                          <input
                            className="se-mem-in se-mem-in--sub" placeholder="Plan (optional)"
                            value={memEditor.plan}
                            onChange={(e) => upd({ plan: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="se-mem-ed-row">
                        <label className="se-mem-field">
                          <span className="se-mem-flab">Price /mo</span>
                          <span className="se-mem-price">
                            <i>{CURRENCIES[currency]?.code ?? currency}</i>
                            <input
                              inputMode="numeric" value={memEditor.price} placeholder="0"
                              onChange={(e) => upd({ price: e.target.value.replace(/[^\d]/g, "") })}
                            />
                          </span>
                        </label>
                        <label className="se-mem-field se-mem-field--mono">
                          <span className="se-mem-flab">Badge</span>
                          <input
                            className="se-mem-in se-mem-mono-in" maxLength={2}
                            value={memEditor.mono}
                            placeholder={memInitials(memEditor.name) || "AB"}
                            onChange={(e) => upd({ mono: e.target.value, monoTouched: true })}
                          />
                        </label>
                      </div>
                      <div className="se-mem-swatches">
                        {MEM_PALETTE.map((c) => (
                          <button
                            key={c} type="button"
                            className={"se-sw" + (memEditor.color === c ? " on" : "")}
                            style={{ ["--brand" as string]: c } as React.CSSProperties}
                            onClick={() => upd({ color: c })}
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
                  )}

                  <div className="se-mem-foot">
                    <span>{activeMems.length} active{pausedCount ? ` · ${pausedCount} paused` : ""}</span>
                    <span className="se-mem-hint">tap to pause · ✎ to edit</span>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="se-col se-col--out">
            <div className="se-col-head">
              <span className="se-col-title">
                <span className="se-pill se-pill--out"><IcoOut /></span>
                Spending
                <small className="se-col-hint">
                  {gran === "all" ? "dated" : weeks.find((w) => w.idx === gran)?.range}
                </small>
              </span>
              <span className="se-col-sum">{fmtMoney(exp, currency)}</span>
            </div>

            <div className="se-weekrow">
              <button
                type="button"
                className="se-wkflip"
                aria-label="Previous week"
                disabled={gran !== "all" && (gran as number) <= 1}
                onClick={() => {
                  const cur = gran === "all" ? 1 : (gran as number);
                  setGran(Math.max(1, cur - 1));
                }}
              >
                <IcoChev dir="left" />
              </button>
              <div className="se-weekstrip">
                {weeks.map((w) => {
                  const wAmt = stmt.expenses
                    .filter((e) => weekOfDate(active, e.date) === w.idx)
                    .reduce((s, e) => s + e.amt, 0);
                  const maxWk = Math.max(...weeks.map((ww) =>
                    stmt.expenses.filter((e) => weekOfDate(active, e.date) === ww.idx).reduce((s, e) => s + e.amt, 0)
                  ), 1);
                  const pct = (wAmt / maxWk) * 100;
                  return (
                    <button
                      type="button"
                      key={w.idx}
                      className={`se-wk${gran === w.idx ? " on" : ""}`}
                      onClick={() => setGran(gran === w.idx ? "all" : w.idx)}
                      title={`${w.range} · ${fmtMoney(wAmt, currency)}`}
                    >
                      <span className="se-wk-bar">
                        <span className="se-wk-fill" style={{ height: `${pct}%` }} />
                      </span>
                      <span className="se-wk-amt">{fmtMoney(wAmt, currency, { abbr: true })}</span>
                      <span className="se-wk-lab">{w.label}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="se-wkflip"
                aria-label="Next week"
                disabled={gran !== "all" && (gran as number) >= weeks.length}
                onClick={() => {
                  const cur = gran === "all" ? 1 : (gran as number);
                  setGran(Math.min(weeks.length, cur + 1));
                }}
              >
                <IcoChev dir="right" />
              </button>
            </div>

            <div className="se-rows">
              {visibleExpenses.length === 0 && (
                <div className="se-empty">No expenses{gran !== "all" ? " this week" : " yet"}.</div>
              )}
              {visibleExpenses.map((row) => (
                <div key={row.id} className="se-row">
                  <span className="se-catdot" style={{ background: STMT_CATS[row.cat]?.hue ?? "#888" }} />
                  <input
                    className="se-label"
                    style={{ background: "transparent", border: "none", outline: "none", color: "var(--fg)", minWidth: 0, flex: 1 }}
                    value={row.label}
                    placeholder="Label"
                    onChange={(e) => patchExpense(row.id, { label: e.target.value })}
                  />
                  <select
                    className="se-cat"
                    value={row.cat}
                    onChange={(e) => patchExpense(row.id, { cat: e.target.value as CatKey })}
                  >
                    {CAT_KEYS.map((k) => <option key={k} value={k}>{STMT_CATS[k].label}</option>)}
                  </select>
                  <div className="se-amt">
                    <span className="se-cur">{sym}</span>
                    <input
                      className="se-amt-input"
                      type="text"
                      inputMode="numeric"
                      value={amtValue(row.id, row.amt)}
                      placeholder="0"
                      onChange={(e) => setAmt("expenses", row.id, e.target.value)}
                      onBlur={() => setAmtStrings((s) => { const n = { ...s }; delete n[row.id]; return n; })}
                    />
                  </div>
                  <button className="se-del" onClick={() => delExpense(row.id)}><IcoTrash /></button>
                </div>
              ))}
            </div>
            <div className="se-add" onClick={addExpense}><IcoPlus /> Add expense</div>
          </div>
        </div>

        <div className="se-foot">
          <div className="se-tallies">
            <div className="se-tally">
              <div className="se-tally-lab">Income</div>
              <div className="se-op">{fmtMoney(inc, currency)}</div>
            </div>
            <div className="se-tally">
              <div className="se-tally-lab">Expenses</div>
              <div className="se-op">{fmtMoney(exp, currency)}</div>
            </div>
            <div className={`se-tally se-tally--net${net < 0 ? " neg" : ""}`}>
              <div className="se-tally-lab">Net</div>
              <div className="se-op">{net >= 0 ? "+" : ""}{fmtMoney(net, currency)}</div>
            </div>
          </div>
          <div className="se-actions">
            <button className="se-btn se-btn--ghost" onClick={onClose}>Cancel</button>
            <button
              className="se-btn se-btn--primary"
              onClick={() => { onSave(localBook, localOrder, active, members); onClose(); }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
