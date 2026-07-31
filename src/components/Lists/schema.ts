// Field-level rules: defaults, coercion, validation and display formatting.
// Every write path funnels values through `coerceFieldValue` so what lands in
// chrome.storage.local is always JSON-safe and matches the declared field type.

import {
  type FieldDefinition,
  type FieldId,
  type ListDefinition,
  type ListItem,
  type ListsState,
} from "../../types/lists";
import { evaluateFilter, FilterError } from "./filter";

/** Every list has a Title. It is the label used wherever one item must be
 *  named — lookups, gallery cards, calendar entries. */
export const TITLE_FIELD_ID: FieldId = "Title";

export function createTitleField(): FieldDefinition {
  return { id: TITLE_FIELD_ID, displayName: "Title", type: "text", required: true, system: true };
}

export const FIELD_TYPE_LABELS: Record<FieldDefinition["type"], string> = {
  text: "Text",
  number: "Number",
  choice: "Choice",
  boolean: "Yes/No",
  dateTime: "Date",
  user: "Person",
  lookup: "Lookup",
  url: "Link",
  attachment: "Attachment",
  json: "JSON",
};

/** A field id must be a bare identifier so it can appear in filter expressions. */
export function normalizeFieldId(raw: string): string {
  const cleaned = raw.trim().replace(/[^A-Za-z0-9_]/g, "");
  if (!cleaned) return "";
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `f${cleaned}`;
}

export function uniqueFieldId(list: ListDefinition, desired: string): string {
  const base = normalizeFieldId(desired) || "Field";
  if (!list.fields.some((field) => field.id === base)) return base;

  let suffix = 2;
  while (list.fields.some((field) => field.id === `${base}${suffix}`)) suffix += 1;
  return `${base}${suffix}`;
}

/* ── Coercion ──────────────────────────────────────────────────────────── */

export type CoerceResult = { ok: true; value: unknown } | { ok: false; error: string };

function isBlank(raw: unknown): boolean {
  return raw === null || raw === undefined || (typeof raw === "string" && !raw.trim()) || (Array.isArray(raw) && !raw.length);
}

function coerceSingle(field: FieldDefinition, raw: unknown): CoerceResult {
  switch (field.type) {
    case "number": {
      const value = typeof raw === "number" ? raw : Number(String(raw).trim());
      if (!Number.isFinite(value)) return { ok: false, error: `${field.displayName} must be a number` };
      if (field.min !== undefined && value < field.min) return { ok: false, error: `${field.displayName} must be at least ${field.min}` };
      if (field.max !== undefined && value > field.max) return { ok: false, error: `${field.displayName} must be at most ${field.max}` };
      return { ok: true, value };
    }

    case "boolean":
      return { ok: true, value: raw === true || raw === "true" };

    case "choice": {
      const value = String(raw).trim();
      if (field.choices?.length && !field.choices.includes(value)) {
        return { ok: false, error: `${field.displayName} must be one of: ${field.choices.join(", ")}` };
      }
      return { ok: true, value };
    }

    case "dateTime": {
      const parsed = new Date(String(raw));
      if (Number.isNaN(parsed.getTime())) return { ok: false, error: `${field.displayName} must be a valid date` };
      return { ok: true, value: parsed.toISOString() };
    }

    case "url": {
      const value = String(raw).trim();
      const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
      try {
        // Rejects things that can never be navigated to; stores the normalized form.
        return { ok: true, value: new URL(candidate).toString() };
      } catch {
        return { ok: false, error: `${field.displayName} must be a valid link` };
      }
    }

    case "lookup": {
      const value = String(raw).trim();
      return { ok: true, value };
    }

    case "json": {
      if (typeof raw !== "string") return { ok: true, value: raw };
      try {
        return { ok: true, value: JSON.parse(raw) };
      } catch {
        return { ok: false, error: `${field.displayName} must be valid JSON` };
      }
    }

    case "attachment":
    case "user":
    case "text":
    default:
      return { ok: true, value: String(raw) };
  }
}

