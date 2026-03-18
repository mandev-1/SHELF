import { Input, Link, Surface } from "@heroui/react";
import { useMemo, useState } from "react";
import type { BookmarkTreeNode } from "../types/bookmarks";
import type { ShelfPillarTodoItem } from "../types/grid";

function faviconUrl(url: string) {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`;
  } catch {
    return "";
  }
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

export function Pillar({
  shelfName,
  tree,
  pinnedTop,
  onSetPinned,
  todos,
  onSetTodos,
}: {
  shelfName: string;
  tree: BookmarkTreeNode[] | null;
  pinnedTop: string[];
  onSetPinned: (next: { top: string[] }) => void;
  todos: ShelfPillarTodoItem[];
  onSetTodos: (next: ShelfPillarTodoItem[] | ((prev: ShelfPillarTodoItem[]) => ShelfPillarTodoItem[])) => void;
}) {
  const byId = useMemo(() => collectBookmarks(tree), [tree]);
  const [overZone, setOverZone] = useState<"top" | null>(null);
  const [todoDraft, setTodoDraft] = useState("");
  const [todoLinkDraft, setTodoLinkDraft] = useState("");

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
    const url = todoLinkDraft.trim() || undefined;
    onSetTodos((prev) => [...prev, { id: crypto.randomUUID(), text, done: false, url }]);
    setTodoDraft("");
    setTodoLinkDraft("");
  };

  const toggleTodo = (id: string) => {
    onSetTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const removeTodo = (id: string) => {
    onSetTodos((prev) => prev.filter((t) => t.id !== id));
  };

  const setTodoUrl = (id: string, url: string | undefined) => {
    onSetTodos((prev) => prev.map((t) => (t.id === id ? { ...t, url: url?.trim() || undefined } : t)));
  };

  return (
    <aside className="flex h-screen w-[280px] shrink-0 flex-col border-r border-white/10 bg-zinc-900/80">
      <div className="shrink-0 p-4">
        <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-300/70">Pillar</div>
        <div className="mt-1 truncate text-lg font-semibold text-white">{shelfName}</div>
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 pt-0">
      <Surface variant="secondary" className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4">

        <div
          className={`min-w-0 rounded-2xl border p-3 transition ${
            overZone === "top" ? "border-emerald-300/50 bg-emerald-400/10" : "border-white/10 bg-black/20"
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
              topNodes.map((b) => (
                <div key={b.id} className="group min-w-0 overflow-hidden rounded-2xl border border-emerald-400/15 bg-black/35 p-3">
                  <Link
                    href={b.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 items-center gap-3 no-underline"
                  >
                    <img src={faviconUrl(b.url!)} alt="" className="h-11 w-11 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="truncate text-sm font-semibold text-white group-hover:text-emerald-100">
                        {b.title || b.url}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-zinc-400">{b.url}</div>
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
              ))
            )}
          </div>
        </div>

        <div className="mt-3 min-w-0 rounded-2xl border border-white/10 bg-black/20 p-3">
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
              placeholder="Link (optional)"
              value={todoLinkDraft}
              onChange={(e) => setTodoLinkDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTodo();
              }}
              className="[--input-bg:theme(colors.white/0.05)] [--input-border:theme(colors.white/0.1)] text-xs"
            />
          </div>
          <div className="min-w-0 space-y-1">
            {todos.length === 0 ? (
              <div className="text-xs text-zinc-500">No tasks yet</div>
            ) : (
              todos.map((t) => (
                <div key={t.id} className="group flex min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/5">
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
              ))
            )}
          </div>
        </div>
      </Surface>
      </div>
    </aside>
  );
}

