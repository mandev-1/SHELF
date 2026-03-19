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

export interface ShelfPromptVersion {
  id: string;
  code: string;
  body: string;
  createdAt: string;
}

export interface ShelfPillarTodoItem {
  id: string;
  text: string;
  done: boolean;
  url?: string;
  note?: string;
  subtitle?: string;
  tag?: string;
}

export interface ObsidianLogConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  notePath: string;
  /** When true, append /YYYY-MM-DD.md to notePath for one log per day */
  useDailyNote?: boolean;
}

export interface ShelfBackupData {
  version: number;
  layout: ShelfLayoutItem[];
  colors: ShelfSectionColors;
  labels: Record<string, string>;
  separators: ShelfFolderSeparatorMap;
  goals: ShelfGoalMap;
  showGoals: boolean;
  pillarPins?: { top: string[]; list?: string[]; overrides?: Record<string, { title?: string; imageUrl?: string }> };
  pillarTodos?: ShelfPillarTodoItem[];
  prompts: ShelfPromptMap;
  shelfName: string;
  gridLocked: boolean;
  promptRows: 1 | 2;
  hiddenFolderIds?: string[];
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
