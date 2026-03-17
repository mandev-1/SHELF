import { Button, Link, Popover, Spinner, Surface } from "@heroui/react";
import { GridStack } from "gridstack";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createFolder,
  createBookmark,
  moveBookmark,
  useBookmarksTree,
} from "../hooks/useBookmarks";
import { useShelfStorage } from "../hooks/useShelfStorage";
import type { BookmarkTreeNode } from "../types/bookmarks";
import type { ShelfLayoutItem } from "../types/grid";
import { ACCENT_COLORS } from "../types/grid";

const COLUMNS = 12;
const DEFAULT_W = 4;
const DEFAULT_H = 3;

function isFolder(node: BookmarkTreeNode) {
  return node.url === undefined;
}

function folderChildren(node: BookmarkTreeNode) {
  return (node.children ?? []).filter((n) => n.url);
}

function getTitle(node: BookmarkTreeNode) {
  return node.title || "Folder";
}

function normalizeLayoutItem(item: ShelfLayoutItem) {
  const w = item.w ?? item.width ?? DEFAULT_W;
  const h = item.h ?? item.height ?? DEFAULT_H;
  return { id: item.id ?? "", x: item.x ?? 0, y: item.y ?? 0, w: typeof w === "number" ? w : DEFAULT_W, h: typeof h === "number" ? h : DEFAULT_H };
}

