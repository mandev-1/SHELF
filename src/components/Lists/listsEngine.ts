// Pure transforms over ListsState. Nothing here touches storage or React —
// every function takes the whole state and returns the next state, so the
// backend facade can stay a thin persistence wrapper and the same operations
// remain usable from tests or a future remote implementation.

import {
  LOCAL_USER,
  type ContentType,
  type FieldDefinition,
  type FieldId,
  type ItemQuery,
  type ListDefinition,
  type ListId,
  type ListItem,
  type ListView,
  type ListsState,
  type QueryResult,
  type ViewId,
} from "../../types/lists";
import { compareItemsByField, evaluateFilter } from "./filter";
import { TITLE_FIELD_ID, createTitleField, defaultValueForField, validateValues } from "./schema";

export type EngineResult<T> =
  | { ok: true; state: ListsState; value: T }
  | { ok: false; errors: Record<string, string> };

function fail<T>(errors: Record<string, string>): EngineResult<T> {
  return { ok: false, errors };
}

function newId(): string {
  return crypto.randomUUID();
}

function stamp(): string {
  return new Date().toISOString();
}

function replaceList(state: ListsState, next: ListDefinition): ListsState {
  return { ...state, lists: state.lists.map((list) => (list.id === next.id ? next : list)) };
}

function touch(list: ListDefinition): ListDefinition {
  return { ...list, modifiedAt: stamp() };
}

/* ── Reads ─────────────────────────────────────────────────────────────── */

export function getList(state: ListsState, listId: ListId): ListDefinition | null {
  return state.lists.find((list) => list.id === listId) ?? null;
}

export function listLists(state: ListsState): ListDefinition[] {
  return state.lists;
}

export function getItems(state: ListsState, listId: ListId): ListItem[] {
  return state.items[listId] ?? [];
}

export function getItem(state: ListsState, listId: ListId, itemId: string): ListItem | null {
  return getItems(state, listId).find((item) => item.id === itemId) ?? null;
}

export function getView(list: ListDefinition, viewId?: ViewId): ListView | null {
  if (viewId) return list.views.find((view) => view.id === viewId) ?? null;
  return list.views.find((view) => view.id === list.defaultViewId) ?? list.views[0] ?? null;
}

/* ── Lists ─────────────────────────────────────────────────────────────── */

export interface CreateListInput {
  name: string;
  description?: string;
  scope?: ListDefinition["scope"];
  /** Extra fields beyond the built-in Title. */
  fields?: FieldDefinition[];
}

export function createDefaultView(fieldIds: FieldId[]): ListView {
  return { id: newId(), name: "All items", layout: "list", fieldIds };
}

export function createList(state: ListsState, input: CreateListInput): EngineResult<ListDefinition> {
  const name = input.name.trim();
  if (!name) return fail({ name: "List name is required" });

  const fields = [createTitleField(), ...(input.fields ?? []).filter((field) => field.id !== TITLE_FIELD_ID)];
  const view = createDefaultView(fields.map((field) => field.id));
  const now = stamp();

  const list: ListDefinition = {
    id: newId(),
    name,
    description: input.description?.trim() || undefined,
    fields,
    contentTypes: [],
    views: [view],
    defaultViewId: view.id,
    scope: input.scope ?? "personal",
    createdAt: now,
    modifiedAt: now,
  };

  return {
    ok: true,
    state: { ...state, lists: [...state.lists, list], items: { ...state.items, [list.id]: [] } },
    value: list,
  };
}

export type ListPatch = Partial<Pick<ListDefinition, "name" | "description" | "scope" | "defaultViewId">>;

export function updateList(state: ListsState, listId: ListId, patch: ListPatch): EngineResult<ListDefinition> {
  const list = getList(state, listId);
  if (!list) return fail({ listId: "List not found" });

  if (patch.name !== undefined && !patch.name.trim()) return fail({ name: "List name is required" });
  if (patch.defaultViewId && !list.views.some((view) => view.id === patch.defaultViewId)) {
    return fail({ defaultViewId: "View not found on this list" });
  }

  const next = touch({
    ...list,
    ...patch,
    name: patch.name?.trim() ?? list.name,
    description: patch.description !== undefined ? patch.description.trim() || undefined : list.description,
  });

  return { ok: true, state: replaceList(state, next), value: next };
}

