import { useMemo, useRef, useState } from "react";
import type {
  BudgetState,
  BudgetCurrency,
  BudgetSplitBasis,
  BudgetMember,
  BudgetExpense,
} from "../../types/grid";
import { scanReceipt } from "./receiptScan";
import "./budget.css";

const CURRENCIES: BudgetCurrency[] = ["CZK", "PLN", "EUR"];
const BASES: { id: BudgetSplitBasis; label: string }[] = [
  { id: "equal", label: "Equal" },
  { id: "share", label: "By share" },
  { id: "income", label: "By income" },
];
// 1:1 with the handoff's expense-category select (value → display label).
const EXPENSE_CATEGORIES: { value: string; label: string }[] = [
  { value: "cash", label: "Cash (ATM)" },
  { value: "charity", label: "Charity" },
  { value: "clothing", label: "Clothing" },
  { value: "credit", label: "Credit card" },
  { value: "eating", label: "Eating out" },
  { value: "electronics", label: "Electronics" },
  { value: "fees", label: "Fees" },
  { value: "fun", label: "Fun" },
  { value: "food", label: "Groceries" },
  { value: "health", label: "Health" },
  { value: "home", label: "Home" },
  { value: "housing", label: "Housing" },
  { value: "shopping", label: "Shopping" },
  { value: "taxi", label: "Taxi & delivery" },
  { value: "transport", label: "Transport" },
  { value: "vending", label: "Vending" },
  { value: "other", label: "Other" },
];
// Avatar hues cycle through ShELF's tokens.
const AV_HUES = ["var(--hue-blue)", "var(--hue-rose)", "var(--hue-purple)", "var(--hue-orange)", "var(--hue-green)", "var(--hue-zinc)"];

function curSymbol(c: BudgetCurrency): string {
  return c === "CZK" ? "Kč" : c === "PLN" ? "zł" : "€";
}

