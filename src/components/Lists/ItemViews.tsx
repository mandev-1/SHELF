// Layout renderers for a view's result set. Each takes the same props so the
// panel can swap layouts without knowing anything about how they draw.

import type { ListDefinition, ListItem, ListView, ListsState } from "../../types/lists";
import { TITLE_FIELD_ID, displayTitle, formatFieldValue } from "./schema";

export interface ItemViewProps {
  list: ListDefinition;
  state: ListsState;
  view: ListView;
  items: ListItem[];
  selectedIds: string[];
  onToggleSelect: (itemId: string) => void;
  onEdit: (item: ListItem) => void;
  onDuplicate: (itemId: string) => void;
  onDelete: (itemId: string) => void;
  onMove: (itemId: string, direction: -1 | 1) => void;
  /** Reordering is meaningless while a filter or search hides neighbours. */
  canReorder: boolean;
}

const actionButton = "rounded border border-white/10 px-1.5 py-1 text-[11px] text-zinc-200";
const dangerButton = "rounded border border-rose-400/30 px-1.5 py-1 text-[11px] text-rose-200";

function RowActions({ item, onEdit, onDuplicate, onDelete, onMove, canReorder }: Pick<ItemViewProps, "onEdit" | "onDuplicate" | "onDelete" | "onMove" | "canReorder"> & { item: ListItem }) {
  return (
    <div className="flex flex-col gap-1">
      <button type="button" className={actionButton} onClick={() => onEdit(item)}>Edit</button>
      <button type="button" className={actionButton} onClick={() => onDuplicate(item.id)}>Duplicate</button>
      {canReorder ? (
        <>
          <button type="button" className={actionButton} onClick={() => onMove(item.id, -1)}>↑</button>
          <button type="button" className={actionButton} onClick={() => onMove(item.id, 1)}>↓</button>
        </>
      ) : null}
      <button type="button" className={dangerButton} onClick={() => onDelete(item.id)}>Delete</button>
    </div>
  );
}

/** Renders a value with type-appropriate affordances (links, done styling). */
function FieldValue({ list, state, item, fieldId }: { list: ListDefinition; state: ListsState; item: ListItem; fieldId: string }) {
  const definition = list.fields.find((entry) => entry.id === fieldId);
  if (!definition) return null;

  const raw = item.values[fieldId];
  const text = formatFieldValue(definition, raw, state);
  if (!text) return <span className="text-zinc-600">—</span>;

  if (definition.type === "url") {
    return (
      <a href={String(raw)} target="_blank" rel="noreferrer" className="truncate text-sky-300 hover:underline">
        {text}
      </a>
    );
  }

  if (definition.type === "text" && definition.multiple) {
    return (
      <span className="flex flex-wrap gap-1">
        {(Array.isArray(raw) ? raw : [raw]).map((entry, index) => (
          <span key={`${String(entry)}-${index}`} className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-400">
            {String(entry)}
          </span>
        ))}
      </span>
    );
  }

  return <span className="text-zinc-300">{text}</span>;
}

/* ── list ──────────────────────────────────────────────────────────────── */

