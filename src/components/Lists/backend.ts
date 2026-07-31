// The service contract for Lists, plus the local implementation backed by
// ListsState in chrome.storage.local (via useShelfStorage).
//
// The interface is deliberately async even though the local implementation is
// synchronous underneath: it is the seam a remote implementation would slot
// into without any caller changing. Expected validation failures reject with
// ListValidationError carrying per-field messages, so UI can render them
// against the right input rather than parsing an error string.

import type {
  ContentType,
  FieldDefinition,
  FieldId,
  ItemChangeEvent,
  ItemId,
  ItemQuery,
  ListDefinition,
  ListId,
  ListItem,
  ListView,
  ListsState,
  QueryResult,
  ViewId,
} from "../../types/lists";
import * as engine from "./listsEngine";
import type { CreateListInput, EngineResult, FieldPatch, ListPatch } from "./listsEngine";

export class ListValidationError extends Error {
  readonly errors: Record<string, string>;

  constructor(errors: Record<string, string>) {
    super(Object.values(errors)[0] ?? "Validation failed");
    this.name = "ListValidationError";
    this.errors = errors;
  }
}

export interface ListBackend {
  /* Lists */
  createList(input: CreateListInput): Promise<ListDefinition>;
  getList(listId: ListId): Promise<ListDefinition | null>;
  updateList(listId: ListId, patch: ListPatch): Promise<ListDefinition>;
  deleteList(listId: ListId): Promise<void>;
  listLists(): Promise<ListDefinition[]>;
  duplicateList(listId: ListId): Promise<ListDefinition>;
  moveList(listId: ListId, direction: -1 | 1): Promise<void>;

  /* Schema — fields, content types, views */
  addField(listId: ListId, field: FieldDefinition): Promise<ListDefinition>;
  updateField(listId: ListId, fieldId: FieldId, patch: FieldPatch): Promise<ListDefinition>;
  removeField(listId: ListId, fieldId: FieldId): Promise<ListDefinition>;
  moveField(listId: ListId, fieldId: FieldId, direction: -1 | 1): Promise<void>;
  addContentType(listId: ListId, contentType: ContentType): Promise<ListDefinition>;
  attachContentType(listId: ListId, contentTypeId: string): Promise<ListDefinition>;
  removeContentType(listId: ListId, contentTypeId: string): Promise<void>;
  defineView(listId: ListId, view: ListView): Promise<ListDefinition>;
  removeView(listId: ListId, viewId: ViewId): Promise<ListDefinition>;

  /* Items */
  createItem(listId: ListId, values: Record<FieldId, unknown>): Promise<ListItem>;
  getItem(listId: ListId, itemId: ItemId): Promise<ListItem | null>;
  updateItem(listId: ListId, itemId: ItemId, patch: Record<FieldId, unknown>): Promise<ListItem>;
  deleteItem(listId: ListId, itemId: ItemId): Promise<void>;
  deleteItems(listId: ListId, itemIds: ItemId[]): Promise<void>;
  duplicateItems(listId: ListId, itemIds: ItemId[]): Promise<void>;
  moveItem(listId: ListId, itemId: ItemId, direction: -1 | 1): Promise<void>;
  moveItemsToList(fromListId: ListId, toListId: ListId, itemIds: ItemId[]): Promise<ListItem[]>;

  /* Query */
  queryItems(listId: ListId, query?: ItemQuery): Promise<QueryResult>;

  /* Automation hooks. Returns an unsubscribe function. */
  onItemChanged(listId: ListId | "*", handler: (event: ItemChangeEvent) => void | Promise<void>): () => void;
}

export interface ListBackendIO {
  /** Must return the freshest state — React callers should read through a ref. */
  getState: () => ListsState;
  setState: (next: ListsState) => void;
}