function uid() {
  return (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : "b" + Math.random().toString(36).slice(2);
}
function nowIso() {
  return new Date().toISOString();
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmt(amount: number, c: BudgetCurrency): string {
  const n = Math.round(amount);
  if (c === "CZK") return `${n.toLocaleString()} Kč`;
  if (c === "PLN") return `${n.toLocaleString()} zł`;
  return `€${n.toLocaleString()}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function memberWeight(m: BudgetMember, basis: BudgetSplitBasis): number {
  if (basis === "share") return m.share && m.share > 0 ? m.share : 1;
  if (basis === "income") return m.income && m.income > 0 ? m.income : 0;
  return 1;
}

interface Balance {
  member: BudgetMember;
  paid: number;
  owed: number;
  net: number; // paid - owed; positive => others owe them
}

/** Compute per-member balances + suggested transfers from the expense list. */
function computeBalances(state: BudgetState): { balances: Balance[]; total: number; transfers: { from: BudgetMember; to: BudgetMember; amount: number }[] } {
  const byId = new Map(state.members.map((m) => [m.id, m]));
  const paid = new Map<string, number>();
  const owed = new Map<string, number>();
  state.members.forEach((m) => { paid.set(m.id, 0); owed.set(m.id, 0); });
  let total = 0;

  for (const e of state.expenses) {
    if (e.amount <= 0) continue;
    total += e.amount;
    paid.set(e.paidBy, (paid.get(e.paidBy) ?? 0) + e.amount);
    const among = (e.splitAmong.length ? e.splitAmong : state.members.map((m) => m.id)).filter((id) => byId.has(id));
    if (among.length === 0) continue;
    const basis = e.basis ?? state.splitBasis;
    const useCustom = e.customWeights && Object.keys(e.customWeights).length > 0;
    let weights = among.map((id) => ({
      id,
      w: useCustom ? (e.customWeights![id] ?? 0) : memberWeight(byId.get(id)!, basis),
    }));
    let totalW = weights.reduce((s, x) => s + x.w, 0);
    if (totalW <= 0) { weights = among.map((id) => ({ id, w: 1 })); totalW = among.length; }
    for (const { id, w } of weights) {
      owed.set(id, (owed.get(id) ?? 0) + (e.amount * w) / totalW);
    }
  }

  const balances: Balance[] = state.members.map((m) => {
    const p = paid.get(m.id) ?? 0;
    const o = owed.get(m.id) ?? 0;
    return { member: m, paid: p, owed: o, net: p - o };
  });

  // Greedy settle-up: match biggest debtor to biggest creditor.
  const creditors = balances.filter((b) => b.net > 0.5).map((b) => ({ m: b.member, amt: b.net })).sort((a, b) => b.amt - a.amt);
  const debtors = balances.filter((b) => b.net < -0.5).map((b) => ({ m: b.member, amt: -b.net })).sort((a, b) => b.amt - a.amt);
  const transfers: { from: BudgetMember; to: BudgetMember; amount: number }[] = [];
  let ci = 0, di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const give = Math.min(creditors[ci].amt, debtors[di].amt);
    if (give > 0.5) transfers.push({ from: debtors[di].m, to: creditors[ci].m, amount: give });
    creditors[ci].amt -= give;
    debtors[di].amt -= give;
    if (creditors[ci].amt < 0.5) ci++;
    if (debtors[di].amt < 0.5) di++;
  }

  return { balances, total, transfers };
}

function Avatar({ member, idx, size = 30 }: { member: BudgetMember; idx: number; size?: number }) {
  const hue = member.color || AV_HUES[idx % AV_HUES.length];
  return (
    <span className="gb-av" style={{ width: size, height: size, fontSize: size * 0.4, background: hue }}>
      {initials(member.name)}
    </span>
  );
}

interface Props {
  budget: BudgetState;
  setBudget: (next: BudgetState | ((prev: BudgetState) => BudgetState)) => void;
}

export function BudgetPanel({ budget, setBudget }: Props) {
  const [expenseModal, setExpenseModal] = useState<BudgetExpense | "new" | null>(null);

  const { balances, total, transfers } = useMemo(() => computeBalances(budget), [budget]);
  const currency = budget.currency;

  const setCurrency = (c: BudgetCurrency) => setBudget((p) => ({ ...p, currency: c }));
  const setBasis = (b: BudgetSplitBasis) => setBudget((p) => ({ ...p, splitBasis: b }));

  const addPerson = () => {
    const name = window.prompt("Add a person — their name?");
    if (!name?.trim()) return;
    const m: BudgetMember = { id: uid(), name: name.trim(), createdAt: nowIso() };
    setBudget((p) => ({ ...p, members: [...p.members, m] }));
  };
  const renamePerson = (m: BudgetMember) => {
    const name = window.prompt("Rename", m.name);
    if (name == null) return;
    if (!name.trim()) {
      if (window.confirm(`Remove ${m.name}?`)) {
        setBudget((p) => ({ ...p, members: p.members.filter((x) => x.id !== m.id) }));
      }
      return;
    }
    setBudget((p) => ({ ...p, members: p.members.map((x) => x.id === m.id ? { ...x, name: name.trim() } : x) }));
  };

  const saveExpense = (e: BudgetExpense) => {
    setBudget((p) => {
      const exists = p.expenses.some((x) => x.id === e.id);
      return { ...p, expenses: exists ? p.expenses.map((x) => x.id === e.id ? e : x) : [e, ...p.expenses] };
    });
    setExpenseModal(null);
  };
  const removeExpense = (id: string) => {
    setBudget((p) => ({ ...p, expenses: p.expenses.filter((x) => x.id !== id) }));
    setExpenseModal(null);
  };

  const memberById = (id: string) => budget.members.find((m) => m.id === id);
  const me = balances[0];

  return (
    <div className="gb">
      {/* Header */}
      <div className="gb-head">
        <div className="gb-head-l">
          <h1 className="gb-title">Shared Budget</h1>
          <div className="seg gb-cur-seg" role="tablist" aria-label="Currency">
            {CURRENCIES.map((c) => (
              <button key={c} type="button" className={`seg-btn${currency === c ? " on" : ""}`} onClick={() => setCurrency(c)}>{c}</button>
            ))}
          </div>
        </div>
        <button type="button" className="ghost-btn gb-add-btn" onClick={() => setExpenseModal("new")} disabled={budget.members.length === 0}>
          ＋ Add expense
        </button>
      </div>

      {/* Member bar */}
      <div className="gb-memberbar">
        {balances.map((b, i) => (
          <button key={b.member.id} type="button" className="gb-memchip on" onClick={() => renamePerson(b.member)}>
            <Avatar member={b.member} idx={i} />
            <span className="gb-memchip-main">
              <span className="gb-memchip-name">{b.member.name}</span>
              <span className="gb-memchip-bal" style={{ color: Math.abs(b.net) < 0.5 ? "var(--dim)" : b.net > 0 ? "var(--gb-pos)" : "var(--gb-neg)" }}>
                {Math.abs(b.net) < 0.5 ? "settled" : b.net > 0 ? `gets ${fmt(b.net, currency)}` : `owes ${fmt(-b.net, currency)}`}
              </span>
            </span>
            <span className="gb-memchip-edit">✎</span>
          </button>
        ))}
        <button type="button" className="gb-memchip gb-memchip--add" onClick={addPerson}>
          ＋ <span>Add person</span>
        </button>
      </div>

      {budget.members.length === 0 ? (
        <div className="gb-empty" style={{ marginTop: 24 }}>Add the people sharing this budget to get started.</div>
      ) : (
        <div className="gb-grid">
          {/* Stats / board */}
          <div className="gb-board">
            <div className="gb-board-tiles">
              <div className="gb-board-tile">
                <span className="gb-board-meta">Shared spend</span>
                <span className="gb-board-net">{fmt(total, currency)}</span>
                <span className="gb-board-state">{budget.expenses.length} expense{budget.expenses.length === 1 ? "" : "s"}</span>
              </div>
              {me && (
                <div className="gb-board-tile">
                  <span className="gb-board-meta">{me.member.name}'s position</span>
                  <span className="gb-board-net" style={{ color: Math.abs(me.net) < 0.5 ? undefined : me.net > 0 ? "var(--gb-pos)" : "var(--gb-neg)" }}>{fmt(me.net, currency)}</span>
                  <span className="gb-board-state">{Math.abs(me.net) < 0.5 ? "all square" : me.net > 0 ? "owed to you" : "you owe"}</span>
                </div>
              )}
              {me && (
                <div className="gb-board-tile">
                  <span className="gb-board-meta">{me.member.name}'s fair share</span>
                  <span className="gb-board-net">{fmt(me.owed, currency)}</span>
                  <span className="gb-board-state">paid {fmt(me.paid, currency)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Settle up */}
          <div className="card span-4 gb-settle">
            <div className="card-head"><span className="card-eyebrow">Reconcile</span><span className="card-title">Settle up</span></div>
            <div className="gb-settle-body">
              <div className="gb-bal-list">
                {balances.map((b, i) => {
                  const max = Math.max(1, ...balances.map((x) => Math.abs(x.net)));
                  return (
                    <div key={b.member.id} className="gb-bal-row">
                      <Avatar member={b.member} idx={i} size={26} />
                      <span className="gb-bal-name">{b.member.name}</span>
                      <span className="gb-bal-track">
                        <span className="gb-bal-fill" style={{ width: `${(Math.abs(b.net) / max) * 100}%`, background: b.net >= 0 ? "var(--gb-pos)" : "var(--gb-neg)", marginLeft: b.net >= 0 ? "50%" : undefined }} />
                      </span>
                      <span className="gb-bal-net" style={{ color: Math.abs(b.net) < 0.5 ? "var(--dim)" : b.net > 0 ? "var(--gb-pos)" : "var(--gb-neg)" }}>{fmt(b.net, currency)}</span>
                    </div>
                  );
                })}
              </div>
              {transfers.length === 0 ? (
                <div className="gb-settle-clear">✓ Everyone's square</div>
              ) : (
                <>
                  <div className="gb-settle-lab">Suggested transfers</div>
                  {transfers.map((t, i) => (
                    <div key={i} className="gb-settle-row">
                      <strong>{t.from.name}</strong> → <strong>{t.to.name}</strong>
                      <span className="gb-settle-amt">{fmt(t.amount, currency)}</span>
                    </div>
                  ))}
                  <button type="button" className="gb-settle-btn" onClick={() => {
                    if (window.confirm("Mark everyone as settled? This clears the current shared expenses.")) {
                      setBudget((p) => ({ ...p, expenses: [] }));
                    }
                  }}>Settle up</button>
                </>
              )}
            </div>
          </div>

          {/* Ledger */}
          <div className="card span-8 gb-ledger">
            <div className="card-head">
              <span className="card-eyebrow">This month</span>
              <span className="card-title">Who paid what</span>
              <button type="button" className="ghost-btn gb-add-btn" onClick={() => setExpenseModal("new")}>＋ Add expense</button>
            </div>
            <div className="gb-ledger-body">
              {budget.expenses.length === 0 ? (
                <div className="gb-empty">No shared expenses yet — add the first one.</div>
              ) : (
                <div className="gb-activity-list">
                  {budget.expenses.map((e) => {
                    const payer = memberById(e.paidBy);
                    return (
                      <button key={e.id} type="button" className="gb-act-row" onClick={() => setExpenseModal(e)}>
                        {payer && <Avatar member={payer} idx={budget.members.indexOf(payer)} size={30} />}
                        <span className="gb-act-main">
                          <span className="gb-act-label">{e.title || "Expense"}</span>
                          <span className="gb-act-meta">
                            {payer?.name ?? "?"} paid · {e.date}{e.category ? ` · ${e.category}` : ""}
                          </span>
                        </span>
                        <span className="gb-act-amt">{fmt(e.amount, e.currency)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Split basis */}
          <div className="card span-4 gb-split-card">
            <div className="card-head"><span className="card-eyebrow">Fairness</span><span className="card-title">Split basis</span></div>
            <div className="gb-split-body">
              <div className="seg gb-basis-seg" role="tablist">
                {BASES.map((b) => (
                  <button key={b.id} type="button" className={`seg-btn${budget.splitBasis === b.id ? " on" : ""}`} onClick={() => setBasis(b.id)}>{b.label}</button>
                ))}
              </div>
              <p className="gb-basis-hint">
                {budget.splitBasis === "equal" && "Everyone pays an equal share."}
                {budget.splitBasis === "share" && "Split by each person's share weight."}
                {budget.splitBasis === "income" && "Split proportionally to income."}
              </p>
              <div className="gb-mem-list">
                {budget.members.map((m, i) => {
                  const totalW = budget.members.reduce((s, x) => s + memberWeight(x, budget.splitBasis), 0) || 1;
                  const pct = Math.round((memberWeight(m, budget.splitBasis) / totalW) * 100);
                  return (
                    <div key={m.id} className="gb-mem-row">
                      <Avatar member={m} idx={i} size={26} />
                      <span className="gb-mem-info">
                        <span className="gb-mem-name">{m.name}</span>
                        <span className="gb-mem-sub">
                          {budget.splitBasis === "equal" && "equal share"}
                          {budget.splitBasis === "share" && (
                            <button type="button" className="gb-mem-edit" onClick={() => {
                              const v = window.prompt(`${m.name}'s share weight`, String(m.share ?? 1));
                              if (v != null) setBudget((p) => ({ ...p, members: p.members.map((x) => x.id === m.id ? { ...x, share: Math.max(0, Number(v) || 0) } : x) }));
                            }}>weight {m.share ?? 1}</button>
                          )}
                          {budget.splitBasis === "income" && (
                            <button type="button" className="gb-mem-edit" onClick={() => {
                              const v = window.prompt(`${m.name}'s income`, String(m.income ?? 0));
                              if (v != null) setBudget((p) => ({ ...p, members: p.members.map((x) => x.id === m.id ? { ...x, income: Math.max(0, Number(v) || 0) } : x) }));
                            }}>income {fmt(m.income ?? 0, currency)}</button>
                          )}
                        </span>
                      </span>
                      <span className="gb-mem-share">
                        <span className="gb-mem-pct">{pct}%</span>
                        <span className="gb-mem-pctbar"><span style={{ width: `${pct}%` }} /></span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {expenseModal && (
        <ExpenseModal
          expense={expenseModal === "new" ? null : expenseModal}
          members={budget.members}
          currency={currency}
          groupBasis={budget.splitBasis}
          onSave={saveExpense}
          onRemove={removeExpense}
          onClose={() => setExpenseModal(null)}
        />
      )}
    </div>
  );
}

