// Budget data model — ported verbatim from the ShELF extension
// (src/types/grid.ts) so the hosted app and the extension stay byte-compatible.
// The model is a single sync-friendly blob (string ids + ISO timestamps); the
// hosted version persists it as a jsonb column in Supabase instead of
// chrome.storage.local.

export type BudgetCurrency = "CZK" | "PLN" | "EUR";

export type BudgetSplitBasis = "equal" | "share" | "income";

export interface BudgetMember {
  id: string;
  name: string;
  /** "admin" = full access to everything; anything else = scoped to one trip. */
  role?: string;
  /** Weight for "by share" basis (defaults to 1). */
  share?: number;
  /** Monthly income for "by income" basis. */
  income?: number;
  /** Avatar accent (hex or token). */
  color?: string;
  createdAt: string;
}

export interface BudgetExpense {
  id: string;
  title: string;
  amount: number;
  currency: BudgetCurrency;
  category?: string;
  /** ISO yyyy-mm-dd. */
  date: string;
  paidBy: string;
  /** Member ids this expense is split among (empty = everyone). */
  splitAmong: string[];
  basis?: BudgetSplitBasis;
  customWeights?: Record<string, number>;
  /** Reconciliation statement: a settle-up payment (paidBy → splitAmong[0]).
   *  Moves balances but is NOT spending — excluded from trip totals. */
  settlement?: boolean;
  note?: string;
  receipt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetTrip {
  id: string;
  name: string;
  emoji?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  datesTBD?: boolean;
  color?: string;
  cover?: string;
  /** Totals are shown in mainCurrency, with secondaryCurrency in parentheses. */
  mainCurrency?: BudgetCurrency;
  secondaryCurrency?: BudgetCurrency;
  memberIds?: string[];
  expenses?: BudgetExpense[];
  createdAt: string;
  updatedAt: string;
}

export interface BudgetState {
  currency: BudgetCurrency;
  splitBasis: BudgetSplitBasis;
  members: BudgetMember[];
  expenses: BudgetExpense[];
  monthlyBudget?: number;
  settledMonths?: string[];
  trips?: BudgetTrip[];
}

export const DEFAULT_BUDGET_STATE: BudgetState = {
  currency: "CZK",
  splitBasis: "equal",
  members: [],
  expenses: [],
  trips: [],
};

const BUDGET_CURRENCIES: BudgetCurrency[] = ["CZK", "PLN", "EUR"];
const BUDGET_BASES: BudgetSplitBasis[] = ["equal", "share", "income"];

export function normBudgetExpense(o: any): BudgetExpense | null {
  if (!o || typeof o !== "object") return null;
  if (typeof o.id !== "string" || typeof o.paidBy !== "string") return null;
  const nowIso = new Date().toISOString();
  return {
    id: o.id,
    title: typeof o.title === "string" ? o.title : "",
    amount: typeof o.amount === "number" && isFinite(o.amount) ? o.amount : 0,
    currency: BUDGET_CURRENCIES.includes(o.currency) ? o.currency : "CZK",
    category: typeof o.category === "string" ? o.category : undefined,
    date: typeof o.date === "string" ? o.date : nowIso.slice(0, 10),
    paidBy: o.paidBy,
    splitAmong: Array.isArray(o.splitAmong)
      ? o.splitAmong.filter((x: unknown) => typeof x === "string")
      : [],
    basis: BUDGET_BASES.includes(o.basis) ? o.basis : undefined,
    customWeights:
      o.customWeights && typeof o.customWeights === "object" && !Array.isArray(o.customWeights)
        ? o.customWeights
        : undefined,
    settlement: o.settlement === true ? true : undefined,
    note: typeof o.note === "string" ? o.note : undefined,
    receipt: typeof o.receipt === "string" ? o.receipt : undefined,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : nowIso,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : nowIso,
  };
}

function normBudgetMember(o: any): BudgetMember | null {
  if (!o || typeof o !== "object" || typeof o.id !== "string" || typeof o.name !== "string")
    return null;
  return {
    id: o.id,
    name: o.name,
    role: typeof o.role === "string" ? o.role : undefined,
    share: typeof o.share === "number" ? o.share : undefined,
    income: typeof o.income === "number" ? o.income : undefined,
    color: typeof o.color === "string" ? o.color : undefined,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
  };
}

/** Sanitize an untrusted blob (from Supabase / import) into a valid BudgetState. */
export function normalizeBudget(raw: unknown): BudgetState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ...DEFAULT_BUDGET_STATE };
  const o = raw as Record<string, any>;
  const members = Array.isArray(o.members)
    ? (o.members.map(normBudgetMember).filter(Boolean) as BudgetMember[])
    : [];
  const expenses = Array.isArray(o.expenses)
    ? (o.expenses.map(normBudgetExpense).filter(Boolean) as BudgetExpense[])
    : [];
  const trips: BudgetTrip[] = Array.isArray(o.trips)
    ? o.trips
        .filter((t: any) => t && typeof t.id === "string" && typeof t.name === "string")
        .map((t: any) => ({
          id: t.id,
          name: t.name,
          emoji: typeof t.emoji === "string" ? t.emoji : undefined,
          destination: typeof t.destination === "string" ? t.destination : undefined,
          startDate: typeof t.startDate === "string" ? t.startDate : undefined,
          endDate: typeof t.endDate === "string" ? t.endDate : undefined,
          datesTBD: !!t.datesTBD,
          color: typeof t.color === "string" ? t.color : undefined,
          cover: typeof t.cover === "string" ? t.cover : undefined,
          memberIds: Array.isArray(t.memberIds)
            ? t.memberIds.filter((x: unknown) => typeof x === "string")
            : undefined,
          expenses: Array.isArray(t.expenses)
            ? (t.expenses.map(normBudgetExpense).filter(Boolean) as BudgetExpense[])
            : undefined,
          createdAt: typeof t.createdAt === "string" ? t.createdAt : new Date().toISOString(),
          updatedAt: typeof t.updatedAt === "string" ? t.updatedAt : new Date().toISOString(),
        }))
    : [];
  return {
    currency: BUDGET_CURRENCIES.includes(o.currency) ? o.currency : "CZK",
    splitBasis: BUDGET_BASES.includes(o.splitBasis) ? o.splitBasis : "equal",
    members,
    expenses,
    monthlyBudget: typeof o.monthlyBudget === "number" ? o.monthlyBudget : undefined,
    settledMonths: Array.isArray(o.settledMonths)
      ? o.settledMonths.filter((x: unknown) => typeof x === "string")
      : undefined,
    trips,
  };
}