export function coerceFieldValue(field: FieldDefinition, raw: unknown): CoerceResult {
  if (isBlank(raw)) {
    if (field.required) return { ok: false, error: `${field.displayName} is required` };
    return { ok: true, value: field.type === "boolean" ? false : undefined };
  }

  if (field.multiple) {
    const entries = Array.isArray(raw) ? raw : [raw];
    const out: unknown[] = [];
    for (const entry of entries) {
      if (isBlank(entry)) continue;
      const result = coerceSingle(field, entry);
      if (!result.ok) return result;
      out.push(result.value);
    }
    if (!out.length && field.required) return { ok: false, error: `${field.displayName} is required` };
    return { ok: true, value: out.length ? out : undefined };
  }

  return coerceSingle(field, raw);
}

export function defaultValueForField(field: FieldDefinition): unknown {
  if (field.defaultValue !== undefined) return field.defaultValue;
  if (field.type === "boolean") return false;
  if (field.multiple) return [];
  return "";
}

/* ── Whole-item validation ─────────────────────────────────────────────── */

export interface ValidationOutcome {
  ok: boolean;
  /** Keyed by field id; empty when ok. */
  errors: Record<FieldId, string>;
  /** Coerced values, safe to persist. Only meaningful when ok. */
  values: Record<FieldId, unknown>;
}

export function validateValues(list: ListDefinition, raw: Record<FieldId, unknown>): ValidationOutcome {
  const errors: Record<FieldId, string> = {};
  const values: Record<FieldId, unknown> = {};

  for (const field of list.fields) {
    const supplied = Object.prototype.hasOwnProperty.call(raw, field.id) ? raw[field.id] : undefined;
    const result = coerceFieldValue(field, supplied);
    if (!result.ok) {
      errors[field.id] = result.error;
      continue;
    }
    if (result.value !== undefined) values[field.id] = result.value;
  }

  // Field validation rules run against the fully coerced candidate, so a rule
  // can reference any field on the item, not just its own.
  if (!Object.keys(errors).length) {
    const candidate: ListItem = {
      id: "candidate",
      listId: list.id,
      values,
      createdBy: "",
      createdAt: "",
      modifiedBy: "",
      modifiedAt: "",
    };

    for (const field of list.fields) {
      if (!field.validationRule?.trim()) continue;
      try {
        if (!evaluateFilter(field.validationRule, candidate)) {
          errors[field.id] = field.validationMessage?.trim() || `${field.displayName} failed validation`;
        }
      } catch (error) {
        errors[field.id] = error instanceof FilterError ? `Invalid rule: ${error.message}` : "Invalid validation rule";
      }
    }
  }

  return { ok: !Object.keys(errors).length, errors, values };
}

/* ── Display ───────────────────────────────────────────────────────────── */

/** Human-readable rendering of a stored value. Lookups resolve to the target
 *  item's Title when `state` is supplied. */
export function formatFieldValue(field: FieldDefinition, value: unknown, state?: ListsState): string {
  if (value === null || value === undefined || value === "") return "";

  if (Array.isArray(value)) {
    return value.map((entry) => formatFieldValue({ ...field, multiple: false }, entry, state)).filter(Boolean).join(", ");
  }

  switch (field.type) {
    case "boolean":
      return value ? "Yes" : "No";
    case "dateTime": {
      const parsed = new Date(String(value));
      return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString();
    }
    case "number":
      return Number(value).toLocaleString();
    case "lookup": {
      if (!state || !field.lookupListId) return String(value);
      const target = (state.items[field.lookupListId] ?? []).find((item) => item.id === value);
      if (!target) return String(value);
      const labelField = field.lookupFieldId ?? TITLE_FIELD_ID;
      return String(target.values[labelField] ?? target.values[TITLE_FIELD_ID] ?? value);
    }
    case "json":
      return JSON.stringify(value);
    default:
      return String(value);
  }
}

/** The text a quick-search box should match against. */
export function itemSearchText(list: ListDefinition, item: ListItem, state?: ListsState): string {
  return list.fields.map((field) => formatFieldValue(field, item.values[field.id], state)).join(" ").toLowerCase();
}

export function displayTitle(list: ListDefinition, item: ListItem): string {
  const raw = item.values[TITLE_FIELD_ID];
  const title = typeof raw === "string" ? raw.trim() : "";
  if (title) return title;

  const firstText = list.fields.find((field) => field.type === "text" && field.id !== TITLE_FIELD_ID);
  const fallback = firstText ? item.values[firstText.id] : undefined;
  return typeof fallback === "string" && fallback.trim() ? fallback.trim() : "Untitled";
}
