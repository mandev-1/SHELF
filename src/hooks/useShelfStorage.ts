import { useCallback, useEffect, useState } from "react";
import type {
  ObsidianLogConfig,
  ShelfBackupData,
  ShelfBookmarkViewMap,
  ShelfFolderSeparatorMap,
  ShelfGoalMap,
  ShelfLayoutItem,
  ShelfPillarTodoItem,
  ShelfPromptMap,
  ShelfPromptVersion,
  ShelfSectionColors,
} from "../types/grid";

const LAYOUT_KEY = "shelf-layout";
const COLORS_KEY = "shelf-colors";
const SHELF_NAME_KEY = "shelf-name";
const LABELS_KEY = "shelf-labels";
const SEPARATORS_KEY = "shelf-separators";
const GOALS_KEY = "shelf-goals";
const SHOW_GOALS_KEY = "show-goals";
const BOOKMARK_VIEW_KEY = "bookmark-view";
const PILLAR_KEY = "pillar-pins";
const PILLAR_TODOS_KEY = "pillar-todos";
const OBSIDIAN_LOG_KEY = "obsidian-log";
const TASK_LOG_KEY = "task-log";
const HIDDEN_FOLDERS_KEY = "shelf-hidden-folders";
const PROMPTS_KEY = "shelf-prompts";
const GRID_LOCKED_KEY = "grid-locked";
const PROMPT_ROWS_KEY = "prompt-rows";

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

export function useShelfStorage() {
  const [layout, setLayout] = useState<ShelfLayoutItem[]>([]);
  const [colors, setColors] = useState<ShelfSectionColors>({});
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [separators, setSeparators] = useState<ShelfFolderSeparatorMap>({});
  const [goals, setGoals] = useState<ShelfGoalMap>({});
  const [showGoals, setShowGoals] = useState(false);
  const [bookmarkViews, setBookmarkViews] = useState<ShelfBookmarkViewMap>({});
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
        BOOKMARK_VIEW_KEY,
        PILLAR_KEY,
        PILLAR_TODOS_KEY,
        OBSIDIAN_LOG_KEY,
        TASK_LOG_KEY,
        HIDDEN_FOLDERS_KEY,
        PROMPTS_KEY,
        GRID_LOCKED_KEY,
        PROMPT_ROWS_KEY,
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
      setBookmarkViews(
        result[BOOKMARK_VIEW_KEY] && typeof result[BOOKMARK_VIEW_KEY] === "object" && !Array.isArray(result[BOOKMARK_VIEW_KEY])
          ? (result[BOOKMARK_VIEW_KEY] as ShelfBookmarkViewMap)
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
      setPillarTodos(() => {
        const raw = result[PILLAR_TODOS_KEY];
        if (!Array.isArray(raw)) return [];
        return raw
          .filter((x: any) => x && typeof x === "object" && typeof x.id === "string" && typeof x.text === "string")
          .map((x: any) => ({
            id: x.id,
            text: String(x.text),
            done: Boolean(x.done),
            url: typeof x.url === "string" && x.url.trim() ? x.url.trim() : undefined,
            note: typeof x.note === "string" ? x.note : undefined,
          }));
      });
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
      setReady(true);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
      const normalized = list.map((t) => ({
        id: t.id,
        text: t.text,
        done: Boolean(t.done),
        url: typeof t.url === "string" && t.url.trim() ? t.url.trim() : undefined,
        note: typeof t.note === "string" ? t.note : undefined,
      }));
      getStorage()?.set({ [PILLAR_TODOS_KEY]: normalized });
      return normalized;
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
      labels,
      separators,
      goals,
      showGoals,
      pillarPins,
      pillarTodos,
      prompts,
      shelfName,
      gridLocked,
      promptRows,
      hiddenFolderIds,
    };
  }, [colors, goals, gridLocked, hiddenFolderIds, labels, layout, pillarPins, pillarTodos, prompts, promptRows, separators, shelfName, showGoals]);

  const importBackup = useCallback((backup: Partial<ShelfBackupData>) => {
    if (backup.layout) setLayout(backup.layout);
    if (backup.colors) setColors(backup.colors);
    if (backup.labels) setLabels(backup.labels);
    if (backup.prompts) setPrompts(backup.prompts);
    if (typeof backup.shelfName === "string") setShelfNameState(backup.shelfName);
    if (typeof backup.gridLocked === "boolean") setGridLocked(backup.gridLocked);
    if (typeof backup.showGoals === "boolean") setShowGoals(backup.showGoals);
    if (backup.pillarPins && typeof backup.pillarPins === "object") {
      const raw = backup.pillarPins as any;
      setPillarPins({
        top: Array.isArray(raw.top) ? raw.top.slice(0, 6) : [],
        overrides: raw.overrides && typeof raw.overrides === "object" ? raw.overrides : undefined,
      });
    }
    if (Array.isArray(backup.pillarTodos)) setPillarTodos(backup.pillarTodos);
    if (Array.isArray(backup.hiddenFolderIds)) setHiddenFolderIds(backup.hiddenFolderIds);

    getStorage()?.set({
      [LAYOUT_KEY]: backup.layout ?? layout,
      [COLORS_KEY]: backup.colors ?? colors,
      [LABELS_KEY]: backup.labels ?? labels,
      [SEPARATORS_KEY]: backup.separators ?? separators,
      [GOALS_KEY]: backup.goals ?? goals,
      [SHOW_GOALS_KEY]: typeof backup.showGoals === "boolean" ? backup.showGoals : showGoals,
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
    });
  }, [colors, goals, gridLocked, hiddenFolderIds, labels, layout, pillarPins, pillarTodos, prompts, promptRows, separators, shelfName, showGoals]);

  return {
    layout,
    colors,
    labels,
    separators,
    goals,
    showGoals,
    bookmarkViews,
    pillarPins,
    pillarTodos,
    setPillarTodos: setPillarTodosState,
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
    exportBackup,
    importBackup,
    reload: load,
  };
}
