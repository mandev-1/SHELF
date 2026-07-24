import { useCallback, useEffect, useState } from "react";
import { isPragueDaylight } from "../utils/sun";
import { readAuditFields } from "../utils/todoAudit";
import {
  GRAZELAND_HANDLE_SLOTS,
  createGrazelandHandleVisibility,
  isSectorColorKey,
  type BookmarkSize,
  type ObsidianLogConfig,
  type ShelfBackupData,
  type ShelfGrazelandHandleVisibility,
  type ShelfTheme,
  type ShelfTodoBlockStatus,
  type ShelfTodoHandleConfig,
  type ShelfBookmarkOverrides,
  type ShelfBookmarkViewMap,
  type ShelfFolderSeparatorMap,
  type ShelfGoalMap,
  type ShelfLayoutItem,
  type ShelfPillarTodoItem,
  type ShelfPromptMap,
  type ShelfPromptVersion,
  type ShelfSectionColors,
  type SectorColorKey,
  type VisualFlowData,
  type VisualFlowNodeSize,
  type BuylistItem,
  type StrategieState,
  type MonthStatement,
  type MembershipRow,
  type SaleItem,
  type SaleStatus,
  type InventoryItem,
  type InvCategory,
  type VfGoal,
  type BudgetState,
  type BudgetCurrency,
  type BudgetSplitBasis,
  type BudgetMember,
  type BudgetExpense,
  type BudgetTrip,
  type DirectoryListItem,
  normalizeStrategie,
  normalizeVfGoals,
  DEFAULT_BUDGET_STATE,
  SAVINGS_PLAN_HUES,
} from "../types/grid";
void (undefined as unknown as SaleStatus);
void (undefined as unknown as InvCategory);

const BUDGET_CURRENCIES: BudgetCurrency[] = ["CZK", "PLN", "EUR"];
const BUDGET_BASES: BudgetSplitBasis[] = ["equal", "share", "income"];

function normBudgetExpense(o: any): BudgetExpense | null {
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
    splitAmong: Array.isArray(o.splitAmong) ? o.splitAmong.filter((x: unknown) => typeof x === "string") : [],
    basis: BUDGET_BASES.includes(o.basis) ? o.basis : undefined,
    customWeights:
      o.customWeights && typeof o.customWeights === "object" && !Array.isArray(o.customWeights)
        ? o.customWeights
        : undefined,
    note: typeof o.note === "string" ? o.note : undefined,
    receipt: typeof o.receipt === "string" ? o.receipt : undefined,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : nowIso,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : nowIso,
  };
}

function normBudgetMember(o: any): BudgetMember | null {
  if (!o || typeof o !== "object" || typeof o.id !== "string" || typeof o.name !== "string") return null;
  return {
    id: o.id,
    name: o.name,
    share: typeof o.share === "number" ? o.share : undefined,
    income: typeof o.income === "number" ? o.income : undefined,
    color: typeof o.color === "string" ? o.color : undefined,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
  };
}

function normalizeBudget(raw: unknown): BudgetState {
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
          destination: typeof t.destination === "string" ? t.destination : undefined,
          startDate: typeof t.startDate === "string" ? t.startDate : undefined,
          endDate: typeof t.endDate === "string" ? t.endDate : undefined,
          datesTBD: !!t.datesTBD,
          color: typeof t.color === "string" ? t.color : undefined,
          cover: typeof t.cover === "string" ? t.cover : undefined,
          memberIds: Array.isArray(t.memberIds) ? t.memberIds.filter((x: unknown) => typeof x === "string") : undefined,
          expenses: Array.isArray(t.expenses) ? (t.expenses.map(normBudgetExpense).filter(Boolean) as BudgetExpense[]) : undefined,
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
    settledMonths: Array.isArray(o.settledMonths) ? o.settledMonths.filter((x: unknown) => typeof x === "string") : undefined,
    trips,
  };
}

const LAYOUT_KEY = "shelf-layout";
const COLORS_KEY = "shelf-colors";
const SHELF_NAME_KEY = "shelf-name";
const LABELS_KEY = "shelf-labels";
const SEPARATORS_KEY = "shelf-separators";
const GOALS_KEY = "shelf-goals";
const SHOW_GOALS_KEY = "show-goals";
const SHOW_TODO_DATES_KEY = "show-todo-dates";
const SHOW_FOCUS_DRAWER_KEY = "shelf-show-focus-drawer";
const BOOKMARK_VIEW_KEY = "bookmark-view";
const BOOKMARK_OVERRIDES_KEY = "bookmark-overrides";
const PILLAR_KEY = "pillar-pins";
const PILLAR_TODOS_KEY = "pillar-todos";
const OBSIDIAN_LOG_KEY = "obsidian-log";
const TASK_LOG_KEY = "task-log";
const HIDDEN_FOLDERS_KEY = "shelf-hidden-folders";
const PROMPTS_KEY = "shelf-prompts";
const GRID_LOCKED_KEY = "grid-locked";
const PROMPT_ROWS_KEY = "prompt-rows";
const THEME_KEY = "shelf-theme";
const ACCENT_KEY = "shelf-accent"; // legacy: single accent value, kept for migration read
const ACCENT_BY_THEME_KEY = "shelf-accent-by-theme"; // Record<themeName, hex>

const DEFAULT_ACCENT_BY_THEME: Record<string, string> = {
  dark: "#16b981",
  day: "#d97706",
  sap: "#0070f2",
};
const BOOKMARK_SIZE_KEY = "bookmark-size";
const VISUAL_FLOW_KEY = "shelf-visual-flow";
const GRAZELAND_ITEMS_KEY = "shelf-grazeland-items";
const BIN_ITEMS_KEY = "shelf-bin-items";
const LLM_CONSOLE_URL_KEY = "shelf-llm-console-url";
const SHOW_BOTH_NAV_BUTTONS_KEY = "shelf-show-both-nav-buttons";
const PILLAR_TODO_PINS_KEY = "shelf-pillar-todo-pins";
const FOCUS_DESYNCED_KEY = "shelf-focus-desynced";
export const LOW_PERFORMANCE_MODE_KEY = "shelf-low-performance-mode";
const SHOW_CANVAS_BLOCKERS_KEY = "shelf-show-canvas-blockers";
const SHOW_STRATEGIE_TAB_KEY = "shelf-show-strategie-tab";
const SHOW_HOPPER_TAB_KEY    = "shelf-show-hopper-tab";
const SHOW_INVENTORY_TAB_KEY = "shelf-show-inventory-tab";
const BUYLIST_KEY = "shelf-buylist";
const LISTS_KEY = "shelf-lists";
const HOPPER_FACE_KEY = "shelf-hopper-face";
const SALE_ITEMS_KEY = "shelf-sale-items";
const INVENTORY_KEY = "shelf-inventory";
const STRATEGIE_KEY = "shelf-strategie";
const VF_GOALS_KEY = "shelf-vf-goals";
const BUDGET_KEY = "shelf-budget";
const SHOW_BUDGET_TAB_KEY = "shelf-show-budget-tab";

function normalizeDirectoryListItems(raw: unknown): DirectoryListItem[] {
  if (!Array.isArray(raw)) return [];
  const out: DirectoryListItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    if (!title) continue;
    out.push({
      id: typeof o.id === "string" && o.id ? o.id : crypto.randomUUID(),
      title,
      description: typeof o.description === "string" && o.description.trim() ? o.description.trim() : undefined,
    });
  }
  return out;
}

function normalizeBuylist(raw: unknown): BuylistItem[] {
  if (!Array.isArray(raw)) return [];
  const out: BuylistItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    if (typeof o.title !== "string" || !o.title.trim()) continue;
    out.push({
      id: typeof o.id === "string" && o.id ? o.id : crypto.randomUUID(),
      title: o.title,
      url: typeof o.url === "string" ? o.url : undefined,
      note: typeof o.note === "string" ? o.note : undefined,
      addedAt: typeof o.addedAt === "string" ? o.addedAt : new Date().toISOString(),
    });
  }
  return out;
}

function normalizeSaleItems(raw: unknown): SaleItem[] {
  if (!Array.isArray(raw)) return [];
  const out: SaleItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : (typeof o.title === "string" ? o.title.trim() : "");
    if (!name) continue;
    const status = (o.status === "listed" || o.status === "reserved" || o.status === "sold") ? o.status : "listed";
    const now = new Date().toISOString().slice(0, 19);
    out.push({
      id: typeof o.id === "string" && o.id ? o.id : crypto.randomUUID(),
      name,
      where: typeof o.where === "string" ? o.where : (typeof o.platform === "string" ? o.platform : ""),
      price: typeof o.price === "number" ? o.price : 0,
      unit: typeof o.unit === "string" ? o.unit : "Kč",
      status,
      url: typeof o.url === "string" ? o.url : undefined,
      createdAt: typeof o.createdAt === "string" ? o.createdAt : (typeof o.listedAt === "string" ? o.listedAt : now),
      updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : now,
      soldAt: typeof o.soldAt === "string" ? o.soldAt : null,
      history: Array.isArray(o.history) ? (o.history as { at: string; text: string }[]).filter((h) => h && typeof h.at === "string" && typeof h.text === "string") : [],
    });
  }
  return out;
}

const INV_CATS = ["Tech", "Music", "Photo", "Sport", "Home", "Gear", "Other"] as const;
function normalizeInventory(raw: unknown): InventoryItem[] {
  if (!Array.isArray(raw)) return [];
  const out: InventoryItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    if (typeof o.name !== "string" || !o.name.trim()) continue;
    const category = INV_CATS.includes(o.category as InvCategory) ? (o.category as InvCategory) : "Other";
    const kids = Array.isArray(o.kids)
      ? (o.kids as unknown[])
          .filter((k): k is Record<string, unknown> => !!k && typeof k === "object")
          .filter((k) => typeof k.name === "string" && (k.name as string).trim())
          .map((k) => ({
            id: typeof k.id === "string" && k.id ? (k.id as string) : crypto.randomUUID(),
            name: k.name as string,
            value: typeof k.value === "number" ? (k.value as number) : 0,
          }))
      : undefined;
    out.push({
      id: typeof o.id === "string" && o.id ? o.id : crypto.randomUUID(),
      name: o.name,
      category,
      estimatedValue: typeof o.estimatedValue === "number" ? o.estimatedValue : 0,
      notes: typeof o.notes === "string" ? o.notes : undefined,
      url: typeof o.url === "string" ? o.url : undefined,
      sellUrl: typeof o.sellUrl === "string" ? (o.sellUrl as string) : undefined,
      kids: kids && kids.length ? kids : undefined,
      addedAt: typeof o.addedAt === "string" ? o.addedAt : new Date().toISOString().slice(0, 10),
    });
  }
  return out;
}

