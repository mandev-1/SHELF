export interface ShelfLayoutItem {
  id?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  width?: number;
  height?: number;
}

export type ShelfSectionColors = Record<string, string>;

export interface ShelfPrompt {
  id: string;
  title: string;
  body: string;
  versions?: ShelfPromptVersion[];
  activeVersionId?: string;
}

export type ShelfPromptMap = Record<string, ShelfPrompt>;

export interface ShelfFolderSeparator {
  id: string;
  createdAt: string;
  /**
   * Insert this separator before the bookmark link at this index (0-based).
   * Values >= links.length render at the end of the list.
   */
  atIndex?: number;
}

export type ShelfFolderSeparatorMap = Record<string, ShelfFolderSeparator[]>;

export interface ShelfGoal {
  id: string;
  title: string;
  goal: string;
  progress: number;
  label?: string; // header label (default: "Goal")
  linkUrl?: string; // optional "Continue" link
}

export type ShelfGoalMap = Record<string, ShelfGoal>;

export interface ShelfBookmarkView {
  expanded?: boolean;
}

export type ShelfBookmarkViewMap = Record<string, ShelfBookmarkView>;

export type ShelfBookmarkOverrides = Record<string, { title?: string; imageUrl?: string }>;

export interface ShelfPromptVersion {
  id: string;
  code: string;
  body: string;
  createdAt: string;
}

export type ShelfTodoBlockStatus = "blocked" | "ready" | "abeyed";

export type ShelfTodoHandleConfig =
  | "horizontal"
  | "vertical"
  | "top"
  | "bottom"
  | "left"
  | "right"
  /** All four sides, with both source and target points on each side. */
  | "omni"
  | "hidden";

export const GRAZELAND_HANDLE_SLOTS = [
  "top1",
  "top2",
  "right1",
  "right2",
  "bottom1",
  "bottom2",
  "left1",
  "left2",
] as const;

export type ShelfGrazelandHandleSlot = (typeof GRAZELAND_HANDLE_SLOTS)[number];

export type ShelfGrazelandHandleVisibility = Record<ShelfGrazelandHandleSlot, boolean>;

export function createGrazelandHandleVisibility(allVisible = true): ShelfGrazelandHandleVisibility {
  return {
    top1: allVisible,
    top2: allVisible,
    right1: allVisible,
    right2: allVisible,
    bottom1: allVisible,
    bottom2: allVisible,
    left1: allVisible,
    left2: allVisible,
  };
}

/** Epic / sector border tint on Visual Flow (subtle; optional) */
export type SectorColorKey =
  | "bone"
  | "jet-black"
  | "pacific-blue"
  | "alice-blue"
  | "fern"
  | "neon-blue"
  | "acid-blue"
  | "king-blue";

export const SECTOR_COLOR_OPTIONS: { value: SectorColorKey; label: string }[] = [
  { value: "bone", label: "Bone" },
  { value: "jet-black", label: "Jet black" },
  { value: "pacific-blue", label: "Pacific blue" },
  { value: "alice-blue", label: "Alice blue" },
  { value: "fern", label: "Fern" },
  { value: "neon-blue", label: "Neon blue" },
  { value: "acid-blue", label: "Acid blue" },
  { value: "king-blue", label: "King blue" },
];

/** Hex values for sector borders (see design tokens) */
export const SECTOR_HEX: Record<SectorColorKey, string> = {
  bone: "#e6d9c3",
  "jet-black": "#1f2a2a",
  "pacific-blue": "#5fb3c6",
  "alice-blue": "#eaf4f7",
  fern: "#3e7c4a",
  "neon-blue": "#3a72ff",
  "acid-blue": "#16e0e6",
  "king-blue": "#1d4ed8",
};

const SECTOR_COLOR_SET = new Set<string>(Object.keys(SECTOR_HEX));

export function isSectorColorKey(x: unknown): x is SectorColorKey {
  return typeof x === "string" && SECTOR_COLOR_SET.has(x);
}