// 1:1 reconstruction of the handoff "Add an expense" modal (se-*/gb-* classes),
// with a working Scan-a-receipt dropzone (client-side OCR) and group/custom split.
function ExpenseModal({ expense, members, currency, groupBasis, onSave, onRemove, onClose }: {
  expense: BudgetExpense | null;
  members: BudgetMember[];
  currency: BudgetCurrency;
  groupBasis: BudgetSplitBasis;
  onSave: (e: BudgetExpense) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(expense?.title ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [category, setCategory] = useState(expense?.category ?? "food");
  const [date, setDate] = useState(expense?.date ?? today());
  const [paidBy, setPaidBy] = useState(expense?.paidBy ?? members[0]?.id ?? "");
  const startsCustom = !!(expense?.customWeights && Object.keys(expense.customWeights).length);
  const [splitMode, setSplitMode] = useState<"group" | "custom">(startsCustom ? "custom" : "group");
  const [among, setAmong] = useState<string[]>(
    expense?.splitAmong?.length ? expense.splitAmong : members.map((m) => m.id)
  );
  const [weights, setWeights] = useState<Record<string, number>>(expense?.customWeights ?? {});

  // Receipt scan state
  const fileRef = useRef<HTMLInputElement>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "done" | "error">("idle");
  const [scanMsg, setScanMsg] = useState("");

  const sym = curSymbol(currency);
  const included = splitMode === "group" ? members.map((m) => m.id) : among;

  // Live per-member split preview.
  const amountNum = Number(String(amount).replace(",", ".")) || 0;
  const splitPreview = useMemo(() => {
    const ids = included;
    const ws = ids.map((id) => {
      const m = members.find((x) => x.id === id);
      const w = splitMode === "custom" ? (weights[id] ?? 1) : memberWeight(m!, groupBasis);
      return { id, w };
    });
    let totalW = ws.reduce((s, x) => s + x.w, 0);
    if (totalW <= 0) { ws.forEach((x) => (x.w = 1)); totalW = ws.length || 1; }
    return ws.map((x) => ({ id: x.id, amt: (amountNum * x.w) / totalW, w: x.w }));
  }, [included, weights, splitMode, groupBasis, amountNum, members]);

  const basisLabel = groupBasis === "share" ? "share" : groupBasis === "income" ? "income" : "equal";

  const handleFile = async (file: File) => {
    setThumb(URL.createObjectURL(file));
    setScanStatus("scanning");
    setScanMsg("Reading the receipt…");
    try {
      const r = await scanReceipt(file);
      if (r.merchant && !title.trim()) setTitle(r.merchant);
      if (r.total != null) setAmount(String(r.total));
      if (r.date) setDate(r.date);
      setScanStatus("done");
      setScanMsg(r.total != null || r.merchant ? "Read it — double-check the fields." : "Couldn't read much — type it in.");
    } catch {
      setScanStatus("error");
      setScanMsg("Couldn't read that one — just type it in.");
    }
  };

  const valid = title.trim() && amountNum > 0 && paidBy && included.length > 0;
  const submit = () => {
    if (!valid) return;
    const base: BudgetExpense = expense ?? {
      id: uid(), title: "", amount: 0, currency, date, paidBy, splitAmong: included,
      createdAt: nowIso(), updatedAt: nowIso(),
    };
    const customWeights = splitMode === "custom"
      ? Object.fromEntries(among.map((id) => [id, weights[id] ?? 1]))
      : undefined;
    onSave({
      ...base,
      title: title.trim(),
      amount: amountNum,
      currency,
      category: category || undefined,
      date,
      paidBy,
      splitAmong: included,
      basis: undefined,
      customWeights,
      // Note: the scanned image is used for OCR only; we don't persist the
      // ephemeral object URL (it wouldn't survive a reload). Receipt image
      // storage (as a data URL) can come later if wanted.
      receipt: base.receipt,
      updatedAt: nowIso(),
    });
  };

  return (
    <div className="se-backdrop" onClick={onClose} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="se-modal gb-modal" role="dialog" aria-modal="true" aria-label="Expense" onClick={(e) => e.stopPropagation()}>
        <div className="se-head">
          <div className="se-head-l">
            <div className="se-eyebrow">Shared expense</div>
            <h2 className="se-title">{expense ? "Edit expense" : "Add an expense"}</h2>
            <p className="se-lede">Log what was bought, who paid, and how it splits. It feeds the budget and the settle-up.</p>
          </div>
          <button className="se-close" aria-label="Close" onClick={onClose}>✕</button>
        </div>

        <div className="gb-modal-body">
          {/* Scan a receipt */}
          <div className="gb-field gb-field--label gb-scan-field">
            <div
              className={`gb-scan-drop${thumb ? " gb-scan-attached" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
            >
              {thumb ? (
                <>
                  <span className="gb-scan-thumbwrap"><img className="gb-scan-thumb" src={thumb} alt="" /></span>
                  <span className="gb-scan-att-info">
                    <span className="gb-scan-main">{scanStatus === "scanning" ? "Reading…" : "Receipt attached"}</span>
                    <span className="gb-scan-status">{scanMsg}</span>
                  </span>
                  <button
                    type="button"
                    className="gb-scan-remove"
                    aria-label="Remove receipt"
                    onClick={(e) => { e.stopPropagation(); setThumb(null); setScanStatus("idle"); setScanMsg(""); }}
                  >✕</button>
                </>
              ) : (
                <>
                  <span className="gb-scan-ico" aria-hidden="true">📷</span>
                  <span className="gb-scan-main">Scan a receipt</span>
                  <span className="gb-scan-sub">Drop a photo or screenshot — we’ll read the merchant, total and date. Or just type it in below.</span>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
              />
            </div>
          </div>

          {/* What was it */}
          <div className="gb-field gb-field--label">
            <label>What was it?</label>
            <input className="se-label" autoFocus placeholder="e.g. Groceries — Lidl" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          {/* Amount */}
          <div className="gb-field">
            <label>Amount</label>
            <div className="se-amt gb-amt">
              <span className="se-cur">{sym}</span>
              <input className="se-amt-input" inputMode="numeric" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} />
            </div>
          </div>

          {/* Category */}
          <div className="gb-field">
            <label>Category</label>
            <select className="se-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {/* Date */}
          <div className="gb-field">
            <label>Date</label>
            <input className="se-date gb-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          {/* Paid by */}
          <div className="gb-field gb-field--label">
            <label>Paid by</label>
            <div className="gb-paidby">
              {members.map((m, i) => (
                <button key={m.id} type="button" className={`gb-paid-chip${paidBy === m.id ? " on" : ""}`} onClick={() => setPaidBy(m.id)}>
                  <Avatar member={m} idx={i} size={22} /> {m.name}
                </button>
              ))}
            </div>
          </div>

          {/* How does it split */}
          <div className="gb-field gb-field--label">
            <label>How does it split?</label>
            <div className="seg gb-splitseg">
              <button type="button" className={`seg-btn${splitMode === "group" ? " on" : ""}`} onClick={() => setSplitMode("group")}>Group default</button>
              <button type="button" className={`seg-btn${splitMode === "custom" ? " on" : ""}`} onClick={() => setSplitMode("custom")}>Custom</button>
            </div>
            <div className="gb-split-list">
              {members.map((m, i) => {
                const on = splitMode === "group" || among.includes(m.id);
                const row = splitPreview.find((p) => p.id === m.id);
                return (
                  <div key={m.id} className={`gb-split-row${on ? "" : " off"}`}>
                    <Avatar member={m} idx={i} size={22} />
                    {splitMode === "custom" ? (
                      <button
                        type="button"
                        className="gb-split-name"
                        style={{ textAlign: "left", background: "none", border: 0, cursor: "pointer", font: "inherit" }}
                        onClick={() => setAmong((prev) => prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id])}
                      >
                        {m.name}
                      </button>
                    ) : (
                      <span className="gb-split-name">{m.name}</span>
                    )}
                    {splitMode === "custom" && on ? (
                      <span className="gb-split-weights">
                        <input
                          type="number"
                          min={0}
                          value={weights[m.id] ?? 1}
                          onChange={(e) => setWeights((w) => ({ ...w, [m.id]: Math.max(0, Number(e.target.value) || 0) }))}
                          style={{ width: 48, textAlign: "right", font: "inherit", borderRadius: 6, border: "1px solid var(--line)", background: "var(--surface)", padding: "2px 6px" }}
                        />
                      </span>
                    ) : (
                      <span className="gb-split-basis">{on ? basisLabel : "—"}</span>
                    )}
                    <span className="gb-split-amt">{on && row ? fmt(row.amt, currency) : `0 ${sym}`}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="se-foot gb-modal-foot">
          {expense ? (
            <button type="button" className="se-btn se-btn--ghost" style={{ color: "var(--gb-neg)" }} onClick={() => onRemove(expense.id)}>Delete</button>
          ) : <span />}
          <div className="se-actions">
            <button type="button" className="se-btn se-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="button" className="se-btn se-btn--primary" disabled={!valid} onClick={submit}>
              {expense ? "Save changes" : "Add expense"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
