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
}

export type ShelfPromptMap = Record<string, ShelfPrompt>;

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
