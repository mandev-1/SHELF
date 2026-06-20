"use client";

import { useMemo, useState } from "react";
import type {
  BudgetState,
  BudgetCurrency,
  BudgetSplitBasis,
  BudgetMember,
  BudgetExpense,
  BudgetTrip,
} from "../lib/budget-types";
import "./budget.css";
import { TripsView } from "./TripsView";
import { PeopleView } from "./PeopleView";
import { TripDetail } from "./TripDetail";
import { ErrorCard } from "./ErrorCard";
import { toast } from "../lib/toast";

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
  /** Trip-scoped link (?trip=<id>) → render guest mode for just that trip. */
  scopedTripId?: string | null;
  isSuperuser?: boolean;
  /** People CRUD against the Supabase users table (people live there now). */
  onAddUser: (name: string) => Promise<BudgetMember | null>;
  onUpdateUser: (id: string, patch: Partial<BudgetMember>) => void;
  onRemoveUser: (id: string) => void;
  /** Trip CRUD against the Supabase trips table (trips live there now). */
  onAddTrip: (trip: BudgetTrip) => void;
  onUpdateTrip: (trip: BudgetTrip) => void;
  onRemoveTrip: (id: string) => void;
  onLogout?: () => void;
}

export function BudgetPanel({
  budget,
  setBudget,
  budgetId = null,
  activeMemberId = null,
  scopedTripId = null,
  isSuperuser = false,
  onAddUser,
  onUpdateUser,
  onRemoveUser,
  onAddTrip,
  onUpdateTrip,
  onRemoveTrip,
  onLogout,
}: Props) {
  const [expenseModal, setExpenseModal] = useState<BudgetExpense | "new" | null>(null);
  const [personModal, setPersonModal] = useState<BudgetMember | "new" | null>(null);
  const [view, setView] = useState<"people" | "trips">("people");

  const { balances, total, transfers } = useMemo(() => computeBalances(budget), [budget]);
  const currency = budget.currency;

  const setCurrency = (c: BudgetCurrency) => setBudget((p) => ({ ...p, currency: c }));
  const setBasis = (b: BudgetSplitBasis) => setBudget((p) => ({ ...p, splitBasis: b }));

  const addPerson = () => setPersonModal("new");
  const editPerson = (m: BudgetMember) => setPersonModal(m);
  const savePerson = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (personModal === "new") {
      const m = await onAddUser(trimmed);
      // Reopen in edit mode so the host immediately sees this person's share link.
      setPersonModal(m ?? null);
      return;
    }
    onUpdateUser((personModal as BudgetMember).id, { name: trimmed });
    setPersonModal(null);
  };
  const removePerson = () => {
    if (personModal && personModal !== "new") {
      onRemoveUser((personModal as BudgetMember).id);
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

  // Guest mode: a trip-scoped link (?trip=<id>) shows ONLY that trip — no People
  // tab, no other trips, no host actions. (Soft scoping — a UX guardrail.)
  if (scopedTripId) {
    const scopedTrip = (budget.trips ?? []).find((t) => t.id === scopedTripId);
    if (!scopedTrip) {
      return (
        <ErrorCard
          emoji="🧭"
          title="This trip link isn't valid anymore"
          message="The trip may have been removed, or the link is out of date. Ask the host for a fresh invite."
          onAdmin={onLogout}
        />
      );
    }
    return (
      <div className="gb">
        <div className="gb-head">
          <div className="gb-head-l" style={{ flexDirection: "column", alignItems: "flex-start", gap: 0 }}>
            <span className="card-eyebrow" style={{ display: "block", marginBottom: 2 }}>SHARED BUDGET · TRIP GUEST</span>
            <h1 className="gb-title">{scopedTrip.name}</h1>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 10 }}>
              {activeMember && (
                <span
                  title="You opened a trip link"
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
          </div>
        </div>
        <TripDetail
          trip={scopedTrip}
          members={budget.members}
          currency={currency}
          splitBasis={budget.splitBasis}
          budgetId={budgetId}
          guest
          onBack={() => {}}
          onEdit={() => {}}
          onUpdate={onUpdateTrip}
        />
      </div>
    );
  }

  return (
    <div className="gb">
      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          style={{
            position: "fixed",
            bottom: 12,
            left: 12,
            zIndex: 50,
            fontFamily: "inherit",
            fontSize: 11.5,
            fontWeight: 600,
            color: "var(--dim)",
            background: "var(--surface, #fff)",
            border: "1px solid var(--line)",
            borderRadius: 8,
            padding: "5px 10px",
            cursor: "pointer",
            opacity: 0.9,
          }}
        >
          {isSuperuser ? "Sign out" : "Leave"}
        </button>
      )}
      {/* Header */}
      <div className="gb-head">
        <div className="gb-head-l" style={{ flexDirection: "column", alignItems: "flex-start", gap: 0 }}>
          <span className="card-eyebrow" style={{ display: "block", marginBottom: 2 }}>STRATEGIE · SHARED BUDGET</span>
          <h1 className="gb-title">{view === "trips" ? "Trips & travel" : "People"}</h1>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 10 }}>
            <div className="seg gb-viewseg" role="tablist" aria-label="View">
              <button type="button" className={`seg-btn${view === "people" ? " on" : ""}`} onClick={() => setView("people")}>People</button>
              <button type="button" className={`seg-btn${view === "trips" ? " on" : ""}`} onClick={() => setView("trips")}>
                Trips<span className="gb-viewseg-n">{(budget.trips ?? []).length}</span>
              </button>
            </div>
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
        </div>
      </div>

      {view === "trips" ? (
        <TripsView
          trips={budget.trips ?? []}
          members={budget.members}
          currency={currency}
          splitBasis={budget.splitBasis}
          budgetId={budgetId}
          onAddTrip={onAddTrip}
          onUpdateTrip={onUpdateTrip}
          onRemoveTrip={onRemoveTrip}
        />
      ) : (
        <PeopleView
          balances={balances}
          currency={currency}
          budgetId={budgetId}
          onEdit={editPerson}
          onAdd={addPerson}
        />
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
          trips={budget.trips ?? []}
          onSave={savePerson}
          onRemove={personModal === "new" ? undefined : removePerson}
          onClose={() => setPersonModal(null)}
        />
      )}
    </div>
  );
}

