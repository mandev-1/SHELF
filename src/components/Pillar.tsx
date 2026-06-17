import { Link } from "@heroui/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { BookmarkTreeNode } from "../types/bookmarks";
import type { ShelfPillarTodoItem } from "../types/grid";
import { monogramDataUri } from "../utils/monogram";
import { applyTodoUpdate, stampNewTodo } from "../utils/todoAudit";
import { NoteContent } from "./NoteContent";

function faviconUrl(url: string) {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`;
  } catch {
    return "";
  }
}

/** 1×1 transparent gif used to suppress the native drag ghost during pin reorder. */
const BLANK_DRAG_IMG: HTMLImageElement | null = (() => {
  if (typeof Image === "undefined") return null;
  const img = new Image();
  img.src = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
  return img;
})();

function truncateSubtitle(text: string, maxLen = 25) {
  return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
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
  void overZone; // currently visual-only; keep setter for future drop-zone hover state
  const [todoDraft, setTodoDraft] = useState("");
  const [todoSubtitleDraft, setTodoSubtitleDraft] = useState("");
  const [notePopover, setNotePopover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [noteEditMode, setNoteEditMode] = useState(false);

  useEffect(() => {
    setNoteEditMode(false);
  }, [notePopover?.id]);
  const [pinMenu, setPinMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [draggingPinId, setDraggingPinId] = useState<string | null>(null);
  const notePopoverRef = useRef<HTMLDivElement | null>(null);
  const pinMenuRef = useRef<HTMLDivElement | null>(null);
  const todosRef = useRef(todos);
  todosRef.current = todos;

  const topNodes = pinnedTop.map((id) => byId.get(id)).filter(Boolean) as BookmarkTreeNode[];

  const removePin = (id: string) => {
    capturePinPositions();
    onSetPinned({ top: pinnedTop.filter((x) => x !== id) });
  };

  const pinIntoTop = (id: string) => {
    const wasPinned = pinnedTop.includes(id);
    const nextTop = pinnedTop.filter((x) => x !== id);
    nextTop.unshift(id);
    if (nextTop.length > 6) nextTop.pop();
    capturePinPositions();
    // Only a genuinely new pin gets the drop-in; re-pinning an existing one
    // is a reorder and should ride the FLIP glide instead.
    if (!wasPinned) justPinnedRef.current = id;
    onSetPinned({ top: nextTop });
  };

  // ── FLIP animation for pin reorder ─────────────────────────────────────
  // Per design spec: snapshot rects before reorder, then in useLayoutEffect
  // apply the inverse transform with `transition:none`, then rAF back to
  // identity over 0.3s cubic-bezier(.2,.9,.3,1). Displaced pins glide.
  const pinNodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const pinRectsRef = useRef<Map<string, DOMRect>>(new Map());
  // id of a bookmark just pinned into Top 6 — gets a one-shot drop-in animation.
  const justPinnedRef = useRef<string | null>(null);

  const capturePinPositions = () => {
    const snap = new Map<string, DOMRect>();
    pinNodeRefs.current.forEach((node, id) => {
      snap.set(id, node.getBoundingClientRect());
    });
    pinRectsRef.current = snap;
  };

  useLayoutEffect(() => {
    const justId = justPinnedRef.current;
    justPinnedRef.current = null;

    // FLIP glide for displaced pins (skips the freshly-pinned node, which has
    // no prior rect and instead plays the drop-in below).
    const prev = pinRectsRef.current;
    pinRectsRef.current = new Map();
    prev.forEach((oldRect, id) => {
      const node = pinNodeRefs.current.get(id);
      if (!node || id === justId) return;
      const newRect = node.getBoundingClientRect();
      const dx = oldRect.left - newRect.left;
      const dy = oldRect.top - newRect.top;
      if (dx === 0 && dy === 0) return;
      node.style.transition = "none";
      node.style.transform = `translate(${dx}px, ${dy}px)`;
      // Force reflow so the inverse transform commits before we animate back
      void node.getBoundingClientRect();
      requestAnimationFrame(() => {
        node.style.transition = "transform 0.3s cubic-bezier(.2,.9,.3,1)";
        node.style.transform = "";
        const clear = () => {
          node.style.transition = "";
          node.style.transform = "";
          node.removeEventListener("transitionend", clear);
        };
        node.addEventListener("transitionend", clear);
      });
    });

    // Ghost drop-in for a freshly pinned bookmark — works even from an empty
    // stack (no prior rects to FLIP against).
    if (justId) {
      const node = pinNodeRefs.current.get(justId);
      if (node) {
        node.classList.remove("pin-drop-in");
        void node.getBoundingClientRect();
        node.classList.add("pin-drop-in");
        const clear = () => {
          node.classList.remove("pin-drop-in");
          node.removeEventListener("animationend", clear);
        };
        node.addEventListener("animationend", clear);
      }
    }
  }, [pinnedTop]);

  // Deterministic tag color per spec (only violet or blue available)
  const tagClass = (tag: string) => {
    let h = 0;
    for (const ch of tag) h = ((h * 31) + ch.charCodeAt(0)) >>> 0;
    return h % 2 === 0 ? "tag--violet" : "tag--blue";
  };

  const addTodo = () => {
    const text = todoDraft.trim();
    if (!text) return;
    const subtitle = todoSubtitleDraft.trim() || undefined;
    onSetTodos((prev) => [...prev, stampNewTodo({ id: crypto.randomUUID(), text, subtitle, done: false })]);
    setTodoDraft("");
    setTodoSubtitleDraft("");
    onTodoLog?.(`added new task with name ${text}`);
  };

  const toggleTodo = (id: string) => {
    const t = todos.find((x) => x.id === id);
    const wasDone = t?.done ?? false;
    onSetTodos((prev) => prev.map((item) => (item.id === id ? applyTodoUpdate(item, { done: !item.done }) : item)));
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
      // Burning ("on fire") tasks always float to the very top.
      const aBurning = !!a.burning;
      const bBurning = !!b.burning;
      if (aBurning !== bBurning) return aBurning ? -1 : 1;
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
        const next = prev.map((t) => (t.id === id ? applyTodoUpdate(t, { focused: willBeFocused }) : t));
        const focusedIds = next.filter((t) => t.focused).map((t) => t.id).slice(0, MAX_PILLAR_TODO_PINS);
        onSetPillarTodoPins?.(focusedIds);
        return next;
      });
    }
  };

  const setTodoUrl = (id: string, url: string | undefined) => {
    const t = todos.find((x) => x.id === id);
    onSetTodos((prev) => prev.map((item) => (item.id === id ? applyTodoUpdate(item, { url: url?.trim() || undefined }) : item)));
    if (t) {
      if (url?.trim()) onTodoLog?.(`added URL to task with name ${t.text}. The URL is: ${url.trim()}`);
      else onTodoLog?.(`removed URL from task with name ${t.text}`);
    }
  };

  const setTodoNote = (id: string, note: string) => {
    onSetTodos((prev) => prev.map((item) => (item.id === id ? applyTodoUpdate(item, { note: note === "" ? undefined : note }) : item)));
  };

  const setTodoSubtitle = (id: string, subtitle: string) => {
    onSetTodos((prev) =>
      prev.map((item) => (item.id === id ? applyTodoUpdate(item, { subtitle: subtitle === "" ? undefined : subtitle }) : item))
    );
  };

  const toggleTodoBurning = (id: string) => {
    onSetTodos((prev) =>
      prev.map((item) => (item.id === id ? applyTodoUpdate(item, { burning: item.burning ? undefined : true }) : item))
    );
  };

  const setTodoTag = (id: string, tag: string) => {
    onSetTodos((prev) =>
      prev.map((item) => (item.id === id ? applyTodoUpdate(item, { tag: tag.trim() === "" ? undefined : tag.trim() }) : item))
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
    <aside className="pillar">
      <div className="pillar-head">
        <div className="eyebrow">Pillar</div>
        <div className="pillar-name">{shelfName}</div>
      </div>
      <div className="pillar-body">

        <div className="zone">
          <div className="zone-head">
            <div className="zone-title">Top 6</div>
            <div className="zone-hint">Drop bookmarks here</div>
          </div>
          <div
            className="pin-stack"
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
            {topNodes.length === 0 ? (
              <div className="text-xs text-[var(--faint)]">Empty</div>
            ) : (
              topNodes.map((b) => {
                const override = pinOverrides?.[b.id];
                const displayTitle = override?.title ?? b.title ?? b.url ?? "";
                const imageSrc = override?.imageUrl?.trim() ? override.imageUrl! : faviconUrl(b.url!);
                const isDragging = draggingPinId === b.id;
                return (
                  <div
                    key={b.id}
                    ref={(el) => {
                      if (el) pinNodeRefs.current.set(b.id, el);
                      else pinNodeRefs.current.delete(b.id);
                    }}
                    data-sort-key={b.id}
                    className={`pin${isDragging ? " is-dragging" : ""}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("application/x-shelf-pin-reorder", b.id);
                      if (BLANK_DRAG_IMG) {
                        try { e.dataTransfer.setDragImage(BLANK_DRAG_IMG, 0, 0); } catch { /* ignore */ }
                      }
                      setDraggingPinId(b.id);
                    }}
                    onDragEnter={() => {
                      // Immediate reorder on dragenter — drives the FLIP animation.
                      if (!draggingPinId || draggingPinId === b.id) return;
                      const from = pinnedTop.indexOf(draggingPinId);
                      const to = pinnedTop.indexOf(b.id);
                      if (from < 0 || to < 0 || from === to) return;
                      capturePinPositions();
                      const next = pinnedTop.slice();
                      const [moved] = next.splice(from, 1);
                      next.splice(to, 0, moved);
                      onSetPinned({ top: next });
                    }}
                    onDragOver={(e) => {
                      // Must preventDefault to accept the drop and keep the dragenter cycle live.
                      if (e.dataTransfer.types.includes("application/x-shelf-pin-reorder")) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = "move";
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDraggingPinId(null);
                    }}
                    onDragEnd={() => {
                      setDraggingPinId(null);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPinMenu({ id: b.id, x: e.clientX, y: e.clientY });
                    }}
                  >
                    <div className="pin-grip" aria-hidden="true">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <a
                      href={b.url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pin-ico"
                      draggable={false}
                    >
                      <img
                        src={imageSrc}
                        alt=""
                        draggable={false}
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          if (img.dataset.fallback === "monogram") return;
                          img.dataset.fallback = "monogram";
                          img.src = monogramDataUri(b.url!);
                        }}
                      />
                    </a>
                    <div className="pin-meta">
                      <a
                        href={b.url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pin-title"
                        draggable={false}
                      >
                        {displayTitle}
                      </a>
                      <div className="pin-url" title={b.url}>
                        {b.url}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePin(b.id)}
                      className="pin-remove"
                      aria-label="Remove pin"
                    >
                      ×
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="zone">
          <div className="zone-head">
            <div className="zone-title">Todo</div>
          </div>
          <div className="todo-add">
            <input
              type="text"
              className="fld"
              placeholder="Add a task…"
              value={todoDraft}
              onChange={(e) => setTodoDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTodo();
              }}
            />
            <input
              type="text"
              className="fld fld--sub"
              placeholder="Subtitle (optional)"
              value={todoSubtitleDraft}
              onChange={(e) => setTodoSubtitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTodo();
              }}
            />
          </div>
          <div className="todo-list">
            {sortedTodos.length === 0 ? (
              <div className="text-xs text-[var(--faint)]">No tasks yet</div>
            ) : (
              sortedTodos.map((t) => {
                const isFocused = focusDesynced ? pillarTodoPins.includes(t.id) : !!t.focused;
                const focusRank = isFocused ? pillarTodoPins.indexOf(t.id) + 1 : undefined;
                return (
                <div
                  key={t.id}
                  className={`todo ${isFocused ? "todo--focus" : ""} ${t.done ? "todo--done" : ""} ${t.burning ? "todo--burning" : ""} ${t.blockStatus === "blocked" ? "italic" : ""}`}
                  data-focus-rank={focusRank}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setNotePopover({ id: t.id, x: e.clientX, y: e.clientY });
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleTodo(t.id)}
                    className={`cbox ${t.done ? "cbox--on" : ""}`}
                    aria-label={t.done ? "Mark incomplete" : "Mark done"}
                  >
                    {t.done ? (
                      <svg viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </button>
                  <div className="todo-main">
                    <div className="todo-row">
                      {t.burning && (
                        <span className="todo-burn" aria-label="Burning" title="Burning">🔥</span>
                      )}
                      {t.url ? (
                        <Link
                          href={t.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="todo-title"
                        >
                          {t.text}
                        </Link>
                      ) : (
                        <span className="todo-title">
                          {t.text}
                        </span>
                      )}
                      {t.url && (
                        <span className="todo-link" aria-hidden="true">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 13, height: 13 }}>
                            <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
                            <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
                          </svg>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const next = window.prompt("Link URL", t.url ?? "");
                          if (next !== null) setTodoUrl(t.id, next || undefined);
                        }}
                        className="todo-link-edit"
                        aria-label={t.url ? "Edit link" : "Add link"}
                        title={t.url ? "Edit link" : "Add link"}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                        </svg>
                      </button>
                    </div>
                    {t.tag ? (
                      <div>
                        <span className={`todo-tag ${tagClass(t.tag)}`}>{t.tag}</span>
                        {t.subtitle && (
                          <span className="todo-sub" style={{ marginLeft: 8, display: "inline" }}>
                            {truncateSubtitle(t.subtitle, 25)}
                          </span>
                        )}
                      </div>
                    ) : t.subtitle ? (
                      <div className="todo-sub">
                        {truncateSubtitle(t.subtitle, 25)}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTodo(t.id)}
                    className="todo-x"
                    aria-label="Remove task"
                  >
                    ×
                  </button>
                </div>
              );
              })
            )}
          </div>
        </div>

        <div className="zone">
          <div className="zone-head">
            <div className="zone-title">Visualization</div>
          </div>
          <div className="zone-hint">Visualize flow of your goals</div>
          <button
            type="button"
            onClick={() => onOpenVisualFlow?.()}
            className="ghost-btn ghost-btn--full"
            style={{ marginTop: 4 }}
          >
            Visual Flow of Action
          </button>
        </div>
      </div>
      {pinMenu && (() => {
        const b = byId.get(pinMenu.id);
        if (!b) return null;
        const override = pinOverrides?.[b.id];
        return (
          <div
            ref={pinMenuRef}
            className="popover"
            style={{
              left: Math.max(8, Math.min(pinMenu.x, window.innerWidth - 180)),
              top: Math.max(8, Math.min(pinMenu.y, window.innerHeight - 180)),
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="popover-item"
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
              className="popover-item"
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
                className="popover-item popover-item--muted"
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
              className="popover-item popover-item--muted"
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
            className={`note-popover${t.blockStatus === "blocked" ? " italic" : ""}`}
            style={{
              left: Math.max(8, Math.min(notePopover.x, window.innerWidth - 272)),
              top: Math.max(8, Math.min(notePopover.y, window.innerHeight - 180)),
            }}
          >
            <div className="note-popover-header">
              <span>Note: {t.text}</span>
              <div className="flex shrink-0 items-center gap-3">
                <label className="flex shrink-0 items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!t.burning}
                    onChange={() => toggleTodoBurning(t.id)}
                    className="h-3.5 w-3.5 rounded"
                    style={{ accentColor: "var(--hue-orange)" }}
                    aria-label="Mark task as burning"
                  />
                  <span style={{ fontSize: 10, color: "var(--muted)" }}>🔥 Burning</span>
                </label>
                {onSetPillarTodoPins && (
                  <label className="flex shrink-0 items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={focusDesynced ? pillarTodoPins.includes(t.id) : !!t.focused}
                      onChange={() => toggleTodoFocus(t.id)}
                      className="h-3.5 w-3.5 rounded"
                      style={{ accentColor: "var(--accent)" }}
                      aria-label="Focus task"
                    />
                    <span style={{ fontSize: 10, color: "var(--muted)" }}>Focus</span>
                  </label>
                )}
              </div>
            </div>
            <div className="note-popover-body">
              <input
                type="text"
                className="fld fld--sub"
                value={t.tag ?? ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTodoTag(t.id, e.target.value)}
                placeholder="Tag (optional)"
              />
              <input
                type="text"
                className="fld fld--sub"
                value={t.subtitle ?? ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTodoSubtitle(t.id, e.target.value)}
                placeholder="Subtitle (optional)"
              />
              {t.note?.trim() && !noteEditMode ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--fg-2)" }}>
                    <NoteContent
                      content={t.note}
                      onNoteChange={(newNote) => setTodoNote(t.id, newNote)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setNoteEditMode(true)}
                    style={{
                      alignSelf: "flex-start",
                      background: "none",
                      border: 0,
                      cursor: "pointer",
                      fontSize: 11,
                      color: "var(--dim)",
                      padding: 0,
                    }}
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
                  className="note-popover-textarea"
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