export function deleteList(state: ListsState, listId: ListId): ListsState {
  const items = { ...state.items };
  delete items[listId];
  return { ...state, lists: state.lists.filter((list) => list.id !== listId), items };
}

export function duplicateList(state: ListsState, listId: ListId): EngineResult<ListDefinition> {
  const list = getList(state, listId);
  if (!list) return fail({ listId: "List not found" });

  const now = stamp();
  const viewIdMap = new Map(list.views.map((view) => [view.id, newId()]));
  const copy: ListDefinition = {
    ...list,
    id: newId(),
    name: `${list.name} copy`,
    fields: list.fields.map((field) => ({ ...field })),
    contentTypes: list.contentTypes.map((ct) => ({ ...ct, fieldIds: [...ct.fieldIds] })),
    views: list.views.map((view) => ({ ...view, id: viewIdMap.get(view.id) ?? newId(), fieldIds: [...view.fieldIds] })),
    defaultViewId: list.defaultViewId ? viewIdMap.get(list.defaultViewId) : undefined,
    createdAt: now,
    modifiedAt: now,
  };

  const copiedItems = getItems(state, listId).map((item) => ({
    ...item,
    id: newId(),
    listId: copy.id,
    values: { ...item.values },
  }));

  const index = state.lists.findIndex((entry) => entry.id === listId);
  const lists = [...state.lists];
  lists.splice(index + 1, 0, copy);

  return { ok: true, state: { ...state, lists, items: { ...state.items, [copy.id]: copiedItems } }, value: copy };
}

export function moveList(state: ListsState, listId: ListId, direction: -1 | 1): ListsState {
  const index = state.lists.findIndex((list) => list.id === listId);
  if (index < 0) return state;
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= state.lists.length) return state;

  const lists = [...state.lists];
  const [moved] = lists.splice(index, 1);
  lists.splice(nextIndex, 0, moved);
  return { ...state, lists };
}

/* ── Schema: fields ────────────────────────────────────────────────────── */

export function addField(state: ListsState, listId: ListId, field: FieldDefinition): EngineResult<ListDefinition> {
  const list = getList(state, listId);
  if (!list) return fail({ listId: "List not found" });
  if (!field.id.trim()) return fail({ id: "Field id is required" });
  if (!field.displayName.trim()) return fail({ displayName: "Field name is required" });
  if (list.fields.some((existing) => existing.id === field.id)) return fail({ id: `A field called ${field.id} already exists` });
  if (field.type === "choice" && !field.choices?.length) return fail({ choices: "Choice fields need at least one option" });
  if (field.type === "lookup" && !field.lookupListId) return fail({ lookupListId: "Pick the list this field looks up" });

  // New fields join every view that shows all current fields, so a freshly
  // added column doesn't silently go missing from the default view.
  const views = list.views.map((view) =>
    view.fieldIds.length === list.fields.length ? { ...view, fieldIds: [...view.fieldIds, field.id] } : view,
  );

  const next = touch({ ...list, fields: [...list.fields, field], views });
  return { ok: true, state: replaceList(state, next), value: next };
}

export type FieldPatch = Partial<Omit<FieldDefinition, "id">>;

export function updateField(state: ListsState, listId: ListId, fieldId: FieldId, patch: FieldPatch): EngineResult<ListDefinition> {
  const list = getList(state, listId);
  if (!list) return fail({ listId: "List not found" });

  const field = list.fields.find((entry) => entry.id === fieldId);
  if (!field) return fail({ fieldId: "Field not found" });
  if (field.system && patch.type && patch.type !== field.type) return fail({ type: "Built-in fields cannot change type" });
  if (field.system && patch.required === false) return fail({ required: "Built-in fields stay required" });
  if (patch.displayName !== undefined && !patch.displayName.trim()) return fail({ displayName: "Field name is required" });

  const merged: FieldDefinition = {
    ...field,
    ...patch,
    id: field.id,
    displayName: patch.displayName?.trim() ?? field.displayName,
  };

  if (merged.type === "choice" && !merged.choices?.length) return fail({ choices: "Choice fields need at least one option" });

  const next = touch({ ...list, fields: list.fields.map((entry) => (entry.id === fieldId ? merged : entry)) });
  return { ok: true, state: replaceList(state, next), value: next };
}

