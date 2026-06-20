"use client";

import { useMemo, useState } from "react";
import type {
  BudgetState,
  BudgetCurrency,
  BudgetSplitBasis,
  BudgetMember,
  BudgetExpense,
} from "../lib/budget-types";
import "./budget.css";

const CURRENCIES: BudgetCurrency[] = ["CZK", "PLN", "EUR"];
const BASES: { id: BudgetSplitBasis; label: string }[] = [
  { id: "equal", label: "Equal" },
  { id: "share", label: "By share" },
  { id: "income", label: "By income" },
];
const CATEGORIES = ["Groceries", "Dining", "Transport", "Housing", "Fun", "Health", "Fees", "Other"];
// Avatar hues cycle through ShELF's tokens.
const AV_HUES = ["var(--hue-blue)", "var(--hue-rose)", "var(--hue-purple)", "var(--hue-orange)", "var(--hue-green)", "var(--hue-zinc)"];

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
    let weights = among.map((id) => ({ id, w: memberWeight(byId.get(id)!, basis) }));
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
  /** The Supabase budget row id — used to build per-person share links. */
  budgetId?: string | null;
  /** When opened via a personal link (?me=<id>), the member you are. */
  activeMemberId?: string | null;
}

export function BudgetPanel({ budget, setBudget, budgetId = null, activeMemberId = null }: Props) {
  const [expenseModal, setExpenseModal] = useState<BudgetExpense | "new" | null>(null);
  const [personModal, setPersonModal] = useState<BudgetMember | "new" | null>(null);

  const { balances, total, transfers } = useMemo(() => computeBalances(budget), [budget]);
  const currency = budget.currency;

  const setCurrency = (c: BudgetCurrency) => setBudget((p) => ({ ...p, currency: c }));
  const setBasis = (b: BudgetSplitBasis) => setBudget((p) => ({ ...p, splitBasis: b }));

  const addPerson = () => setPersonModal("new");
  const editPerson = (m: BudgetMember) => setPersonModal(m);
  const savePerson = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (personModal === "new") {
      const m: BudgetMember = { id: uid(), name: trimmed, createdAt: nowIso() };
      setBudget((p) => ({ ...p, members: [...p.members, m] }));
      // Reopen in edit mode so the owner immediately sees this person's share link.
      setPersonModal(m);
      return;
    }
    const target = personModal as BudgetMember;
    setBudget((p) => ({ ...p, members: p.members.map((x) => (x.id === target.id ? { ...x, name: trimmed } : x)) }));
    setPersonModal(null);
  };
  const removePerson = () => {
    if (personModal && personModal !== "new") {
      const target = personModal as BudgetMember;
      setBudget((p) => ({ ...p, members: p.members.filter((x) => x.id !== target.id) }));
    }
    setPersonModal(null);
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
  const activeMember = activeMemberId ? budget.members.find((m) => m.id === activeMemberId) : undefined;

  return (
    <div className="gb">
      {/* Header */}
      <div className="gb-head">
        <div className="gb-head-l">
          <h1 className="gb-title">Shared Budget</h1>
          {activeMember && (
            <span
              title="You opened a personal link"
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--accent-deep)",
                background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                padding: "4px 10px",
                borderRadius: 999,
              }}
            >
              You&apos;re {activeMember.name}
            </span>
          )}
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
          <button key={b.member.id} type="button" className="gb-memchip on" onClick={() => editPerson(b.member)}>
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
          defaultPaidBy={activeMemberId ?? undefined}
          onSave={saveExpense}
          onRemove={removeExpense}
          onClose={() => setExpenseModal(null)}
        />
      )}

      {personModal && (
        <PersonModal
          member={personModal === "new" ? null : personModal}
          budgetId={budgetId}
          onSave={savePerson}
          onRemove={personModal === "new" ? undefined : removePerson}
          onClose={() => setPersonModal(null)}
        />
      )}
    </div>
  );
}

