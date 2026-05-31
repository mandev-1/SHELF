import { useCallback, useEffect, useState } from "react";
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
} from "../types/grid";

const LAYOUT_KEY = "shelf-layout";
const COLORS_KEY = "shelf-colors";
const SHELF_NAME_KEY = "shelf-name";
const LABELS_KEY = "shelf-labels";
const SEPARATORS_KEY = "shelf-separators";
const GOALS_KEY = "shelf-goals";
const SHOW_GOALS_KEY = "show-goals";
const SHOW_TODO_DATES_KEY = "show-todo-dates";
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
const ACCENT_KEY = "shelf-accent";
const BOOKMARK_SIZE_KEY = "bookmark-size";
const VISUAL_FLOW_KEY = "shelf-visual-flow";
const GRAZELAND_ITEMS_KEY = "shelf-grazeland-items";
const BIN_ITEMS_KEY = "shelf-bin-items";
const LLM_CONSOLE_URL_KEY = "shelf-llm-console-url";
const SHOW_BOTH_NAV_BUTTONS_KEY = "shelf-show-both-nav-buttons";
const PILLAR_TODO_PINS_KEY = "shelf-pillar-todo-pins";
const FOCUS_DESYNCED_KEY = "shelf-focus-desynced";
export const LOW_PERFORMANCE_MODE_KEY = "shelf-low-performance-mode";
const BUYLIST_KEY = "shelf-buylist";

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
      sectorName: typeof x.sectorName === "string" && x.sectorName.trim() ? x.sectorName.trim() : undefined,
      sectorColor: isSectorColorKey(x.sectorColor) ? x.sectorColor : undefined,
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
  const [accent, setAccentState] = useState("#16b981");
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
  const [buylist, setBuylistState] = useState<BuylistItem[]>([]);
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
        BOOKMARK_SIZE_KEY,
        VISUAL_FLOW_KEY,
        GRAZELAND_ITEMS_KEY,
        BIN_ITEMS_KEY,
        LLM_CONSOLE_URL_KEY,
        SHOW_BOTH_NAV_BUTTONS_KEY,
        PILLAR_TODO_PINS_KEY,
        FOCUS_DESYNCED_KEY,
        LOW_PERFORMANCE_MODE_KEY,
        BUYLIST_KEY,
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
      const a = result[ACCENT_KEY];
      setAccentState(typeof a === "string" && a.startsWith("#") ? a : "#16b981");
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
      setBuylistState(normalizeBuylist(result[BUYLIST_KEY]));
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
      if (changes[ACCENT_KEY]) {
        const v = changes[ACCENT_KEY].newValue;
        if (typeof v === "string" && v.startsWith("#")) setAccentState(v);
      }
      if (changes[SHELF_NAME_KEY]) {
        const v = changes[SHELF_NAME_KEY].newValue;
        if (typeof v === "string") setShelfNameState(v);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  /* Update every minute so "auto" theme switches at 08:00 and 21:40 */
  useEffect(() => {
    const id = setInterval(() => setTimeTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const resolvedTheme: "dark" | "day" | "sap" =
    theme === "auto"
      ? (() => {
          const d = new Date(timeTick);
          const h = d.getHours();
          const m = d.getMinutes();
          const totalMin = h * 60 + m;
          const darkUntil = 8 * 60; // 08:00
          const darkFrom = 21 * 60 + 40; // 21:40
          return totalMin < darkUntil || totalMin >= darkFrom ? "dark" : "sap";
        })()
      : theme;

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

  const setAccent = useCallback((next: string) => {
    const normalized = next.startsWith("#") ? next : "#16b981";
    setAccentState(normalized);
    getStorage()?.set({ [ACCENT_KEY]: normalized });
  }, []);

  const setVisualFlow = useCallback((next: VisualFlowData) => {
    setVisualFlowState(next);
    getStorage()?.set({ [VISUAL_FLOW_KEY]: next });
  }, []);

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
      buylist,
    };
  }, [bookmarkOverrides, bookmarkViews, bookmarkSize, binItems, buylist, colors, focusDesynced, goals, gridLocked, hiddenFolderIds, labels, layout, llmConsoleUrl, lowPerformanceMode, pillarPins, pillarTodos, pillarTodoPins, prompts, promptRows, separators, shelfName, showGoals, showTodoDates, showBothNavButtons, theme, visualFlow, grazelandItems]);

  const importBackup = useCallback((backup: Partial<ShelfBackupData>) => {
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
    if (Array.isArray(backup.buylist)) setBuylist(backup.buylist as BuylistItem[]);

    getStorage()?.set({
      [LAYOUT_KEY]: backup.layout ?? layout,
      [COLORS_KEY]: backup.colors ?? colors,
      [LABELS_KEY]: backup.labels ?? labels,
      [SEPARATORS_KEY]: backup.separators ?? separators,
      [GOALS_KEY]: backup.goals ?? goals,
      [SHOW_GOALS_KEY]: typeof backup.showGoals === "boolean" ? backup.showGoals : showGoals,
      [SHOW_TODO_DATES_KEY]: typeof backup.showTodoDates === "boolean" ? backup.showTodoDates : showTodoDates,
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
      [BUYLIST_KEY]: Array.isArray(backup.buylist) ? backup.buylist : buylist,
    });
  }, [bookmarkOverrides, binItems, bookmarkSize, buylist, colors, focusDesynced, goals, gridLocked, hiddenFolderIds, labels, layout, llmConsoleUrl, lowPerformanceMode, pillarPins, pillarTodos, pillarTodoPins, prompts, promptRows, separators, shelfName, showGoals, showTodoDates, showBothNavButtons, theme, visualFlow, grazelandItems, setBinItems, setBuylist, setGrazelandItems]);

  return {
    layout,
    colors,
    labels,
    separators,
    goals,
    showGoals,
    showTodoDates,
    setShowTodoDates: setShowTodoDatesState,
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
    grazelandItems,
    setGrazelandItems,
    binItems,
    setBinItems,
    buylist,
    setBuylist,
    buylistAdd,
    buylistDiscard,
    buylistBuyBottom,
    llmConsoleUrl,
    setLlmConsoleUrl,
    showBothNavButtons,
    setShowBothNavButtons: setShowBothNavButtonsState,
    exportBackup,
    importBackup,
    reload: load,
  };
}
