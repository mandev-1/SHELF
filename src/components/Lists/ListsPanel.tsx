import { useEffect, useMemo, useRef, useState } from "react";
import type { ListItem, ListsState } from "../../types/lists";
import { ListValidationError, createLocalListBackend } from "./backend";
import { FilterError } from "./filter";
import * as engine from "./listsEngine";
import { itemSearchText } from "./schema";
import { ItemForm, draftFromValues, emptyDraft, type DraftValues } from "./ItemForm";
import { ItemViewSurface } from "./ItemViews";
import { FieldsEditor, ViewsEditor } from "./SchemaEditor";

export interface ListsPanelProps {
  lists: ListsState;
  onChange: (next: ListsState) => void;
}

type Tab = "items" | "fields" | "views";

const btn = "rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-zinc-200 disabled:opacity-40";
const dangerBtn = "rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-200 disabled:opacity-40";
const field = "w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600";

export function ListsPanel({ lists: state, onChange }: ListsPanelProps) {
  const [activeListId, setActiveListId] = useState<string | null>(state.lists[0]?.id ?? null);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("items");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [editingItemId, setEditingItemId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<DraftValues>({});
  const [renamingList, setRenamingList] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  // The backend reads through a ref so a handler never commits against a state
  // snapshot captured when the callback was created.
  const stateRef = useRef(state);
  stateRef.current = state;

  const backend = useMemo(
    () => createLocalListBackend({ getState: () => stateRef.current, setState: onChange }),
    [onChange],
  );

  /** Run a backend call, surfacing validation errors instead of throwing. */
  const run = (action: () => Promise<unknown>) => {
    setError(null);
    setFormErrors({});
    void action().catch((caught: unknown) => {
      if (caught instanceof ListValidationError) {
        setFormErrors(caught.errors);
        setError(caught.message);
        return;
      }
      setError(caught instanceof Error ? caught.message : String(caught));
    });
  };

  useEffect(() => {
    if (activeListId && state.lists.some((list) => list.id === activeListId)) return;
    setActiveListId(state.lists[0]?.id ?? null);
  }, [state.lists, activeListId]);

  const activeList = activeListId ? engine.getList(state, activeListId) : null;
  const activeView = activeList ? engine.getView(activeList, activeViewId ?? undefined) : null;

  // Reads run through the engine synchronously — the async backend is the write
  // path; awaiting it during render would mean an effect round-trip per keystroke.
  const queried = useMemo(() => {
    if (!activeList || !activeView) return { items: [] as ListItem[], total: 0, filterError: null as string | null };
    try {
      const result = engine.queryItems(state, activeList.id, { viewId: activeView.id });
      return { ...result, filterError: null };
    } catch (caught) {
      // A broken view filter shouldn't blank the tab: show everything and say why.
      const message = caught instanceof FilterError ? caught.message : "Invalid filter";
      return { items: engine.getItems(state, activeList.id), total: 0, filterError: message };
    }
  }, [state, activeList, activeView]);

  const visibleItems = useMemo(() => {
    if (!activeList || !search.trim()) return queried.items;
    const needle = search.trim().toLowerCase();
    return queried.items.filter((item) => itemSearchText(activeList, item, state).includes(needle));
  }, [queried.items, search, activeList, state]);

  const selection = useMemo(() => {
    if (!activeList) return [];
    const present = new Set(engine.getItems(state, activeList.id).map((item) => item.id));
    return selectedIds.filter((id) => present.has(id));
  }, [selectedIds, state, activeList]);

  const allVisibleSelected = visibleItems.length > 0 && visibleItems.every((item) => selection.includes(item.id));
  const canReorder = !search.trim() && !activeView?.filter?.trim() && !activeView?.sort?.length;

  const switchList = (listId: string) => {
    setActiveListId(listId);
    setActiveViewId(null);
    setSelectedIds([]);
    setEditingItemId(null);
    setSearch("");
    setError(null);
    setTab("items");
  };

  const openNewItem = () => {
    if (!activeList) return;
    setEditingItemId("new");
    setDraft(emptyDraft(activeList));
    setFormErrors({});
  };

  const openEditItem = (item: ListItem) => {
    if (!activeList) return;
    setEditingItemId(item.id);
    setDraft(draftFromValues(activeList, item.values));
    setFormErrors({});
  };

  const submitItem = () => {
    if (!activeList || !editingItemId) return;
    const action =
      editingItemId === "new"
        ? () => backend.createItem(activeList.id, draft)
        : () => backend.updateItem(activeList.id, editingItemId, draft);

    setError(null);
    setFormErrors({});
    void action()
      .then(() => setEditingItemId(null))
      .catch((caught: unknown) => {
        if (caught instanceof ListValidationError) {
          setFormErrors(caught.errors);
          return;
        }
        setError(caught instanceof Error ? caught.message : String(caught));
      });
  };

  const toggleSelect = (itemId: string) => {
    setSelectedIds((prev) => (prev.includes(itemId) ? prev.filter((entry) => entry !== itemId) : [...prev, itemId]));
  };

  const runOnSelection = (action: (listId: string, ids: string[]) => Promise<unknown>) => {
    if (!activeList || !selection.length) return;
    run(() => action(activeList.id, selection));
    setSelectedIds([]);
  };

  return (
    <div className="flex gap-4 text-sm text-zinc-100">
      {/* List rail */}
      <aside className="w-60 shrink-0 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Lists</div>
          <button type="button" className={btn} onClick={() => run(() => backend.createList({ name: "New list" }))}>
            New
          </button>
        </div>

        {state.lists.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 p-3 text-center text-xs text-zinc-500">No lists yet</div>
        ) : (
          <div className="space-y-1">
            {state.lists.map((list) => {
              const active = list.id === activeListId;
              const renaming = renamingList === list.id;
              const count = engine.getItems(state, list.id).length;

              return (
                <div key={list.id} className={`rounded-lg border p-2 ${active ? "border-emerald-400/40 bg-emerald-500/10" : "border-white/10 bg-white/[0.03]"}`}>
                  {renaming ? (
                    <input
                      autoFocus
                      className={field}
                      value={renameDraft}
                      onChange={(event) => setRenameDraft(event.target.value)}
                      onBlur={() => {
                        if (renameDraft.trim()) run(() => backend.updateList(list.id, { name: renameDraft }));
                        setRenamingList(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                        if (event.key === "Escape") setRenamingList(null);
                      }}
                    />
                  ) : (
                    <button type="button" className="flex w-full items-baseline justify-between gap-2 text-left" onClick={() => switchList(list.id)}>
                      <span className="truncate font-medium text-zinc-100">{list.name}</span>
                      <span className="text-[11px] text-zinc-500">{count}</span>
                    </button>
                  )}

                  {active && !renaming ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <button type="button" className="rounded border border-white/10 px-1.5 py-1 text-[11px] text-zinc-300" onClick={() => { setRenamingList(list.id); setRenameDraft(list.name); }}>Rename</button>
                      <button type="button" className="rounded border border-white/10 px-1.5 py-1 text-[11px] text-zinc-300" onClick={() => run(() => backend.duplicateList(list.id))}>Duplicate</button>
                      <button type="button" className="rounded border border-white/10 px-1.5 py-1 text-[11px] text-zinc-300" onClick={() => run(() => backend.moveList(list.id, -1))}>↑</button>
                      <button type="button" className="rounded border border-white/10 px-1.5 py-1 text-[11px] text-zinc-300" onClick={() => run(() => backend.moveList(list.id, 1))}>↓</button>
                      <button type="button" className="rounded border border-rose-400/30 px-1.5 py-1 text-[11px] text-rose-200" onClick={() => run(() => backend.deleteList(list.id))}>Delete</button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </aside>

      {/* Active list */}
      <section className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 p-3 shadow-sm">
        {!activeList || !activeView ? (
          <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-xs text-zinc-500">
            Create a list to get started
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-zinc-100">{activeList.name}</div>
                <div className="text-xs text-zinc-500">
                  {visibleItems.length} shown
                  {queried.total !== visibleItems.length ? ` of ${engine.getItems(state, activeList.id).length}` : ""}
                  {selection.length ? ` · ${selection.length} selected` : ""}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {(["items", "fields", "views"] as Tab[]).map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    className={`rounded-lg px-2.5 py-1.5 text-xs capitalize ${tab === entry ? "bg-white/10 text-zinc-100" : "text-zinc-400"}`}
                    onClick={() => setTab(entry)}
                  >
                    {entry}
                  </button>
                ))}
              </div>
            </div>

            {error ? (
              <div className="mb-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-200">{error}</div>
            ) : null}

            {tab === "fields" ? (
              <FieldsEditor list={activeList} state={state} backend={backend} run={run} />
            ) : tab === "views" ? (
              <ViewsEditor list={activeList} state={state} backend={backend} run={run} />
            ) : (
              <>
                {/* View switcher + search */}
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <select
                    className="rounded-lg border border-white/10 bg-zinc-950/60 px-2 py-1.5 text-xs text-zinc-200"
                    value={activeView.id}
                    onChange={(event) => { setActiveViewId(event.target.value); setSelectedIds([]); }}
                  >
                    {activeList.views.map((view) => (
                      <option key={view.id} value={view.id}>{view.name}</option>
                    ))}
                  </select>

                  <input
                    className="w-56 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600"
                    placeholder="Search this list…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />

                  <button type="button" className={btn} onClick={openNewItem}>New item</button>
                </div>

                {queried.filterError ? (
                  <div className="mb-3 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-200">
                    View filter ignored — {queried.filterError}
                  </div>
                ) : null}

                {/* Bulk actions */}
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={() => setSelectedIds(allVisibleSelected ? [] : visibleItems.map((item) => item.id))}
                    />
                    Select all shown
                  </label>

                  <button type="button" className={btn} disabled={!selection.length} onClick={() => runOnSelection((listId, ids) => backend.duplicateItems(listId, ids))}>
                    Duplicate
                  </button>

                  <select
                    className="rounded-lg border border-white/10 bg-zinc-950/60 px-2 py-1.5 text-xs text-zinc-200 disabled:opacity-40"
                    disabled={!selection.length || state.lists.length < 2}
                    value=""
                    onChange={(event) => {
                      const toListId = event.target.value;
                      if (toListId) runOnSelection((listId, ids) => backend.moveItemsToList(listId, toListId, ids));
                    }}
                  >
                    <option value="">Move to…</option>
                    {state.lists.filter((list) => list.id !== activeList.id).map((list) => (
                      <option key={list.id} value={list.id}>{list.name}</option>
                    ))}
                  </select>

                  <button type="button" className={dangerBtn} disabled={!selection.length} onClick={() => runOnSelection((listId, ids) => backend.deleteItems(listId, ids))}>
                    Delete
                  </button>
                </div>

                {/* Editor */}
                {editingItemId ? (
                  <div className="mb-3 rounded-lg border border-white/10 bg-zinc-950/30 p-3">
                    <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                      {editingItemId === "new" ? "New item" : "Edit item"}
                    </div>
                    <ItemForm
                      list={activeList}
                      state={state}
                      draft={draft}
                      errors={formErrors}
                      onChange={setDraft}
                      onSubmit={submitItem}
                      onCancel={() => setEditingItemId(null)}
                      submitLabel={editingItemId === "new" ? "Add item" : "Save item"}
                    />
                  </div>
                ) : null}

                {visibleItems.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-white/10 p-3 text-center text-xs text-zinc-500">
                    {engine.getItems(state, activeList.id).length === 0 ? "No items yet" : "Nothing matches the current view"}
                  </div>
                ) : (
                  <ItemViewSurface
                    list={activeList}
                    state={state}
                    view={activeView}
                    items={visibleItems}
                    selectedIds={selection}
                    onToggleSelect={toggleSelect}
                    onEdit={openEditItem}
                    onDuplicate={(itemId) => run(() => backend.duplicateItems(activeList.id, [itemId]))}
                    onDelete={(itemId) => run(() => backend.deleteItem(activeList.id, itemId))}
                    onMove={(itemId, direction) => run(() => backend.moveItem(activeList.id, itemId, direction))}
                    canReorder={canReorder}
                  />
                )}
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