export function createLocalListBackend({ getState, setState }: ListBackendIO): ListBackend {
  type Subscriber = { listId: ListId | "*"; handler: (event: ItemChangeEvent) => void | Promise<void> };
  const subscribers = new Set<Subscriber>();

  const emit = (event: ItemChangeEvent) => {
    for (const subscriber of subscribers) {
      if (subscriber.listId !== "*" && subscriber.listId !== event.listId) continue;
      // Handlers are automation, not part of the write: never let one reject the
      // operation that triggered it.
      void Promise.resolve()
        .then(() => subscriber.handler(event))
        .catch((error) => console.error("[lists] onItemChanged handler failed", error));
    }
  };

  /** Commit an EngineResult, or reject with its field errors. */
  const commit = <T,>(result: EngineResult<T>): T => {
    if (!result.ok) throw new ListValidationError(result.errors);
    setState(result.state);
    return result.value;
  };

  return {
    /* Lists */

    async createList(input) {
      return commit(engine.createList(getState(), input));
    },

    async getList(listId) {
      return engine.getList(getState(), listId);
    },

    async updateList(listId, patch) {
      return commit(engine.updateList(getState(), listId, patch));
    },

    async deleteList(listId) {
      setState(engine.deleteList(getState(), listId));
    },

    async listLists() {
      return engine.listLists(getState());
    },

    async duplicateList(listId) {
      return commit(engine.duplicateList(getState(), listId));
    },

    async moveList(listId, direction) {
      setState(engine.moveList(getState(), listId, direction));
    },

    /* Schema */

    async addField(listId, field) {
      return commit(engine.addField(getState(), listId, field));
    },

    async updateField(listId, fieldId, patch) {
      return commit(engine.updateField(getState(), listId, fieldId, patch));
    },

    async removeField(listId, fieldId) {
      return commit(engine.removeField(getState(), listId, fieldId));
    },

    async moveField(listId, fieldId, direction) {
      setState(engine.moveField(getState(), listId, fieldId, direction));
    },

    async addContentType(listId, contentType) {
      return commit(engine.addContentType(getState(), listId, contentType));
    },

    async attachContentType(listId, contentTypeId) {
      return commit(engine.attachContentType(getState(), listId, contentTypeId));
    },

    async removeContentType(listId, contentTypeId) {
      setState(engine.removeContentType(getState(), listId, contentTypeId));
    },

    async defineView(listId, view) {
      return commit(engine.defineView(getState(), listId, view));
    },

    async removeView(listId, viewId) {
      return commit(engine.removeView(getState(), listId, viewId));
    },

    /* Items */

    async createItem(listId, values) {
      const item = commit(engine.createItem(getState(), listId, values));
      emit({ type: "created", listId, item });
      return item;
    },

    async getItem(listId, itemId) {
      return engine.getItem(getState(), listId, itemId);
    },

    async updateItem(listId, itemId, patch) {
      const item = commit(engine.updateItem(getState(), listId, itemId, patch));
      emit({ type: "updated", listId, item });
      return item;
    },

    async deleteItem(listId, itemId) {
      const existing = engine.getItem(getState(), listId, itemId);
      setState(engine.deleteItem(getState(), listId, itemId));
      if (existing) emit({ type: "deleted", listId, item: existing });
    },

    async deleteItems(listId, itemIds) {
      const state = getState();
      const removed = engine.getItems(state, listId).filter((item) => itemIds.includes(item.id));
      setState(engine.deleteItems(state, listId, itemIds));
      for (const item of removed) emit({ type: "deleted", listId, item });
    },

    async duplicateItems(listId, itemIds) {
      setState(engine.duplicateItems(getState(), listId, itemIds));
    },

    async moveItem(listId, itemId, direction) {
      setState(engine.moveItem(getState(), listId, itemId, direction));
    },

    async moveItemsToList(fromListId, toListId, itemIds) {
      const moved = commit(engine.moveItemsToList(getState(), fromListId, toListId, itemIds));
      for (const item of moved) {
        emit({ type: "deleted", listId: fromListId, item });
        emit({ type: "created", listId: toListId, item });
      }
      return moved;
    },

    /* Query */

    async queryItems(listId, query) {
      return engine.queryItems(getState(), listId, query);
    },

    onItemChanged(listId, handler) {
      const subscriber: Subscriber = { listId, handler };
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
  };
}
