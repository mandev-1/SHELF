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
export type SectorColorKey = "bone" | "jet-black" | "pacific-blue" | "alice-blue" | "fern";

export const SECTOR_COLOR_OPTIONS: { value: SectorColorKey; label: string }[] = [
  { value: "bone", label: "Bone" },
  { value: "jet-black", label: "Jet black" },
  { value: "pacific-blue", label: "Pacific blue" },
  { value: "alice-blue", label: "Alice blue" },
  { value: "fern", label: "Fern" },
];

/** Hex values for sector borders (see design tokens) */
export const SECTOR_HEX: Record<SectorColorKey, string> = {
  bone: "#e6d9c3",
  "jet-black": "#1f2a2a",
  "pacific-blue": "#5fb3c6",
  "alice-blue": "#eaf4f7",
  fern: "#3e7c4a",
};

const SECTOR_COLOR_SET = new Set<string>(Object.keys(SECTOR_HEX));

export function isSectorColorKey(x: unknown): x is SectorColorKey {
  return typeof x === "string" && SECTOR_COLOR_SET.has(x);
}

export interface ShelfPillarTodoItem {
  id: string;
  text: string;
  done: boolean;
  url?: string;
  note?: string;
  subtitle?: string;
  tag?: string;
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
  /** Epic / sector name (optional); shown lightly on Visual Flow when set */
  sectorName?: string;
  /** When set, a subtle Visual Flow border uses this tint; omit for default node chrome */
  sectorColor?: SectorColorKey;
  /** Bin-specific potential value text shown as PV in the bin editor. */
  potentialValue?: string;
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
  customPlanes?: { id: string; name: string }[];
  customPlaneItems?: Record<string, ShelfPillarTodoItem[]>;
  customPlaneNodePositions?: Record<string, Record<string, { x: number; y: number }>>;
  customPlaneEdges?: Record<string, VisualFlowEdge[]>;
  customPlaneNodeSizes?: Record<string, Record<string, VisualFlowNodeSize>>;
  /** Saved viewport (pan + zoom) per plane id */
  planeViewports?: Record<string, { x: number; y: number; zoom: number }>;
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
  strategie?: StrategieState;
  saleItems?: SaleItem[];
}

export type CatKey = "housing" | "food" | "transport" | "home" | "fun" | "health" | "shopping" | "other";

export interface IncomeRow { id: string; label: string; amt: number; kind: string; }
export interface ExpenseRow { id: string; label: string; amt: number; cat: CatKey; date: string; }
export interface MonthStatement { income: IncomeRow[]; expenses: ExpenseRow[]; }

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
  /** Top-level autocomplete dictionary — identity only (name + tag + optional URL). */
  accountsDirectory: AccountDictEntry[];
  /** Per-rung overrides. When unset for a rung, fall back to DEFAULT_LADDER seed. */
  rungAccounts: Record<number, RungAccountRef[]>;
}

function _defaultStrategie(): StrategieState {
  return {
    statements: {
      current: "2026-04",
      order: ["2026-04"],
      byMonth: { "2026-04": { income: [], expenses: [] } },
    },
    positions: { invested: 14000, emergencySaved: 9000, emergencyTarget: 18000 },
    pots: [
      { id: "pot-apt",   name: "Apartment deposit", target: 12000, saved: 4500, monthly: 400, fromHopper: false },
      { id: "pot-japan", name: "Japan spring 2027",  target: 6000,  saved: 1750, monthly: 150, fromHopper: false },
    ],
    memberships: [
      { id: "m_net", name: "Netflix",         plan: "Standard",   price: 13, color: "#E50914", mono: "N"  },
      { id: "m_spo", name: "Spotify",         plan: "Premium",    price: 6,  color: "#1DB954", mono: "S"  },
      { id: "m_yt",  name: "YouTube Premium", plan: "Individual", price: 12, color: "#FF0033", mono: "YT" },
      { id: "m_gpt", name: "ChatGPT",         plan: "Plus",       price: 20, color: "#10A37F", mono: "AI" },
      { id: "m_icl", name: "iCloud+",         plan: "200 GB",     price: 3,  color: "#3B82F6", mono: "iC" },
      { id: "m_not", name: "Notion",          plan: "Plus",       price: 8,  color: "#8E8E93", mono: "No" },
    ],
    currency: "CZK",
    secondaryCurrency: null,
    compareCurrencyOn: false,
    accountsDirectory: [],
    rungAccounts: {},
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
      invested:        typeof p["invested"]        === "number" ? p["invested"]        : 14000,
      emergencySaved:  typeof p["emergencySaved"]  === "number" ? p["emergencySaved"]  : 9000,
      emergencyTarget: typeof p["emergencyTarget"] === "number" ? p["emergencyTarget"] : 18000,
    };
  } else {
    positions = { invested: 14000, emergencySaved: 9000, emergencyTarget: 18000 };
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
  let accountsDirectory: AccountDictEntry[] = [];
  if (Array.isArray(r["accountsDirectory"])) {
    const seen = new Set<string>();
    accountsDirectory = (r["accountsDirectory"] as unknown[])
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
      .map((o) => ({
        name: typeof o["name"] === "string" ? o["name"] : "",
        tag:  typeof o["tag"]  === "string" ? o["tag"]  : "",
        url:  typeof o["url"]  === "string" ? o["url"]  : undefined,
      }))
      .filter((e) => {
        if (!e.name || seen.has(e.name)) return false;
        seen.add(e.name);
        return true;
      });
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

  return { statements, positions, pots, memberships, currency, secondaryCurrency, compareCurrencyOn, accountsDirectory, rungAccounts };
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