/** A subtask within a task's checklist (Doing-now Edit-Task editor). */
export interface ShelfTodoChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface ShelfPillarTodoItem {
  id: string;
  text: string;
  done: boolean;
  url?: string;
  note?: string;
  subtitle?: string;
  tag?: string;
  /** Structured subtasks shown in the Doing-now Edit-Task editor. */
  checklist?: ShelfTodoChecklistItem[];
  /** When true, the deadline is a fixed meeting time (show the start time, not a countdown). */
  fixedMeeting?: boolean;
  /** Task blocking status: blocked by another, ready to work on, or abeyed. Only in edit form, not shown in Pillar. */
  blockStatus?: ShelfTodoBlockStatus;
  /** Main-plane handle preset. Special planes use grazelandHandleVisibility for per-point toggles. */
  handleConfig?: ShelfTodoHandleConfig;
  /** Visibility for the eight individual connection points on the special planes (top1/top2/right1/right2/bottom1/bottom2/left1/left2). */
  grazelandHandleVisibility?: ShelfGrazelandHandleVisibility;
  /** Optional date string (e.g. YYYY-MM-DD). Shown in Visual Flow when showTodoDates is on. */
  date?: string;
  /** When true, the task appears in the visual flow focus drawer. */
  focused?: boolean;
  /** Urgency flag — "on fire". Renders a flame + warm border on the Pillar row. */
  burning?: boolean;
  /** Epic / sector name (optional); shown lightly on Visual Flow when set */
  sectorName?: string;
  /** When set, a subtle Visual Flow border uses this tint; omit for default node chrome */
  sectorColor?: SectorColorKey;
  /** Bin-specific potential value text shown as PV in the bin editor. */
  potentialValue?: string;
  /** Epoch ms when the item was first created. */
  createdAt?: number;
  /** Epoch ms when the item was last modified. */
  updatedAt?: number;
  /** Bounded audit trail of changes (most recent last). */
  history?: ShelfTodoAuditEntry[];
}

/** A single entry in an item's audit trail. */
export interface ShelfTodoAuditEntry {
  /** Epoch ms when the change happened. */
  at: number;
  /** What kind of change occurred. */
  action: "created" | "updated" | "completed" | "restored";
  /** Names of the content fields that changed (for "updated"). */
  fields?: string[];
}

export interface ObsidianLogConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  notePath: string;
  /** When true, append /YYYY-MM-DD.md to notePath for one log per day */
  useDailyNote?: boolean;
}

export type ShelfTheme = "dark" | "day" | "sap" | "auto";

export type BookmarkSize = "normal" | "senior";

export type VisualFlowEdge = {
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  arrow?: boolean;
  doubled?: boolean;
  muted?: boolean;
};

export type VisualFlowNodeSize = {
  width?: number;
  height?: number;
};

/** Time-block "blocker" (handoff 011): reserves a window of time. Lives in the
 * Doing-now pipeline (its id sits in `doingNow.pipeline`), not on the canvas. */
export interface Blocker {
  id: string;
  label: string;
  /** START time, ms epoch. */
  due: number;
  /** Duration in minutes (30 / 45 / 60). */
  dur: number;
  /** Legacy flow-space coords from the canvas-node prototype; unused now. */
  x?: number;
  y?: number;
}

export interface VisualFlowData {
  nodePositions?: Record<string, { x: number; y: number }>;
  edges?: VisualFlowEdge[];
  /** Second canvas layer — same item shape as pillar todos, separate from main flow */
  grazelandNodePositions?: Record<string, { x: number; y: number }>;
  grazelandEdges?: VisualFlowEdge[];
  /** Explicit size overrides for Grazeland nodes; omitted dimensions keep the computed default. */
  grazelandNodeSizes?: Record<string, VisualFlowNodeSize>;
  /** Third canvas layer — same item shape as pillar todos, separate from the other special plane. */
  binNodePositions?: Record<string, { x: number; y: number }>;
  binEdges?: VisualFlowEdge[];
  /** Explicit size overrides for Bin nodes; omitted dimensions keep the computed default. */
  binNodeSizes?: Record<string, VisualFlowNodeSize>;
  /** Sector label → border color; applies to all tasks with that sector name on both planes */
  sectorColors?: Record<string, SectorColorKey>;
  /** User-created custom planes beyond the three built-ins */
  customPlanes?: { id: string; name: string; color?: string }[];
  /** Focused-task cards expanded in the focus drawer (default collapsed). */
  focusExpandedIds?: string[];
  /** Plane groups collapsed in the focus drawer. */
  focusCollapsedGroups?: string[];
  customPlaneItems?: Record<string, ShelfPillarTodoItem[]>;
  customPlaneNodePositions?: Record<string, Record<string, { x: number; y: number }>>;
  customPlaneEdges?: Record<string, VisualFlowEdge[]>;
  customPlaneNodeSizes?: Record<string, Record<string, VisualFlowNodeSize>>;
  /** Saved viewport (pan + zoom) per plane id */
  planeViewports?: Record<string, { x: number; y: number; zoom: number }>;
  /** "Doing now" pipeline (handoff 010): ordered task ids (max 7 = 1 active + 6 queued) + drawer open state. */
  doingNow?: { pipeline: string[]; open: boolean };
  /** Time-block "blocker" nodes (handoff 011). */
  blockers?: Blocker[];
}

/** Border/handle color for a node: managed sector map wins, then per-task `sectorColor`. */
export function resolveVisualFlowSectorColor(
  todo: ShelfPillarTodoItem,
  sectorColors?: Record<string, SectorColorKey>
): SectorColorKey | undefined {
  const name = todo.sectorName?.trim();
  if (name && sectorColors && isSectorColorKey(sectorColors[name])) {
    return sectorColors[name];
  }
  return todo.sectorColor;
}

