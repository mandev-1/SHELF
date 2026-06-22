"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
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
import { AddExpenseButton } from "./AddExpenseButton";
import { toast } from "../lib/toast";

const CURRENCIES: BudgetCurrency[] = ["CZK", "PLN", "EUR"];
const BASES: { id: BudgetSplitBasis; label: string }[] = [
  { id: "equal", label: "Equal" },
  { id: "share", label: "By share" },
  { id: "income", label: "By income" },
];
const CATEGORIES = ["Groceries", "Dining", "Transport", "Housing", "Fun", "Health", "Fees", "Other"];

// A person is either an admin (full access) or a member scoped to one trip.
type PersonAccess = { isAdmin: boolean; tripId: string };
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
  const [addExpenseSignal, setAddExpenseSignal] = useState(0); // bumping opens the scoped trip's Add-Expense modal
  const [personModal, setPersonModal] = useState<BudgetMember | "new" | null>(null);
  const [view, setView] = useState<"people" | "trips">("people");
  // Which trip is open in the Trips tab — lifted here so the page header can show
  // its "Add expense" action beside the title.
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  // Always start a view at the top, and close any open trip when switching tabs.
  useEffect(() => {
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
    setSelectedTripId(null);
  }, [view]);
  const creatingRef = useRef(false); // guards against double-submit creating two people

  const { balances, total, transfers } = useMemo(() => computeBalances(budget), [budget]);
  const currency = budget.currency;

  const setBasis = (b: BudgetSplitBasis) => setBudget((p) => ({ ...p, splitBasis: b }));

  const addPerson = () => setPersonModal("new");
  const editPerson = (m: BudgetMember) => setPersonModal(m);
  // A non-admin person is scoped to exactly ONE trip — enforced via that trip's
  // roster (trips.memberIds): join the chosen trip, leave all others.
  const setExclusiveTripMembership = (memberId: string, tripId: string) => {
    (budget.trips ?? []).forEach((trip) => {
      const ids = trip.memberIds ?? [];
      const has = ids.includes(memberId);
      if (trip.id === tripId && !has) {
        onUpdateTrip({ ...trip, memberIds: [...ids, memberId], updatedAt: nowIso() });
      } else if (trip.id !== tripId && has) {
        onUpdateTrip({ ...trip, memberIds: ids.filter((x) => x !== memberId), updatedAt: nowIso() });
      }
    });
  };
  const persistAccess = (id: string, name: string, access?: PersonAccess) => {
    onUpdateUser(id, { name, ...(access ? { role: access.isAdmin ? "admin" : "member" } : {}) });
    if (access && !access.isAdmin && access.tripId) setExclusiveTripMembership(id, access.tripId);
  };
  const savePerson = async (name: string, access?: PersonAccess) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (personModal === "new") {
      if (creatingRef.current) return; // double-submit guard → no duplicate person
      creatingRef.current = true;
      try {
        const m = await onAddUser(trimmed);
        // Reopen in edit mode so the host immediately sees this person's share link.
        setPersonModal(m ?? null);
      } finally {
        creatingRef.current = false;
      }
      return;
    }
    persistAccess((personModal as BudgetMember).id, trimmed, access);
    setPersonModal(null);
  };
  const applyPerson = (name: string, access?: PersonAccess) => {
    const trimmed = name.trim();
    if (!trimmed || personModal === "new") return;
    persistAccess((personModal as BudgetMember).id, trimmed, access);
    toast("Changes applied");
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

  // Non-admin members are locked to their single trip: if they opened any other
  // link (the full budget, or a trip they're not on), send them to their trip.
  const memberTrip =
    activeMember && activeMember.role !== "admin"
      ? (budget.trips ?? []).find((t) => (t.memberIds ?? []).includes(activeMember.id))
      : undefined;
  const effectiveScopedTripId = memberTrip ? memberTrip.id : scopedTripId;

  // Guest mode: a trip-scoped link (?trip=<id>) shows ONLY that trip — no People
  // tab, no other trips, no host actions. (Soft scoping — a UX guardrail.)
  if (effectiveScopedTripId) {
    const scopedTrip = (budget.trips ?? []).find((t) => t.id === effectiveScopedTripId);
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
            </div>
          </div>
          <AddExpenseButton onClick={() => setAddExpenseSignal((s) => s + 1)} />
        </div>
        <TripDetail
          trip={scopedTrip}
          members={budget.members}
          currency={currency}
          splitBasis={budget.splitBasis}
          budgetId={budgetId}
          guest
          actorId={activeMemberId}
          actorName={activeMember?.name}
          addExpenseSignal={addExpenseSignal}
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
          <span className="card-eyebrow ink-on-paper" style={{ display: "block", marginBottom: 2 }}>STRATEGIE · SHARED BUDGET</span>
          <h1 className="gb-title ink-on-paper">{view === "trips" ? "Trips & travel" : "People"}</h1>
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
          </div>
        </div>
        {view === "trips" && selectedTripId && (
          <AddExpenseButton onClick={() => setAddExpenseSignal((s) => s + 1)} />
        )}
      </div>

      {view === "trips" ? (
        <TripsView
          trips={budget.trips ?? []}
          members={budget.members}
          currency={currency}
          splitBasis={budget.splitBasis}
          budgetId={budgetId}
          canManage={isSuperuser}
          actorId={activeMemberId}
          actorName={activeMember?.name ?? (isSuperuser ? "Host" : undefined)}
          selectedTripId={selectedTripId}
          onSelectTrip={setSelectedTripId}
          addExpenseSignal={addExpenseSignal}
          onAddTrip={onAddTrip}
          onUpdateTrip={onUpdateTrip}
          onRemoveTrip={onRemoveTrip}
        />
      ) : (
        <PeopleView
          balances={balances}
          currency={currency}
          budgetId={budgetId}
          trips={budget.trips ?? []}
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
          onApply={applyPerson}
          onRemove={personModal === "new" ? undefined : removePerson}
          onClose={() => setPersonModal(null)}
        />
      )}
    </div>
  );
}

