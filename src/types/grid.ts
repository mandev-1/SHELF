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
}

export type ShelfFolderSeparatorMap = Record<string, ShelfFolderSeparator[]>;

export interface ShelfPromptVersion {
  id: string;
  code: string;
  body: string;
  createdAt: string;
}

export interface ShelfBackupData {
  version: number;
  layout: ShelfLayoutItem[];
  colors: ShelfSectionColors;
  labels: Record<string, string>;
  separators: ShelfFolderSeparatorMap;
  prompts: ShelfPromptMap;
  shelfName: string;
  gridLocked: boolean;
  promptRows: 1 | 2;
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
