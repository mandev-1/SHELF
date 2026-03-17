import { useCallback, useEffect, useState } from "react";
import type {
  ShelfBackupData,
  ShelfLayoutItem,
  ShelfPromptMap,
  ShelfPromptVersion,
  ShelfSectionColors,
} from "../types/grid";

const LAYOUT_KEY = "shelf-layout";
const COLORS_KEY = "shelf-colors";
const SHELF_NAME_KEY = "shelf-name";
const LABELS_KEY = "shelf-labels";
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

export function useShelfStorage() {
  const [layout, setLayout] = useState<ShelfLayoutItem[]>([]);
  const [colors, setColors] = useState<ShelfSectionColors>({});
  const [labels, setLabels] = useState<Record<string, string>>({});
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
    storage.get([LAYOUT_KEY, COLORS_KEY, SHELF_NAME_KEY, LABELS_KEY, PROMPTS_KEY, GRID_LOCKED_KEY, PROMPT_ROWS_KEY], (result: { [key: string]: unknown }) => {
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

  const exportBackup = useCallback((): ShelfBackupData => {
    return {
      version: 1,
      layout,
      colors,
      labels,
      prompts,
      shelfName,
      gridLocked,
      promptRows,
    };
  }, [colors, gridLocked, labels, layout, prompts, promptRows, shelfName]);

  const importBackup = useCallback((backup: Partial<ShelfBackupData>) => {
    if (backup.layout) setLayout(backup.layout);
    if (backup.colors) setColors(backup.colors);
    if (backup.labels) setLabels(backup.labels);
    if (backup.prompts) setPrompts(backup.prompts);
    if (typeof backup.shelfName === "string") setShelfNameState(backup.shelfName);
    if (typeof backup.gridLocked === "boolean") setGridLocked(backup.gridLocked);

    getStorage()?.set({
      [LAYOUT_KEY]: backup.layout ?? layout,
      [COLORS_KEY]: backup.colors ?? colors,
      [LABELS_KEY]: backup.labels ?? labels,
      [PROMPTS_KEY]: backup.prompts ?? prompts,
      [SHELF_NAME_KEY]: typeof backup.shelfName === "string" ? backup.shelfName : shelfName,
      [GRID_LOCKED_KEY]: typeof backup.gridLocked === "boolean" ? backup.gridLocked : gridLocked,
      [PROMPT_ROWS_KEY]: backup.promptRows === 2 ? 2 : 1,
    });
  }, [colors, gridLocked, labels, layout, prompts, promptRows, shelfName]);

  return {
    layout,
    colors,
    labels,
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
    setGridLocked: setGridLockedState,
    setPromptRows: setPromptRowsState,
    exportBackup,
    importBackup,
    reload: load,
  };
}
