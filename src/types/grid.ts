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
  | "hidden";

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
  /** Per-node handle config: horizontal (L+R), vertical (T+B), or single side. Hidden = no connection points. */
  handleConfig?: ShelfTodoHandleConfig;
  /** Optional date string (e.g. YYYY-MM-DD). Shown in Visual Flow when showTodoDates is on. */
  date?: string;
  /** When true, the task appears in the visual flow focus drawer. */
  focused?: boolean;
  /** Epic / sector name (optional); shown lightly on Visual Flow when set */
  sectorName?: string;
  /** When set, a subtle Visual Flow border uses this tint; omit for default node chrome */
  sectorColor?: SectorColorKey;
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
  arrow?: boolean;
  doubled?: boolean;
  muted?: boolean;
};

export interface VisualFlowData {
  nodePositions?: Record<string, { x: number; y: number }>;
  edges?: VisualFlowEdge[];
  /** Second canvas layer — same item shape as pillar todos, separate from main flow */
  grazelandNodePositions?: Record<string, { x: number; y: number }>;
  grazelandEdges?: VisualFlowEdge[];
  /** Sector label → border color; applies to all tasks with that sector name on both planes */
  sectorColors?: Record<string, SectorColorKey>;
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
  llmConsoleUrl?: string;
  showBothNavButtons?: boolean;
  pillarTodoPins?: string[];
  focusDesynced?: boolean;
  lowPerformanceMode?: boolean;
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