export function ExpenseModal({ expense, members, currency, defaultPaidBy, onSave, onRemove, onClose }: {
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

function PersonModal({ member, budgetId, trips, onSave, onRemove, onClose }: {
  member: BudgetMember | null;
  budgetId?: string | null;
  trips: BudgetTrip[];
  onSave: (name: string) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(member?.name ?? "");
  const [scope, setScope] = useState<string>("full"); // "full" | tripId
  const [copied, setCopied] = useState(false);
  const valid = name.trim().length > 0;
  const submit = () => { if (valid) onSave(name); };

  // Personal link carries explicit ?user=<id> (who you are) and, when scoped,
  // &trip=<id> (the only trip they can open). budget id rides along as ?b=.
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const scopeTrip = scope !== "full" ? trips.find((t) => t.id === scope) : undefined;
  const shareUrl =
    member && budgetId
      ? `${origin}/?b=${budgetId}&user=${member.id}${scopeTrip ? `&trip=${scopeTrip.id}` : ""}`
      : "";

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
            <>
              {trips.length > 0 && (
                <label className="gb-fld" style={{ gridColumn: "1 / -1" }}>
                  <span className="gb-fld-lab">Trip access</span>
                  <select value={scope} onChange={(e) => setScope(e.target.value)}>
                    <option value="full">Full access — everything</option>
                    {trips.map((t) => (
                      <option key={t.id} value={t.id}>
                        {(t.emoji ? t.emoji + " " : "") + t.name} only
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="gb-fld" style={{ gridColumn: "1 / -1" }}>
                <span className="gb-fld-lab">
                  {scopeTrip
                    ? `Trip link — ${name || "they"} can only open “${scopeTrip.name}”`
                    : `Personal link — send to ${name || "them"} so they can add expenses as themselves`}
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <input readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} style={{ flex: 1 }} />
                  <button
                    type="button"
                    className="gb-settle-btn"
                    style={{ width: "auto", marginTop: 0, padding: "10px 16px", whiteSpace: "nowrap" }}
                    onClick={() => {
                      navigator.clipboard.writeText(shareUrl);
                      toast(scopeTrip ? "Trip link copied" : "Link copied");
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                  >
                    {copied ? "Copied ✓" : "Copy link"}
                  </button>
                </div>
              </div>
            </>
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