/** Drops the field from the schema, from every view and content type, and
 *  strips its values off existing items so no orphan data is left behind. */
export function removeField(state: ListsState, listId: ListId, fieldId: FieldId): EngineResult<ListDefinition> {
  const list = getList(state, listId);
  if (!list) return fail({ listId: "List not found" });

  const field = list.fields.find((entry) => entry.id === fieldId);
  if (!field) return fail({ fieldId: "Field not found" });
  if (field.system) return fail({ fieldId: "Built-in fields cannot be removed" });

  const next = touch({
    ...list,
    fields: list.fields.filter((entry) => entry.id !== fieldId),
    contentTypes: list.contentTypes.map((ct) => ({ ...ct, fieldIds: ct.fieldIds.filter((id) => id !== fieldId) })),
    views: list.views.map((view) => ({
      ...view,
      fieldIds: view.fieldIds.filter((id) => id !== fieldId),
      sort: view.sort?.filter((entry) => entry.fieldId !== fieldId),
      groupByFieldId: view.groupByFieldId === fieldId ? undefined : view.groupByFieldId,
      dateFieldId: view.dateFieldId === fieldId ? undefined : view.dateFieldId,
    })),
  });

  const strippedItems = getItems(state, listId).map((item) => {
    if (!(fieldId in item.values)) return item;
    const values = { ...item.values };
    delete values[fieldId];
    return { ...item, values };
  });

  return {
    ok: true,
    state: { ...replaceList(state, next), items: { ...state.items, [listId]: strippedItems } },
    value: next,
  };
}

export function moveField(state: ListsState, listId: ListId, fieldId: FieldId, direction: -1 | 1): ListsState {
  const list = getList(state, listId);
  if (!list) return state;

  const index = list.fields.findIndex((field) => field.id === fieldId);
  if (index < 0) return state;
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= list.fields.length) return state;

  const fields = [...list.fields];
  const [moved] = fields.splice(index, 1);
  fields.splice(nextIndex, 0, moved);
  return replaceList(state, touch({ ...list, fields }));
}

/* ── Schema: content types ─────────────────────────────────────────────── */

export function addContentType(state: ListsState, listId: ListId, contentType: ContentType): EngineResult<ListDefinition> {
  const list = getList(state, listId);
  if (!list) return fail({ listId: "List not found" });
  if (!contentType.name.trim()) return fail({ name: "Content type name is required" });
  if (list.contentTypes.some((ct) => ct.id === contentType.id)) return fail({ id: "Content type already exists here" });

  const unknownField = contentType.fieldIds.find((id) => !list.fields.some((field) => field.id === id));
  if (unknownField) return fail({ fieldIds: `Unknown field ${unknownField}` });

  const next = touch({ ...list, contentTypes: [...list.contentTypes, contentType] });
  return { ok: true, state: replaceList(state, next), value: next };
}

/** Copy a content type defined on another list onto this one, bringing any
 *  field definitions it needs that this list doesn't have yet. */
export function attachContentType(state: ListsState, listId: ListId, contentTypeId: string): EngineResult<ListDefinition> {
  const list = getList(state, listId);
  if (!list) return fail({ listId: "List not found" });
  if (list.contentTypes.some((ct) => ct.id === contentTypeId)) return fail({ contentTypeId: "Already attached" });

  const source = state.lists.find((entry) => entry.contentTypes.some((ct) => ct.id === contentTypeId));
  const contentType = source?.contentTypes.find((ct) => ct.id === contentTypeId);
  if (!source || !contentType) return fail({ contentTypeId: "Content type not found" });

  const missingFields = contentType.fieldIds
    .filter((id) => !list.fields.some((field) => field.id === id))
    .map((id) => source.fields.find((field) => field.id === id))
    .filter((field): field is FieldDefinition => !!field)
    .map((field) => ({ ...field, system: false }));

  const next = touch({
    ...list,
    fields: [...list.fields, ...missingFields],
    contentTypes: [...list.contentTypes, { ...contentType, fieldIds: [...contentType.fieldIds] }],
  });

  return { ok: true, state: replaceList(state, next), value: next };
}