const DEFAULT_PROMPTS: ShelfPromptMap = {
  hacker: {
    id: "hacker",
    title: "Hacker prompt",
    body:
      "You are a sharp, careful assistant. Think step by step, keep the answer concise, and call out any assumptions or risks before conclusions.",
    versions: [
      {
        id: "hacker-v1",
        code: "v1",
        body:
          "You are a sharp, careful assistant. Think step by step, keep the answer concise, and call out any assumptions or risks before conclusions.",
        createdAt: new Date().toISOString(),
      },
    ],
    activeVersionId: "hacker-v1",
  },
};

function normalizePrompts(input: unknown): ShelfPromptMap {
  if (!input || typeof input !== "object" || Array.isArray(input)) return DEFAULT_PROMPTS;
  const next: ShelfPromptMap = { ...DEFAULT_PROMPTS };
  for (const [id, raw] of Object.entries(input as Record<string, any>)) {
    if (!raw || typeof raw !== "object") continue;
    const versions = Array.isArray(raw.versions)
      ? raw.versions.filter(Boolean).map((version: ShelfPromptVersion) => ({
          id: version.id || crypto.randomUUID(),
          code: version.code || "v1",
          body: version.body || "",
          createdAt: version.createdAt || new Date().toISOString(),
        }))
      : [];
    const body = typeof raw.body === "string" ? raw.body : versions.at(-1)?.body ?? "";
    next[id] = {
      id,
      title: typeof raw.title === "string" ? raw.title : "New prompt",
      body,
      versions: versions.length
        ? versions
        : [
            {
              id: `${id}-v1`,
              code: "v1",
              body,
              createdAt: new Date().toISOString(),
            },
          ],
      activeVersionId:
        typeof raw.activeVersionId === "string" ? raw.activeVersionId : versions.at(-1)?.id ?? `${id}-v1`,
    };
  }
  return next;
}

function getStorage() {
  if (typeof chrome !== "undefined" && chrome.storage?.local) return chrome.storage.local;
  return null;
}

function isShelfTodoHandleConfig(value: unknown): value is ShelfTodoHandleConfig {
  return (
    value === "horizontal" ||
    value === "vertical" ||
    value === "top" ||
    value === "bottom" ||
    value === "left" ||
    value === "right" ||
    value === "omni" ||
    value === "hidden"
  );
}

function normalizeGrazelandHandleVisibility(value: unknown): ShelfGrazelandHandleVisibility | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const next = createGrazelandHandleVisibility();
  let hasAny = false;
  for (const slot of GRAZELAND_HANDLE_SLOTS) {
    if (typeof raw[slot] === "boolean") {
      next[slot] = raw[slot];
      hasAny = true;
    }
  }
  return hasAny ? next : undefined;
}

function normalizeGoals(input: unknown): ShelfGoalMap {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const next: ShelfGoalMap = {};
  for (const [id, raw] of Object.entries(input as Record<string, any>)) {
    if (!raw || typeof raw !== "object") continue;
    const title = typeof raw.title === "string" ? raw.title : "Learning in progress";
    const goal = typeof raw.goal === "string" ? raw.goal : "";
    const progress =
      typeof raw.progress === "number"
        ? raw.progress
        : typeof raw.progress === "string"
          ? Number(raw.progress)
          : 0;
    next[id] = {
      id,
      title,
      goal,
      progress: Number.isFinite(progress) ? progress : 0,
      label: typeof raw.label === "string" ? raw.label : "Goal",
      linkUrl: typeof raw.linkUrl === "string" ? raw.linkUrl : undefined,
    };
  }
  return next;
}