/** Builist (TEMP working name) — buylist hopper item. Stack is FIFO:
 *  newest item is at index 0 (visually top), oldest is the last index
 *  (the "bottom slot" — the only one eligible to be bought). */
export interface BuylistItem {
  id: string;
  title: string;
  url?: string;
  note?: string;
  addedAt: string;
}

export type SaleStatus = "listed" | "reserved" | "sold";
export interface SaleItem {
  id: string;
  name: string;
  where: string;
  price: number;
  unit: string;
  status: SaleStatus;
  url?: string;
  createdAt: string;
  updatedAt: string;
  soldAt: string | null;
  history: { at: string; text: string }[];
}

export type InvCategory = "Tech" | "Music" | "Photo" | "Sport" | "Home" | "Gear" | "Other";
export interface InvAccessory {
  id: string;
  name: string;
  value: number;
}
export interface InventoryItem {
  id: string;
  name: string;
  category: InvCategory;
  estimatedValue: number;
  notes?: string;
  url?: string;
  /** Quick link to a marketplace / resale page. */
  sellUrl?: string;
  /** Accessories & extras that travel with this item — folded into its total value. */
  kids?: InvAccessory[];
  addedAt: string;
}

/* ============================================================
 * Holiday / Shared Budget (handoff 006)
 * A Splitwise-style shared-expense model: people, expenses split by a
 * basis (equal / share / income), with derived settle-up balances.
 * Designed sync-friendly (string ids + ISO timestamps) so an external
 * Supabase layer can merge it later.
 * ========================================================== */

export type BudgetCurrency = "CZK" | "PLN" | "EUR";

export type BudgetSplitBasis = "equal" | "share" | "income";

