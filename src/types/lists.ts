// Schema-driven Lists: a list owns a field schema, content types and views;
// items are bags of values keyed by field id. Modelled on the SharePoint /
// Microsoft Lists shape, minus the parts that assume a server:
//
//  · no tenantId/siteId — ShELF is serverless and single-user; `scope` remains
//    so a list can still be marked personal vs. shared-by-export.
//  · ids are string UUIDs, not incrementing ints, matching the rest of ShELF.
//  · timestamps are ISO strings, not Date — chrome.storage.local round-trips
//    through JSON, which would otherwise hand back a string typed as Date.

export type ListId = string;
export type ItemId = string;
export type FieldId = string;
export type ViewId = string;
export type ContentTypeId = string;

/** Author of a change. There is no auth in the extension, so writes are
 *  attributed to a local sentinel unless a caller supplies someone. */
export const LOCAL_USER = "local";

export type FieldType =
  | "text"
  | "number"
  | "choice"
  | "boolean"
  | "dateTime"
  | "user"
  | "lookup"
  | "url"
  | "attachment"
  | "json";

export interface FieldDefinition {
  /** Internal, stable field name. Keys into `ListItem.values`. */
  id: FieldId;
  displayName: string;
  type: FieldType;
  required?: boolean;
  /** Multi-value: choice, user and lookup fields store an array when set. */
  multiple?: boolean;
  defaultValue?: unknown;
  /** choice */
  choices?: string[];
  /** number */
  min?: number;
  max?: number;
  /** text */
  maxLength?: number;
  multiline?: boolean;
  /** lookup — the list this field points at, and the field shown as its label. */
  lookupListId?: ListId;
  lookupFieldId?: FieldId;
  /** Filter-DSL expression evaluated against the candidate item; must hold to save. */
  validationRule?: string;
  validationMessage?: string;
  /** Built-in fields: cannot be removed, retyped or un-required. */
  system?: boolean;
}

/** A reusable named subset of a list's fields. */
export interface ContentType {
  id: ContentTypeId;
  name: string;
  fieldIds: FieldId[];
}

export type ViewLayout = "list" | "grid" | "gallery" | "calendar";

export interface ViewSort {
  fieldId: FieldId;
  direction: "asc" | "desc";
}

export interface ListView {
  id: ViewId;
  name: string;
  layout: ViewLayout;
  /** Fields rendered, in order. */
  fieldIds: FieldId[];
  /** Filter-DSL expression, e.g. `Status eq 'Active' and Priority ge 2`. */
  filter?: string;
  sort?: ViewSort[];
  groupByFieldId?: FieldId;
  /** Which dateTime field the calendar layout buckets by. */
  dateFieldId?: FieldId;
  pageSize?: number;
}

export interface ListDefinition {
  id: ListId;
  name: string;
  description?: string;
  fields: FieldDefinition[];
  contentTypes: ContentType[];
  views: ListView[];
  defaultViewId?: ViewId;
  scope: "personal" | "shared";
  createdAt: string;
  modifiedAt: string;
}

export interface ListItem {
  id: ItemId;
  listId: ListId;
  contentTypeId?: ContentTypeId;
  /** Keyed by FieldDefinition.id. */
  values: Record<FieldId, unknown>;
  createdBy: string;
  createdAt: string;
  modifiedBy: string;
  modifiedAt: string;
}

export interface ItemQuery {
  /** Filter-DSL expression. Combined with the view's own filter when `viewId` is set. */
  filter?: string;
  /** Field ids to project. Omit for all. */
  select?: FieldId[];
  orderBy?: ViewSort[];
  skip?: number;
  take?: number;
  /** Apply this view's filter/sort/projection as the baseline. */
  viewId?: ViewId;
}

export interface QueryResult {
  items: ListItem[];
  /** Matches before skip/take — for paging UI. */
  total: number;
}

export type ItemChangeType = "created" | "updated" | "deleted";

export interface ItemChangeEvent {
  type: ItemChangeType;
  listId: ListId;
  item: ListItem;
}

/** Everything persisted under the `shelf-lists` key. */
export interface ListsState {
  version: 2;
  lists: ListDefinition[];
  /** Items bucketed by list id. */
  items: Record<ListId, ListItem[]>;
}

export function emptyListsState(): ListsState {
  return { version: 2, lists: [], items: {} };
}

/* ── Legacy shapes, retained so stored data and old backups can be migrated ─ */

/** @deprecated pre-schema item shape (v0 flat array, v1 inside DirectoryList). */
export interface DirectoryListItem {
  id: string;
  title: string;
  description?: string;
  url?: string;
  tags?: string[];
  done?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** @deprecated pre-schema container shape (v1). */
export interface DirectoryList {
  id: string;
  name: string;
  items: DirectoryListItem[];
  createdAt?: string;
  updatedAt?: string;
}
