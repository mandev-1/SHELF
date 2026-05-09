import { Input, Link, Surface } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BookmarkTreeNode } from "../types/bookmarks";
import type { ShelfPillarTodoItem } from "../types/grid";
import { NoteContent } from "./NoteContent";

function faviconUrl(url: string) {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`;
  } catch {
    return "";
  }
}

function truncateSubtitle(text: string, maxLen = 25) {
  return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
}

const TAG_PALETTES: { bg: string; palette: string }[] = [
  { bg: "bg-violet-700/18", palette: "shelf-todo-tag--violet" },
  { bg: "bg-fuchsia-700/18", palette: "shelf-todo-tag--fuchsia" },
  { bg: "bg-purple-700/18", palette: "shelf-todo-tag--purple" },
  { bg: "bg-indigo-700/18", palette: "shelf-todo-tag--indigo" },
  { bg: "bg-slate-800/25", palette: "shelf-todo-tag--navy" },
  { bg: "bg-blue-600/22", palette: "shelf-todo-tag--royal-blue" },
  { bg: "bg-emerald-700/22", palette: "shelf-todo-tag--royal-green" },
  { bg: "bg-violet-800/16", palette: "shelf-todo-tag--violet" },
  { bg: "bg-fuchsia-800/16", palette: "shelf-todo-tag--fuchsia" },
];

function tagColorClasses(tag: string) {
  const hash = tag.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const { bg, palette } = TAG_PALETTES[hash % TAG_PALETTES.length];
  return `shelf-todo-tag ${bg} ${palette}`;
}

function collectBookmarks(tree: BookmarkTreeNode[] | null): Map<string, BookmarkTreeNode> {
  const map = new Map<string, BookmarkTreeNode>();
  const walk = (n: BookmarkTreeNode) => {
    if (n.url) map.set(n.id, n);
    (n.children ?? []).forEach(walk);
  };
  (tree ?? []).forEach(walk);
  return map;
}

type DragPayload =
  | { kind: "bookmark"; id: string; parentId?: string }
  | { kind: "separator"; sepId: string; folderId: string };

function readDragPayload(dt: DataTransfer): DragPayload | null {
  const sepRaw = dt.getData("application/x-shelf-separator");
  if (sepRaw) {
    try {
      const parsed = JSON.parse(sepRaw) as { sepId?: string; folderId?: string };
      if (parsed?.sepId && parsed?.folderId) return { kind: "separator", sepId: parsed.sepId, folderId: parsed.folderId };
    } catch {
      // ignore
    }
  }

  const raw = dt.getData("application/x-shelf-bookmark");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { id?: string; parentId?: string };
      if (parsed?.id) return { kind: "bookmark", id: parsed.id, parentId: parsed.parentId };
    } catch {
      // ignore
    }
  }
  const id = dt.getData("text/plain");
  return id ? { kind: "bookmark", id } : null;
}

const MAX_PILLAR_TODO_PINS = 6;

export function Pillar({
  shelfName,
  tree,
  pinnedTop,
  pinOverrides,
  onSetPinned,
  onSetPinOverride,
  pillarTodoPins = [],
  onSetPillarTodoPins,
  focusDesynced = false,
  onShowPinnedLimitToast,
  todos,
  onSetTodos,
  onTodoLog,
  onOpenVisualFlow,
  onTaskCompleted,
}: {
  shelfName: string;
  tree: BookmarkTreeNode[] | null;
  pinnedTop: string[];
  pinOverrides?: Record<string, { title?: string; imageUrl?: string }>;
  onSetPinned: (next: { top: string[] }) => void;
  onSetPinOverride: (bookmarkId: string, override: { title?: string; imageUrl?: string } | null) => void;
  pillarTodoPins?: string[];
  onSetPillarTodoPins?: (next: string[] | ((prev: string[]) => string[])) => void;
  focusDesynced?: boolean;
  onShowPinnedLimitToast?: () => void;
  todos: ShelfPillarTodoItem[];
  onSetTodos: (next: ShelfPillarTodoItem[] | ((prev: ShelfPillarTodoItem[]) => ShelfPillarTodoItem[])) => void;
  onTodoLog?: (entry: string) => void;
  onOpenVisualFlow?: () => void;
  onTaskCompleted?: () => void;
}) {
  const byId = useMemo(() => collectBookmarks(tree), [tree]);
  const [overZone, setOverZone] = useState<"top" | null>(null);
  const [todoDraft, setTodoDraft] = useState("");
  const [todoSubtitleDraft, setTodoSubtitleDraft] = useState("");
  const [notePopover, setNotePopover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [noteEditMode, setNoteEditMode] = useState(false);

  useEffect(() => {
    setNoteEditMode(false);
  }, [notePopover?.id]);
  const [pinMenu, setPinMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const notePopoverRef = useRef<HTMLDivElement | null>(null);
  const pinMenuRef = useRef<HTMLDivElement | null>(null);
  const todosRef = useRef(todos);
  todosRef.current = todos;

  const topNodes = pinnedTop.map((id) => byId.get(id)).filter(Boolean) as BookmarkTreeNode[];

  const removePin = (id: string) => {
    onSetPinned({ top: pinnedTop.filter((x) => x !== id) });
  };

  const pinIntoTop = (id: string) => {
    const nextTop = pinnedTop.filter((x) => x !== id);
    nextTop.unshift(id);
    if (nextTop.length > 6) nextTop.pop();
    onSetPinned({ top: nextTop });
  };

  const addTodo = () => {
    const text = todoDraft.trim();
    if (!text) return;
    const subtitle = todoSubtitleDraft.trim() || undefined;
    onSetTodos((prev) => [...prev, { id: crypto.randomUUID(), text, subtitle, done: false }]);
    setTodoDraft("");
    setTodoSubtitleDraft("");
    onTodoLog?.(`added new task with name ${text}`);
  };

  const toggleTodo = (id: string) => {
    const t = todos.find((x) => x.id === id);
    const wasDone = t?.done ?? false;
    onSetTodos((prev) => prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
    if (t) onTodoLog?.(wasDone ? `reopened task ${t.text}` : `completed task ${t.text}`);
    if (t && !wasDone) onTaskCompleted?.();
  };

  const removeTodo = (id: string) => {
    const t = todos.find((x) => x.id === id);
    const label = t?.text ? `"${t.text}"` : "this task";
    if (!window.confirm(`Remove ${label}? This will clear it from your list.`)) return;
    if (!window.confirm(`Are you sure? This cannot be undone.`)) return;
    onSetTodos((prev) => prev.filter((item) => item.id !== id));
    onSetPillarTodoPins?.((prev) => prev.filter((x) => x !== id));
    if (t) onTodoLog?.(`removed task ${t.text}`);
  };

  const sortedTodos = useMemo(() => {
    const pinSet = focusDesynced
      ? new Set(pillarTodoPins)
      : new Set(todos.filter((t) => t.focused).map((t) => t.id));
    const orderIds = focusDesynced
      ? pillarTodoPins
      : [
          ...pillarTodoPins.filter((id) => pinSet.has(id)),
          ...todos.filter((t) => t.focused).map((t) => t.id).filter((id) => !pillarTodoPins.includes(id)),
        ];
    return [...todos].sort((a, b) => {
      const aPinned = pinSet.has(a.id);
      const bPinned = pinSet.has(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      if (aPinned && bPinned) {
        const aIdx = orderIds.indexOf(a.id);
        const bIdx = orderIds.indexOf(b.id);
        return (aIdx >= 0 ? aIdx : 999) - (bIdx >= 0 ? bIdx : 999);
      }
      return 0;
    });
  }, [todos, pillarTodoPins, focusDesynced]);

  const toggleTodoFocus = (id: string) => {
    if (focusDesynced) {
      if (!onSetPillarTodoPins) return;
      const isFocused = pillarTodoPins.includes(id);
      if (isFocused) {
        onSetPillarTodoPins((prev) => prev.filter((x) => x !== id));
      } else if (pillarTodoPins.length >= MAX_PILLAR_TODO_PINS) {
        onShowPinnedLimitToast?.();
      } else {
        onSetPillarTodoPins((prev) => [...prev.filter((x) => x !== id), id]);
      }
    } else {
      const todo = todos.find((t) => t.id === id);
      if (!todo) return;
      const willBeFocused = !todo.focused;
      if (willBeFocused) {
        const currentFocusedIds = todos.filter((t) => t.focused).map((t) => t.id);
        if (currentFocusedIds.length >= MAX_PILLAR_TODO_PINS) {
          onShowPinnedLimitToast?.();
          return;
        }
      }
      onSetTodos((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, focused: willBeFocused } : t));
        const focusedIds = next.filter((t) => t.focused).map((t) => t.id).slice(0, MAX_PILLAR_TODO_PINS);
        onSetPillarTodoPins?.(focusedIds);
        return next;
      });
    }
  };

  const setTodoUrl = (id: string, url: string | undefined) => {
    const t = todos.find((x) => x.id === id);
    onSetTodos((prev) => prev.map((item) => (item.id === id ? { ...item, url: url?.trim() || undefined } : item)));
    if (t) {
      if (url?.trim()) onTodoLog?.(`added URL to task with name ${t.text}. The URL is: ${url.trim()}`);
      else onTodoLog?.(`removed URL from task with name ${t.text}`);
    }
  };

  const setTodoNote = (id: string, note: string) => {
    onSetTodos((prev) => prev.map((item) => (item.id === id ? { ...item, note: note === "" ? undefined : note } : item)));
  };

  const setTodoSubtitle = (id: string, subtitle: string) => {
    onSetTodos((prev) =>
      prev.map((item) => (item.id === id ? { ...item, subtitle: subtitle === "" ? undefined : subtitle } : item))
    );
  };

  const setTodoTag = (id: string, tag: string) => {
    onSetTodos((prev) =>
      prev.map((item) => (item.id === id ? { ...item, tag: tag.trim() === "" ? undefined : tag.trim() } : item))
    );
  };

  useEffect(() => {
    if (!notePopover) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (notePopoverRef.current && target && notePopoverRef.current.contains(target)) return;
      const todo = todosRef.current.find((t) => t.id === notePopover.id);
      if (todo?.note?.trim()) {
        onTodoLog?.(`added comment to task ${todo.text}:\n\n${todo.note.trim()}\n\n`);
      }
      setNotePopover(null);
    };
    window.addEventListener("mousedown", onMouseDown, true);
    return () => window.removeEventListener("mousedown", onMouseDown, true);
  }, [notePopover, onTodoLog]);

  useEffect(() => {
    if (!pinMenu) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPinMenu(null);
    };
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (pinMenuRef.current && target && pinMenuRef.current.contains(target)) return;
      setPinMenu(null);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown, true);
    };
  }, [pinMenu]);

  return (
    <aside className="shelf-pillar relative flex h-full min-h-0 w-[280px] shrink-0 flex-col border-r border-white/10 bg-zinc-900/80">
      <div className="shrink-0 p-4">
        <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-300/70">Pillar</div>
        <div className="mt-1 truncate text-lg font-semibold text-white">{shelfName}</div>
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 pt-0">
      <Surface variant="secondary" className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4">

        <div
          className={`shelf-top6-zone min-w-0 rounded-2xl border p-3 transition ${
            overZone === "top"
              ? "shelf-top6-zone--drag border-emerald-300/50 bg-emerald-400/10"
              : "border-white/10 bg-black/20"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            const payload = readDragPayload(e.dataTransfer);
            if (!payload || payload.kind !== "bookmark") return;
            setOverZone("top");
            e.dataTransfer.dropEffect = "move";
          }}
          onDragLeave={() => setOverZone(null)}
          onDrop={(e) => {
            e.preventDefault();
            const payload = readDragPayload(e.dataTransfer);
            setOverZone(null);
            if (!payload || payload.kind !== "bookmark") return;
            pinIntoTop(payload.id);
          }}
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold text-emerald-200">Top 6</div>
            <div className="text-[10px] text-zinc-500">Drop bookmarks here</div>
          </div>
          <div className="grid min-w-0 gap-2">
            {topNodes.length === 0 ? (
              <div className="text-xs text-zinc-500">Empty</div>
            ) : (
              topNodes.map((b) => {
                const override = pinOverrides?.[b.id];
                const displayTitle = override?.title ?? b.title ?? b.url ?? "";
                const imageSrc = override?.imageUrl?.trim() ? override.imageUrl! : faviconUrl(b.url!);
                return (
                  <div
                    key={b.id}
                    className="shelf-top6-card group min-w-0 overflow-hidden rounded-2xl border border-emerald-400/15 bg-black/35 p-3"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPinMenu({ id: b.id, x: e.clientX, y: e.clientY });
                    }}
                  >
                    <Link
                      href={b.url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-w-0 min-h-0 items-center gap-3 no-underline overflow-hidden"
                    >
                      <img
                        src={imageSrc}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-xl object-cover bg-white/5"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = faviconUrl(b.url!);
                        }}
                      />
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="truncate text-sm font-semibold text-white group-hover:text-emerald-100">
                          {displayTitle}
                        </div>
                        <div
                          className="shelf-pin-url mt-0.5 block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-zinc-400"
                          title={b.url}
                        >
                          {b.url && b.url.length > 18 ? `${b.url.slice(0, 18)}...` : b.url}
                        </div>
                      </div>
                    </Link>
                    <button
                      type="button"
                      onClick={() => removePin(b.id)}
                      className="mt-2 text-[11px] text-zinc-400 hover:text-white"
                    >
                      Remove
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="shelf-todo-zone mt-3 min-w-0 rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold text-emerald-200">Todo</div>
          </div>
          <div className="mb-2 space-y-1.5">
            <Input
              variant="secondary"
              placeholder="Add a task…"
              value={todoDraft}
              onChange={(e) => setTodoDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTodo();
              }}
              className="[--input-bg:theme(colors.white/0.05)] [--input-border:theme(colors.white/0.1)] text-sm"
            />
            <Input
              variant="secondary"
              placeholder="Subtitle (optional)"
              value={todoSubtitleDraft}
              onChange={(e) => setTodoSubtitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTodo();
              }}
              className="[--input-bg:theme(colors.white/0.05)] [--input-border:theme(colors.white/0.1)] text-xs"
            />
          </div>
          <div className="min-w-0 space-y-1">
            {sortedTodos.length === 0 ? (
              <div className="text-xs text-zinc-500">No tasks yet</div>
            ) : (
              sortedTodos.map((t) => {
                const isFocused = focusDesynced ? pillarTodoPins.includes(t.id) : !!t.focused;
                const focusRank = isFocused ? pillarTodoPins.indexOf(t.id) + 1 : undefined;
                return (
                <div
                  key={t.id}
                  className={`shelf-todo-item group relative min-w-0 rounded-xl px-2 py-1.5 hover:bg-white/5 ${t.blockStatus === "blocked" ? "shelf-todo-item--blocked italic opacity-60" : ""} ${isFocused ? "shelf-todo-item--focused" : ""}`}
                  data-focus-rank={focusRank}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setNotePopover({ id: t.id, x: e.clientX, y: e.clientY });
                  }}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleTodo(t.id)}
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-white/20 bg-white/5 text-emerald-400 hover:border-emerald-400/50 hover:bg-emerald-400/10"
                      aria-label={t.done ? "Mark incomplete" : "Mark done"}
                    >
                      {t.done ? <span className="text-[10px]">✓</span> : null}
                    </button>
                    {t.url ? (
                      <Link
                        href={t.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`min-w-0 flex-1 truncate text-left text-xs no-underline hover:underline underline-offset-1 ${
                          t.done ? "text-zinc-500 line-through" : "text-zinc-300 hover:text-emerald-200"
                        }`}
                      >
                        {t.text}
                      </Link>
                    ) : (
                      <span
                        className={`min-w-0 flex-1 truncate text-left text-xs ${t.done ? "text-zinc-500 line-through" : "text-zinc-300"}`}
                      >
                        {t.text}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const next = window.prompt("Link URL", t.url ?? "");
                        if (next !== null) setTodoUrl(t.id, next || undefined);
                      }}
                      className="shrink-0 text-[11px] text-zinc-500 hover:text-emerald-300"
                      aria-label={t.url ? "Edit link" : "Add link"}
                      title={t.url ? "Edit link" : "Add link"}
                    >
                      🔗
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTodo(t.id)}
                      className="ml-0.5 shrink-0 text-[11px] text-zinc-500 hover:text-white"
                      aria-label="Remove task"
                    >
                      ×
                    </button>
                  </div>
                  {(t.tag || t.subtitle) && (
                    <div className="mt-1 ml-6 flex min-w-0 items-center gap-2">
                      {t.tag && (
                        <span className={`shrink-0 rounded-sm px-2 py-0.5 text-[9px] font-medium ${tagColorClasses(t.tag)}`}>
                          {t.tag}
                        </span>
                      )}
                      {t.subtitle && (
                        <span className={`min-w-0 truncate text-[11px] ${t.done ? "text-zinc-500 line-through" : "text-zinc-400"}`}>
                          {truncateSubtitle(t.subtitle, 25)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
              })
            )}
          </div>
        </div>

        <div className="shelf-error-dashboard-pillar mt-3 min-w-0 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-3">
          <div className="mb-2 text-xs font-semibold text-cyan-100">Visualization</div>
          <div className="shelf-error-dashboard-pillar-subtitle text-[11px] text-cyan-100/80">
            Visualize flow of your goals
          </div>
          <button
            type="button"
            onClick={() => onOpenVisualFlow?.()}
            className="mt-2 w-full rounded-lg border border-cyan-300/35 bg-cyan-400/10 px-2.5 py-1.5 text-[11px] font-medium text-cyan-50 hover:bg-cyan-400/20"
          >
            Visual Flow of Action
          </button>
        </div>
      </Surface>
      </div>
      {pinMenu && (() => {
        const b = byId.get(pinMenu.id);
        if (!b) return null;
        const override = pinOverrides?.[b.id];
        return (
          <div
            ref={pinMenuRef}
            className="fixed z-[100] min-w-44 rounded-2xl border border-emerald-400/15 bg-black/92 p-2 shadow-[0_0_40px_rgba(16,185,129,0.16)]"
            style={{
              left: Math.max(8, Math.min(pinMenu.x, window.innerWidth - 180)),
              top: Math.max(8, Math.min(pinMenu.y, window.innerHeight - 180)),
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-emerald-200 hover:bg-emerald-400/10"
              onClick={() => {
                const current = override?.title ?? b.title ?? "";
                const newTitle = window.prompt("Display name for this pin", current);
                if (newTitle !== null) {
                  onSetPinOverride(b.id, { ...override, title: newTitle.trim() || undefined });
                }
                setPinMenu(null);
              }}
            >
              Rename
            </button>
            <button
              type="button"
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-emerald-200 hover:bg-emerald-400/10"
              onClick={() => {
                const current = override?.imageUrl ?? "";
                const url = window.prompt("Image URL for this pin", current);
                if (url !== null) {
                  onSetPinOverride(b.id, { ...override, imageUrl: url.trim() || undefined });
                }
                setPinMenu(null);
              }}
            >
              {override?.imageUrl ? "Change image" : "Set custom image"}
            </button>
            {override?.imageUrl && (
              <button
                type="button"
                className="block w-full rounded-xl px-3 py-2 text-left text-sm text-zinc-400 hover:bg-white/5"
                onClick={() => {
                  onSetPinOverride(b.id, { ...override, imageUrl: "" });
                  setPinMenu(null);
                }}
              >
                Clear custom image
              </button>
            )}
            <button
              type="button"
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-zinc-400 hover:bg-white/5"
              onClick={() => setPinMenu(null)}
            >
              Cancel
            </button>
          </div>
        );
      })()}
      {notePopover && (() => {
        const t = todos.find((x) => x.id === notePopover.id);
        if (!t) return null;
        return (
          <div
            ref={notePopoverRef}
            className={`shelf-note-popover fixed z-[100] w-64 rounded-xl border border-emerald-400/20 bg-zinc-900 shadow-lg ${t.blockStatus === "blocked" ? "italic" : ""}`}
            style={{
              left: Math.max(8, Math.min(notePopover.x, window.innerWidth - 272)),
              top: Math.max(8, Math.min(notePopover.y, window.innerHeight - 180)),
            }}
          >
            <div className="shelf-note-popover-header flex items-center justify-between gap-2 border-b border-white/10 px-2 py-1.5 text-[10px] text-zinc-500">
              <span className="min-w-0 truncate">Note: {t.text}</span>
              {onSetPillarTodoPins && (
                <label className="flex shrink-0 items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={focusDesynced ? pillarTodoPins.includes(t.id) : !!t.focused}
                    onChange={() => toggleTodoFocus(t.id)}
                    className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-400/50"
                    aria-label="Focus task"
                  />
                  <span className="text-[9px] text-zinc-500">Focus</span>
                </label>
              )}
            </div>
            <div className="shelf-note-popover-body space-y-2 px-2 py-2">
              <Input
                variant="secondary"
                value={t.tag ?? ""}
                onChange={(e) => setTodoTag(t.id, e.target.value)}
                placeholder="Tag (optional)"
                className="text-xs"
              />
              <Input
                variant="secondary"
                value={t.subtitle ?? ""}
                onChange={(e) => setTodoSubtitle(t.id, e.target.value)}
                placeholder="Subtitle (optional)"
                className="text-xs"
              />
              {t.note?.trim() && !noteEditMode ? (
                <div className="space-y-1">
                  <div className="shelf-flow-node-note text-[11px] leading-relaxed">
                    <NoteContent
                      content={t.note}
                      onNoteChange={(newNote) => setTodoNote(t.id, newNote)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setNoteEditMode(true)}
                    className="text-[10px] text-zinc-500 hover:text-emerald-400"
                  >
                    Edit note…
                  </button>
                </div>
              ) : (
                <textarea
                  value={t.note ?? ""}
                  onChange={(e) => setTodoNote(t.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.shiftKey) {
                      e.preventDefault();
                      const todo = todosRef.current.find((x) => x.id === notePopover.id);
                      if (todo?.note?.trim()) {
                        onTodoLog?.(`added comment to task ${todo.text}:\n\n${todo.note.trim()}\n\n`);
                      }
                      setNotePopover(null);
                    }
                  }}
                  onBlur={() => setNoteEditMode(false)}
                  placeholder="Add a note…"
                  className="shelf-note-popover-textarea min-h-[80px] w-full resize-y rounded-b-xl border-0 bg-transparent px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-0"
                  rows={3}
                  autoFocus={noteEditMode || !t.note?.trim()}
                />
              )}
            </div>
          </div>
        );
      })()}
    </aside>
  );
}