function localIso(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// Inclusive list of ISO days from start to end (guards against reversed/huge ranges).
function eachDayISO(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  let cur = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  if (isNaN(cur.getTime()) || isNaN(end.getTime()) || end.getTime() < cur.getTime()) return out;
  let guard = 0;
  while (cur.getTime() <= end.getTime() && guard < 60) {
    out.push(localIso(cur));
    cur = new Date(cur.getTime() + 86400000);
    guard++;
  }
  return out;
}

export function ExpenseModal({ expense, members, currency, currencies, defaultCurrency, defaultPaidBy, dateRange, onSave, onRemove, onClose }: {
  expense: BudgetExpense | null;
  members: BudgetMember[];
  currency: BudgetCurrency;
  /** Currency choices offered (trip = [main, secondary, EUR]); defaults to all. */
  currencies?: BudgetCurrency[];
  /** Pre-selected currency for a new expense (e.g. the trip's main currency). */
  defaultCurrency?: BudgetCurrency;
  defaultPaidBy?: string;
  /** Trip date range — when set, the day picker offers the trip's days instead. */
  dateRange?: { start?: string; end?: string };
  onSave: (e: BudgetExpense) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const curOptions = currencies ?? CURRENCIES;
  const [title, setTitle] = useState(expense?.title ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [cur, setCur] = useState<BudgetCurrency>(expense?.currency ?? defaultCurrency ?? currency);
  const [category, setCategory] = useState(expense?.category ?? "");

  // Inside a trip, the day picker offers the trip's days; otherwise recent days.
  const rangeDaysAll = dateRange?.start && dateRange?.end ? eachDayISO(dateRange.start, dateRange.end) : [];
  const rangeDays = rangeDaysAll.length ? rangeDaysAll : null;
  const clampToRange = (iso: string, list: string[]) => {
    if (!list.length || list.includes(iso)) return iso;
    if (iso < list[0]) return list[0];
    if (iso > list[list.length - 1]) return list[list.length - 1];
    return iso;
  };
  const [date, setDate] = useState(
    expense?.date ?? (rangeDays ? clampToRange(today(), rangeDays) : today()),
  );
  const [paidBy, setPaidBy] = useState(expense?.paidBy ?? defaultPaidBy ?? members[0]?.id ?? "");
  const [among, setAmong] = useState<string[]>(
    expense?.splitAmong?.length ? expense.splitAmong : members.map((m) => m.id),
  );
  const [receipt, setReceipt] = useState<string | undefined>(expense?.receipt);

  const allIds = members.map((m) => m.id);
  const initialSplitMode: "equal" | "custom" | "me" = (() => {
    const sa = expense?.splitAmong;
    if (!sa || sa.length === 0 || sa.length === members.length) return "equal";
    if (sa.length === 1) return "me";
    return "custom";
  })();
  const [splitMode, setSplitMode] = useState<"equal" | "custom" | "me">(initialSplitMode);
  const splitIds = splitMode === "equal" ? allIds : splitMode === "me" ? [paidBy] : among;

  // Day chips: the trip's days when in a trip, else the last 5 days (anchored so
  // the selected date is always one of the chips).
  const dayList: string[] =
    rangeDays ??
    (() => {
      const sel = new Date(`${date}T00:00:00`);
      const t = new Date(`${today()}T00:00:00`);
      const diff = Math.round((t.getTime() - sel.getTime()) / 86400000);
      const anchor = diff >= 0 && diff <= 4 ? t : sel;
      return [4, 3, 2, 1, 0].map((i) => localIso(new Date(anchor.getTime() - i * 86400000)));
    })();

  const amt = Number(amount) || 0;
  const perHead = splitIds.length ? amt / splitIds.length : 0;

  // TODO (later version): receipts are stored inline as base64 data URLs on the
  // expense — fine for small images but it bloats the jsonb blob and risks the
  // Go API's 8 MiB body cap for big photos. Move to object storage (Supabase
  // Storage / S3) and persist only a URL/key; ideally OCR on upload. See SSoT §10.
  const onReceiptFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setReceipt(reader.result as string);
    reader.readAsDataURL(file);
  };

  const valid = title.trim() && amt > 0 && paidBy && splitIds.length > 0;
  const submit = () => {
    if (!valid) return;
    const base: BudgetExpense = expense ?? { id: uid(), title: "", amount: 0, currency: cur, date, paidBy, splitAmong: splitIds, createdAt: nowIso(), updatedAt: nowIso() };
    onSave({
      ...base,
      title: title.trim(),
      amount: amt,
      currency: cur,
      category: category || undefined,
      date,
      paidBy,
      splitAmong: splitIds,
      receipt: receipt || undefined,
      updatedAt: nowIso(),
    });
  };

  return (
    <div className="gb-modal-backdrop" onClick={onClose}>
      <div className="gb-modal gb-modal--sm" onClick={(e) => e.stopPropagation()}>
        <div className="gb-modal-head">
          <span className="card-eyebrow">Shared expense</span>
          <button type="button" className="gb-modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="gb-modal-body" style={{ display: "block" }}>
          <h2 className="gb-modal-title">{expense ? "Edit expense" : "Add an expense"}</h2>
          <p className="gb-modal-desc">
            Log what was bought, who paid, and how it splits. It feeds the budget and the settle-up.
          </p>

          <div className="gb-scan-field" style={{ marginTop: 14 }}>
            {receipt ? (
              <div className="gb-scan-attached">
                <div className="gb-scan-thumbwrap">
                  <img className="gb-scan-thumb" src={receipt} alt="receipt" />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="gb-scan-main">Receipt attached</div>
                  <div className="gb-scan-sub">Saved with this expense.</div>
                </div>
                <button type="button" className="gb-modal-cancel" onClick={() => setReceipt(undefined)}>
                  Remove
                </button>
              </div>
            ) : (
              <label className="gb-scan-drop">
                <div className="gb-scan-ico">📸</div>
                <div className="gb-scan-main">Scan a receipt</div>
                <div className="gb-scan-sub">
                  Drop a photo or screenshot — we’ll read the merchant, total and date. Or just type it in below.
                </div>
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={onReceiptFile} />
              </label>
            )}
          </div>

          <label className="gb-fld" style={{ marginTop: 14 }}>
            <span className="gb-fld-lab">What was it?</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Groceries — Lidl" />
          </label>

          <label className="gb-fld">
            <span className="gb-fld-lab">Amount</span>
            <div className="gb-amt">
              <select className="gb-amt-cur" value={cur} onChange={(e) => setCur(e.target.value as BudgetCurrency)} aria-label="Currency">
                {curOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                className="se-amt-input"
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                style={{ flex: 1, minWidth: 0, padding: 0, textAlign: "right", fontSize: 16, fontWeight: 700, color: "var(--fg)" }}
              />
            </div>
          </label>

          <label className="gb-fld">
            <span className="gb-fld-lab">Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">—</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          <div className="gb-fld">
            <span className="gb-fld-lab">Which day?</span>
            <div className="gb-daypick">
              {dayList.map((di) => {
                const d = new Date(`${di}T00:00:00`);
                return (
                  <button type="button" key={di} className={`gb-day${di === date ? " on" : ""}`} onClick={() => setDate(di)}>
                    <span className="gb-day-dow">{d.toLocaleDateString("en", { weekday: "short" })}</span>
                    <span className="gb-day-num">{d.getDate()}</span>
                    <span className="gb-day-mon">{d.toLocaleDateString("en", { month: "short" })}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="gb-fld">
            <span className="gb-fld-lab">Paid by</span>
            <div className="gb-paidby">
              {members.map((m, i) => (
                <button key={m.id} type="button" className={`gb-paid-chip${paidBy === m.id ? " on" : ""}`} onClick={() => setPaidBy(m.id)}>
                  <Avatar member={m} idx={i} size={22} /> {m.name}
                </button>
              ))}
            </div>
          </div>

          <div className="gb-fld">
            <span className="gb-fld-lab">How does it split?</span>
            <div className="seg gb-splitseg">
              <button
                type="button"
                className={`seg-btn${splitMode === "equal" ? " on" : ""}`}
                onClick={() => setSplitMode("equal")}
              >
                Split equally
              </button>
              <button
                type="button"
                className={`seg-btn${splitMode === "custom" ? " on" : ""}`}
                onClick={() => {
                  setSplitMode("custom");
                  if (!among.length) setAmong(allIds);
                }}
              >
                Custom split
              </button>
              <button
                type="button"
                className={`seg-btn${splitMode === "me" ? " on" : ""}`}
                onClick={() => setSplitMode("me")}
              >
                Only me
              </button>
            </div>
            <div className="gb-split-list">
              {members.map((m, i) => {
                const on = splitIds.includes(m.id);
                const interactive = splitMode === "custom";
                return (
                  <div
                    key={m.id}
                    className={`gb-split-row${on ? "" : " off"}`}
                    style={interactive ? { cursor: "pointer" } : undefined}
                    onClick={
                      interactive
                        ? () =>
                            setAmong((prev) =>
                              prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id],
                            )
                        : undefined
                    }
                  >
                    <Avatar member={m} idx={i} size={26} />
                    <span className="gb-split-name">{m.name}</span>
                    <span className="gb-split-basis">equal</span>
                    <span className="gb-split-amt">{fmt(on ? perHead : 0, cur)}</span>
                  </div>
                );
              })}
            </div>
          </div>
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

function PersonModal({ member, budgetId, trips, onSave, onApply, onRemove, onClose }: {
  member: BudgetMember | null;
  budgetId?: string | null;
  trips: BudgetTrip[];
  onSave: (name: string, access?: PersonAccess) => void;
  onApply?: (name: string, access?: PersonAccess) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(member?.name ?? "");
  // Access: admin (role "admin" → full access) vs a single trip. Defaults reflect
  // saved state — the role flag, and the one trip they're currently a member of.
  const memberTrips = member ? trips.filter((t) => (t.memberIds ?? []).includes(member.id)) : [];
  const [isAdmin, setIsAdmin] = useState((member?.role ?? "") === "admin");
  const [tripId, setTripId] = useState<string>(memberTrips[0]?.id ?? trips[0]?.id ?? "");
  const [copied, setCopied] = useState(false);
  const valid = name.trim().length > 0;
  const access: PersonAccess = { isAdmin, tripId };
  const submit = () => { if (valid) onSave(name, access); };

  // Personal link carries explicit ?user=<id> (who you are) and, for non-admins,
  // &trip=<id> (the only trip they can open). budget id rides along as ?b=.
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const scopeTrip = !isAdmin ? trips.find((t) => t.id === tripId) : undefined;
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
              <label className="gb-fld" style={{ gridColumn: "1 / -1" }}>
                <span className="gb-fld-lab">Access</span>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    cursor: "pointer",
                    fontSize: 14,
                    color: "var(--fg)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isAdmin}
                    onChange={(e) => setIsAdmin(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: "var(--accent)" }}
                  />
                  Admin — full access to everything
                </label>
              </label>
              {!isAdmin && trips.length > 0 && (
                <label className="gb-fld" style={{ gridColumn: "1 / -1" }}>
                  <span className="gb-fld-lab">Trip access — the only trip they can open</span>
                  <select value={tripId} onChange={(e) => setTripId(e.target.value)}>
                    {trips.map((t) => (
                      <option key={t.id} value={t.id}>
                        {(t.emoji ? t.emoji + " " : "") + t.name}
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
          {member ? (
            <>
              <button
                type="button"
                onClick={() => { if (valid) onApply?.(name, access); }}
                disabled={!valid}
                style={{
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--accent)",
                  background: "none",
                  border: "1px solid color-mix(in srgb, var(--accent) 40%, var(--line))",
                  borderRadius: 10,
                  padding: "9px 16px",
                  cursor: valid ? "pointer" : "default",
                  opacity: valid ? 1 : 0.5,
                }}
              >
                Apply
              </button>
              <button type="button" className="gb-settle-btn" style={{ width: "auto", marginTop: 0, padding: "10px 18px" }} disabled={!valid} onClick={submit}>
                Save
              </button>
            </>
          ) : (
            <>
              <button type="button" className="gb-modal-cancel" onClick={onClose}>Cancel</button>
              <button type="button" className="gb-settle-btn" style={{ width: "auto", marginTop: 0, padding: "10px 18px" }} disabled={!valid} onClick={submit}>
                Add person
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
