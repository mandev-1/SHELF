import { Button, Link, Popover, Spinner, Surface } from "@heroui/react";
import { GridStack } from "gridstack";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createFolder,
  createBookmark,
  deleteBookmarkNode,
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

function renderFolderItems(node: BookmarkTreeNode, separators: number[] = []) {
  const links = folderChildren(node);
  const items: Array<
    | { type: "link"; key: string; node: BookmarkTreeNode }
    | { type: "separator"; key: string }
  > = [];
  let separatorIndex = 0;
  const separatorSet = new Set(separators);
  links.forEach((link, index) => {
    if (separatorSet.has(index)) {
      items.push({ type: "separator", key: `separator-${separatorIndex}` });
      separatorIndex += 1;
    }
    items.push({ type: "link", key: link.id, node: link });
  });
  if (separatorSet.has(links.length)) {
    items.push({ type: "separator", key: `separator-${separatorIndex}` });
  }
  return items;
}

function collectFolders(nodes: BookmarkTreeNode[] | null): BookmarkTreeNode[] {
  const out: BookmarkTreeNode[] = [];
  const walk = (node: BookmarkTreeNode) => {
    if (!isFolder(node)) return;
    out.push(node);
    (node.children ?? []).forEach((child) => {
      if (child.url === undefined) walk(child);
    });
  };
  (nodes ?? []).forEach(walk);
  return out;
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
  gridLocked,
  separators,
  onColorChange,
  onLabelChange,
  onDeleteFolder,
  onAddSeparator,
  onDropBookmark,
}: {
  node: BookmarkTreeNode;
  accentColor?: string;
  label?: string;
  gridLocked: boolean;
  separators: number[];
  onColorChange: (id: string, color: string | null) => void;
  onLabelChange: (id: string, label: string | null) => void;
  onDeleteFolder: (id: string) => void;
  onAddSeparator: (id: string) => void;
  onDropBookmark: (bookmarkId: string, folderId: string) => void;
}) {
  const items = renderFolderItems(node, separators);
  const [editingLabel, setEditingLabel] = useState(false);
  const [draftLabel, setDraftLabel] = useState(label ?? getTitle(node));
  const [showMenu, setShowMenu] = useState(false);

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
      className="group grid-stack-item-content h-full flex flex-row rounded-xl border border-white/10 bg-white/5 overflow-hidden min-h-0"
      onDragOver={(e) => e.preventDefault()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setShowMenu(true);
      }}
      onDrop={(e) => {
        e.preventDefault();
        const bookmarkId = e.dataTransfer.getData("text/plain");
        if (bookmarkId) onDropBookmark(bookmarkId, node.id);
      }}
    >
      <div className="shrink-0 w-1 min-w-[4px] self-stretch rounded-l-xl" style={{ backgroundColor: accentColor || "transparent" }} aria-hidden />
      <div
        className="flex-1 flex flex-col min-w-0"
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowMenu(true);
        }}
      >
        {showMenu && (
          <div className="absolute z-20 mt-12 ml-3 rounded-2xl border border-emerald-400/15 bg-black/95 p-2 shadow-[0_0_40px_rgba(16,185,129,0.16)]">
            <button
              type="button"
              onClick={() => {
                onAddSeparator(node.id);
                setShowMenu(false);
              }}
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-emerald-200 hover:bg-emerald-400/10"
            >
              Add separator
            </button>
            <button
              type="button"
              onClick={() => setShowMenu(false)}
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-zinc-400 hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        )}
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
          {!["0", "1", "2"].includes(node.id) && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Delete "${label || getTitle(node)}"?`)) {
                  onDeleteFolder(node.id);
                }
              }}
              className={`rounded-full border border-red-400/15 bg-black/30 p-2 text-red-300 transition hover:border-red-300/40 hover:bg-red-500/10 hover:text-red-200 ${
                gridLocked ? "hidden" : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
              }`}
              aria-label="Delete folder"
              title="Delete folder"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 11v6" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 7l1 13h10l1-13" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 7V4h6v3" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {items.length === 0 ? (
            <p className="text-zinc-500 text-xs">Empty folder</p>
          ) : (
            items.map((item) =>
              item.type === "separator" ? (
                <div key={item.key} className="my-2 h-px w-full bg-gradient-to-r from-transparent via-emerald-300/75 to-transparent" />
              ) : (
                <div
                  key={item.key}
                  draggable
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowMenu(true);
                  }}
                  onDragStart={(e: React.DragEvent<HTMLDivElement>) => {
                    e.dataTransfer.setData("text/plain", item.node.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  className="cursor-move"
                >
                  <Link
                    href={item.node.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-zinc-300 hover:text-white text-xs truncate no-underline hover:underline underline-offset-1 w-full"
                  >
                    <img src={faviconUrl(item.node.url!)} alt="" className="w-4 h-4 shrink-0 rounded" />
                    <span className="truncate">{item.node.title || item.node.url}</span>
                  </Link>
                </div>
              )
            )
          )}
        </div>
      </div>
    </div>
  );
}

export function BookmarkGrid() {
  const { tree, error, reload } = useBookmarksTree();
  const {
    layout: savedLayout,
    colors,
    labels,
    separators,
    gridLocked,
    ready,
    saveLayout,
    setSectionColor,
    setShelfLabel,
    addFolderSeparator,
    setGridLocked,
    exportBackup,
    importBackup,
  } = useShelfStorage();
  const gridRef = useRef<HTMLDivElement>(null);
  const gridInstanceRef = useRef<GridStack | null>(null);
  const [adding, setAdding] = useState(false);
  const [addingBookmark, setAddingBookmark] = useState(false);
  const [moving, setMoving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folders = useMemo(() => collectFolders(tree), [tree]);
  const layout = useMemo(() => {
    const byId = new Map<string, { id: string; x: number; y: number; w: number; h: number }>();
    savedLayout.forEach((item) => {
      const n = normalizeLayoutItem(item);
      if (n.id) byId.set(n.id, n);
    });
    const existing = [...byId.values()];
    const maxY = 1 + existing.length ? Math.max(...existing.map((item) => item.y + item.h)) : 0;
    const maxXOnLastRow = 1 +existing
      .filter((item) => item.y + item.h === maxY)
      .reduce((max, item) => Math.max(max, item.x + item.w), 0);
    let appendX = maxXOnLastRow;
    let appendY = maxY;
    return folders.map((node) => {
      const existingItem = byId.get(node.id);
      if (existingItem) return existingItem;
      const item = { id: node.id, x: appendX, y: appendY, w: DEFAULT_W, h: DEFAULT_H };
      appendX += DEFAULT_W;
      if (appendX + DEFAULT_W > COLUMNS) {
        appendX = 0;
        appendY += DEFAULT_H;
      }
      return item;
    });
  }, [folders, savedLayout]);

  useEffect(() => {
    if (!gridRef.current || !ready || folders.length === 0) return;
    gridInstanceRef.current?.destroy(false);
    const grid = GridStack.init({ column: COLUMNS, cellHeight: 80, margin: "12px 10px 12px 10px", float: true, animate: true }, gridRef.current);
    gridInstanceRef.current = grid;
    grid.enableMove(!gridLocked);
    grid.enableResize(true);
    const handleChange = () => saveLayout(grid.save() as ShelfLayoutItem[]);
    grid.on("change", handleChange);
    return () => {
      grid.off("change");
      grid.destroy(false);
      gridInstanceRef.current = null;
    };
  }, [folders.length, ready, saveLayout, gridLocked]);

  const removeFolderWithCollapse = async (id: string) => {
    saveLayout(savedLayout.filter((item) => item.id !== id));
    await deleteBookmarkNode(id);
    await reload();
  };

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-400">Drag cards to reorder them. Drop bookmarks into a folder card to move them.</p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-zinc-100"
            onPress={async () => {
              setAdding(true);
              try {
                await createFolder("New Folder");
                await reload();
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
                await reload();
              } finally {
                setAddingBookmark(false);
              }
            }}
            isDisabled={addingBookmark}
          >
            + Bookmark
          </Button>
        </div>
      </div>
      {showSettings && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="absolute bottom-20 right-4 w-56 rounded-2xl border border-emerald-400/15 bg-black/92 p-2 shadow-[0_0_40px_rgba(16,185,129,0.16),0_0_90px_rgba(59,130,246,0.08)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-emerald-200 hover:bg-emerald-400/10 hover:text-emerald-100"
              onClick={() => {
                const blob = new Blob([JSON.stringify(exportBackup(), null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `shelf-backup-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
                setShowSettings(false);
              }}
            >
              <span>Export backup</span>
              <span className="text-xs text-emerald-300/60">JSON</span>
            </button>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-emerald-200 hover:bg-emerald-400/10 hover:text-emerald-100"
              onClick={() => fileInputRef.current?.click()}
            >
              <span>Import backup</span>
              <span className="text-xs text-emerald-300/60">Upload</span>
            </button>
          </div>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const text = await file.text();
          const parsed = JSON.parse(text) as Parameters<typeof importBackup>[0];
          importBackup(parsed);
          setShowSettings(false);
          e.currentTarget.value = "";
        }}
      />
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowSettings((v) => !v)}
          className="rounded-full border border-white/10 bg-black/30 p-2 text-zinc-300 transition-all hover:border-white/20 hover:bg-black/45 hover:text-white"
          aria-label="Open settings"
          title="Settings"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 3.75h3l.6 2.1a6.7 6.7 0 0 1 1.5.9l2.1-.7 1.5 2.6-1.5 1.5c.1.3.1.7.1 1s0 .7-.1 1l1.5 1.5-1.5 2.6-2.1-.7a6.7 6.7 0 0 1-1.5.9l-.6 2.1h-3l-.6-2.1a6.7 6.7 0 0 1-1.5-.9l-2.1.7-1.5-2.6 1.5-1.5c-.1-.3-.1-.7-.1-1s0-.7.1-1L4.8 9.3l1.5-2.6 2.1.7c.5-.4 1-.7 1.5-.9l.6-2.1Z" />
            <circle cx="12" cy="12" r="2.5" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => {
            const next = !gridLocked;
            setGridLocked(next);
            gridInstanceRef.current?.enableMove(!next);
            gridInstanceRef.current?.enableResize(true);
          }}
          className="rounded-full border border-white/10 bg-black/30 p-2 text-zinc-300 transition-all hover:border-white/20 hover:bg-black/45 hover:text-white"
          aria-label={gridLocked ? "Unlock grid movement" : "Lock grid movement"}
          title={gridLocked ? "Unlock grid movement" : "Lock grid movement"}
        >
          {gridLocked ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 11V9a6 6 0 1 1 12 0v2" />
              <rect x="5" y="11" width="14" height="10" rx="2.5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 11V9a3 3 0 0 1 5.2-2.1" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 11h12" />
              <rect x="5" y="11" width="14" height="10" rx="2.5" />
            </svg>
          )}
        </button>
      </div>
      <div ref={gridRef} className="grid-stack shelf-grid pb-[2px]" data-gs-column={COLUMNS}>
        {folders.map((node, i) => {
          const pos = layout[i];
          if (!pos) return null;
          return (
            <div key={node.id} className="grid-stack-item" {...{ "gs-id": pos.id, "gs-x": pos.x, "gs-y": pos.y, "gs-w": pos.w, "gs-h": pos.h }}>
              <FolderCard
                node={node}
                accentColor={colors[node.id]}
                label={labels[node.id]}
                gridLocked={gridLocked}
                separators={
                  separators[node.id]
                    ? (separators[node.id] as Array<{ id: string; createdAt: string }>).map((_, index) => index)
                    : []
                }
                onColorChange={setSectionColor}
                onLabelChange={setShelfLabel}
                onDeleteFolder={removeFolderWithCollapse}
                onAddSeparator={addFolderSeparator}
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