function normalizeNodeSizes(input: unknown): Record<string, VisualFlowNodeSize> | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const next: Record<string, VisualFlowNodeSize> = {};
  for (const [id, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const size: VisualFlowNodeSize = {};
    const width = (raw as { width?: unknown }).width;
    const height = (raw as { height?: unknown }).height;
    if (typeof width === "number" && Number.isFinite(width)) size.width = width;
    if (typeof height === "number" && Number.isFinite(height)) size.height = height;
    if (size.width !== undefined || size.height !== undefined) next[id] = size;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function normalizeShelfTodoItems(input: unknown): ShelfPillarTodoItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((x: any) => x && typeof x === "object" && typeof x.id === "string" && typeof x.text === "string")
    .map((x: any) => ({
      id: x.id,
      text: String(x.text),
      done: Boolean(x.done),
      url: typeof x.url === "string" && x.url.trim() ? x.url.trim() : undefined,
      note: typeof x.note === "string" ? x.note : undefined,
      potentialValue: typeof x.potentialValue === "string" ? x.potentialValue : undefined,
      subtitle: typeof x.subtitle === "string" ? x.subtitle : undefined,
      tag: typeof x.tag === "string" ? x.tag : undefined,
      blockStatus:
        x.blockStatus === "blocked" || x.blockStatus === "ready" || x.blockStatus === "abeyed"
          ? (x.blockStatus as ShelfTodoBlockStatus)
          : undefined,
      date: typeof x.date === "string" && x.date.trim() ? x.date.trim() : undefined,
      handleConfig: isShelfTodoHandleConfig(x.handleConfig) ? x.handleConfig : undefined,
      grazelandHandleVisibility: normalizeGrazelandHandleVisibility(x.grazelandHandleVisibility),
      focused: Boolean(x.focused),
      burning: x.burning ? true : undefined,
      checklist: (() => {
        if (!Array.isArray(x.checklist)) return undefined;
        const items = x.checklist
          .filter((c: any) => c && typeof c === "object" && typeof c.id === "string" && typeof c.text === "string")
          .map((c: any) => ({ id: c.id, text: String(c.text), done: Boolean(c.done) }));
        return items.length ? items : undefined;
      })(),
      fixedMeeting: x.fixedMeeting ? true : undefined,
      sectorName: typeof x.sectorName === "string" && x.sectorName.trim() ? x.sectorName.trim() : undefined,
      sectorColor: isSectorColorKey(x.sectorColor) ? x.sectorColor : undefined,
      ...readAuditFields(x),
    }));
}

export function useShelfStorage() {
  const [layout, setLayout] = useState<ShelfLayoutItem[]>([]);
  const [colors, setColors] = useState<ShelfSectionColors>({});
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [separators, setSeparators] = useState<ShelfFolderSeparatorMap>({});
  const [goals, setGoals] = useState<ShelfGoalMap>({});
  const [showGoals, setShowGoals] = useState(false);
  const [showTodoDates, setShowTodoDates] = useState(false);
  const [showFocusDrawer, setShowFocusDrawer] = useState(true);
  const [bookmarkViews, setBookmarkViews] = useState<ShelfBookmarkViewMap>({});
  const [bookmarkOverrides, setBookmarkOverrides] = useState<ShelfBookmarkOverrides>({});
  const [pillarPins, setPillarPins] = useState<{
    top: string[];
    overrides?: Record<string, { title?: string; imageUrl?: string }>;
  }>({ top: [] });
  const [pillarTodos, setPillarTodos] = useState<ShelfPillarTodoItem[]>([]);
  const [obsidianLog, setObsidianLogState] = useState<ObsidianLogConfig>({
    enabled: false,
    baseUrl: "http://127.0.0.1:27124",
    apiKey: "",
    notePath: "ShELF/todo-log.md",
    useDailyNote: false,
  });
  const [taskLog, setTaskLog] = useState<string>("");
  const [hiddenFolderIds, setHiddenFolderIds] = useState<string[]>([]);
  const [prompts, setPrompts] = useState<ShelfPromptMap>(DEFAULT_PROMPTS);
  const [shelfName, setShelfNameState] = useState("ShELF");
  const [gridLocked, setGridLocked] = useState(false);
  const [promptRows, setPromptRows] = useState<1 | 2>(1);
  const [theme, setThemeState] = useState<ShelfTheme>("auto");
  const [accentByTheme, setAccentByThemeState] = useState<Record<string, string>>(DEFAULT_ACCENT_BY_THEME);
  const [timeTick, setTimeTick] = useState(() => Date.now());
  const [bookmarkSize, setBookmarkSizeState] = useState<BookmarkSize>("normal");
  const [visualFlow, setVisualFlowState] = useState<VisualFlowData>({});
  const [grazelandItems, setGrazelandItemsState] = useState<ShelfPillarTodoItem[]>([]);
  const [binItems, setBinItemsState] = useState<ShelfPillarTodoItem[]>([]);
  const [llmConsoleUrl, setLlmConsoleUrlState] = useState("https://example.org");
  const [showBothNavButtons, setShowBothNavButtons] = useState(false);
  const [pillarTodoPins, setPillarTodoPinsState] = useState<string[]>([]);
  const [focusDesynced, setFocusDesyncedState] = useState(false);
  const [lowPerformanceMode, setLowPerformanceModeState] = useState(false);
  const [showCanvasBlockers, setShowCanvasBlockersState] = useState(true);
  const [showStrategieTab, setShowStrategieTabState] = useState(true);
  const [showHopperTab,    setShowHopperTabState]    = useState(true);
  const [showInventoryTab, setShowInventoryTabState] = useState(true);
  const [buylist, setBuylistState] = useState<BuylistItem[]>([]);
  const [hopperFace, setHopperFaceState] = useState<"buy" | "sell">("buy");
  const [saleItems, setSaleItemsState] = useState<SaleItem[]>([]);
  const [inventoryItems, setInventoryItemsState] = useState<InventoryItem[]>([]);
  const [strategieState, setStrategieState] = useState<StrategieState>(() => normalizeStrategie(null));
  const [vfGoals, setVfGoalsState] = useState<VfGoal[]>(() => normalizeVfGoals(undefined));
  const [budgetState, setBudgetState] = useState<BudgetState>(() => normalizeBudget(null));
  const [showBudgetTab, setShowBudgetTabState] = useState(true);
  const [lists, setListsState] = useState<DirectoryListItem[]>([]);
  const [ready, setReady] = useState(false);

  const load = useCallback(() => {
    const storage = getStorage();
    if (!storage) {
      setReady(true);
      return;
    }
    storage.get(
      [
        LAYOUT_KEY,
        COLORS_KEY,
        SHELF_NAME_KEY,
        LABELS_KEY,
        SEPARATORS_KEY,
        GOALS_KEY,
        SHOW_GOALS_KEY,
        SHOW_TODO_DATES_KEY,
        SHOW_FOCUS_DRAWER_KEY,
        BOOKMARK_VIEW_KEY,
        BOOKMARK_OVERRIDES_KEY,
        PILLAR_KEY,
        PILLAR_TODOS_KEY,
        OBSIDIAN_LOG_KEY,
        TASK_LOG_KEY,
        HIDDEN_FOLDERS_KEY,
        PROMPTS_KEY,
        GRID_LOCKED_KEY,
        PROMPT_ROWS_KEY,
        THEME_KEY,
        ACCENT_KEY,
        ACCENT_BY_THEME_KEY,
        BOOKMARK_SIZE_KEY,
        VISUAL_FLOW_KEY,
        GRAZELAND_ITEMS_KEY,
        BIN_ITEMS_KEY,
        LLM_CONSOLE_URL_KEY,
        SHOW_BOTH_NAV_BUTTONS_KEY,
        PILLAR_TODO_PINS_KEY,
        FOCUS_DESYNCED_KEY,
        LOW_PERFORMANCE_MODE_KEY,
        SHOW_CANVAS_BLOCKERS_KEY,
        SHOW_STRATEGIE_TAB_KEY,
        SHOW_HOPPER_TAB_KEY,
        SHOW_INVENTORY_TAB_KEY,
        SHOW_BUDGET_TAB_KEY,
        BUDGET_KEY,
        LISTS_KEY,
        BUYLIST_KEY,
        HOPPER_FACE_KEY,
        SALE_ITEMS_KEY,
        INVENTORY_KEY,
        STRATEGIE_KEY,
        VF_GOALS_KEY,
      ],
      (result: { [key: string]: unknown }) => {
      setLayout(Array.isArray(result[LAYOUT_KEY]) ? (result[LAYOUT_KEY] as ShelfLayoutItem[]) : []);
      setColors(
        result[COLORS_KEY] && typeof result[COLORS_KEY] === "object" && !Array.isArray(result[COLORS_KEY])
          ? (result[COLORS_KEY] as ShelfSectionColors)
          : {}
      );
      setShelfNameState(typeof result[SHELF_NAME_KEY] === "string" ? (result[SHELF_NAME_KEY] as string) : "ShELF");
      setLabels(
        result[LABELS_KEY] && typeof result[LABELS_KEY] === "object" && !Array.isArray(result[LABELS_KEY])
          ? (result[LABELS_KEY] as Record<string, string>)
          : {}
      );
      setSeparators(
        result[SEPARATORS_KEY] && typeof result[SEPARATORS_KEY] === "object" && !Array.isArray(result[SEPARATORS_KEY])
          ? (() => {
              const raw = result[SEPARATORS_KEY] as ShelfFolderSeparatorMap;
              const next: ShelfFolderSeparatorMap = {};
              for (const [folderId, seps] of Object.entries(raw)) {
                if (!Array.isArray(seps)) continue;
                next[folderId] = seps
                  .filter(Boolean)
                  .map((sep: any, index: number) => ({
                    id: typeof sep?.id === "string" ? sep.id : crypto.randomUUID(),
                    createdAt:
                      typeof sep?.createdAt === "string" ? sep.createdAt : new Date().toISOString(),
                    atIndex: typeof sep?.atIndex === "number" ? sep.atIndex : index,
                  }));
              }
              return next;
            })()
          : {}
      );
      setGoals(normalizeGoals(result[GOALS_KEY]));
      setShowGoals(result[SHOW_GOALS_KEY] === true);
      setShowTodoDates(result[SHOW_TODO_DATES_KEY] === true);
      setShowFocusDrawer(result[SHOW_FOCUS_DRAWER_KEY] !== false);
      setBookmarkViews(
        result[BOOKMARK_VIEW_KEY] && typeof result[BOOKMARK_VIEW_KEY] === "object" && !Array.isArray(result[BOOKMARK_VIEW_KEY])
          ? (result[BOOKMARK_VIEW_KEY] as ShelfBookmarkViewMap)
          : {}
      );
      setBookmarkOverrides(
        result[BOOKMARK_OVERRIDES_KEY] && typeof result[BOOKMARK_OVERRIDES_KEY] === "object" && !Array.isArray(result[BOOKMARK_OVERRIDES_KEY])
          ? (result[BOOKMARK_OVERRIDES_KEY] as ShelfBookmarkOverrides)
          : {}
      );
      setPillarPins(() => {
        const raw = result[PILLAR_KEY];
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { top: [] };
        const top = Array.isArray((raw as any).top) ? (raw as any).top.filter((x: any) => typeof x === "string") : [];
        const overrides = (raw as any).overrides && typeof (raw as any).overrides === "object" && !Array.isArray((raw as any).overrides)
          ? (raw as any).overrides as Record<string, { title?: string; imageUrl?: string }>
          : undefined;
        return { top: top.slice(0, 6), overrides };
      });
      setPillarTodos(() => normalizeShelfTodoItems(result[PILLAR_TODOS_KEY]));
      setGrazelandItemsState(() => normalizeShelfTodoItems(result[GRAZELAND_ITEMS_KEY]));
      setBinItemsState(() => normalizeShelfTodoItems(result[BIN_ITEMS_KEY]));
      const rawObs = result[OBSIDIAN_LOG_KEY];
      if (rawObs && typeof rawObs === "object" && !Array.isArray(rawObs)) {
        const o = rawObs as Record<string, unknown>;
        setObsidianLogState({
          enabled: Boolean(o.enabled),
          baseUrl: typeof o.baseUrl === "string" && o.baseUrl.trim() ? o.baseUrl.trim() : "http://127.0.0.1:27124",
          apiKey: typeof o.apiKey === "string" ? o.apiKey : "",
          notePath: typeof o.notePath === "string" && o.notePath.trim() ? o.notePath.trim() : "ShELF/todo-log.md",
          useDailyNote: Boolean(o.useDailyNote),
        });
      }
      setTaskLog(typeof result[TASK_LOG_KEY] === "string" ? result[TASK_LOG_KEY] as string : "");
      const rawHidden = result[HIDDEN_FOLDERS_KEY];
      setHiddenFolderIds(
        Array.isArray(rawHidden) ? rawHidden.filter((x: unknown) => typeof x === "string") : []
      );
      setPrompts(
        result[PROMPTS_KEY] && typeof result[PROMPTS_KEY] === "object" && !Array.isArray(result[PROMPTS_KEY])
          ? normalizePrompts(result[PROMPTS_KEY])
          : DEFAULT_PROMPTS
      );
      setGridLocked(Boolean(result[GRID_LOCKED_KEY]));
      setPromptRows(result[PROMPT_ROWS_KEY] === 2 ? 2 : 1);
      const t = result[THEME_KEY];
      setThemeState(t === "dark" || t === "day" || t === "sap" || t === "auto" ? t : "auto");
      // Per-theme accent map: prefer new key; fall back to migrating the old single-value key
      const abtRaw = result[ACCENT_BY_THEME_KEY];
      if (abtRaw && typeof abtRaw === "object" && !Array.isArray(abtRaw)) {
        const next: Record<string, string> = { ...DEFAULT_ACCENT_BY_THEME };
        for (const [k, v] of Object.entries(abtRaw as Record<string, unknown>)) {
          if (typeof v === "string" && v.startsWith("#")) next[k] = v;
        }
        setAccentByThemeState(next);
      } else {
        // Migration: seed map from legacy single-value accent (applied to current theme),
        // defaults for the rest.
        const legacy = result[ACCENT_KEY];
        const seed = { ...DEFAULT_ACCENT_BY_THEME };
        if (typeof legacy === "string" && legacy.startsWith("#")) {
          const themeForLegacy = (result[THEME_KEY] === "day" || result[THEME_KEY] === "sap")
            ? (result[THEME_KEY] as "day" | "sap")
            : "dark";
          seed[themeForLegacy] = legacy;
        }
        setAccentByThemeState(seed);
        // Persist the migrated map so subsequent loads use the new key
        getStorage()?.set({ [ACCENT_BY_THEME_KEY]: seed });
      }
      const bs = result[BOOKMARK_SIZE_KEY];
      setBookmarkSizeState(bs === "senior" ? "senior" : "normal");
      const rawUrl = result[LLM_CONSOLE_URL_KEY];
      if (typeof rawUrl === "string" && rawUrl.trim()) {
        setLlmConsoleUrlState(rawUrl.trim());
      }
      setShowBothNavButtons(result[SHOW_BOTH_NAV_BUTTONS_KEY] === true);
      const rawPins = result[PILLAR_TODO_PINS_KEY];
      setPillarTodoPinsState(
        Array.isArray(rawPins)
          ? (rawPins as unknown[]).filter((id): id is string => typeof id === "string").slice(0, 6)
          : []
      );
      setFocusDesyncedState(result[FOCUS_DESYNCED_KEY] === true);
      setLowPerformanceModeState(result[LOW_PERFORMANCE_MODE_KEY] === true);
      setShowCanvasBlockersState(result[SHOW_CANVAS_BLOCKERS_KEY] !== false);
      setShowStrategieTabState(result[SHOW_STRATEGIE_TAB_KEY] !== false);
      setShowHopperTabState   (result[SHOW_HOPPER_TAB_KEY]    !== false);
      setShowInventoryTabState(result[SHOW_INVENTORY_TAB_KEY] !== false);
      setShowBudgetTabState   (result[SHOW_BUDGET_TAB_KEY]    !== false);
      setBudgetState(normalizeBudget(result[BUDGET_KEY]));
      setListsState(normalizeDirectoryListItems(result[LISTS_KEY]));
      setBuylistState(normalizeBuylist(result[BUYLIST_KEY]));
      setHopperFaceState(result[HOPPER_FACE_KEY] === "sell" ? "sell" : "buy");
      setSaleItemsState(normalizeSaleItems(result[SALE_ITEMS_KEY]));
      setInventoryItemsState(normalizeInventory(result[INVENTORY_KEY]));
      setStrategieState(normalizeStrategie(result[STRATEGIE_KEY]));
      setVfGoalsState(normalizeVfGoals(result[VF_GOALS_KEY]));
      const vf = result[VISUAL_FLOW_KEY];
      if (vf && typeof vf === "object" && !Array.isArray(vf)) {
        const raw = vf as Record<string, unknown>;
        const parseEdges = (arr: unknown) =>
          Array.isArray(arr)
            ? (arr as unknown[])
                .filter((e: unknown) => e && typeof e === "object" && typeof (e as any).source === "string" && typeof (e as any).target === "string")
                .map((e: any) => ({
                  source: e.source,
                  target: e.target,
                  ...(e.arrow && { arrow: true }),
                  ...(e.doubled && { doubled: true }),
                  ...(e.muted && { muted: true }),
                }))
            : undefined;
        const sectorColorsRaw = raw.sectorColors;
        let sectorColors: Record<string, SectorColorKey> | undefined;
        if (sectorColorsRaw && typeof sectorColorsRaw === "object" && !Array.isArray(sectorColorsRaw)) {
          const next: Record<string, SectorColorKey> = {};
          for (const [k, v] of Object.entries(sectorColorsRaw as Record<string, unknown>)) {
            const key = typeof k === "string" ? k.trim() : "";
            if (!key || !isSectorColorKey(v)) continue;
            next[key] = v;
          }
          if (Object.keys(next).length > 0) sectorColors = next;
        }
        const grazelandNodeSizes = normalizeNodeSizes(raw.grazelandNodeSizes);
        const binNodeSizes = normalizeNodeSizes(raw.binNodeSizes);
        setVisualFlowState({
          nodePositions: raw.nodePositions && typeof raw.nodePositions === "object" ? (raw.nodePositions as Record<string, { x: number; y: number }>) : undefined,
          edges: parseEdges(raw.edges),
          grazelandNodePositions:
            raw.grazelandNodePositions && typeof raw.grazelandNodePositions === "object"
              ? (raw.grazelandNodePositions as Record<string, { x: number; y: number }>)
              : undefined,
          grazelandEdges: parseEdges(raw.grazelandEdges),
          ...(grazelandNodeSizes && { grazelandNodeSizes }),
          binNodePositions:
            raw.binNodePositions && typeof raw.binNodePositions === "object"
              ? (raw.binNodePositions as Record<string, { x: number; y: number }>)
              : undefined,
          binEdges: parseEdges(raw.binEdges),
          ...(binNodeSizes && { binNodeSizes }),
          ...(sectorColors && { sectorColors }),
          ...(Array.isArray(raw.customPlanes) ? { customPlanes: raw.customPlanes as { id: string; name: string }[] } : {}),
          ...(raw.customPlaneItems && typeof raw.customPlaneItems === "object" ? { customPlaneItems: raw.customPlaneItems as Record<string, import("../types/grid").ShelfPillarTodoItem[]> } : {}),
          ...(raw.customPlaneNodePositions && typeof raw.customPlaneNodePositions === "object" ? { customPlaneNodePositions: raw.customPlaneNodePositions as Record<string, Record<string, { x: number; y: number }>> } : {}),
          ...(raw.customPlaneEdges && typeof raw.customPlaneEdges === "object" ? { customPlaneEdges: raw.customPlaneEdges as Record<string, import("../types/grid").VisualFlowEdge[]> } : {}),
          ...(raw.customPlaneNodeSizes && typeof raw.customPlaneNodeSizes === "object" ? { customPlaneNodeSizes: raw.customPlaneNodeSizes as Record<string, Record<string, import("../types/grid").VisualFlowNodeSize>> } : {}),
          ...(raw.planeViewports && typeof raw.planeViewports === "object" ? { planeViewports: raw.planeViewports as Record<string, { x: number; y: number; zoom: number }> } : {}),
          ...(raw.doingNow && typeof raw.doingNow === "object" && !Array.isArray(raw.doingNow)
            ? {
                doingNow: {
                  pipeline: Array.isArray((raw.doingNow as any).pipeline)
                    ? ((raw.doingNow as any).pipeline as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 7)
                    : [],
                  open: !!(raw.doingNow as any).open,
                },
              }
            : {}),
          ...(Array.isArray(raw.blockers)
            ? {
                blockers: (raw.blockers as unknown[])
                  .filter((b): b is Record<string, unknown> => !!b && typeof b === "object")
                  .map((b) => ({
                    id: String((b as any).id ?? ""),
                    x: Number((b as any).x) || 0,
                    y: Number((b as any).y) || 0,
                    label: typeof (b as any).label === "string" ? (b as any).label : "Blocker",
                    due: Number((b as any).due) || 0,
                    dur: Number((b as any).dur) || 30,
                  }))
                  .filter((b) => b.id),
              }
            : {}),
          ...(Array.isArray(raw.focusExpandedIds) ? { focusExpandedIds: (raw.focusExpandedIds as unknown[]).filter((x): x is string => typeof x === "string") } : {}),
          ...(Array.isArray(raw.focusCollapsedGroups) ? { focusCollapsedGroups: (raw.focusCollapsedGroups as unknown[]).filter((x): x is string => typeof x === "string") } : {}),
        });
      }
      setReady(true);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* Cross-hook-instance sync: when one component writes a setting to
     chrome.storage.local, other components calling useShelfStorage() in
     the same tab should pick it up live. Listen to onChanged for the keys
     that cross instance boundaries (theme/accent/shelf name). */
  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return;
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName !== "local") return;
      if (changes[THEME_KEY]) {
        const v = changes[THEME_KEY].newValue;
        if (v === "dark" || v === "day" || v === "sap" || v === "auto") setThemeState(v);
      }
      if (changes[ACCENT_BY_THEME_KEY]) {
        const v = changes[ACCENT_BY_THEME_KEY].newValue;
        if (v && typeof v === "object" && !Array.isArray(v)) {
          const next: Record<string, string> = { ...DEFAULT_ACCENT_BY_THEME };
          for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
            if (typeof val === "string" && val.startsWith("#")) next[k] = val;
          }
          setAccentByThemeState(next);
        }
      }
      if (changes[SHELF_NAME_KEY]) {
        const v = changes[SHELF_NAME_KEY].newValue;
        if (typeof v === "string") setShelfNameState(v);
      }
      if (changes[SHOW_CANVAS_BLOCKERS_KEY]) {
        const v = changes[SHOW_CANVAS_BLOCKERS_KEY].newValue;
        if (typeof v === "boolean") setShowCanvasBlockersState(v);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  /* Re-evaluate every minute so "auto" flips within a minute of Prague sun-up/-down */
  useEffect(() => {
    const id = setInterval(() => setTimeTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // "auto" follows the sun in Prague (computed offline from an astronomical
  // formula — no network): daylight → sap, night → dark.
  const resolvedTheme: "dark" | "day" | "sap" =
    theme === "auto"
      ? (isPragueDaylight(new Date(timeTick)) ? "sap" : "dark")
      : theme;

  // Derived: the accent for the currently-resolved theme.
  // Each theme remembers its own accent via the accentByTheme map.
  const accent: string =
    accentByTheme[resolvedTheme] ?? DEFAULT_ACCENT_BY_THEME[resolvedTheme] ?? "#16b981";

  const saveLayout = useCallback((items: ShelfLayoutItem[]) => {
    setLayout(items);
    getStorage()?.set({ [LAYOUT_KEY]: items });
  }, []);

  const setSectionColor = useCallback((sectionId: string, color: string | null) => {
    setColors((prev) => {
      const next = { ...prev };
      if (!color) delete next[sectionId];
      else next[sectionId] = color;
      getStorage()?.set({ [COLORS_KEY]: next });
      return next;
    });
  }, []);

  const setShelfName = useCallback((name: string) => {
    setShelfNameState(name);
    getStorage()?.set({ [SHELF_NAME_KEY]: name });
  }, []);

  const setShelfLabel = useCallback((id: string, label: string | null) => {
    setLabels((prev) => {
      const next = { ...prev };
      if (!label) delete next[id];
      else next[id] = label;
      getStorage()?.set({ [LABELS_KEY]: next });
      return next;
    });
  }, []);

  const addFolderSeparator = useCallback((folderId: string) => {
    setSeparators((prev) => {
      const next = {
        ...prev,
        [folderId]: [
          ...(prev[folderId] ?? []),
          { id: crypto.randomUUID(), createdAt: new Date().toISOString(), atIndex: 999999 },
        ],
      };
      getStorage()?.set({ [SEPARATORS_KEY]: next });
      return next;
    });
  }, []);

  const setFolderSeparators = useCallback((folderId: string, seps: ShelfFolderSeparatorMap[string]) => {
    setSeparators((prev) => {
      const next = { ...prev, [folderId]: seps ?? [] };
      getStorage()?.set({ [SEPARATORS_KEY]: next });
      return next;
    });
  }, []);

  const setBookmarkExpanded = useCallback((bookmarkId: string, expanded: boolean) => {
    setBookmarkViews((prev) => {
      const next = { ...prev, [bookmarkId]: { ...(prev[bookmarkId] ?? {}), expanded } };
      getStorage()?.set({ [BOOKMARK_VIEW_KEY]: next });
      return next;
    });
  }, []);

  const setBookmarkOverride = useCallback((bookmarkId: string, override: { title?: string; imageUrl?: string } | null) => {
    setBookmarkOverrides((prev) => {
      const next = { ...prev };
      if (override === null) {
        delete next[bookmarkId];
      } else {
        const current = next[bookmarkId] ?? {};
        next[bookmarkId] = {
          title: override.title !== undefined ? override.title : current.title,
          imageUrl: override.imageUrl !== undefined ? override.imageUrl : current.imageUrl,
        };
        if (!next[bookmarkId].title && !next[bookmarkId].imageUrl) delete next[bookmarkId];
      }
      getStorage()?.set({ [BOOKMARK_OVERRIDES_KEY]: next });
      return next;
    });
  }, []);

  const setPillarPinsState = useCallback((next: { top: string[] }) => {
    setPillarPins((prev) => {
      const normalized = { ...prev, top: (next.top ?? []).filter(Boolean).slice(0, 6) };
      getStorage()?.set({ [PILLAR_KEY]: normalized });
      return normalized;
    });
  }, []);

  const setPillarPinOverride = useCallback((bookmarkId: string, override: { title?: string; imageUrl?: string } | null) => {
    setPillarPins((prev) => {
      const overrides = { ...(prev.overrides ?? {}) };
      if (override === null) {
        delete overrides[bookmarkId];
      } else {
        const current = overrides[bookmarkId] ?? {};
        overrides[bookmarkId] = {
          title: override.title !== undefined ? override.title : current.title,
          imageUrl: override.imageUrl !== undefined ? override.imageUrl : current.imageUrl,
        };
        if (!overrides[bookmarkId].title && !overrides[bookmarkId].imageUrl) delete overrides[bookmarkId];
      }
      const next = { ...prev, overrides: Object.keys(overrides).length ? overrides : undefined };
      getStorage()?.set({ [PILLAR_KEY]: next });
      return next;
    });
  }, []);

  const setPillarTodosState = useCallback((next: ShelfPillarTodoItem[] | ((prev: ShelfPillarTodoItem[]) => ShelfPillarTodoItem[])) => {
    setPillarTodos((prev) => {
      const list = typeof next === "function" ? next(prev) : next;
      const normalized = normalizeShelfTodoItems(list);
      getStorage()?.set({ [PILLAR_TODOS_KEY]: normalized });
      return normalized;
    });
  }, []);

  const setGrazelandItems = useCallback((next: ShelfPillarTodoItem[] | ((prev: ShelfPillarTodoItem[]) => ShelfPillarTodoItem[])) => {
    setGrazelandItemsState((prev) => {
      const list = typeof next === "function" ? next(prev) : next;
      const normalized = normalizeShelfTodoItems(list);
      getStorage()?.set({ [GRAZELAND_ITEMS_KEY]: normalized });
      return normalized;
    });
  }, []);

  const setBinItems = useCallback((next: ShelfPillarTodoItem[] | ((prev: ShelfPillarTodoItem[]) => ShelfPillarTodoItem[])) => {
    setBinItemsState((prev) => {
      const list = typeof next === "function" ? next(prev) : next;
      const normalized = normalizeShelfTodoItems(list);
      getStorage()?.set({ [BIN_ITEMS_KEY]: normalized });
      return normalized;
    });
  }, []);

  const setBuylist = useCallback((next: BuylistItem[] | ((prev: BuylistItem[]) => BuylistItem[])) => {
    setBuylistState((prev) => {
      const list = typeof next === "function" ? next(prev) : next;
      const normalized = normalizeBuylist(list);
      getStorage()?.set({ [BUYLIST_KEY]: normalized });
      return normalized;
    });
  }, []);

  // remember which face of the Hopper flip-card (chute vs. selling ledger) is showing
  const setHopperFace = useCallback((face: "buy" | "sell") => {
    setHopperFaceState((prev) => {
      if (prev === face) return prev;
      getStorage()?.set({ [HOPPER_FACE_KEY]: face });
      return face;
    });
  }, []);

  const buylistAdd = useCallback(
    (input: { title: string; url?: string; note?: string }) => {
      const title = input.title.trim();
      if (!title) return;
      const item: BuylistItem = {
        id: crypto.randomUUID(),
        title,
        url: input.url?.trim() || undefined,
        note: input.note?.trim() || undefined,
        addedAt: new Date().toISOString(),
      };
      setBuylist((prev) => [item, ...prev]);
    },
    [setBuylist]
  );

  const buylistDiscard = useCallback(
    (id: string) => {
      setBuylist((prev) => prev.filter((x) => x.id !== id));
    },
    [setBuylist]
  );

  const buylistBuyBottom = useCallback(() => {
    setBuylist((prev) => (prev.length === 0 ? prev : prev.slice(0, -1)));
  }, [setBuylist]);

  // Move a puck to the end of the queue (it becomes the tray / next-to-buy).
  const buylistBump = useCallback(
    (id: string) => {
      setBuylist((prev) => {
        const it = prev.find((x) => x.id === id);
        if (!it) return prev;
        return [...prev.filter((x) => x.id !== id), it];
      });
    },
    [setBuylist]
  );

  // Move an item back to the top of the queue (used by the tray's "Not yet" action).
  const buylistSkip = useCallback(
    (id: string) => {
      setBuylist((prev) => {
        const it = prev.find((x) => x.id === id);
        if (!it) return prev;
        return [it, ...prev.filter((x) => x.id !== id)];
      });
    },
    [setBuylist]
  );

  const setSaleItems = useCallback((next: SaleItem[] | ((prev: SaleItem[]) => SaleItem[])) => {
    setSaleItemsState((prev) => {
      const list = typeof next === "function" ? next(prev) : next;
      getStorage()?.set({ [SALE_ITEMS_KEY]: list });
      return list;
    });
  }, []);

  const saleItemAdd = useCallback((item: Omit<SaleItem, "id">) => {
    setSaleItems((prev) => [{
      ...item,
      id: crypto.randomUUID(),
    }, ...prev]);
  }, [setSaleItems]);

  const saleItemUpdate = useCallback((id: string, patch: Partial<SaleItem>) => {
    setSaleItems((prev) => prev.map((x) => x.id === id ? { ...x, ...patch } : x));
  }, [setSaleItems]);

  const saleItemRemove = useCallback((id: string) => {
    setSaleItems((prev) => prev.filter((x) => x.id !== id));
  }, [setSaleItems]);

  const setInventory = useCallback((next: InventoryItem[] | ((prev: InventoryItem[]) => InventoryItem[])) => {
    setInventoryItemsState((prev) => {
      const list = typeof next === "function" ? next(prev) : next;
      getStorage()?.set({ [INVENTORY_KEY]: list });
      return list;
    });
  }, []);

  const inventoryAdd = useCallback((item: Omit<InventoryItem, "id" | "addedAt">) => {
    setInventory((prev) => [{
      ...item,
      id: crypto.randomUUID(),
      addedAt: new Date().toISOString().slice(0, 10),
    }, ...prev]);
  }, [setInventory]);

  const inventoryUpdate = useCallback((id: string, patch: Partial<InventoryItem>) => {
    setInventory((prev) => prev.map((x) => x.id === id ? { ...x, ...patch } : x));
  }, [setInventory]);

  const inventoryRemove = useCallback((id: string) => {
    setInventory((prev) => prev.filter((x) => x.id !== id));
  }, [setInventory]);

  const setStrategie = useCallback((next: StrategieState) => {
    setStrategieState(next);
    getStorage()?.set({ [STRATEGIE_KEY]: next });
  }, []);

  const strategieSaveStatement = useCallback(
    (
      book: Record<string, MonthStatement>,
      order: string[],
      active: string,
      memberships?: MembershipRow[],
    ) => {
      setStrategieState((prev) => {
        const next: StrategieState = {
          ...prev,
          statements: { current: active, order, byMonth: book },
          memberships: memberships ?? prev.memberships,
        };
        getStorage()?.set({ [STRATEGIE_KEY]: next });
        return next;
      });
    },
    []
  );

  const strategieAddPot = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setStrategieState((prev) => {
        const next: StrategieState = {
          ...prev,
          pots: [
            ...prev.pots,
            { id: crypto.randomUUID(), name: trimmed, target: 0, saved: 0, monthly: 0, fromHopper: false },
          ],
        };
        getStorage()?.set({ [STRATEGIE_KEY]: next });
        return next;
      });
    },
    []
  );

  const strategieRemovePot = useCallback((id: string) => {
    setStrategieState((prev) => {
      const next: StrategieState = { ...prev, pots: prev.pots.filter((p) => p.id !== id) };
      getStorage()?.set({ [STRATEGIE_KEY]: next });
      return next;
    });
  }, []);

  const strategieSetCurrency = useCallback((c: string) => {
    setStrategieState((prev) => {
      const next: StrategieState = { ...prev, currency: c };
      getStorage()?.set({ [STRATEGIE_KEY]: next });
      return next;
    });
  }, []);

  // step the active statement month (edge arrows on the Strategie panel)
  const strategieSetCurrentMonth = useCallback((key: string) => {
    setStrategieState((prev) => {
      if (!(key in prev.statements.byMonth) || prev.statements.current === key) return prev;
      const next: StrategieState = { ...prev, statements: { ...prev.statements, current: key } };
      getStorage()?.set({ [STRATEGIE_KEY]: next });
      return next;
    });
  }, []);

  // remember which face of the projection hero flip-card is showing
  const strategieSetHeroFace = useCallback((face: "grow" | "spend") => {
    setStrategieState((prev) => {
      if (prev.heroFace === face) return prev;
      const next: StrategieState = { ...prev, heroFace: face };
      getStorage()?.set({ [STRATEGIE_KEY]: next });
      return next;
    });
  }, []);

  const strategieSetSecondaryCurrency = useCallback((c: string | null) => {
    setStrategieState((prev) => {
      // Turning the secondary off should also clear the compare toggle.
      const compareOn = c == null ? false : prev.compareCurrencyOn;
      const next: StrategieState = { ...prev, secondaryCurrency: c, compareCurrencyOn: compareOn };
      getStorage()?.set({ [STRATEGIE_KEY]: next });
      return next;
    });
  }, []);

  const strategieToggleCompareCurrency = useCallback(() => {
    setStrategieState((prev) => {
      if (!prev.secondaryCurrency) return prev;
      const next: StrategieState = { ...prev, compareCurrencyOn: !prev.compareCurrencyOn };
      getStorage()?.set({ [STRATEGIE_KEY]: next });
      return next;
    });
  }, []);

  const strategieSetRungAccounts = useCallback(
    (rungId: number, rows: import("../types/grid").RungAccountRef[]) => {
      setStrategieState((prev) => {
        const nextRung = { ...prev.rungAccounts, [rungId]: rows };
        const next: StrategieState = { ...prev, rungAccounts: nextRung };
        getStorage()?.set({ [STRATEGIE_KEY]: next });
        return next;
      });
    },
    []
  );

  const strategieUpsertAccountDictEntry = useCallback(
    (entry: import("../types/grid").AccountDictEntry) => {
      const name = entry.name.trim();
      if (!name) return;
      setStrategieState((prev) => {
        const idx = prev.accountsDirectory.findIndex((d) => d.name === name);
        const dir = [...prev.accountsDirectory];
        if (idx >= 0) {
          // preserve the existing kind/balance unless the caller supplies one
          dir[idx] = {
            ...dir[idx],
            name,
            tag: entry.tag,
            url: entry.url?.trim() || undefined,
            ...(entry.kind !== undefined ? { kind: entry.kind } : {}),
            ...(entry.balance !== undefined ? { balance: entry.balance } : {}),
          };
        } else {
          dir.push({
            name,
            tag: entry.tag,
            url: entry.url?.trim() || undefined,
            kind: entry.kind ?? "cash",
            balance: entry.balance ?? 0,
          });
        }
        const next: StrategieState = { ...prev, accountsDirectory: dir };
        getStorage()?.set({ [STRATEGIE_KEY]: next });
        return next;
      });
    },
    []
  );

  const strategieSetAccountsDirectory = useCallback(
    (dir: import("../types/grid").AccountDictEntry[]) => {
      setStrategieState((prev) => {
        // de-dupe by name, keep first occurrence
        const seen = new Set<string>();
        const cleaned = dir
          .map((a) => ({ ...a, name: a.name.trim() }))
          .filter((a) => {
            if (!a.name || seen.has(a.name)) return false;
            seen.add(a.name);
            return true;
          });
        const next: StrategieState = { ...prev, accountsDirectory: cleaned };
        getStorage()?.set({ [STRATEGIE_KEY]: next });
        return next;
      });
    },
    []
  );

  const strategieAddSavingsPlan = useCallback(
    (name: string, kind: import("../types/grid").SavingsPlanKind) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setStrategieState((prev) => {
        const hue = SAVINGS_PLAN_HUES[prev.savingsPlans.length % SAVINGS_PLAN_HUES.length];
        const next: StrategieState = {
          ...prev,
          savingsPlans: [
            ...prev.savingsPlans,
            { id: crypto.randomUUID(), name: trimmed, kind, hue, monthly: 0, target: 0 },
          ],
        };
        getStorage()?.set({ [STRATEGIE_KEY]: next });
        return next;
      });
    },
    []
  );

  const strategieUpdateSavingsPlan = useCallback(
    (id: string, patch: Partial<import("../types/grid").SavingsPlan>) => {
      setStrategieState((prev) => {
        const next: StrategieState = {
          ...prev,
          savingsPlans: prev.savingsPlans.map((p) => (p.id === id ? { ...p, ...patch, id: p.id } : p)),
        };
        getStorage()?.set({ [STRATEGIE_KEY]: next });
        return next;
      });
    },
    []
  );

  const strategieRemoveSavingsPlan = useCallback((id: string) => {
    setStrategieState((prev) => {
      // strip the tag from every expense row so nothing dangles
      const byMonth: Record<string, MonthStatement> = {};
      for (const [k, mo] of Object.entries(prev.statements.byMonth)) {
        byMonth[k] = {
          income: mo.income,
          expenses: mo.expenses.map((e) =>
            e.savingsPlanId === id ? { ...e, savingsPlanId: undefined } : e
          ),
        };
      }
      const next: StrategieState = {
        ...prev,
        statements: { ...prev.statements, byMonth },
        savingsPlans: prev.savingsPlans.filter((p) => p.id !== id),
      };
      getStorage()?.set({ [STRATEGIE_KEY]: next });
      return next;
    });
  }, []);

  const strategieSetDebts = useCallback((next: import("../types/grid").Debt[]) => {
    setStrategieState((prev) => {
      const ids = new Set(next.map((d) => d.id));
      // mirror savings-plan cleanup: a removed debt's tagged rows lose the link
      // (debtId stripped) so they fall back to ordinary spending.
      let touched = false;
      const byMonth: Record<string, MonthStatement> = {};
      for (const [k, mo] of Object.entries(prev.statements.byMonth)) {
        byMonth[k] = {
          income: mo.income,
          expenses: mo.expenses.map((e) => {
            if (e.debtId && !ids.has(e.debtId)) { touched = true; return { ...e, debtId: undefined }; }
            return e;
          }),
        };
      }
      const nextState: StrategieState = {
        ...prev,
        debts: next,
        statements: touched ? { ...prev.statements, byMonth } : prev.statements,
      };
      getStorage()?.set({ [STRATEGIE_KEY]: nextState });
      return nextState;
    });
  }, []);

  const strategieSetDebtStrategy = useCallback((v: import("../types/grid").DebtStrategy) => {
    setStrategieState((prev) => {
      const next: StrategieState = { ...prev, debtStrategy: v };
      getStorage()?.set({ [STRATEGIE_KEY]: next });
      return next;
    });
  }, []);

  const strategieSetCardLayout = useCallback((layout: import("../types/grid").CardLayout) => {
    setStrategieState((prev) => {
      const next: StrategieState = { ...prev, cardLayout: layout };
      getStorage()?.set({ [STRATEGIE_KEY]: next });
      return next;
    });
  }, []);

  const setVfGoals = useCallback((next: VfGoal[] | ((prev: VfGoal[]) => VfGoal[])) => {
    setVfGoalsState((prev) => {
      const value = typeof next === "function" ? (next as (p: VfGoal[]) => VfGoal[])(prev) : next;
      getStorage()?.set({ [VF_GOALS_KEY]: value });
      return value;
    });
  }, []);

  const saveGoals = useCallback((next: ShelfGoalMap) => {
    setGoals(next);
    getStorage()?.set({ [GOALS_KEY]: next });
  }, []);

  const setShowGoalsState = useCallback((next: boolean) => {
    setShowGoals(next);
    getStorage()?.set({ [SHOW_GOALS_KEY]: next });
  }, []);

  const setShowTodoDatesState = useCallback((next: boolean) => {
    setShowTodoDates(next);
    getStorage()?.set({ [SHOW_TODO_DATES_KEY]: next });
  }, []);

  const setShowFocusDrawerState = useCallback((next: boolean) => {
    setShowFocusDrawer(next);
    getStorage()?.set({ [SHOW_FOCUS_DRAWER_KEY]: next });
  }, []);

  const savePrompts = useCallback((next: ShelfPromptMap) => {
    setPrompts(next);
    getStorage()?.set({ [PROMPTS_KEY]: next });
  }, []);

  const updatePrompt = useCallback((id: string, updater: (prompt: ShelfPromptMap[string]) => ShelfPromptMap[string]) => {
    setPrompts((prev) => {
      const current = prev[id];
      if (!current) return prev;
      const next = { ...prev, [id]: updater(current) };
      getStorage()?.set({ [PROMPTS_KEY]: next });
      return next;
    });
  }, []);

  const setGridLockedState = useCallback((next: boolean) => {
    setGridLocked(next);
    getStorage()?.set({ [GRID_LOCKED_KEY]: next });
  }, []);

  const setTheme = useCallback((next: ShelfTheme) => {
    setThemeState(next);
    getStorage()?.set({ [THEME_KEY]: next });
  }, []);

  const setBookmarkSize = useCallback((next: BookmarkSize) => {
    setBookmarkSizeState(next);
    getStorage()?.set({ [BOOKMARK_SIZE_KEY]: next });
  }, []);

  // Writes the picked accent to the slot for the currently-resolved theme.
  // Each theme remembers its own accent independently.
  const setAccent = useCallback((next: string) => {
    const normalized = next.startsWith("#") ? next : "#16b981";
    setAccentByThemeState((prev) => {
      const updated = { ...prev, [resolvedTheme]: normalized };
      getStorage()?.set({ [ACCENT_BY_THEME_KEY]: updated });
      return updated;
    });
  }, [resolvedTheme]);

  const setVisualFlow = useCallback((next: VisualFlowData) => {
    setVisualFlowState(next);
    getStorage()?.set({ [VISUAL_FLOW_KEY]: next });
  }, []);

  /**
   * Functional-updater form of {@link setVisualFlow}. Use this for every write
   * that derives from prior state — it reads React's latest committed state in
   * the updater, so two updates in the same tick can't clobber each other.
   */
  const updateVisualFlow = useCallback(
    (updater: (prev: VisualFlowData) => VisualFlowData) => {
      setVisualFlowState((prev) => {
        const next = updater(prev);
        getStorage()?.set({ [VISUAL_FLOW_KEY]: next });
        return next;
      });
    },
    []
  );

  const setLlmConsoleUrl = useCallback((next: string) => {
    const url = next.trim() || "https://example.org";
    setLlmConsoleUrlState(url);
    getStorage()?.set({ [LLM_CONSOLE_URL_KEY]: url });
  }, []);

  const setShowBothNavButtonsState = useCallback((next: boolean) => {
    setShowBothNavButtons(next);
    getStorage()?.set({ [SHOW_BOTH_NAV_BUTTONS_KEY]: next });
  }, []);

  const setPillarTodoPins = useCallback((next: string[] | ((prev: string[]) => string[])) => {
    setPillarTodoPinsState((prev) => {
      const list = typeof next === "function" ? next(prev) : next;
      const normalized = list.filter((id) => typeof id === "string").slice(0, 6);
      getStorage()?.set({ [PILLAR_TODO_PINS_KEY]: normalized });
      return normalized;
    });
  }, []);

  const setFocusDesynced = useCallback((next: boolean) => {
    setFocusDesyncedState(next);
    getStorage()?.set({ [FOCUS_DESYNCED_KEY]: next });
  }, []);

  const setLowPerformanceMode = useCallback((next: boolean) => {
    setLowPerformanceModeState(next);
    getStorage()?.set({ [LOW_PERFORMANCE_MODE_KEY]: next });
  }, []);

  const setShowCanvasBlockers = useCallback((next: boolean) => {
    setShowCanvasBlockersState(next);
    getStorage()?.set({ [SHOW_CANVAS_BLOCKERS_KEY]: next });
  }, []);

  const setShowStrategieTab = useCallback((next: boolean) => {
    setShowStrategieTabState(next);
    getStorage()?.set({ [SHOW_STRATEGIE_TAB_KEY]: next });
  }, []);
  const setShowHopperTab = useCallback((next: boolean) => {
    setShowHopperTabState(next);
    getStorage()?.set({ [SHOW_HOPPER_TAB_KEY]: next });
  }, []);
  const setShowInventoryTab = useCallback((next: boolean) => {
    setShowInventoryTabState(next);
    getStorage()?.set({ [SHOW_INVENTORY_TAB_KEY]: next });
  }, []);
  const setShowBudgetTab = useCallback((next: boolean) => {
    setShowBudgetTabState(next);
    getStorage()?.set({ [SHOW_BUDGET_TAB_KEY]: next });
  }, []);

  const setLists = useCallback((next: DirectoryListItem[] | ((prev: DirectoryListItem[]) => DirectoryListItem[])) => {
    setListsState((prev) => {
      const value = typeof next === "function" ? (next as (p: DirectoryListItem[]) => DirectoryListItem[])(prev) : next;
      const normalized = normalizeDirectoryListItems(value);
      getStorage()?.set({ [LISTS_KEY]: normalized });
      return normalized;
    });
  }, []);

  // Single source of truth for the budget blob — pass an updater; result persists.
  const setBudget = useCallback(
    (next: BudgetState | ((prev: BudgetState) => BudgetState)) => {
      setBudgetState((prev) => {
        const value = typeof next === "function" ? (next as (p: BudgetState) => BudgetState)(prev) : next;
        getStorage()?.set({ [BUDGET_KEY]: value });
        return value;
      });
    },
    []
  );

  const setPromptRowsState = useCallback((next: 1 | 2) => {
    setPromptRows(next);
    getStorage()?.set({ [PROMPT_ROWS_KEY]: next });
  }, []);

  const setObsidianLogConfig = useCallback((next: Partial<ObsidianLogConfig>) => {
    setObsidianLogState((prev) => {
      const nextState = {
        enabled: typeof next.enabled === "boolean" ? next.enabled : prev.enabled,
        baseUrl: typeof next.baseUrl === "string" && next.baseUrl.trim() ? next.baseUrl.trim() : prev.baseUrl,
        apiKey: typeof next.apiKey === "string" ? next.apiKey : prev.apiKey,
        notePath: typeof next.notePath === "string" && next.notePath.trim() ? next.notePath.trim() : prev.notePath,
        useDailyNote: typeof next.useDailyNote === "boolean" ? next.useDailyNote : prev.useDailyNote ?? false,
      };
      getStorage()?.set({ [OBSIDIAN_LOG_KEY]: nextState });
      return nextState;
    });
  }, []);

  const logToObsidian = useCallback(
    async (message: string) => {
      if (!obsidianLog.enabled || !obsidianLog.apiKey.trim() || !obsidianLog.baseUrl.trim()) return;
      const base = obsidianLog.baseUrl.replace(/\/+$/, "");
      let path = obsidianLog.notePath.replace(/^\//, "").replace(/\/+$/, "");
      if (obsidianLog.useDailyNote) {
        const dateStr = new Date().toISOString().slice(0, 10);
        path = path.endsWith(".md") ? path.replace(/\.md$/, "") : path;
        path = `${path}/${dateStr}.md`;
      } else if (!path.endsWith(".md")) {
        path = `${path}.md`;
      }
      const url = `${base}/vault/${encodeURIComponent(path)}`;
      const line = `\n${message}`;
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${obsidianLog.apiKey}`,
            "Content-Type": "text/markdown",
          },
          body: line,
        });
        if (!res.ok) {
          console.warn("[ShELF] Obsidian log failed:", res.status, await res.text());
        }
      } catch (e) {
        console.warn("[ShELF] Obsidian log error:", e);
      }
    },
    [obsidianLog]
  );

  const appendTaskLog = useCallback((text: string) => {
    setTaskLog((prev) => {
      const next = prev ? `${prev}\n${text}` : text;
      getStorage()?.set({ [TASK_LOG_KEY]: next });
      return next;
    });
  }, []);

  const clearTaskLog = useCallback(() => {
    setTaskLog("");
    getStorage()?.set({ [TASK_LOG_KEY]: "" });
  }, []);

  const openTaskLogInObsidian = useCallback(async () => {
    if (!obsidianLog.apiKey.trim() || !obsidianLog.baseUrl.trim()) return;
    const base = obsidianLog.baseUrl.replace(/\/+$/, "");
    let path = obsidianLog.notePath.replace(/^\//, "").replace(/\/+$/, "");
    if (obsidianLog.useDailyNote) {
      const dateStr = new Date().toISOString().slice(0, 10);
      path = path.endsWith(".md") ? path.replace(/\.md$/, "") : path;
      path = `${path}/${dateStr}.md`;
    } else if (!path.endsWith(".md")) {
      path = `${path}.md`;
    }
    try {
      const res = await fetch(`${base}/open/${encodeURIComponent(path)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${obsidianLog.apiKey}` },
      });
      if (!res.ok) console.warn("[ShELF] Open in Obsidian failed:", res.status, await res.text());
    } catch (e) {
      console.warn("[ShELF] Open in Obsidian error:", e);
    }
  }, [obsidianLog]);

  const setHiddenFolders = useCallback((next: string[] | ((prev: string[]) => string[])) => {
    setHiddenFolderIds((prev) => {
      const list = typeof next === "function" ? next(prev) : next;
      const normalized = list.filter((id) => typeof id === "string");
      getStorage()?.set({ [HIDDEN_FOLDERS_KEY]: normalized });
      return normalized;
    });
  }, []);

  const exportBackup = useCallback((): ShelfBackupData => {
    return {
      version: 1,
      layout,
      colors,
      theme,
      labels,
      separators,
      goals,
      showGoals,
      showTodoDates,
      showFocusDrawer,
      pillarPins,
      pillarTodos,
      prompts,
      shelfName,
      gridLocked,
      promptRows,
      hiddenFolderIds,
      bookmarkOverrides,
      bookmarkViews,
      bookmarkSize,
      visualFlow,
      grazelandItems,
      binItems,
      llmConsoleUrl,
      showBothNavButtons,
      pillarTodoPins,
      focusDesynced,
      lowPerformanceMode,
      showCanvasBlockers,
      buylist,
      hopperFace,
      strategie: strategieState,
      saleItems,
      inventory: inventoryItems,
      vfGoals,
      budget: budgetState,
      showStrategieTab,
      showHopperTab,
      showInventoryTab,
      showBudgetTab,
      lists,
      accentByTheme,
      obsidianLog,
      taskLog,
    };
  }, [bookmarkOverrides, bookmarkViews, bookmarkSize, binItems, buylist, hopperFace, colors, focusDesynced, goals, gridLocked, hiddenFolderIds, labels, layout, llmConsoleUrl, lowPerformanceMode, lists, pillarPins, pillarTodos, pillarTodoPins, prompts, promptRows, separators, shelfName, showGoals, showTodoDates, showFocusDrawer, showBothNavButtons, theme, visualFlow, grazelandItems, saleItems, strategieState, inventoryItems, vfGoals, budgetState, showCanvasBlockers, showStrategieTab, showHopperTab, showInventoryTab, showBudgetTab, accentByTheme, obsidianLog, taskLog]);

  const importBackup = useCallback((backup: Partial<ShelfBackupData>): Promise<void> => {
    if (backup.layout) setLayout(backup.layout);
    if (backup.colors) setColors(backup.colors);
    if (backup.theme === "day" || backup.theme === "sap" || backup.theme === "auto") setThemeState(backup.theme);
    else if (backup.theme === "dark") setThemeState("dark");
    if (backup.labels) setLabels(backup.labels);
    if (backup.prompts) setPrompts(backup.prompts);
    if (typeof backup.shelfName === "string") setShelfNameState(backup.shelfName);
    if (typeof backup.gridLocked === "boolean") setGridLocked(backup.gridLocked);
    if (typeof backup.showGoals === "boolean") setShowGoals(backup.showGoals);
    if (typeof backup.showTodoDates === "boolean") setShowTodoDates(backup.showTodoDates);
    if (typeof backup.showFocusDrawer === "boolean") setShowFocusDrawer(backup.showFocusDrawer);
    if (backup.pillarPins && typeof backup.pillarPins === "object") {
      const raw = backup.pillarPins as any;
      setPillarPins({
        top: Array.isArray(raw.top) ? raw.top.slice(0, 6) : [],
        overrides: raw.overrides && typeof raw.overrides === "object" ? raw.overrides : undefined,
      });
    }
    if (Array.isArray(backup.pillarTodos)) setPillarTodos(backup.pillarTodos);
    if (Array.isArray(backup.hiddenFolderIds)) setHiddenFolderIds(backup.hiddenFolderIds);
    if (backup.bookmarkOverrides && typeof backup.bookmarkOverrides === "object") setBookmarkOverrides(backup.bookmarkOverrides);
    if (backup.bookmarkViews && typeof backup.bookmarkViews === "object" && !Array.isArray(backup.bookmarkViews)) {
      const raw = backup.bookmarkViews as Record<string, { expanded?: boolean }>;
      const next: ShelfBookmarkViewMap = {};
      for (const [id, v] of Object.entries(raw)) {
        if (id && v && typeof v === "object") {
          next[id] = { expanded: Boolean(v.expanded) };
        }
      }
      setBookmarkViews(next);
    }
    if (backup.bookmarkSize === "senior") setBookmarkSizeState("senior");
    else if (backup.bookmarkSize === "normal") setBookmarkSizeState("normal");
    if (backup.separators) setSeparators(backup.separators);
    if (backup.promptRows === 1 || backup.promptRows === 2) setPromptRows(backup.promptRows);
    if (typeof backup.showStrategieTab === "boolean") setShowStrategieTabState(backup.showStrategieTab);
    if (typeof backup.showHopperTab === "boolean") setShowHopperTabState(backup.showHopperTab);
    if (typeof backup.showInventoryTab === "boolean") setShowInventoryTabState(backup.showInventoryTab);
    if (typeof backup.showBudgetTab === "boolean") setShowBudgetTabState(backup.showBudgetTab);
    if (backup.accentByTheme && typeof backup.accentByTheme === "object" && !Array.isArray(backup.accentByTheme)) {
      const next: Record<string, string> = { ...DEFAULT_ACCENT_BY_THEME };
      for (const [k, v] of Object.entries(backup.accentByTheme as Record<string, unknown>)) {
        if (typeof v === "string" && v.startsWith("#")) next[k] = v;
      }
      setAccentByThemeState(next);
    }
    if (backup.obsidianLog && typeof backup.obsidianLog === "object" && !Array.isArray(backup.obsidianLog)) {
      const o = backup.obsidianLog as unknown as Record<string, unknown>;
      setObsidianLogState({
        enabled: Boolean(o.enabled),
        baseUrl: typeof o.baseUrl === "string" && o.baseUrl.trim() ? o.baseUrl.trim() : "http://127.0.0.1:27124",
        apiKey: typeof o.apiKey === "string" ? o.apiKey : "",
        notePath: typeof o.notePath === "string" && o.notePath.trim() ? o.notePath.trim() : "ShELF/todo-log.md",
        useDailyNote: Boolean(o.useDailyNote),
      });
    }
    if (typeof backup.taskLog === "string") setTaskLog(backup.taskLog);
    if (backup.visualFlow && typeof backup.visualFlow === "object") setVisualFlowState(backup.visualFlow);
    if (Array.isArray(backup.grazelandItems)) setGrazelandItems(backup.grazelandItems as ShelfPillarTodoItem[]);
    if (Array.isArray(backup.binItems)) setBinItems(backup.binItems as ShelfPillarTodoItem[]);
    if (typeof backup.llmConsoleUrl === "string" && backup.llmConsoleUrl.trim()) {
      setLlmConsoleUrlState(backup.llmConsoleUrl.trim());
    }
    if (typeof backup.showBothNavButtons === "boolean") setShowBothNavButtons(backup.showBothNavButtons);
    if (Array.isArray(backup.pillarTodoPins)) {
      setPillarTodoPinsState(
        (backup.pillarTodoPins as unknown[]).filter((id): id is string => typeof id === "string").slice(0, 6)
      );
    }
    if (typeof backup.focusDesynced === "boolean") setFocusDesyncedState(backup.focusDesynced);
    if (typeof backup.lowPerformanceMode === "boolean") setLowPerformanceModeState(backup.lowPerformanceMode);
    if (typeof backup.showCanvasBlockers === "boolean") setShowCanvasBlockersState(backup.showCanvasBlockers);
    if (Array.isArray(backup.buylist)) setBuylist(backup.buylist as BuylistItem[]);
    if (backup.hopperFace === "buy" || backup.hopperFace === "sell") setHopperFace(backup.hopperFace);
    if (backup.strategie) setStrategie(normalizeStrategie(backup.strategie));
    if (Array.isArray(backup.saleItems)) setSaleItems(normalizeSaleItems(backup.saleItems));
    if (Array.isArray(backup.inventory)) setInventory(normalizeInventory(backup.inventory));
    if (Array.isArray(backup.vfGoals)) setVfGoalsState(normalizeVfGoals(backup.vfGoals));
    if (backup.budget) setBudget(normalizeBudget(backup.budget));
    if (Array.isArray(backup.lists)) setLists(backup.lists as DirectoryListItem[]);

    const st = getStorage();
    const writePayload = {
      [LAYOUT_KEY]: backup.layout ?? layout,
      [COLORS_KEY]: backup.colors ?? colors,
      [LABELS_KEY]: backup.labels ?? labels,
      [SEPARATORS_KEY]: backup.separators ?? separators,
      [GOALS_KEY]: backup.goals ?? goals,
      [SHOW_GOALS_KEY]: typeof backup.showGoals === "boolean" ? backup.showGoals : showGoals,
      [SHOW_TODO_DATES_KEY]: typeof backup.showTodoDates === "boolean" ? backup.showTodoDates : showTodoDates,
      [SHOW_FOCUS_DRAWER_KEY]: typeof backup.showFocusDrawer === "boolean" ? backup.showFocusDrawer : showFocusDrawer,
      [PILLAR_KEY]: backup.pillarPins
        ? {
            top: Array.isArray((backup.pillarPins as any).top) ? (backup.pillarPins as any).top.slice(0, 6) : [],
            overrides: (backup.pillarPins as any).overrides ?? pillarPins.overrides,
          }
        : pillarPins,
      [PILLAR_TODOS_KEY]: Array.isArray(backup.pillarTodos) ? backup.pillarTodos : pillarTodos,
      [PROMPTS_KEY]: backup.prompts ?? prompts,
      [SHELF_NAME_KEY]: typeof backup.shelfName === "string" ? backup.shelfName : shelfName,
      [GRID_LOCKED_KEY]: typeof backup.gridLocked === "boolean" ? backup.gridLocked : gridLocked,
      [PROMPT_ROWS_KEY]: backup.promptRows === 2 ? 2 : 1,
      [HIDDEN_FOLDERS_KEY]: Array.isArray(backup.hiddenFolderIds) ? backup.hiddenFolderIds : hiddenFolderIds,
      [THEME_KEY]: backup.theme ?? theme,
      [BOOKMARK_OVERRIDES_KEY]: backup.bookmarkOverrides ?? bookmarkOverrides,
      [BOOKMARK_VIEW_KEY]: backup.bookmarkViews && typeof backup.bookmarkViews === "object" ? backup.bookmarkViews : bookmarkViews,
      [BOOKMARK_SIZE_KEY]: backup.bookmarkSize ?? bookmarkSize,
      [VISUAL_FLOW_KEY]: backup.visualFlow ?? visualFlow,
      [GRAZELAND_ITEMS_KEY]: Array.isArray(backup.grazelandItems) ? backup.grazelandItems : grazelandItems,
      [BIN_ITEMS_KEY]: Array.isArray(backup.binItems) ? backup.binItems : binItems,
      [LLM_CONSOLE_URL_KEY]: typeof backup.llmConsoleUrl === "string" && backup.llmConsoleUrl.trim() ? backup.llmConsoleUrl.trim() : llmConsoleUrl,
      [SHOW_BOTH_NAV_BUTTONS_KEY]: typeof backup.showBothNavButtons === "boolean" ? backup.showBothNavButtons : showBothNavButtons,
      [PILLAR_TODO_PINS_KEY]: Array.isArray(backup.pillarTodoPins) ? backup.pillarTodoPins.slice(0, 6) : pillarTodoPins,
      [FOCUS_DESYNCED_KEY]: typeof backup.focusDesynced === "boolean" ? backup.focusDesynced : focusDesynced,
      [LOW_PERFORMANCE_MODE_KEY]: typeof backup.lowPerformanceMode === "boolean" ? backup.lowPerformanceMode : lowPerformanceMode,
      [SHOW_CANVAS_BLOCKERS_KEY]: typeof backup.showCanvasBlockers === "boolean" ? backup.showCanvasBlockers : showCanvasBlockers,
      [BUYLIST_KEY]: Array.isArray(backup.buylist) ? backup.buylist : buylist,
      [HOPPER_FACE_KEY]: backup.hopperFace === "buy" || backup.hopperFace === "sell" ? backup.hopperFace : hopperFace,
      [STRATEGIE_KEY]: backup.strategie ? normalizeStrategie(backup.strategie) : strategieState,
      [SALE_ITEMS_KEY]: Array.isArray(backup.saleItems) ? normalizeSaleItems(backup.saleItems) : saleItems,
      [INVENTORY_KEY]: Array.isArray(backup.inventory) ? normalizeInventory(backup.inventory) : inventoryItems,
      [VF_GOALS_KEY]: Array.isArray(backup.vfGoals) ? normalizeVfGoals(backup.vfGoals) : vfGoals,
      [BUDGET_KEY]: backup.budget ? normalizeBudget(backup.budget) : budgetState,
      [LISTS_KEY]: Array.isArray(backup.lists) ? backup.lists : lists,
      [SHOW_STRATEGIE_TAB_KEY]: typeof backup.showStrategieTab === "boolean" ? backup.showStrategieTab : showStrategieTab,
      [SHOW_HOPPER_TAB_KEY]: typeof backup.showHopperTab === "boolean" ? backup.showHopperTab : showHopperTab,
      [SHOW_INVENTORY_TAB_KEY]: typeof backup.showInventoryTab === "boolean" ? backup.showInventoryTab : showInventoryTab,
      [SHOW_BUDGET_TAB_KEY]: typeof backup.showBudgetTab === "boolean" ? backup.showBudgetTab : showBudgetTab,
      [ACCENT_BY_THEME_KEY]: backup.accentByTheme && typeof backup.accentByTheme === "object" && !Array.isArray(backup.accentByTheme) ? backup.accentByTheme : accentByTheme,
      [OBSIDIAN_LOG_KEY]: backup.obsidianLog && typeof backup.obsidianLog === "object" && !Array.isArray(backup.obsidianLog) ? backup.obsidianLog : obsidianLog,
      [TASK_LOG_KEY]: typeof backup.taskLog === "string" ? backup.taskLog : taskLog,
    };

    return new Promise<void>((resolve) => {
      if (!st) {
        resolve();
        return;
      }
      st.set(writePayload, () => resolve());
    });
  }, [bookmarkOverrides, binItems, bookmarkSize, buylist, hopperFace, colors, focusDesynced, goals, gridLocked, hiddenFolderIds, labels, layout, llmConsoleUrl, lowPerformanceMode, lists, pillarPins, pillarTodos, pillarTodoPins, prompts, promptRows, saleItems, separators, shelfName, showGoals, showTodoDates, showFocusDrawer, showBothNavButtons, theme, visualFlow, grazelandItems, setBinItems, setBuylist, setHopperFace, setGrazelandItems, setSaleItems, strategieState, setStrategie, inventoryItems, vfGoals, budgetState, setBudget, showCanvasBlockers, showStrategieTab, showHopperTab, showInventoryTab, showBudgetTab, accentByTheme, obsidianLog, taskLog]);

  return {
    layout,
    colors,
    labels,
    separators,
    goals,
    showGoals,
    showTodoDates,
    setShowTodoDates: setShowTodoDatesState,
    showFocusDrawer,
    setShowFocusDrawer: setShowFocusDrawerState,
    bookmarkViews,
    bookmarkOverrides,
    setBookmarkOverride,
    pillarPins,
    pillarTodos,
    setPillarTodos: setPillarTodosState,
    pillarTodoPins,
    setPillarTodoPins,
    focusDesynced,
    setFocusDesynced,
    lowPerformanceMode,
    setLowPerformanceMode,
    showCanvasBlockers,
    setShowCanvasBlockers,
    showStrategieTab,
    setShowStrategieTab,
    showHopperTab,
    setShowHopperTab,
    showInventoryTab,
    setShowInventoryTab,
    obsidianLog,
    setObsidianLogConfig,
    logToObsidian,
    openTaskLogInObsidian,
    taskLog,
    appendTaskLog,
    clearTaskLog,
    hiddenFolderIds,
    setHiddenFolders,
    prompts,
    gridLocked,
    promptRows,
    shelfName,
    ready,
    saveLayout,
    savePrompts,
    updatePrompt,
    setSectionColor,
    setShelfName,
    setShelfLabel,
    addFolderSeparator,
    setFolderSeparators,
    setBookmarkExpanded,
    setPillarPins: setPillarPinsState,
    setPillarPinOverride,
    saveGoals,
    setShowGoals: setShowGoalsState,
    setGridLocked: setGridLockedState,
    setPromptRows: setPromptRowsState,
    theme,
    resolvedTheme,
    setTheme,
    accent,
    setAccent,
    bookmarkSize,
    setBookmarkSize,
    visualFlow,
    setVisualFlow,
    updateVisualFlow,
    grazelandItems,
    setGrazelandItems,
    binItems,
    setBinItems,
    buylist,
    setBuylist,
    buylistAdd,
    buylistDiscard,
    buylistBuyBottom,
    buylistBump,
    buylistSkip,
    hopperFace,
    setHopperFace,
    saleItems,
    setSaleItems,
    saleItemAdd,
    saleItemUpdate,
    saleItemRemove,
    inventoryItems,
    setInventory,
    inventoryAdd,
    inventoryUpdate,
    inventoryRemove,
    strategieState,
    setStrategie,
    strategieSaveStatement,
    strategieAddPot,
    strategieRemovePot,
    strategieSetCurrency,
    strategieSetCurrentMonth,
    strategieSetHeroFace,
    strategieSetSecondaryCurrency,
    strategieToggleCompareCurrency,
    strategieSetRungAccounts,
    strategieUpsertAccountDictEntry,
    strategieSetAccountsDirectory,
    strategieAddSavingsPlan,
    strategieUpdateSavingsPlan,
    strategieRemoveSavingsPlan,
    strategieSetDebts,
    strategieSetDebtStrategy,
    strategieSetCardLayout,
    vfGoals,
    setVfGoals,
    budget: budgetState,
    setBudget,
    showBudgetTab,
    setShowBudgetTab,
    lists,
    setLists,
    llmConsoleUrl,
    setLlmConsoleUrl,
    showBothNavButtons,
    setShowBothNavButtons: setShowBothNavButtonsState,
    exportBackup,
    importBackup,
    reload: load,
  };
}