function faviconUrl(url: string) {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`;
  } catch {
    return "";
  }
}

function FolderCard({
  node,
  accentColor,
  label,
  onColorChange,
  onLabelChange,
  onDropBookmark,
}: {
  node: BookmarkTreeNode;
  accentColor?: string;
  label?: string;
  onColorChange: (id: string, color: string | null) => void;
  onLabelChange: (id: string, label: string | null) => void;
  onDropBookmark: (bookmarkId: string, folderId: string) => void;
}) {
  const links = folderChildren(node);
  const [editingLabel, setEditingLabel] = useState(false);
  const [draftLabel, setDraftLabel] = useState(label ?? getTitle(node));

  useEffect(() => {
    setDraftLabel(label ?? getTitle(node));
  }, [label, node.id, node.title]);

  const commitLabel = () => {
    const next = draftLabel.trim();
    onLabelChange(node.id, next && next !== getTitle(node) ? next : null);
    setEditingLabel(false);
  };

  return (
    <div
      className="grid-stack-item-content h-full flex flex-row rounded-xl border border-white/10 bg-white/5 overflow-hidden min-h-0"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const bookmarkId = e.dataTransfer.getData("text/plain");
        if (bookmarkId) onDropBookmark(bookmarkId, node.id);
      }}
    >
      <div className="shrink-0 w-1 min-w-[4px] self-stretch rounded-l-xl" style={{ backgroundColor: accentColor || "transparent" }} aria-hidden />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-1 border-b border-white/10 shrink-0">
          {editingLabel ? (
            <input
              autoFocus
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitLabel();
                if (e.key === "Escape") {
                  setEditingLabel(false);
                  setDraftLabel(label ?? getTitle(node));
                }
              }}
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-sm text-zinc-100 outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingLabel(true)}
              className="min-w-0 flex-1 text-left font-medium text-zinc-200 hover:text-white truncate text-sm"
            >
              {label || getTitle(node)}
            </button>
          )}
          <Popover>
            <Popover.Trigger>
              <Button size="sm" variant="ghost" className="min-w-8 w-8 h-8 p-0 rounded-full" aria-label="Set color">
                <span className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: accentColor || "#333" }} />
              </Button>
            </Popover.Trigger>
            <Popover.Content className="p-2 bg-zinc-800 border border-white/10">
              <Popover.Dialog>
                <div className="flex flex-wrap gap-1.5 max-w-[12rem]">
                  {ACCENT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => onColorChange(node.id, accentColor === c ? null : c)}
                      className="w-6 h-6 rounded-full border-2 border-transparent hover:border-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                      style={{ backgroundColor: c }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                  {accentColor && (
                    <button type="button" onClick={() => onColorChange(node.id, null)} className="text-zinc-400 text-xs px-2 py-1 hover:text-white">
                      Clear
                    </button>
                  )}
                </div>
              </Popover.Dialog>
            </Popover.Content>
          </Popover>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {links.length === 0 ? (
            <p className="text-zinc-500 text-xs">Empty folder</p>
          ) : (
            links.map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={(e: React.DragEvent<HTMLDivElement>) => {
                  e.dataTransfer.setData("text/plain", item.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                className="cursor-move"
              >
                <Link
                  href={item.url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-zinc-300 hover:text-white text-xs truncate no-underline hover:underline underline-offset-1 w-full"
                >
                  <img src={faviconUrl(item.url!)} alt="" className="w-4 h-4 shrink-0 rounded" />
                  <span className="truncate">{item.title || item.url}</span>
                </Link>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function BookmarkGrid() {
  const { tree, error, reload } = useBookmarksTree();
  const { layout: savedLayout, colors, labels, ready, saveLayout, setSectionColor, setShelfLabel } = useShelfStorage();
  const gridRef = useRef<HTMLDivElement>(null);
  const gridInstanceRef = useRef<GridStack | null>(null);
  const [adding, setAdding] = useState(false);
  const [addingBookmark, setAddingBookmark] = useState(false);
  const [moving, setMoving] = useState(false);
  const [locked, setLocked] = useState(false);

  const folders = useMemo(() => (tree ?? []).filter(isFolder), [tree]);
  const layout = useMemo(() => {
    const byId = new Map<string, { id: string; x: number; y: number; w: number; h: number }>();
    savedLayout.forEach((item) => {
      const n = normalizeLayoutItem(item);
      if (n.id) byId.set(n.id, n);
    });
    return folders.map((node, i) => byId.get(node.id) ?? { id: node.id, x: (i % 3) * 4, y: Math.floor(i / 3) * 3, w: DEFAULT_W, h: DEFAULT_H });
  }, [folders, savedLayout]);

  useEffect(() => {
    if (!gridRef.current || !ready || folders.length === 0) return;
    gridInstanceRef.current?.destroy(false);
    const grid = GridStack.init({ column: COLUMNS, cellHeight: 80, margin: 8, float: true, animate: true }, gridRef.current);
    gridInstanceRef.current = grid;
    grid.enableMove(!locked);
    grid.enableResize(true);
    const handleChange = () => saveLayout(grid.save() as ShelfLayoutItem[]);
    grid.on("change", handleChange);
    return () => {
      grid.off("change");
      grid.destroy(false);
      gridInstanceRef.current = null;
    };
  }, [folders.length, ready, saveLayout, locked]);

  if (tree === null || !ready) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" color="accent" />
      </div>
    );
  }

  if (error) {
    return (
      <Surface variant="secondary" className="rounded-2xl p-4 border border-red-500/30 bg-red-500/10">
        <p className="text-red-300 text-sm">{error}</p>
        <button type="button" onClick={reload} className="mt-2 text-sm text-red-200 hover:underline">
          Retry
        </button>
      </Surface>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-400">Drag cards to reorder them. Drop bookmarks into a folder card to move them.</p>
        <Button
          size="sm"
          variant="ghost"
          className="text-zinc-100"
          onPress={async () => {
            setAdding(true);
            try {
              await createFolder("New Folder");
            } finally {
              setAdding(false);
            }
          }}
          isDisabled={adding}
        >
          + Folder
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-zinc-100"
          onPress={async () => {
            const url = window.prompt("Bookmark URL");
            if (!url) return;
            const title = window.prompt("Bookmark title", new URL(url).hostname) || url;
            setAddingBookmark(true);
            try {
              await createBookmark(title, url);
            } finally {
              setAddingBookmark(false);
            }
          }}
          isDisabled={addingBookmark}
        >
          + Bookmark
        </Button>
      </div>
      <button
        type="button"
        onClick={() => {
          const next = !locked;
          setLocked(next);
          gridInstanceRef.current?.enableMove(!next);
          gridInstanceRef.current?.enableResize(true);
        }}
        className="fixed bottom-4 left-4 z-50 rounded-full border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-300 opacity-0 transition-opacity hover:opacity-100 focus:opacity-100"
        aria-label={locked ? "Unlock grid movement" : "Lock grid movement"}
        title={locked ? "Unlock grid movement" : "Lock grid movement"}
      >
        {locked ? "Locked" : "Unlocked"}
      </button>
      <div ref={gridRef} className="grid-stack shelf-grid" data-gs-column={COLUMNS}>
        {folders.map((node, i) => {
          const pos = layout[i];
          if (!pos) return null;
          return (
            <div key={node.id} className="grid-stack-item" {...{ "gs-id": pos.id, "gs-x": pos.x, "gs-y": pos.y, "gs-w": pos.w, "gs-h": pos.h }}>
              <FolderCard
                node={node}
                accentColor={colors[node.id]}
                label={labels[node.id]}
                onColorChange={setSectionColor}
                onLabelChange={setShelfLabel}
                onDropBookmark={async (bookmarkId, folderId) => {
                  setMoving(true);
                  try {
                    await moveBookmark(bookmarkId, folderId);
                  } finally {
                    setMoving(false);
                  }
                }}
              />
            </div>
          );
        })}
      </div>
      {moving && <p className="text-xs text-zinc-500">Moving bookmark…</p>}
    </div>
  );
}
