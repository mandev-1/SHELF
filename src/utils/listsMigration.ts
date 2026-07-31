// Normalizes whatever is sitting under the `shelf-lists` key into ListsState.
//
// Three shapes have existed:
//   v0  DirectoryListItem[]            — one flat, unnamed list
//   v1  DirectoryList[]                — named containers of fixed-shape items
//   v2  ListsState                     — schema-driven lists (current)
//
// v0/v1 are lifted into v2 by synthesizing the schema their fixed fields imply,
// so nothing a user typed is lost. Migration is transparent: the next write
// persists the v2 shape.

import {
  emptyListsState,
  LOCAL_USER,
  type ContentType,
  type FieldDefinition,
  type FieldId,
  type ListDefinition,
  type ListItem,
  type ListView,
  type ListsState,
  type ViewLayout,
} from "../types/lists";

const LEGACY_FIELD_IDS = {
  title: "Title",
  description: "Description",
  url: "Url",
  tags: "Tags",
  done: "Done",
} as const;

const VIEW_LAYOUTS: ViewLayout[] = ["list", "grid", "gallery", "calendar"];
const FIELD_TYPES: FieldDefinition["type"][] = [
  "text", "number", "choice", "boolean", "dateTime", "user", "lookup", "url", "attachment", "json",
];

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function id(value: unknown): string {
  return typeof value === "string" && value ? value : crypto.randomUUID();
}

function stamp(value: unknown): string {
  return typeof value === "string" && value ? value : new Date().toISOString();
}

/** The schema a v0/v1 item implies: the fields those shapes always carried. */
function legacyFields(): FieldDefinition[] {
  return [
    { id: LEGACY_FIELD_IDS.title, displayName: "Title", type: "text", required: true, system: true },
    { id: LEGACY_FIELD_IDS.description, displayName: "Description", type: "text", multiline: true },
    { id: LEGACY_FIELD_IDS.url, displayName: "Link", type: "url" },
    { id: LEGACY_FIELD_IDS.tags, displayName: "Tags", type: "text", multiple: true },
    { id: LEGACY_FIELD_IDS.done, displayName: "Done", type: "boolean" },
  ];
}

function legacyItem(raw: unknown, listId: string): ListItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const title = str(o.title);
  if (!title) return null;

  const values: Record<FieldId, unknown> = { [LEGACY_FIELD_IDS.title]: title };
  const description = str(o.description);
  if (description) values[LEGACY_FIELD_IDS.description] = description;
  const url = str(o.url);
  if (url) values[LEGACY_FIELD_IDS.url] = url;
  const tags = Array.isArray(o.tags) ? o.tags.map(str).filter((tag): tag is string => !!tag) : [];
  if (tags.length) values[LEGACY_FIELD_IDS.tags] = tags;
  if (o.done === true) values[LEGACY_FIELD_IDS.done] = true;

  const createdAt = stamp(o.createdAt);
  return {
    id: id(o.id),
    listId,
    values,
    createdBy: LOCAL_USER,
    createdAt,
    modifiedBy: LOCAL_USER,
    modifiedAt: typeof o.updatedAt === "string" ? o.updatedAt : createdAt,
  };
}

function legacyList(name: string, rawItems: unknown[], meta?: Record<string, unknown>): { list: ListDefinition; items: ListItem[] } {
  const listId = id(meta?.id);
  const fields = legacyFields();
  const createdAt = stamp(meta?.createdAt);

  const view: ListView = {
    id: crypto.randomUUID(),
    name: "All items",
    layout: "list",
    fieldIds: fields.map((field) => field.id),
  };

  const list: ListDefinition = {
    id: listId,
    name,
    fields,
    contentTypes: [],
    views: [view],
    defaultViewId: view.id,
    scope: "personal",
    createdAt,
    modifiedAt: typeof meta?.updatedAt === "string" ? meta.updatedAt : createdAt,
  };

  const items = rawItems.map((raw) => legacyItem(raw, listId)).filter((item): item is ListItem => !!item);
  return { list, items };
}

/* ── v2 validation ─────────────────────────────────────────────────────── */

function normalizeField(raw: unknown): FieldDefinition | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const fieldId = str(o.id);
  const type = FIELD_TYPES.find((candidate) => candidate === o.type);
  if (!fieldId || !type) return null;

  const choices = Array.isArray(o.choices) ? o.choices.map(str).filter((choice): choice is string => !!choice) : undefined;

  return {
    id: fieldId,
    displayName: str(o.displayName) ?? fieldId,
    type,
    required: o.required === true || undefined,
    multiple: o.multiple === true || undefined,
    defaultValue: o.defaultValue,
    choices: choices?.length ? choices : undefined,
    min: typeof o.min === "number" ? o.min : undefined,
    max: typeof o.max === "number" ? o.max : undefined,
    maxLength: typeof o.maxLength === "number" ? o.maxLength : undefined,
    multiline: o.multiline === true || undefined,
    lookupListId: str(o.lookupListId),
    lookupFieldId: str(o.lookupFieldId),
    validationRule: str(o.validationRule),
    validationMessage: str(o.validationMessage),
    system: o.system === true || undefined,
  };
}

