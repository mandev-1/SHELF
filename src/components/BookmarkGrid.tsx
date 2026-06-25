import { Button, Link, Popover, Spinner, Surface } from "@heroui/react";
import { GridStack } from "gridstack";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createFolder,
  createBookmark,
  deleteBookmarkNode,
  moveBookmark,
  updateBookmark,
  useBookmarksTree,
} from "../hooks/useBookmarks";
import { useShelfStorage } from "../hooks/useShelfStorage";
import type { BookmarkTreeNode } from "../types/bookmarks";
import type { ShelfFolderSeparator, ShelfGoal, ShelfLayoutItem } from "../types/grid";
import { ACCENT_COLORS } from "../types/grid";
import { monogramDataUri } from "../utils/monogram";
import { SettingsPanel } from "./SettingsPanel";

const COLUMNS = 12;
const DEFAULT_W = 4;
const DEFAULT_H = 3;
const GOAL_H = 1;

function isFolder(node: BookmarkTreeNode) {
  return node.url === undefined;
}

function folderChildren(node: BookmarkTreeNode) {
  return (node.children ?? []).filter((n) => n.url);
}

function renderFolderItems(node: BookmarkTreeNode, separators: ShelfFolderSeparator[] = []) {
  const links = folderChildren(node);
  const items: Array<
    | { type: "link"; key: string; node: BookmarkTreeNode }
    | { type: "separator"; key: string; sep: ShelfFolderSeparator }
  > = [];
  const bounded = separators
    .filter(Boolean)
    .map((s) => ({ ...s, atIndex: typeof s.atIndex === "number" ? s.atIndex : 999999 }))
    .sort((a, b) => (a.atIndex ?? 0) - (b.atIndex ?? 0));

  const byIndex = new Map<number, ShelfFolderSeparator[]>();
  bounded.forEach((sep) => {
    const at = Math.max(0, Math.min(links.length, Math.floor(sep.atIndex ?? links.length)));
    const list = byIndex.get(at) ?? [];
    list.push(sep);
    byIndex.set(at, list);
  });

  const pushSeps = (at: number) => {
    const seps = byIndex.get(at);
    if (!seps?.length) return;
    seps.forEach((sep) => items.push({ type: "separator", key: `sep-${sep.id}`, sep }));
  };

  links.forEach((link, index) => {
    pushSeps(index);
    items.push({ type: "link", key: link.id, node: link });
  });
  pushSeps(links.length);
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
  onUpdateSeparators,
  bookmarkViews,
  bookmarkOverrides,
  bookmarkSize = "normal",
  onSetBookmarkExpanded,
  onSetBookmarkOverride,
  onRenameBookmark,
  onDeleteBookmark,
  onAddBookmarkHere,
  onHideFromShelf,
}: {
  node: BookmarkTreeNode;
  accentColor?: string;
  label?: string;
  gridLocked: boolean;
  separators: ShelfFolderSeparator[];
  onColorChange: (id: string, color: string | null) => void;
  onLabelChange: (id: string, label: string | null) => void;
  onDeleteFolder: (id: string) => void;
  onAddSeparator: (id: string) => void;
  onDropBookmark: (bookmarkId: string, folderId: string) => void;
  onUpdateSeparators: (folderId: string, seps: ShelfFolderSeparator[]) => void;
  bookmarkViews: Record<string, { expanded?: boolean }>;
  bookmarkOverrides?: Record<string, { title?: string; imageUrl?: string }>;
  bookmarkSize?: "normal" | "senior";
  onSetBookmarkExpanded: (bookmarkId: string, expanded: boolean) => void;
  onSetBookmarkOverride?: (bookmarkId: string, override: { title?: string; imageUrl?: string } | null) => void;
  onRenameBookmark: (bookmarkId: string, newTitle: string) => Promise<void>;
  onDeleteBookmark: (bookmarkId: string) => Promise<void>;
  onAddBookmarkHere: (folderId: string) => Promise<void>;
  onHideFromShelf: (folderId: string) => void;
}) {
  const items = renderFolderItems(node, separators);
  const [editingLabel, setEditingLabel] = useState(false);
  const [draftLabel, setDraftLabel] = useState(label ?? getTitle(node));
  const [showMenu, setShowMenu] = useState(false);
  const [dropHint, setDropHint] = useState<{ overId: string; place: "before" | "after" } | null>(null);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [bookmarkMenu, setBookmarkMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const folderRef = useRef<HTMLDivElement>(null);
  const [hoverExpandedId, setHoverExpandedId] = useState<string | null>(null);
  const bookmarkMenuOpen = bookmarkMenu !== null;
  const bookmarkMenuRef = useRef<HTMLDivElement | null>(null);
  const hoverExpandTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setDraftLabel(label ?? getTitle(node));
  }, [label, node.id, node.title]);

  useEffect(() => {
    if (!bookmarkMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBookmarkMenu(null);
    };
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (bookmarkMenuRef.current && target && bookmarkMenuRef.current.contains(target)) return;
      setBookmarkMenu(null);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown, true);
    };
  }, [bookmarkMenuOpen]);

  useEffect(() => {
    return () => {
      if (hoverExpandTimerRef.current !== null) {
        window.clearTimeout(hoverExpandTimerRef.current);
        hoverExpandTimerRef.current = null;
      }
    };
  }, []);

  const readDragPayload = (dt: DataTransfer) => {
    const sepRaw = dt.getData("application/x-shelf-separator");
    if (sepRaw) {
      try {
        const parsed = JSON.parse(sepRaw) as { sepId?: string; folderId?: string };
        if (parsed?.sepId && parsed?.folderId) {
          return { kind: "separator" as const, sepId: parsed.sepId, folderId: parsed.folderId };
        }
      } catch {
        // ignore
      }
    }

    const raw = dt.getData("application/x-shelf-bookmark");
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { id?: string; parentId?: string };
        if (parsed?.id) return { kind: "bookmark" as const, id: parsed.id, parentId: parsed.parentId };
      } catch {
        // ignore
      }
    }
    const id = dt.getData("text/plain");
    return id ? { kind: "bookmark" as const, id } : null;
  };

  const moveWithinFolder = async (
    bookmarkId: string,
    targetChildId: string,
    place: "before" | "after",
    sourceParentId?: string
  ) => {
    const children = node.children ?? [];
    const fromIndex = children.findIndex((c) => c.id === bookmarkId);
    const targetIndex = children.findIndex((c) => c.id === targetChildId);
    if (targetIndex < 0) return;

    // if we don't know the source parent, assume different => no index shift
    const sameParent = sourceParentId ? sourceParentId === node.id : fromIndex >= 0;
    let toIndex = targetIndex + (place === "after" ? 1 : 0);

    if (sameParent && fromIndex >= 0 && fromIndex < toIndex) toIndex -= 1;
    if (sameParent && fromIndex === toIndex) return;

    await moveBookmark(bookmarkId, node.id, toIndex);
  };

  const commitSeparators = (next: ShelfFolderSeparator[]) => {
    onUpdateSeparators(node.id, next);
  };

  const moveSeparator = (sepId: string, atIndex: number, place: "before" | "after") => {
    const linksLen = folderChildren(node).length;
    const boundedAt = Math.max(0, Math.min(linksLen, Math.floor(atIndex)));
    const next = (separators ?? []).filter(Boolean).map((s) => ({ ...s }));
    const from = next.findIndex((s) => s.id === sepId);
    if (from < 0) return;
    const [moved] = next.splice(from, 1);
    moved.atIndex = boundedAt;

    // insert into a stable order: by atIndex, then keep existing order, but honor before/after within the same atIndex
    let insertAt = next.findIndex((s) => (s.atIndex ?? 999999) > boundedAt);
    if (insertAt === -1) insertAt = next.length;
    if (place === "after") {
      while (insertAt < next.length && (next[insertAt].atIndex ?? 999999) === boundedAt) insertAt += 1;
    }
    next.splice(insertAt, 0, moved);
    commitSeparators(next);
  };

  const deleteSeparator = (sepId: string) => {
    commitSeparators((separators ?? []).filter((s) => s.id !== sepId));
  };

  const commitLabel = () => {
    const next = draftLabel.trim();
    onLabelChange(node.id, next && next !== getTitle(node) ? next : null);
    setEditingLabel(false);
  };

  const isBookmarkDrag = (dt: DataTransfer) =>
    dt.types.includes("application/x-shelf-bookmark");

  return (
    <div
      ref={folderRef}
      className={`group grid-stack-item-content h-full flex flex-col folder overflow-hidden min-h-0${
        isDropTarget ? " is-drop-target" : ""
      }`}
      style={accentColor ? ({ "--hue": accentColor } as React.CSSProperties) : undefined}
      onDragOver={(e) => {
        e.preventDefault();
        if (isBookmarkDrag(e.dataTransfer)) e.dataTransfer.dropEffect = "move";
      }}
      onDragEnter={(e) => {
        if (isBookmarkDrag(e.dataTransfer)) setIsDropTarget(true);
      }}
      onDragLeave={(e) => {
        const related = e.relatedTarget as Node | null;
        if (related && folderRef.current?.contains(related)) return;
        setIsDropTarget(false);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setShowMenu(true);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDropTarget(false);
        const payload = readDragPayload(e.dataTransfer);
        if (!payload) return;
        if (payload.kind === "separator") {
          // move separator to end of list for this folder
          if (payload.folderId !== node.id) return;
          moveSeparator(payload.sepId, folderChildren(node).length, "after");
          setDropHint(null);
          return;
        }
        onDropBookmark(payload.id, node.id);
        setDropHint(null);
      }}
    >
      <div
        className="flex-1 flex flex-col min-w-0"
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowMenu(true);
        }}
      >
        {bookmarkMenuOpen && (
          <div
            ref={bookmarkMenuRef}
            className="fixed z-[80] min-w-44 rounded-2xl border border-emerald-400/15 bg-black/92 p-2 shadow-[0_0_40px_rgba(16,185,129,0.16)]"
            style={{
              left: Math.max(8, Math.min(bookmarkMenu!.x, window.innerWidth - 200)),
              top: Math.max(8, Math.min(bookmarkMenu!.y, window.innerHeight - 260)),
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-emerald-200 hover:bg-emerald-400/10"
              onClick={() => {
                const id = bookmarkMenu!.id;
                const isExpanded = !!bookmarkViews[id]?.expanded;
                onSetBookmarkExpanded(id, !isExpanded);
                setBookmarkMenu(null);
              }}
            >
              {bookmarkMenu && bookmarkViews[bookmarkMenu.id]?.expanded ? "Make normal" : "Make bigger"}
            </button>
            {onSetBookmarkOverride && (
              <>
                <button
                  type="button"
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-emerald-200 hover:bg-emerald-400/10"
                  onClick={() => {
                    const id = bookmarkMenu!.id;
                    const override = bookmarkOverrides?.[id];
                    const url = window.prompt("Image URL for this bookmark", override?.imageUrl ?? "");
                    if (url !== null) {
                      onSetBookmarkOverride(id, { ...override, imageUrl: url.trim() || undefined });
                    }
                    setBookmarkMenu(null);
                  }}
                >
                  {bookmarkOverrides?.[bookmarkMenu!.id]?.imageUrl ? "Change custom image" : "Set custom image"}
                </button>
                {bookmarkOverrides?.[bookmarkMenu!.id]?.imageUrl && (
                  <button
                    type="button"
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-zinc-400 hover:bg-white/5"
                    onClick={() => {
                      const id = bookmarkMenu!.id;
                      const override = bookmarkOverrides?.[id] ?? {};
                      onSetBookmarkOverride(id, { ...override, imageUrl: undefined });
                      setBookmarkMenu(null);
                    }}
                  >
                    Clear custom image
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-emerald-200 hover:bg-emerald-400/10"
              onClick={async () => {
                const id = bookmarkMenu!.id;
                const bookmark = (node.children ?? []).find((c: BookmarkTreeNode) => c.id === id);
                const currentTitle = bookmark?.title ?? "";
                const newTitle = window.prompt("Rename bookmark", currentTitle);
                if (newTitle !== null && newTitle.trim() !== "") {
                  await onRenameBookmark(id, newTitle.trim());
                }
                setBookmarkMenu(null);
              }}
            >
              Rename
            </button>
            <button
              type="button"
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/15"
              onClick={async () => {
                const id = bookmarkMenu!.id;
                if (window.confirm("Delete this bookmark?")) {
                  await onDeleteBookmark(id);
                }
                setBookmarkMenu(null);
              }}
            >
              Delete
            </button>
            <button
              type="button"
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-zinc-400 hover:bg-white/5"
              onClick={() => setBookmarkMenu(null)}
            >
              Cancel
            </button>
          </div>
        )}
        {showMenu && (
          <div className="absolute z-20 mt-12 ml-3 rounded-2xl border border-emerald-400/15 bg-black/95 p-2 shadow-[0_0_40px_rgba(16,185,129,0.16)]">
            <button
              type="button"
              onClick={() => {
                onAddBookmarkHere(node.id);
                setShowMenu(false);
              }}
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-emerald-200 hover:bg-emerald-400/10"
            >
              Add bookmark here
            </button>
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
              onClick={() => {
                onHideFromShelf(node.id);
                setShowMenu(false);
              }}
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-zinc-400 hover:bg-white/5"
            >
              Hide from shelf
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
        <div className="folder-head">
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
        <div className="folder-body">
          {items.length === 0 ? (
            <p className="folder-empty">Empty folder</p>
          ) : (
            items.map((item) =>
              item.type === "separator" ? (
                <div
                  key={item.key}
                  draggable
                  onDragStart={(e: React.DragEvent<HTMLDivElement>) => {
                    e.dataTransfer.setData(
                      "application/x-shelf-separator",
                      JSON.stringify({ sepId: item.sep.id, folderId: node.id })
                    );
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e: React.DragEvent<HTMLDivElement>) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const payload = readDragPayload(e.dataTransfer);
                    if (!payload || payload.kind !== "separator") return;
                    if (payload.folderId !== node.id) return;
                    if (payload.sepId === item.sep.id) return;
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    const place: "before" | "after" = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
                    setDropHint({ overId: item.sep.id, place });
                  }}
                  onDragLeave={(e) => {
                    const related = e.relatedTarget as Node | null;
                    if (related && e.currentTarget.contains(related)) return;
                    setDropHint(null);
                  }}
                  onDrop={(e: React.DragEvent<HTMLDivElement>) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const payload = readDragPayload(e.dataTransfer);
                    if (!payload || payload.kind !== "separator") return;
                    if (payload.folderId !== node.id) return;
                    moveSeparator(payload.sepId, item.sep.atIndex ?? 0, dropHint?.place ?? "before");
                    setDropHint(null);
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteSeparator(item.sep.id);
                  }}
                  title="Click to delete separator"
                  className="cursor-move select-none"
                >
                  {dropHint?.overId === item.sep.id && dropHint.place === "before" && (
                    <div className="shelf-drop-indicator -mt-0.5 mb-1" aria-hidden />
                  )}
                  <div className="my-2 h-px w-full bg-gradient-to-r from-transparent via-emerald-300/75 to-transparent" />
                  {dropHint?.overId === item.sep.id && dropHint.place === "after" && (
                    <div className="shelf-drop-indicator mt-1" aria-hidden />
                  )}
                </div>
              ) : (
                <div
                  key={item.key}
                  draggable
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setBookmarkMenu({ id: item.node.id, x: e.clientX, y: e.clientY });
                  }}
                  onMouseEnter={() => {
                    if (hoverExpandTimerRef.current !== null) window.clearTimeout(hoverExpandTimerRef.current);
                    hoverExpandTimerRef.current = window.setTimeout(() => {
                      hoverExpandTimerRef.current = null;
                      setHoverExpandedId(item.node.id);
                    }, 1200);
                  }}
                  onMouseLeave={() => {
                    if (hoverExpandTimerRef.current !== null) {
                      window.clearTimeout(hoverExpandTimerRef.current);
                      hoverExpandTimerRef.current = null;
                    }
                    setHoverExpandedId(null);
                  }}
                  onDragStart={(e: React.DragEvent<HTMLDivElement>) => {
                    e.dataTransfer.setData("text/plain", item.node.id);
                    e.dataTransfer.setData(
                      "application/x-shelf-bookmark",
                      JSON.stringify({ id: item.node.id, parentId: node.id })
                    );
                    e.dataTransfer.effectAllowed = "move";
                    if (hoverExpandTimerRef.current !== null) {
                      window.clearTimeout(hoverExpandTimerRef.current);
                      hoverExpandTimerRef.current = null;
                    }
                  }}
                  onDragOver={(e: React.DragEvent<HTMLDivElement>) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const payload = readDragPayload(e.dataTransfer);
                    if (!payload) return;
                    if (payload.kind === "separator") {
                      if (payload.folderId !== node.id) return;
                      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                      const place: "before" | "after" = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
                      setDropHint({ overId: item.node.id, place });
                      e.dataTransfer.dropEffect = "move";
                      return;
                    }

                    if (payload.id === item.node.id) {
                      setDropHint(null);
                      return;
                    }
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    const place: "before" | "after" = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
                    setDropHint({ overId: item.node.id, place });
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDragLeave={(e) => {
                    // avoid flicker when moving between nested elements
                    const related = e.relatedTarget as Node | null;
                    if (related && e.currentTarget.contains(related)) return;
                    setDropHint(null);
                  }}
                  onDrop={async (e: React.DragEvent<HTMLDivElement>) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const payload = readDragPayload(e.dataTransfer);
                    if (!payload) return;
                    if (payload.kind === "separator") {
                      if (payload.folderId !== node.id) return;
                      // compute link index of this item within folderChildren()
                      const links = folderChildren(node);
                      const linkIndex = links.findIndex((c) => c.id === item.node.id);
                      if (linkIndex < 0) return;
                      moveSeparator(payload.sepId, dropHint?.place === "after" ? linkIndex + 1 : linkIndex, "before");
                      setDropHint(null);
                      return;
                    }
                    try {
                      await moveWithinFolder(payload.id, item.node.id, dropHint?.place ?? "before", payload.parentId);
                    } finally {
                      setDropHint(null);
                    }
                  }}
                  className={`cursor-move ${
                    (bookmarkViews[item.node.id]?.expanded || hoverExpandedId === item.node.id || bookmarkSize === "senior")
                      ? "shelf-bookmark-expanded rounded-xl border border-emerald-400/15 bg-black/25 p-3"
                      : ""
                  }`}
                >
                  {dropHint?.overId === item.node.id && dropHint.place === "before" && (
                    <div className="shelf-drop-indicator -mt-0.5 mb-1" aria-hidden />
                  )}
                  <Link
                    href={item.node.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                  className={`bm ${
                    bookmarkViews[item.node.id]?.expanded || hoverExpandedId === item.node.id || bookmarkSize === "senior"
                      ? "flex items-center gap-3 text-zinc-200 hover:text-white no-underline hover:underline underline-offset-2 w-full"
                      : "flex items-center gap-2 text-zinc-300 hover:text-white text-xs truncate no-underline hover:underline underline-offset-1 w-full"
                  }`}
                  >
                    <img
                      src={(bookmarkOverrides?.[item.node.id]?.imageUrl?.trim() || faviconUrl(item.node.url!))}
                      alt=""
                      className={
                        bookmarkViews[item.node.id]?.expanded || hoverExpandedId === item.node.id
                          ? "h-14 w-14 shrink-0 rounded-xl object-cover"
                          : bookmarkSize === "senior"
                            ? "h-10 w-10 shrink-0 rounded-lg object-cover"
                            : "h-4 w-4 shrink-0 rounded object-cover"
                      }
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        // Avoid an infinite loop if the monogram itself errors
                        if (img.dataset.fallback === "monogram") return;
                        img.dataset.fallback = "monogram";
                        img.src = monogramDataUri(item.node.url!);
                      }}
                    />
                    <div
                      className={
                        bookmarkViews[item.node.id]?.expanded || hoverExpandedId === item.node.id || bookmarkSize === "senior" ? "min-w-0" : ""
                      }
                    >
                      <div
                        className={
                          bookmarkViews[item.node.id]?.expanded || hoverExpandedId === item.node.id || bookmarkSize === "senior"
                            ? "truncate text-sm font-semibold"
                            : "truncate"
                        }
                      >
                        {(bookmarkOverrides?.[item.node.id]?.title ?? item.node.title) || item.node.url}
                      </div>
                      {(bookmarkViews[item.node.id]?.expanded || hoverExpandedId === item.node.id || bookmarkSize === "senior") && (
                        <div className="mt-0.5 truncate text-xs text-zinc-400">{item.node.url}</div>
                      )}
                    </div>
                  </Link>
                  {dropHint?.overId === item.node.id && dropHint.place === "after" && (
                    <div className="shelf-drop-indicator mt-1" aria-hidden />
                  )}
                </div>
              )
            )
          )}
        </div>
      </div>
    </div>
  );
}

function GoalCard({
  goal,
  onUpdateGoal,
}: {
  goal: ShelfGoal;
  onUpdateGoal: (id: string, next: ShelfGoal) => void;
}) {
  const percent = Math.max(0, Math.min(100, goal.progress));
  const fillStop = `${percent}%`;
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const menuOpen = menuPos !== null;
  const menuRef = useRef<HTMLDivElement | null>(null);
  const headerLabel = goal.label?.trim() ? goal.label.trim() : "Goal";

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuPos(null);
    };
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (menuRef.current && target && menuRef.current.contains(target)) return;
      setMenuPos(null);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown, true);
    };
  }, [menuOpen]);

  const addOrEditLink = () => {
    const url = window.prompt("Link URL", goal.linkUrl ?? "");
    if (!url?.trim()) return;
    onUpdateGoal(goal.id, { ...goal, linkUrl: url.trim() });
  };

  const changeHeaderTitle = () => {
    const next = window.prompt("Header title", headerLabel);
    if (!next?.trim()) return;
    onUpdateGoal(goal.id, { ...goal, label: next.trim() });
  };

  return (
    <div
      className="grid-stack-item-content mt-[15px] mb-[15px] h-full min-h-0 overflow-hidden rounded-xl border-[3px] border-blue-400 text-slate-900 shadow-[0_0_0_1px_rgba(59,130,246,0.18),0_0_28px_rgba(59,130,246,0.12)]"
      style={{
        backgroundImage: `linear-gradient(90deg, rgb(226 232 240) 0%, rgb(226 232 240) ${fillStop}, rgb(255 255 255) ${fillStop}, rgb(255 255 255) 100%)`,
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setMenuPos({ x: e.clientX, y: e.clientY });
      }}
    >
      {menuOpen && (
        <div
          ref={menuRef}
          className="fixed z-[70] min-w-44 rounded-2xl border border-blue-400/20 bg-black/92 p-2 shadow-[0_0_40px_rgba(59,130,246,0.18)]"
          style={{
            left: Math.max(8, Math.min(menuPos!.x, window.innerWidth - 200)),
            top: Math.max(8, Math.min(menuPos!.y, window.innerHeight - 200)),
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <button
            type="button"
            className="block w-full rounded-xl px-3 py-2 text-left text-sm text-blue-200 hover:bg-blue-400/10 hover:text-blue-100"
            onClick={() => {
              addOrEditLink();
              setMenuPos(null);
            }}
          >
            Add a link
          </button>
          <button
            type="button"
            className="block w-full rounded-xl px-3 py-2 text-left text-sm text-blue-200 hover:bg-blue-400/10 hover:text-blue-100"
            onClick={() => {
              changeHeaderTitle();
              setMenuPos(null);
            }}
          >
            Change title
          </button>
          <button
            type="button"
            className="block w-full rounded-xl px-3 py-2 text-left text-sm text-zinc-400 hover:bg-white/5"
            onClick={() => setMenuPos(null)}
          >
            Cancel
          </button>
        </div>
      )}
      <div className="flex h-full min-h-0 flex-col p-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.18em] text-blue-600/70">{headerLabel}</p>
            <input
              value={goal.title}
              onChange={(e) => onUpdateGoal(goal.id, { ...goal, title: e.target.value })}
              className="mt-0.5 w-full bg-transparent text-sm font-semibold outline-none"
              aria-label="Goal title"
            />
          </div>
          <input
            type="number"
            min={0}
            max={100}
            value={percent}
            onChange={(e) => {
              const next = Number(e.target.value);
              onUpdateGoal(goal.id, {
                ...goal,
                progress: Number.isFinite(next) ? next : 0,
              });
            }}
            className="shrink-0 w-10 rounded-full border border-blue-300 bg-slate-100/90 px-1.5 py-0.5 text-right text-[10px] font-medium text-blue-700 outline-none"
            aria-label="Goal readiness percentage"
          />
        </div>
        <div className="mt-1 flex min-h-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (goal.linkUrl?.trim()) {
                window.open(goal.linkUrl.trim(), "_blank", "noopener,noreferrer");
                return;
              }
              addOrEditLink();
            }}
            className="h-6 flex-1 rounded-md bg-blue-700 px-2 text-left text-[11px] font-semibold text-white shadow hover:bg-blue-600"
            title={goal.linkUrl ? goal.linkUrl : "Set a link"}
          >
            Continue
          </button>
          <div className="relative h-6 w-24 shrink-0 overflow-hidden rounded-full border border-slate-500/60 bg-slate-200 shadow-inner">
            <div
              className="absolute inset-y-0 left-0 bg-slate-100 transition-all"
              style={{ width: `${percent}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-slate-700">
              {percent}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BookmarkGrid({ bodyHidden = false }: { bodyHidden?: boolean } = {}) {
  const { tree, error, reload } = useBookmarksTree();
  const {
    layout: savedLayout,
    colors,
    labels,
    separators,
    goals,
    showGoals,
    showTodoDates,
    setShowTodoDates,
    showFocusDrawer,
    setShowFocusDrawer,
    showBothNavButtons,
    setShowBothNavButtons,
    gridLocked,
    ready,
    saveLayout,
    setSectionColor,
    setShelfLabel,
    addFolderSeparator,
    setFolderSeparators,
    saveGoals,
    setShowGoals,
    setGridLocked,
    bookmarkViews,
    bookmarkOverrides,
    bookmarkSize,
    setBookmarkOverride,
    setBookmarkExpanded,
    setBookmarkSize,
    theme,
    setTheme,
    accent,
    setAccent,
    shelfName,
    setShelfName,
    exportBackup,
    importBackup,
    obsidianLog,
    setObsidianLogConfig,
    logToObsidian,
    openTaskLogInObsidian,
    llmConsoleUrl,
    setLlmConsoleUrl,
    taskLog,
    clearTaskLog,
    hiddenFolderIds,
    setHiddenFolders,
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
    showBudgetTab,
    setShowBudgetTab,
    strategieState,
    strategieSetCurrency,
    strategieSetSecondaryCurrency,
  } = useShelfStorage();
  const gridRef = useRef<HTMLDivElement>(null);
  const gridInstanceRef = useRef<GridStack | null>(null);
  const [adding, setAdding] = useState(false);
  const [addingBookmark, setAddingBookmark] = useState(false);
  const [moving, setMoving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const allFolders = useMemo(() => collectFolders(tree), [tree]);
  const folders = useMemo(
    () => allFolders.filter((f) => !hiddenFolderIds.includes(f.id)),
    [allFolders, hiddenFolderIds]
  );
  const hiddenFolderNodes = useMemo(
    () => allFolders.filter((f) => hiddenFolderIds.includes(f.id)),
    [allFolders, hiddenFolderIds]
  );
  const goalItems = useMemo(() => (showGoals ? Object.values(goals) : []), [goals, showGoals]);
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
    return [...folders, ...goalItems].map((node) => {
      const existingItem = byId.get(node.id);
      if (existingItem) {
        return "progress" in node ? { ...existingItem, h: GOAL_H } : existingItem;
      }
      const item = { id: node.id, x: appendX, y: appendY, w: DEFAULT_W, h: "progress" in node ? GOAL_H : DEFAULT_H };
      appendX += DEFAULT_W;
      if (appendX + DEFAULT_W > COLUMNS) {
        appendX = 0;
        appendY += DEFAULT_H;
      }
      return item;
    });
  }, [folders, goalItems, savedLayout]);

  useEffect(() => {
    if (!gridRef.current || !ready || (folders.length === 0 && goalItems.length === 0)) return;
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
  }, [folders.length, goalItems.length, ready, saveLayout, gridLocked]);

  const removeFolderWithCollapse = async (id: string) => {
    saveLayout(savedLayout.filter((item) => item.id !== id));
    await deleteBookmarkNode(id);
    await reload();
  };

  useEffect(() => {
    if (!goalItems.length) return;
    const normalized = layout.map((item, index) => {
      const node = [...folders, ...goalItems][index];
      return node && "progress" in node ? { ...item, h: GOAL_H } : item;
    });
    const changed = normalized.some((item, index) => {
      const original = layout[index];
      return original && original.h !== item.h;
    });
    if (changed) saveLayout(normalized as ShelfLayoutItem[]);
  }, [folders, goalItems, layout, saveLayout]);

  const addGoalCard = async () => {
    const title = window.prompt("Goal title", "Learning in progress");
    if (!title?.trim()) return;
    const linkUrl = window.prompt("Link URL (optional)", "https://");
    const id = crypto.randomUUID();
    saveGoals({
      ...goals,
      [id]: {
        id,
        title: title.trim(),
        goal: "",
        progress: 0,
        label: "Goal",
        linkUrl: linkUrl?.trim() ? linkUrl.trim() : undefined,
      },
    });
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
      {!bodyHidden && (
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
          <Button
            size="sm"
            variant="ghost"
            className="text-zinc-100"
            onPress={addGoalCard}
          >
            + Goal
          </Button>
        </div>
      </div>
      )}
      <SettingsPanel
        open={showSettings}
        onClose={() => setShowSettings(false)}
        theme={theme}
        setTheme={setTheme}
        accent={accent}
        setAccent={setAccent}
        shelfName={shelfName}
        setShelfName={setShelfName}
        bookmarkSize={bookmarkSize}
        setBookmarkSize={setBookmarkSize}
        showGoals={showGoals}
        setShowGoals={setShowGoals}
        showTodoDates={showTodoDates}
        setShowTodoDates={setShowTodoDates}
        showCanvasBlockers={showCanvasBlockers}
        setShowCanvasBlockers={setShowCanvasBlockers}
        showFocusDrawer={showFocusDrawer}
        setShowFocusDrawer={setShowFocusDrawer}
        showBothNavButtons={showBothNavButtons}
        setShowBothNavButtons={setShowBothNavButtons}
        strategieState={strategieState}
        strategieSetCurrency={strategieSetCurrency}
        strategieSetSecondaryCurrency={strategieSetSecondaryCurrency}
        exportBackup={exportBackup}
        importBackup={importBackup}
        taskLog={taskLog}
        clearTaskLog={clearTaskLog}
        llmConsoleUrl={llmConsoleUrl}
        setLlmConsoleUrl={setLlmConsoleUrl}
        focusDesynced={focusDesynced}
        setFocusDesynced={setFocusDesynced}
        lowPerformanceMode={lowPerformanceMode}
        setLowPerformanceMode={setLowPerformanceMode}
        hiddenFolderNodes={hiddenFolderNodes}
        setHiddenFolders={setHiddenFolders}
        obsidianLog={obsidianLog}
        setObsidianLogConfig={setObsidianLogConfig}
        logToObsidian={logToObsidian}
        openTaskLogInObsidian={openTaskLogInObsidian}
        showStrategieTab={showStrategieTab}
        setShowStrategieTab={setShowStrategieTab}
        showHopperTab={showHopperTab}
        setShowHopperTab={setShowHopperTab}
        showInventoryTab={showInventoryTab}
        setShowInventoryTab={setShowInventoryTab}
        showBudgetTab={showBudgetTab}
        setShowBudgetTab={setShowBudgetTab}
        onImportFile={() => fileInputRef.current?.click()}
        getFolderTitle={getTitle}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          // Reset the input via the ref BEFORE awaiting — after an await
          // e.currentTarget is null because React reuses the synthetic event.
          if (fileInputRef.current) fileInputRef.current.value = "";
          let parsed: Parameters<typeof importBackup>[0];
          try {
            const text = await file.text();
            parsed = JSON.parse(text) as Parameters<typeof importBackup>[0];
          } catch {
            alert("Could not import backup: the file isn't valid JSON.");
            return;
          }
          await importBackup(parsed);
          // Reload so every useShelfStorage() instance (FullApp's powers the
          // Visual Flow / Pillar / Strategie UI) re-hydrates from storage —
          // import runs on this component's instance and most keys aren't
          // cross-instance synced. Guarded to the persistent extension context;
          // in plain dev there's no storage, so a reload would wipe the import.
          if (typeof chrome !== "undefined" && chrome.storage?.local) {
            window.location.reload();
          } else {
            setShowSettings(false);
          }
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
      {!bodyHidden && (
      <>
      <div ref={gridRef} className="grid-stack shelf-grid pb-[2px]" data-gs-column={COLUMNS}>
        {[...folders, ...goalItems].map((node, i) => {
          const pos = layout[i];
          if (!pos) return null;
          const isGoal = "progress" in node;
          return (
            <div
              key={node.id}
              className="grid-stack-item"
              {...{
                "gs-id": pos.id,
                "gs-x": pos.x,
                "gs-y": pos.y,
                "gs-w": pos.w,
                "gs-h": pos.h,
                ...(isGoal ? { "gs-no-resize": "true" } : {}),
              }}
            >
              {isGoal ? (
                <GoalCard
                  goal={node}
                  onUpdateGoal={(id, next) => {
                    saveGoals({ ...goals, [id]: next });
                  }}
                />
              ) : (
                <FolderCard
                  node={node}
                  accentColor={colors[node.id]}
                  label={labels[node.id]}
                  gridLocked={gridLocked}
                  separators={separators[node.id] ?? []}
                  onColorChange={setSectionColor}
                  onLabelChange={setShelfLabel}
                  onDeleteFolder={removeFolderWithCollapse}
                  onAddSeparator={addFolderSeparator}
                  onUpdateSeparators={(folderId, seps) => setFolderSeparators(folderId, seps)}
                  bookmarkViews={bookmarkViews}
                  bookmarkOverrides={bookmarkOverrides}
                  bookmarkSize={bookmarkSize}
                  onSetBookmarkExpanded={setBookmarkExpanded}
                  onSetBookmarkOverride={setBookmarkOverride}
                  onRenameBookmark={async (bookmarkId, newTitle) => {
                    await updateBookmark(bookmarkId, { title: newTitle });
                  }}
                  onDeleteBookmark={async (bookmarkId) => {
                    await deleteBookmarkNode(bookmarkId);
                  }}
                  onAddBookmarkHere={async (folderId) => {
                    const url = window.prompt("Bookmark URL");
                    if (!url?.trim()) return;
                    let defaultTitle = "";
                    try {
                      defaultTitle = new URL(url).hostname;
                    } catch {
                      defaultTitle = url;
                    }
                    const title = window.prompt("Bookmark title", defaultTitle)?.trim() || defaultTitle || url;
                    setAddingBookmark(true);
                    try {
                      await createBookmark(title, url.trim(), folderId);
                      await reload();
                    } finally {
                      setAddingBookmark(false);
                    }
                  }}
                  onDropBookmark={async (bookmarkId, folderId) => {
                    setMoving(true);
                    try {
                      await moveBookmark(bookmarkId, folderId);
                    } finally {
                      setMoving(false);
                    }
                  }}
                  onHideFromShelf={(folderId) => {
                    setHiddenFolders((prev) => [...prev, folderId]);
                    saveLayout(savedLayout.filter((item) => item.id !== folderId));
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      {moving && <p className="text-xs text-zinc-500">Moving bookmark…</p>}
      </>
      )}
    </div>
  );
}
