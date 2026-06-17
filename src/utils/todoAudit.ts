import type { ShelfPillarTodoItem, ShelfTodoAuditEntry } from "../types/grid";

/**
 * Audit / timestamp helpers for todo-shaped items (pillar todos, grazeland, bin,
 * and custom visual-flow planes all share {@link ShelfPillarTodoItem}).
 *
 * Goals:
 *  - stamp `createdAt` once, on creation
 *  - stamp `updatedAt` and append a bounded `history` entry on every real edit
 *  - keep storage small so chrome.storage.local quota / low-RAM stay healthy
 */

/** Cap on retained history entries per item (oldest are dropped). */
export const MAX_TODO_HISTORY = 50;

/**
 * Content fields whose changes are worth recording. Positional / layout-only
 * fields (handle config, handle visibility) are intentionally excluded so the
 * audit trail stays about meaningful edits, not canvas fiddling.
 */
const AUDITED_FIELDS: (keyof ShelfPillarTodoItem)[] = [
  "text",
  "done",
  "url",
  "note",
  "subtitle",
  "tag",
  "blockStatus",
  "date",
  "focused",
  "burning",
  "sectorName",
  "sectorColor",
  "potentialValue",
];

function now(): number {
  return Date.now();
}

/** Seed audit metadata on a freshly created item (no-op if already stamped). */
export function stampNewTodo<T extends ShelfPillarTodoItem>(item: T): T {
  if (item.createdAt) return item;
  const ts = now();
  return {
    ...item,
    createdAt: ts,
    updatedAt: ts,
    history: [{ at: ts, action: "created" }],
  };
}

/** Append an entry to a history array, keeping it bounded to the most recent N. */
function pushHistory(
  history: ShelfTodoAuditEntry[] | undefined,
  entry: ShelfTodoAuditEntry
): ShelfTodoAuditEntry[] {
  const next = history ? [...history, entry] : [entry];
  return next.length > MAX_TODO_HISTORY ? next.slice(next.length - MAX_TODO_HISTORY) : next;
}

/**
 * Merge `updates` into `item`, stamping `updatedAt` and recording the change in
 * `history` — but only when a tracked field actually changed. No-op edits (e.g.
 * re-setting the same value) return the item with the updates applied but no new
 * audit noise. Untracked fields still merge; they just don't create an entry.
 */
export function applyTodoUpdate(
  item: ShelfPillarTodoItem,
  updates: Partial<ShelfPillarTodoItem>
): ShelfPillarTodoItem {
  const merged = { ...item, ...updates };

  const changed = AUDITED_FIELDS.filter(
    (k) => k in updates && updates[k] !== item[k]
  ) as string[];

  if (changed.length === 0) return merged;

  let action: ShelfTodoAuditEntry["action"] = "updated";
  if ("done" in updates && updates.done !== item.done) {
    action = updates.done ? "completed" : "restored";
  }

  const ts = now();
  return {
    ...merged,
    // Backfill createdAt for legacy items that predate auditing.
    createdAt: item.createdAt ?? ts,
    updatedAt: ts,
    history: pushHistory(item.history, { at: ts, action, fields: changed }),
  };
}

/** Apply an audited edit to the matching item within a list (immutably). */
export function editTodoInList(
  list: ShelfPillarTodoItem[],
  id: string,
  updates: Partial<ShelfPillarTodoItem>
): ShelfPillarTodoItem[] {
  return list.map((t) => (t.id === id ? applyTodoUpdate(t, updates) : t));
}

/** Extract & validate audit fields off a raw stored object (for normalize). */
export function readAuditFields(
  x: any
): Pick<ShelfPillarTodoItem, "createdAt" | "updatedAt" | "history"> {
  const createdAt = typeof x?.createdAt === "number" ? x.createdAt : undefined;
  const updatedAt = typeof x?.updatedAt === "number" ? x.updatedAt : undefined;
  const history = Array.isArray(x?.history)
    ? (x.history as any[])
        .filter(
          (e) =>
            e &&
            typeof e.at === "number" &&
            (e.action === "created" ||
              e.action === "updated" ||
              e.action === "completed" ||
              e.action === "restored")
        )
        .map((e) => ({
          at: e.at,
          action: e.action,
          ...(Array.isArray(e.fields)
            ? { fields: e.fields.filter((f: unknown) => typeof f === "string") }
            : {}),
        }))
        .slice(-MAX_TODO_HISTORY)
    : undefined;
  return { createdAt, updatedAt, history };
}