function ExpenseModal({ expense, members, currency, defaultPaidBy, onSave, onRemove, onClose }: {
  expense: BudgetExpense | null;
  members: BudgetMember[];
  currency: BudgetCurrency;
  defaultPaidBy?: string;
  onSave: (e: BudgetExpense) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(expense?.title ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [cur, setCur] = useState<BudgetCurrency>(expense?.currency ?? currency);
  const [category, setCategory] = useState(expense?.category ?? "");
  const [date, setDate] = useState(expense?.date ?? today());
  const [paidBy, setPaidBy] = useState(expense?.paidBy ?? defaultPaidBy ?? members[0]?.id ?? "");
  const [among, setAmong] = useState<string[]>(expense?.splitAmong?.length ? expense.splitAmong : members.map((m) => m.id));

  const valid = title.trim() && Number(amount) > 0 && paidBy && among.length > 0;
  const submit = () => {
    if (!valid) return;
    const base: BudgetExpense = expense ?? { id: uid(), title: "", amount: 0, currency: cur, date, paidBy, splitAmong: among, createdAt: nowIso(), updatedAt: nowIso() };
    onSave({
      ...base,
      title: title.trim(),
      amount: Number(amount),
      currency: cur,
      category: category || undefined,
      date,
      paidBy,
      splitAmong: among,
      updatedAt: nowIso(),
    });
  };

  return (
    <div className="gb-modal-backdrop" onClick={onClose}>
      <div className="gb-modal gb-modal--sm" onClick={(e) => e.stopPropagation()}>
        <div className="gb-modal-head">
          <span className="card-eyebrow">{expense ? "Edit expense" : "Add an expense"}</span>
          <button type="button" className="gb-modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="gb-modal-body">
          <label className="gb-fld">
            <span className="gb-fld-lab">What was it?</span>
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Groceries + wine" />
          </label>
          <div className="gb-fld-row">
            <label className="gb-fld">
              <span className="gb-fld-lab">Amount</span>
              <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </label>
            <label className="gb-fld">
              <span className="gb-fld-lab">Currency</span>
              <select value={cur} onChange={(e) => setCur(e.target.value as BudgetCurrency)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <div className="gb-fld-row">
            <label className="gb-fld">
              <span className="gb-fld-lab">Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">—</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="gb-fld">
              <span className="gb-fld-lab">Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>
          <label className="gb-fld">
            <span className="gb-fld-lab">Paid by</span>
            <div className="gb-paidby">
              {members.map((m, i) => (
                <button key={m.id} type="button" className={`gb-paid-chip${paidBy === m.id ? " on" : ""}`} onClick={() => setPaidBy(m.id)}>
                  <Avatar member={m} idx={i} size={22} /> {m.name}
                </button>
              ))}
            </div>
          </label>
          <label className="gb-fld">
            <span className="gb-fld-lab">Split among</span>
            <div className="gb-paidby">
              {members.map((m, i) => {
                const on = among.includes(m.id);
                return (
                  <button key={m.id} type="button" className={`gb-paid-chip${on ? " on" : ""}`} onClick={() => setAmong((prev) => on ? prev.filter((x) => x !== m.id) : [...prev, m.id])}>
                    <Avatar member={m} idx={i} size={22} /> {m.name}
                  </button>
                );
              })}
            </div>
          </label>
        </div>
        <div className="gb-modal-foot">
          {expense && <button type="button" className="gb-modal-del" onClick={() => onRemove(expense.id)}>Delete</button>}
          <span style={{ flex: 1 }} />
          <button type="button" className="gb-modal-cancel" onClick={onClose}>Cancel</button>
          <button type="button" className="gb-settle-btn" style={{ width: "auto", marginTop: 0, padding: "10px 18px" }} disabled={!valid} onClick={submit}>
            {expense ? "Save changes" : "Add expense"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PersonModal({ member, budgetId, onSave, onRemove, onClose }: {
  member: BudgetMember | null;
  budgetId?: string | null;
  onSave: (name: string) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(member?.name ?? "");
  const [copied, setCopied] = useState(false);
  const valid = name.trim().length > 0;
  const submit = () => { if (valid) onSave(name); };

  // Personal link: opening it identifies the friend as this member, so their
  // expenses are auto-attributed to them. Only valid once the member exists.
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = member && budgetId ? `${origin}/?b=${budgetId}&me=${member.id}` : "";

  return (
    <div className="gb-modal-backdrop" onClick={onClose}>
      <div className="gb-modal gb-modal--sm" onClick={(e) => e.stopPropagation()}>
        <div className="gb-modal-head">
          <span className="card-eyebrow">{member ? "Edit person" : "Add a person"}</span>
          <button type="button" className="gb-modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="gb-modal-body">
          <label className="gb-fld" style={{ gridColumn: "1 / -1" }}>
            <span className="gb-fld-lab">Name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="e.g. Carl"
            />
          </label>

          {shareUrl && (
            <div className="gb-fld" style={{ gridColumn: "1 / -1" }}>
              <span className="gb-fld-lab">
                Personal link — send to {name || "them"} so they can add expenses as themselves
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <input readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} style={{ flex: 1 }} />
                <button
                  type="button"
                  className="gb-settle-btn"
                  style={{ width: "auto", marginTop: 0, padding: "10px 16px", whiteSpace: "nowrap" }}
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? "Copied ✓" : "Copy link"}
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="gb-modal-foot">
          {member && onRemove && <button type="button" className="gb-modal-del" onClick={onRemove}>Remove</button>}
          <span style={{ flex: 1 }} />
          <button type="button" className="gb-modal-cancel" onClick={onClose}>{member ? "Done" : "Cancel"}</button>
          <button type="button" className="gb-settle-btn" style={{ width: "auto", marginTop: 0, padding: "10px 18px" }} disabled={!valid} onClick={submit}>
            {member ? "Save" : "Add person"}
          </button>
        </div>
      </div>
    </div>
  );
}