export function removeContentType(state: ListsState, listId: ListId, contentTypeId: string): ListsState {
  const list = getList(state, listId);
  if (!list) return state;
  return replaceList(state, touch({ ...list, contentTypes: list.contentTypes.filter((ct) => ct.id !== contentTypeId) }));
}

/* ── Schema: views ─────────────────────────────────────────────────────── */

/** Adds the view, or replaces the existing one with the same id. */
export function defineView(state: ListsState, listId: ListId, view: ListView): EngineResult<ListDefinition> {
  const list = getList(state, listId);
  if (!list) return fail({ listId: "List not found" });
  if (!view.name.trim()) return fail({ name: "View name is required" });

  const unknownField = view.fieldIds.find((id) => !list.fields.some((field) => field.id === id));
  if (unknownField) return fail({ fieldIds: `Unknown field ${unknownField}` });

  const exists = list.views.some((entry) => entry.id === view.id);
  const views = exists ? list.views.map((entry) => (entry.id === view.id ? view : entry)) : [...list.views, view];

  const next = touch({ ...list, views, defaultViewId: list.defaultViewId ?? view.id });
  return { ok: true, state: replaceList(state, next), value: next };
}

export function removeView(state: ListsState, listId: ListId, viewId: ViewId): EngineResult<ListDefinition> {
  const list = getList(state, listId);
  if (!list) return fail({ listId: "List not found" });
  if (list.views.length <= 1) return fail({ viewId: "A list needs at least one view" });

  const views = list.views.filter((view) => view.id !== viewId);
  const next = touch({
    ...list,
    views,
    defaultViewId: list.defaultViewId === viewId ? views[0]?.id : list.defaultViewId,
  });

  return { ok: true, state: replaceList(state, next), value: next };
}

/* ── Items ─────────────────────────────────────────────────────────────── */

export function createItem(
  state: ListsState,
  listId: ListId,
  values: Record<FieldId, unknown>,
  author = LOCAL_USER,
): EngineResult<ListItem> {
  const list = getList(state, listId);
  if (!list) return fail({ listId: "List not found" });

  const outcome = validateValues(list, values);
  if (!outcome.ok) return fail(outcome.errors);

  const now = stamp();
  const item: ListItem = {
    id: newId(),
    listId,
    values: outcome.values,
    createdBy: author,
    createdAt: now,
    modifiedBy: author,
    modifiedAt: now,
  };

  return {
    ok: true,
    state: { ...state, items: { ...state.items, [listId]: [...getItems(state, listId), item] } },
    value: item,
  };
}

/** Partial update: unmentioned fields keep their current values. */
export function updateItem(
  state: ListsState,
  listId: ListId,
  itemId: string,
  patch: Record<FieldId, unknown>,
  author = LOCAL_USER,
): EngineResult<ListItem> {
  const list = getList(state, listId);
  if (!list) return fail({ listId: "List not found" });

  const existing = getItem(state, listId, itemId);
  if (!existing) return fail({ itemId: "Item not found" });

  const outcome = validateValues(list, { ...existing.values, ...patch });
  if (!outcome.ok) return fail(outcome.errors);

  const next: ListItem = { ...existing, values: outcome.values, modifiedBy: author, modifiedAt: stamp() };

  return {
    ok: true,
    state: {
      ...state,
      items: { ...state.items, [listId]: getItems(state, listId).map((item) => (item.id === itemId ? next : item)) },
    },
    value: next,
  };
}

export function deleteItem(state: ListsState, listId: ListId, itemId: string): ListsState {
  return { ...state, items: { ...state.items, [listId]: getItems(state, listId).filter((item) => item.id !== itemId) } };
}

export function deleteItems(state: ListsState, listId: ListId, itemIds: string[]): ListsState {
  if (!itemIds.length) return state;
  const target = new Set(itemIds);
  return { ...state, items: { ...state.items, [listId]: getItems(state, listId).filter((item) => !target.has(item.id)) } };
}

/** Each copy lands directly after its source, so multi-select duplication keeps
 *  copies adjacent regardless of how many items precede them. */
