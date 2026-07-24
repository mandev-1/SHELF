import { useMemo, useState, type KeyboardEvent } from "react";
import type { DirectoryListItem } from "../../types/grid";

export interface DirectoryListProps {
  items: DirectoryListItem[];
  title?: string;
  emptyLabel?: string;
  onChange: (next: DirectoryListItem[]) => void;
  createItem?: (index: number) => DirectoryListItem;
}

export function DirectoryList({
  items,
  title = "Directory list",
  emptyLabel = "No items yet",
  onChange,
  createItem,
}: DirectoryListProps) {
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDescription, setEditingDescription] = useState("");

  const selectedCount = selectedIds.length;
  const allSelected = items.length > 0 && selectedIds.length === items.length;

  const commitCreate = () => {
    const title = draftTitle.trim();
    if (!title) return;

    const nextItem = createItem?.(items.length) ?? {
      id: crypto.randomUUID(),
      title,
      description: draftDescription.trim() || undefined,
    };

    onChange([...items, { ...nextItem, title, description: draftDescription.trim() || undefined }]);
    setDraftTitle("");
    setDraftDescription("");
    setSelectedIds([]);
  };

  const startEdit = (item: DirectoryListItem) => {
    setEditingId(item.id);
    setEditingTitle(item.title);
    setEditingDescription(item.description ?? "");
  };

  const saveEdit = () => {
    if (!editingId) return;
    const title = editingTitle.trim();
    if (!title) return;

    onChange(items.map((item) => (item.id === editingId ? { ...item, title, description: editingDescription.trim() || undefined } : item)));
    setEditingId(null);
    setEditingTitle("");
    setEditingDescription("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingTitle("");
    setEditingDescription("");
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(items.map((item) => item.id));
  };

  const removeItems = (ids?: string[]) => {
    const targetIds = ids ?? selectedIds;
    if (!targetIds.length) return;
    onChange(items.filter((item) => !targetIds.includes(item.id)));
    setSelectedIds([]);
  };

  const duplicateItems = (ids?: string[]) => {
    const targetIds = ids ?? selectedIds;
    if (!targetIds.length) return;

    const duplicates = targetIds.flatMap((id) => {
      const source = items.find((item) => item.id === id);
      if (!source) return [];
      return [{ ...source, id: crypto.randomUUID(), title: `${source.title} copy` }];
    });

    const nextItems = [...items];
    targetIds.forEach((id, index) => {
      const existingIndex = nextItems.findIndex((item) => item.id === id);
      if (existingIndex >= 0) {
        nextItems.splice(existingIndex + index + 1, 0, duplicates[index]);
      }
    });

    onChange(nextItems);
    setSelectedIds([]);
  };

  const moveItem = (id: string, direction: -1 | 1) => {
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return;

    const reordered = [...items];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved);
    onChange(reordered);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitCreate();
    }
  };

  const editorLabel = useMemo(() => (selectedCount > 0 ? `${selectedCount} selected` : "No selection"), [selectedCount]);

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-zinc-100 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">{title}</div>
          <div className="text-xs text-zinc-500">{editorLabel}</div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-zinc-200" onClick={() => duplicateItems()} disabled={!selectedIds.length}>
            Duplicate
          </button>
          <button type="button" className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-200" onClick={() => removeItems()} disabled={!selectedIds.length}>
            Delete
          </button>
        </div>
      </div>

      <div className="mb-3 rounded-lg border border-white/10 bg-zinc-950/30 p-2">
        <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-zinc-500">New item</div>
        <input
          className="mb-2 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-100 outline-none"
          placeholder="Item title"
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <textarea
          className="mb-2 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-100 outline-none"
          placeholder="Optional description"
          rows={2}
          value={draftDescription}
          onChange={(event) => setDraftDescription(event.target.value)}
        />
        <button type="button" className="rounded-lg bg-emerald-500/20 px-2.5 py-1.5 text-xs font-medium text-emerald-200" onClick={commitCreate}>
          Add item
        </button>
      </div>

      {items.length > 0 ? (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            Select all
          </label>
          {items.map((item) => {
            const selected = selectedIds.includes(item.id);
            const isEditing = editingId === item.id;

            return (
              <div key={item.id} className={`rounded-lg border p-2 ${selected ? "border-emerald-400/40 bg-emerald-500/10" : "border-white/10 bg-white/[0.03]"}`}>
                <div className="flex items-start gap-2">
                  <input type="checkbox" checked={selected} onChange={() => toggleSelection(item.id)} className="mt-1" />
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          className="w-full rounded-lg border border-white/10 bg-zinc-950/40 px-2 py-1.5 text-xs text-zinc-100 outline-none"
                          value={editingTitle}
                          onChange={(event) => setEditingTitle(event.target.value)}
                        />
                        <textarea
                          className="w-full rounded-lg border border-white/10 bg-zinc-950/40 px-2 py-1.5 text-xs text-zinc-100 outline-none"
                          rows={2}
                          value={editingDescription}
                          onChange={(event) => setEditingDescription(event.target.value)}
                        />
                        <div className="flex gap-2">
                          <button type="button" className="rounded-lg bg-emerald-500/20 px-2 py-1 text-xs text-emerald-200" onClick={saveEdit}>Save</button>
                          <button type="button" className="rounded-lg border border-white/10 px-2 py-1 text-xs text-zinc-200" onClick={cancelEdit}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="font-medium text-zinc-100">{item.title}</div>
                        {item.description ? <div className="mt-1 text-xs text-zinc-500">{item.description}</div> : null}
                      </>
                    )}
                  </div>
                  {!isEditing ? (
                    <div className="flex flex-col gap-1">
                      <button type="button" className="rounded border border-white/10 px-1.5 py-1 text-[11px] text-zinc-200" onClick={() => startEdit(item)}>
                        Edit
                      </button>
                      <button type="button" className="rounded border border-white/10 px-1.5 py-1 text-[11px] text-zinc-200" onClick={() => duplicateItems([item.id])}>
                        Duplicate
                      </button>
                      <button type="button" className="rounded border border-white/10 px-1.5 py-1 text-[11px] text-zinc-200" onClick={() => moveItem(item.id, -1)}>
                        ↑
                      </button>
                      <button type="button" className="rounded border border-white/10 px-1.5 py-1 text-[11px] text-zinc-200" onClick={() => moveItem(item.id, 1)}>
                        ↓
                      </button>
                      <button type="button" className="rounded border border-rose-400/30 px-1.5 py-1 text-[11px] text-rose-200" onClick={() => removeItems([item.id])}>
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-white/10 p-3 text-center text-xs text-zinc-500">{emptyLabel}</div>
      )}
    </section>
  );
}