function normalizeView(raw: unknown, knownFieldIds: Set<string>): ListView | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const layout = VIEW_LAYOUTS.find((candidate) => candidate === o.layout) ?? "list";
  const fieldIds = Array.isArray(o.fieldIds)
    ? o.fieldIds.map(str).filter((entry): entry is string => !!entry && knownFieldIds.has(entry))
    : [];

  const sort = Array.isArray(o.sort)
    ? o.sort
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null;
          const s = entry as Record<string, unknown>;
          const fieldId = str(s.fieldId);
          if (!fieldId || !knownFieldIds.has(fieldId)) return null;
          return { fieldId, direction: s.direction === "desc" ? ("desc" as const) : ("asc" as const) };
        })
        .filter((entry): entry is { fieldId: string; direction: "asc" | "desc" } => !!entry)
    : undefined;

  const groupByFieldId = str(o.groupByFieldId);
  const dateFieldId = str(o.dateFieldId);

  return {
    id: id(o.id),
    name: str(o.name) ?? "View",
    layout,
    fieldIds: fieldIds.length ? fieldIds : [...knownFieldIds],
    filter: str(o.filter),
    sort: sort?.length ? sort : undefined,
    groupByFieldId: groupByFieldId && knownFieldIds.has(groupByFieldId) ? groupByFieldId : undefined,
    dateFieldId: dateFieldId && knownFieldIds.has(dateFieldId) ? dateFieldId : undefined,
    pageSize: typeof o.pageSize === "number" && o.pageSize > 0 ? o.pageSize : undefined,
  };
}

function normalizeListDefinition(raw: unknown): ListDefinition | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const name = str(o.name);
  if (!name) return null;

  const fields = Array.isArray(o.fields)
    ? o.fields.map(normalizeField).filter((field): field is FieldDefinition => !!field)
    : [];
  if (!fields.length) return null;

  const knownFieldIds = new Set(fields.map((field) => field.id));

  const contentTypes: ContentType[] = Array.isArray(o.contentTypes)
    ? o.contentTypes
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null;
          const c = entry as Record<string, unknown>;
          const ctName = str(c.name);
          if (!ctName) return null;
          return {
            id: id(c.id),
            name: ctName,
            fieldIds: Array.isArray(c.fieldIds)
              ? c.fieldIds.map(str).filter((entryId): entryId is string => !!entryId && knownFieldIds.has(entryId))
              : [],
          };
        })
        .filter((entry): entry is ContentType => !!entry)
    : [];

  const views = Array.isArray(o.views)
    ? o.views.map((entry) => normalizeView(entry, knownFieldIds)).filter((view): view is ListView => !!view)
    : [];

  // A list with no usable view is unrenderable; give it one showing everything.
  if (!views.length) {
    views.push({ id: crypto.randomUUID(), name: "All items", layout: "list", fieldIds: [...knownFieldIds] });
  }

  const defaultViewId = str(o.defaultViewId);
  const createdAt = stamp(o.createdAt);

  return {
    id: id(o.id),
    name,
    description: str(o.description),
    fields,
    contentTypes,
    views,
    defaultViewId: defaultViewId && views.some((view) => view.id === defaultViewId) ? defaultViewId : views[0].id,
    scope: o.scope === "shared" ? "shared" : "personal",
    createdAt,
    modifiedAt: stamp(o.modifiedAt ?? createdAt),
  };
}

function normalizeItem(raw: unknown, list: ListDefinition): ListItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const rawValues = o.values && typeof o.values === "object" ? (o.values as Record<string, unknown>) : {};
  const knownFieldIds = new Set(list.fields.map((field) => field.id));

  const values: Record<FieldId, unknown> = {};
  for (const [key, value] of Object.entries(rawValues)) {
    if (knownFieldIds.has(key) && value !== undefined) values[key] = value;
  }

  const createdAt = stamp(o.createdAt);
  return {
    id: id(o.id),
    listId: list.id,
    contentTypeId: str(o.contentTypeId),
    values,
    createdBy: str(o.createdBy) ?? LOCAL_USER,
    createdAt,
    modifiedBy: str(o.modifiedBy) ?? LOCAL_USER,
    modifiedAt: stamp(o.modifiedAt ?? createdAt),
  };
}

/* ── Entry point ───────────────────────────────────────────────────────── */

export function normalizeListsState(raw: unknown): ListsState {
  if (!raw) return emptyListsState();

  // v0 / v1 — a bare array.
  if (Array.isArray(raw)) {
    if (!raw.length) return emptyListsState();

    const containerised = raw.some(
      (entry) => !!entry && typeof entry === "object" && Array.isArray((entry as Record<string, unknown>).items),
    );

    const state = emptyListsState();

    if (containerised) {
      for (const entry of raw) {
        if (!entry || typeof entry !== "object") continue;
        const o = entry as Record<string, unknown>;
        if (!Array.isArray(o.items)) continue;
        const { list, items } = legacyList(str(o.name) ?? "Untitled list", o.items, o);
        state.lists.push(list);
        state.items[list.id] = items;
      }
    } else {
      const { list, items } = legacyList("Lists", raw);
      state.lists.push(list);
      state.items[list.id] = items;
    }

    return state;
  }

  // v2 — the current object shape.
  if (typeof raw !== "object") return emptyListsState();
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.lists)) return emptyListsState();

  const lists = o.lists.map(normalizeListDefinition).filter((list): list is ListDefinition => !!list);
  const rawItems = o.items && typeof o.items === "object" ? (o.items as Record<string, unknown>) : {};

  const items: Record<string, ListItem[]> = {};
  for (const list of lists) {
    const bucket = rawItems[list.id];
    items[list.id] = Array.isArray(bucket)
      ? bucket.map((entry) => normalizeItem(entry, list)).filter((item): item is ListItem => !!item)
      : [];
  }

  return { version: 2, lists, items };
}