export function duplicateItems(state: ListsState, listId: ListId, itemIds: string[], author = LOCAL_USER): ListsState {
  if (!itemIds.length) return state;
  const target = new Set(itemIds);
  const now = stamp();

  const items = getItems(state, listId).flatMap((item) =>
    target.has(item.id)
      ? [
          item,
          {
            ...item,
            id: newId(),
            values: { ...item.values, [TITLE_FIELD_ID]: `${item.values[TITLE_FIELD_ID] ?? "Untitled"} copy` },
            createdBy: author,
            createdAt: now,
            modifiedBy: author,
            modifiedAt: now,
          },
        ]
      : [item],
  );

  return { ...state, items: { ...state.items, [listId]: items } };
}

export function moveItem(state: ListsState, listId: ListId, itemId: string, direction: -1 | 1): ListsState {
  const items = getItems(state, listId);
  const index = items.findIndex((item) => item.id === itemId);
  if (index < 0) return state;
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return state;

  const next = [...items];
  const [moved] = next.splice(index, 1);
  next.splice(nextIndex, 0, moved);
  return { ...state, items: { ...state.items, [listId]: next } };
}

/** Move items to another list, keeping only the values whose field ids exist on
 *  the destination schema. Values that don't fit are dropped, not coerced. */
export function moveItemsToList(
  state: ListsState,
  fromListId: ListId,
  toListId: ListId,
  itemIds: string[],
  author = LOCAL_USER,
): EngineResult<ListItem[]> {
  if (fromListId === toListId) return fail({ toListId: "Pick a different list" });

  const target = getList(state, toListId);
  if (!target) return fail({ toListId: "List not found" });

  const ids = new Set(itemIds);
  const moving = getItems(state, fromListId).filter((item) => ids.has(item.id));
  if (!moving.length) return fail({ itemIds: "Nothing to move" });

  const now = stamp();
  const migrated = moving.map((item) => {
    const values: Record<FieldId, unknown> = {};
    for (const field of target.fields) {
      if (item.values[field.id] !== undefined) values[field.id] = item.values[field.id];
      else if (field.required) values[field.id] = defaultValueForField(field);
    }
    if (!values[TITLE_FIELD_ID]) values[TITLE_FIELD_ID] = item.values[TITLE_FIELD_ID] ?? "Untitled";
    return { ...item, listId: toListId, values, modifiedBy: author, modifiedAt: now };
  });

  return {
    ok: true,
    state: {
      ...state,
      items: {
        ...state.items,
        [fromListId]: getItems(state, fromListId).filter((item) => !ids.has(item.id)),
        [toListId]: [...getItems(state, toListId), ...migrated],
      },
    },
    value: migrated,
  };
}

/* ── Query ─────────────────────────────────────────────────────────────── */

/** Applies the view baseline (filter, sort, projection) then the query's own
 *  filter/sort/projection, then paging. Throws FilterError on a bad expression. */
export function queryItems(state: ListsState, listId: ListId, query: ItemQuery = {}): QueryResult {
  const list = getList(state, listId);
  if (!list) return { items: [], total: 0 };

  const view = query.viewId ? getView(list, query.viewId) : null;
  const filters = [view?.filter, query.filter].filter((expression): expression is string => !!expression?.trim());

  let items = getItems(state, listId);
  for (const expression of filters) {
    items = items.filter((item) => evaluateFilter(expression, item));
  }

  const total = items.length;

  const orderBy = query.orderBy?.length ? query.orderBy : view?.sort;
  if (orderBy?.length) {
    const fieldsById = new Map(list.fields.map((field) => [field.id, field]));
    items = [...items].sort((a, b) => {
      for (const entry of orderBy) {
        const ordering = compareItemsByField(a, b, entry.fieldId, entry.direction, fieldsById.get(entry.fieldId));
        if (ordering !== 0) return ordering;
      }
      return 0;
    });
  }

  const skip = Math.max(0, query.skip ?? 0);
  const take = query.take ?? view?.pageSize;
  if (skip || take !== undefined) {
    items = items.slice(skip, take === undefined ? undefined : skip + take);
  }

  const select = query.select?.length ? query.select : view?.fieldIds;
  if (query.select?.length) {
    const keep = new Set(select);
    items = items.map((item) => {
      const values: Record<FieldId, unknown> = {};
      for (const key of Object.keys(item.values)) {
        if (keep.has(key)) values[key] = item.values[key];
      }
      return { ...item, values };
    });
  }

  return { items, total };
}