export interface BudgetMember {
  id: string;
  name: string;
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
  /** Amount in the budget's base currency. */
  amount: number;
  currency: BudgetCurrency;
  category?: string;
  /** ISO yyyy-mm-dd. */
  date: string;
  /** Member id who paid. */
  paidBy: string;
  /** Member ids this expense is split among (empty = everyone). */
  splitAmong: string[];
  /** Per-expense basis override; falls back to the group default. */
  basis?: BudgetSplitBasis;
  /** Custom per-member weights (when basis is custom / overridden). */
  customWeights?: Record<string, number>;
  note?: string;
  /** Receipt image as a data URL (optional, deferred UI). */
  receipt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetTrip {
  id: string;
  name: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  datesTBD?: boolean;
  color?: string;
  /** Cover image as a data URL (optional, deferred UI). */
  cover?: string;
  /** Member ids participating in this trip. */
  memberIds?: string[];
  expenses?: BudgetExpense[];
  createdAt: string;
  updatedAt: string;
}

export interface BudgetState {
  /** Base currency for all amounts (default CZK). */
  currency: BudgetCurrency;
  /** Group default split basis. */
  splitBasis: BudgetSplitBasis;
  members: BudgetMember[];
  /** Recurring / "Monthly" shared expenses. */
  expenses: BudgetExpense[];
  /** Optional shared monthly budget target. */
  monthlyBudget?: number;
  /** Month keys (yyyy-mm) the group has marked settled. */
  settledMonths?: string[];
  /** Trips ("Holiday") view. */
  trips?: BudgetTrip[];
}

export const DEFAULT_BUDGET_STATE: BudgetState = {
  currency: "CZK",
  splitBasis: "equal",
  members: [],
  expenses: [],
  trips: [],
};

export interface ShelfBackupData {
  version: number;
  layout: ShelfLayoutItem[];
  colors: ShelfSectionColors;
  theme?: ShelfTheme;
  labels: Record<string, string>;
  separators: ShelfFolderSeparatorMap;
  goals: ShelfGoalMap;
  showGoals: boolean;
  showTodoDates?: boolean;
  pillarPins?: { top: string[]; list?: string[]; overrides?: Record<string, { title?: string; imageUrl?: string }> };
  pillarTodos?: ShelfPillarTodoItem[];
  prompts: ShelfPromptMap;
  shelfName: string;
  gridLocked: boolean;
  promptRows: 1 | 2;
  hiddenFolderIds?: string[];
  bookmarkOverrides?: ShelfBookmarkOverrides;
  bookmarkViews?: ShelfBookmarkViewMap;
  bookmarkSize?: BookmarkSize;
  visualFlow?: VisualFlowData;
  /** Items for the Grazeland plane only (same fields as pillar todos; not shown on main canvas or Pillar) */
  grazelandItems?: ShelfPillarTodoItem[];
  /** Items for the Bin plane only (same fields as pillar todos; not shown on main canvas or Pillar) */
  binItems?: ShelfPillarTodoItem[];
  llmConsoleUrl?: string;
  showBothNavButtons?: boolean;
  pillarTodoPins?: string[];
  focusDesynced?: boolean;
  lowPerformanceMode?: boolean;
  /** Builist (TEMP) — buylist hopper stack */
  buylist?: BuylistItem[];
  /** Which face of the Hopper flip-card (chute vs. selling ledger) is showing. */
  hopperFace?: "buy" | "sell";
  strategie?: StrategieState;
  saleItems?: SaleItem[];
  /** Inventory tab — catalogue of owned items. */
  inventory?: InventoryItem[];
  /** Visual Flow goals layer ("camps"). */
  vfGoals?: VfGoal[];
  /** Holiday / shared budget (people, expenses, trips). */
  budget?: BudgetState;
}

export type CatKey =
  | "housing" | "food" | "eating" | "taxi" | "transport" | "home" | "electronics"
  | "clothing" | "fun" | "health" | "sport" | "shopping" | "vending" | "cash" | "fees"
  | "charity" | "credit" | "other";

export interface IncomeRow { id: string; label: string; amt: number; kind: string; }
export interface ExpenseRow {
  id: string; label: string; amt: number; cat: CatKey; date: string;
  /** When set, this "expense" is really a contribution to a savings plan. */
  savingsPlanId?: string;
  /** When set, this "expense" is really a payment toward a tracked debt.
   *  Mutually exclusive with savingsPlanId. */
  debtId?: string;
}
export interface MonthStatement { income: IncomeRow[]; expenses: ExpenseRow[]; }

export type SavingsPlanKind = "savings" | "investment" | "pension" | "building" | "other";
export const SAVINGS_PLAN_KINDS: { id: SavingsPlanKind; label: string }[] = [
  { id: "savings",    label: "Savings account" },
  { id: "investment", label: "Investment plan" },
  { id: "pension",    label: "Pension" },
  { id: "building",   label: "Building savings" },
  { id: "other",      label: "Other program" },
];
/** Legend hues cycled through as plans are created. */
export const SAVINGS_PLAN_HUES = ["#6366f1", "#3b82f6", "#14b8a6", "#f59e0b", "#a384df", "#ec4899", "#22c55e", "#94a3b8"];

// ─── Account kinds (Accounts card + manager) ─────────────────────────────────
export type AccountKind = "checking" | "fintech" | "savings" | "brokerage" | "pension" | "building" | "crypto" | "cash";
export const ACCOUNT_KINDS: { id: AccountKind; label: string; hue: string }[] = [
  { id: "checking",  label: "Checking",  hue: "#5b9cff" },
  { id: "fintech",   label: "Fintech",   hue: "#22d3ee" },
  { id: "savings",   label: "Savings",   hue: "#34c891" },
  { id: "brokerage", label: "Brokerage", hue: "#a384df" },
  { id: "pension",   label: "Pension",   hue: "#e0905a" },
  { id: "building",  label: "Building",  hue: "#6595ee" },
  { id: "crypto",    label: "Crypto",    hue: "#e0a020" },
  { id: "cash",      label: "Cash",      hue: "#8b8b95" },
];
/** Current schema version of the seeded accounts directory. Bumping reseeds the
 *  starter slice on next load (user statements/pots/etc. are preserved). */
export const ACCT_SCHEMA_V = 3;
/** No seed — the accounts directory starts empty; the user adds their own. */
export const DEFAULT_ACCOUNTS_DIRECTORY: AccountDictEntry[] = [];
export interface SavingsPlan {
  id: string;
  name: string;
  kind: SavingsPlanKind;
  hue: string;       // legend / chart color
  monthly: number;   // planned monthly contribution (USD-base), 0 = none
  target: number;    // total goal (USD-base), 0 = open-ended
}

// ─── Debt tracking (Open debt card + statement debt payments) ─────────────────
export type DebtKind = "consumer" | "student" | "card" | "family" | "mortgage" | "business" | "other";
export const DEBT_KINDS: { id: DebtKind; label: string; hue: string }[] = [
  { id: "consumer", label: "Car / consumer loan",     hue: "#e08648" },
  { id: "student",  label: "Student loan",            hue: "#6595ee" },
  { id: "card",     label: "Credit card / overdraft", hue: "#e0647a" },
  { id: "family",   label: "Family & friends",        hue: "#34c891" },
  { id: "mortgage", label: "Mortgage",                hue: "#a384df" },
  { id: "business", label: "Business loan",           hue: "#e0a020" },
  { id: "other",    label: "Other",                   hue: "#8b8b95" },
];
export type DebtStrategy = "avalanche" | "snowball";
export interface Debt {
  id: string;
  name: string;
  kind: DebtKind;
  /** Starting balance in USD-base. Remaining = principal − Σ rows tagged debtId. */
  principal: number;
  /** APR %. 0 = interest-free. */
  rate: number;
  /** Planned monthly payment (USD-base), 0 = none set. */
  payment: number;
}
/** Bumping reseeds the starter debts slice on next load (statements/pots preserved). */
export const DEBT_SCHEMA_V = 1;
/** No seed — debts start empty; the user adds their own on the Open debt card. */
export const DEFAULT_DEBTS: Debt[] = [];

// ─── Visual Flow goals layer ("camps") ───────────────────────────────────────
export type VfGoalStatus = "notstarted" | "ontrack" | "atrisk" | "done";
export interface VfGoalMilestone { id: string; label: string; done: boolean; }
export interface VfGoalLink { type: "pot" | "debt"; id: string; }
/** How a goal's progress (doneness) is measured — money is never the progress. */
export type VfGoalProgressMode = "subgoals" | "manual";
export interface VfGoal {
  id: string;
  title: string;
  outcome: string;            // "Point B"
  status: VfGoalStatus;
  /** Target month, "YYYY-MM". */
  due?: string;
  /** Progress = doneness: completed subgoals, or a self-set %. Never the money. */
  progressMode: VfGoalProgressMode;
  /** Manual progress 0–100 (used when progressMode === "manual"). */
  manualPct?: number;
  /** "Supplies" — an OPTIONAL pot/debt tie shown as a separate readiness/paid-off
   *  indicator. It never drives the progress %. */
  supplies: VfGoalLink | null;
  /** Cascading subgoals. */
  milestones: VfGoalMilestone[];
  notes: string;              // field journal
}
/** Max campsites pitched along the trail. */
export const VF_MAX_GOALS = 6;
/** No seed — the camps map starts blank (six empty "pitch a camp" slots). */
export const DEFAULT_VF_GOALS: VfGoal[] = [];
export function normalizeVfGoals(raw: unknown): VfGoal[] {
  if (!Array.isArray(raw)) return DEFAULT_VF_GOALS.map((g) => ({ ...g, milestones: g.milestones.map((m) => ({ ...m })) }));
  const STATUSES: VfGoalStatus[] = ["notstarted", "ontrack", "atrisk", "done"];
  return (raw as unknown[])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .filter((o) => typeof o["id"] === "string")
    .slice(0, VF_MAX_GOALS)
    .map((o) => {
      // supplies (new) falls back to the legacy `link` field for old blobs
      const supRaw = o["supplies"] ?? o["link"];
      let supplies: VfGoalLink | null = null;
      if (supRaw && typeof supRaw === "object" && !Array.isArray(supRaw)) {
        const l = supRaw as Record<string, unknown>;
        if ((l["type"] === "pot" || l["type"] === "debt") && typeof l["id"] === "string") {
          supplies = { type: l["type"], id: l["id"] };
        }
      }
      const milestones: VfGoalMilestone[] = Array.isArray(o["milestones"])
        ? (o["milestones"] as unknown[])
            .filter((m): m is Record<string, unknown> => !!m && typeof m === "object" && typeof (m as Record<string, unknown>)["id"] === "string")
            .map((m) => ({ id: m["id"] as string, label: typeof m["label"] === "string" ? m["label"] : "", done: Boolean(m["done"]) }))
        : [];
      const progressMode: VfGoalProgressMode = o["progressMode"] === "manual" ? "manual" : "subgoals";
      const manualPct = typeof o["manualPct"] === "number"
        ? Math.max(0, Math.min(100, Math.round(o["manualPct"]))) : undefined;
      return {
        id: o["id"] as string,
        title: typeof o["title"] === "string" ? o["title"] : "",
        outcome: typeof o["outcome"] === "string" ? o["outcome"] : "",
        status: STATUSES.includes(o["status"] as VfGoalStatus) ? (o["status"] as VfGoalStatus) : "notstarted",
        due: typeof o["due"] === "string" ? o["due"] : undefined,
        progressMode,
        manualPct,
        supplies,
        milestones,
        notes: typeof o["notes"] === "string" ? o["notes"] : "",
      };
    });
}

// ─── Dashboard card grid (Strategie 12-col layout) ───────────────────────────
export type CardId =
  | "hero" | "ladder" | "diff" | "weekly" | "flow" | "debt"
  | "programs" | "accounts" | "pots" | "pillars" | "cats";
export type CardWidth = 4 | 6 | 8 | 12;
export interface CardLayout {
  /** Visual order of card ids. */
  order: string[];
  /** Column span per card id (4 / 6 / 8 / 12). */
  w: Record<string, CardWidth>;
}
export const DEFAULT_CARD_ORDER: CardId[] = [
  "hero", "ladder", "diff", "weekly", "flow", "debt", "programs", "accounts", "pots", "pillars", "cats",
];
export const DEFAULT_CARD_W: Record<CardId, CardWidth> = {
  // rows tile to a full 12 cols each: 8+4 · 4+8 · 4+4+4 · 4+4+4 · 12
  hero: 8, ladder: 4, diff: 4, weekly: 8, flow: 4, debt: 4, programs: 4, accounts: 4, pots: 4, pillars: 4, cats: 12,
};
export const CARD_W_SNAPS: CardWidth[] = [4, 6, 8, 12];
/** Filter unknown ids, append any missing cards, default widths to the snap set. */
export function normalizeCardLayout(stored: unknown): CardLayout {
  const s = stored && typeof stored === "object" && !Array.isArray(stored) ? (stored as Record<string, unknown>) : {};
  const srcOrder = Array.isArray(s["order"])
    ? (s["order"] as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const allIds = DEFAULT_CARD_ORDER as string[];
  const kept = srcOrder.filter((id) => allIds.includes(id));
  const order = [...kept, ...DEFAULT_CARD_ORDER.filter((id) => !kept.includes(id))];
  const storedW = s["w"] && typeof s["w"] === "object" && !Array.isArray(s["w"]) ? (s["w"] as Record<string, unknown>) : {};
  const w = {} as Record<string, CardWidth>;
  for (const id of DEFAULT_CARD_ORDER) {
    const v = storedW[id];
    w[id] = CARD_W_SNAPS.includes(v as CardWidth) ? (v as CardWidth) : DEFAULT_CARD_W[id];
  }
  return { order, w };
}

export interface MembershipRow {
  id: string;
  name: string;
  plan: string;
  price: number; // USD-base, per month
  color: string;
  mono: string;
  paused?: boolean;
}

export interface AccountDictEntry {
  /** Primary key. Renaming = delete + re-add. */
  name: string;
  tag: string;
  url?: string;
  /** Account kind for grouping / allocation. Defaults to "cash" when unset. */
  kind?: AccountKind;
  /** Current balance in USD-base. Display converts via the currency table. */
  balance?: number;
}
export interface RungAccountRef {
  accountRef: string;
  balance: number;
}

export interface StrategieState {
  statements: { current: string; order: string[]; byMonth: Record<string, MonthStatement>; };
  positions: { invested: number; emergencySaved: number; emergencyTarget: number; };
  pots: { id: string; name: string; target: number; saved: number; monthly: number; fromHopper: boolean; }[];
  memberships: MembershipRow[];
  currency: string;
  /** Optional secondary currency for side-by-side comparison. null = unset. */
  secondaryCurrency: string | null;
  /** Quick toggle: when true and `secondaryCurrency` is set, KPI values render a secondary subtitle. */
  compareCurrencyOn: boolean;
  /** Top-level accounts directory — identity + kind + USD-base balance. */
  accountsDirectory: AccountDictEntry[];
  /** Schema version of the seeded directory; a bump reseeds the starter slice. */
  acctSchemaV: number;
  /** Per-rung overrides. When unset for a rung, fall back to DEFAULT_LADDER seed. */
  rungAccounts: Record<number, RungAccountRef[]>;
  /** Savings accounts / programs that expense rows can be tagged as contributions to. */
  savingsPlans: SavingsPlan[];
  /** Tracked open liabilities. Remaining balance is statement-driven (debtId tags). */
  debts: Debt[];
  /** Payoff ordering for the Open debt card. */
  debtStrategy: DebtStrategy;
  /** Schema version of the seeded debts; a bump reseeds the starter slice. */
  debtSchemaV: number;
  /** Which face of the projection hero flip-card is showing. */
  heroFace: "grow" | "spend";
  /** 12-col dashboard card placement (order + per-card span). */
  cardLayout: CardLayout;
}

function _defaultStrategie(): StrategieState {
  return {
    statements: {
      current: "2026-04",
      order: ["2026-04"],
      byMonth: { "2026-04": { income: [], expenses: [] } },
    },
    positions: { invested: 0, emergencySaved: 0, emergencyTarget: 0 },
    pots: [],
    memberships: [],
    currency: "CZK",
    secondaryCurrency: null,
    compareCurrencyOn: false,
    accountsDirectory: DEFAULT_ACCOUNTS_DIRECTORY.map((a) => ({ ...a })),
    acctSchemaV: ACCT_SCHEMA_V,
    rungAccounts: {},
    savingsPlans: [],
    debts: DEFAULT_DEBTS.map((d) => ({ ...d })),
    debtStrategy: "avalanche",
    debtSchemaV: DEBT_SCHEMA_V,
    heroFace: "grow",
    cardLayout: { order: [...DEFAULT_CARD_ORDER], w: { ...DEFAULT_CARD_W } },
  };
}

function _clampExpenses(stmt: MonthStatement, key: string): MonthStatement {
  const [y, m] = key.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  return {
    income: stmt.income,
    expenses: stmt.expenses.map((e) => {
      const parts = e.date?.split("-");
      if (!parts || parts.length !== 3) return e;
      const d = Math.max(1, Math.min(parseInt(parts[2], 10), days));
      return { ...e, date: `${parts[0]}-${parts[1]}-${String(d).padStart(2, "0")}` };
    }),
  };
}

export function normalizeStrategie(raw: unknown): StrategieState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return _defaultStrategie();
  const r = raw as Record<string, unknown>;

  // statements
  let statements: StrategieState["statements"];
  const rs = r["statements"];
  if (rs && typeof rs === "object" && !Array.isArray(rs)) {
    const s = rs as Record<string, unknown>;
    const current = typeof s["current"] === "string" ? s["current"] : "2026-04";
    const order = Array.isArray(s["order"])
      ? (s["order"] as unknown[]).filter((x): x is string => typeof x === "string")
      : [current];
    const rawBy = s["byMonth"];
    const byMonth: Record<string, MonthStatement> = {};
    if (rawBy && typeof rawBy === "object" && !Array.isArray(rawBy)) {
      for (const [k, v] of Object.entries(rawBy as Record<string, unknown>)) {
        if (!v || typeof v !== "object" || Array.isArray(v)) continue;
        const mv = v as Record<string, unknown>;
        const income: IncomeRow[] = Array.isArray(mv["income"])
          ? (mv["income"] as unknown[]).filter((x): x is IncomeRow =>
              !!x && typeof x === "object" && typeof (x as IncomeRow).id === "string"
            )
          : [];
        const expenses: ExpenseRow[] = Array.isArray(mv["expenses"])
          ? (mv["expenses"] as unknown[]).filter((x): x is ExpenseRow =>
              !!x && typeof x === "object" && typeof (x as ExpenseRow).id === "string"
            )
          : [];
        byMonth[k] = _clampExpenses({ income, expenses }, k);
      }
    }
    if (!byMonth[current]) byMonth[current] = { income: [], expenses: [] };
    statements = { current, order: order.length ? order : [current], byMonth };
  } else {
    const def = _defaultStrategie();
    statements = def.statements;
  }

  // positions
  let positions: StrategieState["positions"];
  const rp = r["positions"];
  if (rp && typeof rp === "object" && !Array.isArray(rp)) {
    const p = rp as Record<string, unknown>;
    positions = {
      invested:        typeof p["invested"]        === "number" ? p["invested"]        : 0,
      emergencySaved:  typeof p["emergencySaved"]  === "number" ? p["emergencySaved"]  : 0,
      emergencyTarget: typeof p["emergencyTarget"] === "number" ? p["emergencyTarget"] : 0,
    };
  } else {
    positions = { invested: 0, emergencySaved: 0, emergencyTarget: 0 };
  }

  // pots
  let pots: StrategieState["pots"];
  if (Array.isArray(r["pots"])) {
    pots = (r["pots"] as unknown[])
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
      .filter((o) => typeof o["id"] === "string" && typeof o["name"] === "string")
      .map((o) => ({
        id:         o["id"] as string,
        name:       o["name"] as string,
        target:     typeof o["target"]  === "number" ? o["target"]  : 0,
        saved:      typeof o["saved"]   === "number" ? o["saved"]   : 0,
        monthly:    typeof o["monthly"] === "number" ? o["monthly"] : 0,
        fromHopper: Boolean(o["fromHopper"]),
      }));
  } else {
    pots = _defaultStrategie().pots;
  }

  // memberships
  let memberships: MembershipRow[];
  if (Array.isArray(r["memberships"])) {
    memberships = (r["memberships"] as unknown[])
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
      .filter((o) => typeof o["id"] === "string" && typeof o["name"] === "string")
      .map((o) => ({
        id:     o["id"]    as string,
        name:   o["name"]  as string,
        plan:   typeof o["plan"]   === "string" ? o["plan"]   : "",
        price:  typeof o["price"]  === "number" ? o["price"]  : 0,
        color:  typeof o["color"]  === "string" ? o["color"]  : "#8E8E93",
        mono:   typeof o["mono"]   === "string" ? o["mono"]   : "?",
        paused: Boolean(o["paused"]),
      }));
  } else {
    memberships = _defaultStrategie().memberships;
  }

  const currency = typeof r["currency"] === "string" ? r["currency"] : "CZK";
  const secondaryCurrency = typeof r["secondaryCurrency"] === "string"
    ? r["secondaryCurrency"]
    : null;
  const compareCurrencyOn = Boolean(r["compareCurrencyOn"]);

  // accounts directory
  const ACCT_KIND_IDS = new Set(ACCOUNT_KINDS.map((k) => k.id));
  let accountsDirectory: AccountDictEntry[] = [];
  if (Array.isArray(r["accountsDirectory"])) {
    const seen = new Set<string>();
    accountsDirectory = (r["accountsDirectory"] as unknown[])
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
      .map((o) => ({
        name: typeof o["name"] === "string" ? o["name"] : "",
        tag:  typeof o["tag"]  === "string" ? o["tag"]  : "",
        url:  typeof o["url"]  === "string" ? o["url"]  : undefined,
        kind: ACCT_KIND_IDS.has(o["kind"] as AccountKind) ? (o["kind"] as AccountKind) : "cash",
        balance: typeof o["balance"] === "number" ? o["balance"] : 0,
      }))
      .filter((e) => {
        if (!e.name || seen.has(e.name)) return false;
        seen.add(e.name);
        return true;
      });
  }
  // schema version: bumping reseeds the starter slice (statements/pots untouched)
  const storedAcctV = typeof r["acctSchemaV"] === "number" ? r["acctSchemaV"] : 0;
  let acctSchemaV = ACCT_SCHEMA_V;
  if (storedAcctV < ACCT_SCHEMA_V) {
    accountsDirectory = DEFAULT_ACCOUNTS_DIRECTORY.map((a) => ({ ...a }));
  } else {
    acctSchemaV = storedAcctV;
  }

  // per-rung account overrides
  let rungAccounts: Record<number, RungAccountRef[]> = {};
  const ra = r["rungAccounts"];
  if (ra && typeof ra === "object" && !Array.isArray(ra)) {
    for (const [k, v] of Object.entries(ra as Record<string, unknown>)) {
      const id = Number(k);
      if (!Number.isFinite(id) || !Array.isArray(v)) continue;
      rungAccounts[id] = (v as unknown[])
        .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
        .map((o) => ({
          accountRef: typeof o["accountRef"] === "string" ? o["accountRef"] : "",
          balance:    typeof o["balance"]    === "number" ? o["balance"]    : 0,
        }))
        .filter((e) => e.accountRef);
    }
  }

  // savings plans
  const KIND_IDS = new Set(SAVINGS_PLAN_KINDS.map((k) => k.id));
  let savingsPlans: SavingsPlan[] = [];
  if (Array.isArray(r["savingsPlans"])) {
    savingsPlans = (r["savingsPlans"] as unknown[])
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
      .filter((o) => typeof o["id"] === "string" && typeof o["name"] === "string")
      .map((o, i) => ({
        id:      o["id"] as string,
        name:    o["name"] as string,
        kind:    KIND_IDS.has(o["kind"] as SavingsPlanKind) ? (o["kind"] as SavingsPlanKind) : "savings",
        hue:     typeof o["hue"] === "string" ? o["hue"] : SAVINGS_PLAN_HUES[i % SAVINGS_PLAN_HUES.length],
        monthly: typeof o["monthly"] === "number" ? o["monthly"] : 0,
        target:  typeof o["target"]  === "number" ? o["target"]  : 0,
      }));
  }

  // debts
  const DEBT_KIND_IDS = new Set(DEBT_KINDS.map((k) => k.id));
  let debts: Debt[] = [];
  if (Array.isArray(r["debts"])) {
    debts = (r["debts"] as unknown[])
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
      .filter((o) => typeof o["id"] === "string" && typeof o["name"] === "string")
      .map((o) => ({
        id:        o["id"] as string,
        name:      o["name"] as string,
        kind:      DEBT_KIND_IDS.has(o["kind"] as DebtKind) ? (o["kind"] as DebtKind) : "other",
        principal: typeof o["principal"] === "number" ? o["principal"] : 0,
        rate:      typeof o["rate"]      === "number" ? o["rate"]      : 0,
        payment:   typeof o["payment"]   === "number" ? o["payment"]   : 0,
      }));
  }
  // schema version: bumping reseeds the starter debts slice (statements untouched)
  const storedDebtV = typeof r["debtSchemaV"] === "number" ? r["debtSchemaV"] : 0;
  let debtSchemaV = DEBT_SCHEMA_V;
  if (storedDebtV < DEBT_SCHEMA_V) {
    debts = DEFAULT_DEBTS.map((d) => ({ ...d }));
  } else {
    debtSchemaV = storedDebtV;
  }
  const debtStrategy: DebtStrategy = r["debtStrategy"] === "snowball" ? "snowball" : "avalanche";

  const heroFace = r["heroFace"] === "spend" ? "spend" : "grow";
  const cardLayout = normalizeCardLayout(r["cardLayout"]);

  return { statements, positions, pots, memberships, currency, secondaryCurrency, compareCurrencyOn, accountsDirectory, acctSchemaV, rungAccounts, savingsPlans, debts, debtStrategy, debtSchemaV, heroFace, cardLayout };
}

export const ACCENT_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
] as const;