export function ListLayout(props: ItemViewProps) {
  const { list, state, view, items, selectedIds, onToggleSelect } = props;
  const secondaryFieldIds = view.fieldIds.filter((fieldId) => fieldId !== TITLE_FIELD_ID);

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const selected = selectedIds.includes(item.id);
        return (
          <div key={item.id} className={`rounded-lg border p-2 ${selected ? "border-emerald-400/40 bg-emerald-500/10" : "border-white/10 bg-white/[0.03]"}`}>
            <div className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={selected} onChange={() => onToggleSelect(item.id)} />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-zinc-100">{displayTitle(list, item)}</div>
                <div className="mt-1 space-y-1">
                  {secondaryFieldIds.map((fieldId) => {
                    const definition = list.fields.find((entry) => entry.id === fieldId);
                    if (!definition) return null;
                    return (
                      <div key={fieldId} className="flex gap-2 text-xs">
                        <span className="shrink-0 text-zinc-600">{definition.displayName}</span>
                        <FieldValue list={list} state={state} item={item} fieldId={fieldId} />
                      </div>
                    );
                  })}
                </div>
              </div>
              <RowActions item={item} {...props} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── grid ──────────────────────────────────────────────────────────────── */

export function GridLayout(props: ItemViewProps) {
  const { list, state, view, items, selectedIds, onToggleSelect } = props;

  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full min-w-max text-left text-xs">
        <thead className="bg-white/5 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
          <tr>
            <th className="w-8 px-2 py-2" />
            {view.fieldIds.map((fieldId) => (
              <th key={fieldId} className="px-2 py-2 font-medium">
                {list.fields.find((entry) => entry.id === fieldId)?.displayName ?? fieldId}
              </th>
            ))}
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const selected = selectedIds.includes(item.id);
            return (
              <tr key={item.id} className={`border-t border-white/5 ${selected ? "bg-emerald-500/10" : ""}`}>
                <td className="px-2 py-2 align-top">
                  <input type="checkbox" checked={selected} onChange={() => onToggleSelect(item.id)} />
                </td>
                {view.fieldIds.map((fieldId) => (
                  <td key={fieldId} className="max-w-xs px-2 py-2 align-top">
                    <FieldValue list={list} state={state} item={item} fieldId={fieldId} />
                  </td>
                ))}
                <td className="px-2 py-2 align-top">
                  <div className="flex gap-1">
                    <button type="button" className={actionButton} onClick={() => props.onEdit(item)}>Edit</button>
                    <button type="button" className={dangerButton} onClick={() => props.onDelete(item.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── gallery ───────────────────────────────────────────────────────────── */

export function GalleryLayout(props: ItemViewProps) {
  const { list, state, view, items, selectedIds, onToggleSelect } = props;
  const secondaryFieldIds = view.fieldIds.filter((fieldId) => fieldId !== TITLE_FIELD_ID);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const selected = selectedIds.includes(item.id);
        return (
          <div key={item.id} className={`rounded-xl border p-3 ${selected ? "border-emerald-400/40 bg-emerald-500/10" : "border-white/10 bg-white/[0.03]"}`}>
            <div className="mb-2 flex items-start justify-between gap-2">
              <label className="flex min-w-0 items-start gap-2">
                <input type="checkbox" className="mt-1" checked={selected} onChange={() => onToggleSelect(item.id)} />
                <span className="truncate font-medium text-zinc-100">{displayTitle(list, item)}</span>
              </label>
            </div>

            <div className="space-y-1">
              {secondaryFieldIds.map((fieldId) => (
                <div key={fieldId} className="flex gap-2 text-xs">
                  <span className="shrink-0 text-zinc-600">{list.fields.find((entry) => entry.id === fieldId)?.displayName ?? fieldId}</span>
                  <FieldValue list={list} state={state} item={item} fieldId={fieldId} />
                </div>
              ))}
            </div>

            <div className="mt-3 flex gap-1">
              <button type="button" className={actionButton} onClick={() => props.onEdit(item)}>Edit</button>
              <button type="button" className={actionButton} onClick={() => props.onDuplicate(item.id)}>Duplicate</button>
              <button type="button" className={dangerButton} onClick={() => props.onDelete(item.id)}>Delete</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── calendar ──────────────────────────────────────────────────────────── */

/** Buckets items by day using the view's date field, newest bucket first.
 *  Items with no date collect under "No date". */
export function CalendarLayout(props: ItemViewProps) {
  const { list, state, view, items, selectedIds, onToggleSelect } = props;

  const dateFieldId = view.dateFieldId ?? list.fields.find((entry) => entry.type === "dateTime")?.id;

  if (!dateFieldId) {
    return (
      <div className="rounded-lg border border-dashed border-white/10 p-4 text-center text-xs text-zinc-500">
        Calendar layout needs a date field. Add one in Fields, then pick it in this view.
      </div>
    );
  }

  const buckets = new Map<string, ListItem[]>();
  for (const item of items) {
    const raw = item.values[dateFieldId];
    const parsed = raw ? new Date(String(raw)) : null;
    const key = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : "";
    buckets.set(key, [...(buckets.get(key) ?? []), item]);
  }

  const keys = [...buckets.keys()].sort((a, b) => {
    if (!a) return 1;
    if (!b) return -1;
    return a < b ? 1 : a > b ? -1 : 0;
  });

  return (
    <div className="space-y-3">
      {keys.map((key) => (
        <div key={key || "none"} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
          <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
            {key ? new Date(key).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "No date"}
          </div>
          <div className="space-y-1">
            {(buckets.get(key) ?? []).map((item) => (
              <div key={item.id} className="flex items-center gap-2 rounded border border-white/10 bg-zinc-950/30 px-2 py-1.5">
                <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => onToggleSelect(item.id)} />
                <button type="button" className="min-w-0 flex-1 truncate text-left text-xs text-zinc-200" onClick={() => props.onEdit(item)}>
                  {displayTitle(list, item)}
                </button>
                <FieldValue list={list} state={state} item={item} fieldId={dateFieldId} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ItemViewSurface(props: ItemViewProps) {
  switch (props.view.layout) {
    case "grid":
      return <GridLayout {...props} />;
    case "gallery":
      return <GalleryLayout {...props} />;
    case "calendar":
      return <CalendarLayout {...props} />;
    case "list":
    default:
      return <ListLayout {...props} />;
  }
}
