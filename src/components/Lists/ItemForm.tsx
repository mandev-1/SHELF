// Renders an editable item from its list's field schema. Every input reports a
// raw value; coercion and validation happen in schema.ts on save, so the form
// never has to know a field type's storage rules — only how to collect it.

import type { FieldDefinition, FieldId, ListDefinition, ListsState } from "../../types/lists";
import { defaultValueForField, displayTitle } from "./schema";
import { getItems } from "./listsEngine";

const field = "w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600";
const label = "mb-1 block text-[11px] uppercase tracking-[0.16em] text-zinc-500";

export type DraftValues = Record<FieldId, unknown>;

export function emptyDraft(list: ListDefinition): DraftValues {
  const draft: DraftValues = {};
  for (const definition of list.fields) draft[definition.id] = defaultValueForField(definition);
  return draft;
}

export function draftFromValues(list: ListDefinition, values: DraftValues): DraftValues {
  const draft: DraftValues = {};
  for (const definition of list.fields) {
    draft[definition.id] = values[definition.id] ?? defaultValueForField(definition);
  }
  return draft;
}

/** Comma-joined display for free-text multi-value fields. */
function joinLoose(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  return value === null || value === undefined ? "" : String(value);
}

function splitLoose(raw: string): string[] {
  return raw.split(",").map((entry) => entry.trim()).filter(Boolean);
}

function FieldInput({
  definition,
  value,
  state,
  onChange,
}: {
  definition: FieldDefinition;
  value: unknown;
  state: ListsState;
  onChange: (next: unknown) => void;
}) {
  // Multi-line text is the one case where the type alone doesn't pick the control.
  if (definition.type === "text" && definition.multiline && !definition.multiple) {
    return <textarea className={field} rows={2} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} />;
  }

  switch (definition.type) {
    case "boolean":
      return (
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} />
          {definition.displayName}
        </label>
      );

    case "number":
      return (
        <input
          type="number"
          className={field}
          value={value === null || value === undefined ? "" : String(value)}
          min={definition.min}
          max={definition.max}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    case "dateTime": {
      // <input type="date"> wants yyyy-mm-dd; storage keeps full ISO.
      const asDate = value ? new Date(String(value)) : null;
      const asInput = asDate && !Number.isNaN(asDate.getTime()) ? asDate.toISOString().slice(0, 10) : "";
      return <input type="date" className={field} value={asInput} onChange={(event) => onChange(event.target.value)} />;
    }

    case "choice": {
      if (definition.multiple) {
        const selected = Array.isArray(value) ? value.map(String) : [];
        return (
          <div className="flex flex-wrap gap-2">
            {(definition.choices ?? []).map((choice) => (
              <label key={choice} className="flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={selected.includes(choice)}
                  onChange={(event) =>
                    onChange(event.target.checked ? [...selected, choice] : selected.filter((entry) => entry !== choice))
                  }
                />
                {choice}
              </label>
            ))}
          </div>
        );
      }

      return (
        <select className={field} value={value === undefined || value === null ? "" : String(value)} onChange={(event) => onChange(event.target.value)}>
          <option value="">—</option>
          {(definition.choices ?? []).map((choice) => (
            <option key={choice} value={choice}>
              {choice}
            </option>
          ))}
        </select>
      );
    }

    case "lookup": {
      const targetList = state.lists.find((entry) => entry.id === definition.lookupListId);
      const options = targetList ? getItems(state, targetList.id) : [];
      return (
        <select className={field} value={value === undefined || value === null ? "" : String(value)} onChange={(event) => onChange(event.target.value)}>
          <option value="">—</option>
          {targetList
            ? options.map((item) => (
                <option key={item.id} value={item.id}>
                  {displayTitle(targetList, item)}
                </option>
              ))
            : null}
        </select>
      );
    }

    case "json":
      return (
        <textarea
          className={field}
          rows={3}
          value={typeof value === "string" ? value : value === undefined ? "" : JSON.stringify(value, null, 2)}
          onChange={(event) => onChange(event.target.value)}
        />
      );

    case "text":
    case "url":
    case "user":
    case "attachment":
    default:
      return (
        <input
          className={field}
          placeholder={definition.multiple ? "Comma separated" : undefined}
          value={joinLoose(value)}
          onChange={(event) => onChange(definition.multiple ? splitLoose(event.target.value) : event.target.value)}
        />
      );
  }
}

export function ItemForm({
  list,
  state,
  draft,
  errors,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  list: ListDefinition;
  state: ListsState;
  draft: DraftValues;
  errors: Record<string, string>;
  onChange: (next: DraftValues) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  submitLabel: string;
}) {
  const setValue = (fieldId: FieldId, next: unknown) => onChange({ ...draft, [fieldId]: next });

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {list.fields.map((definition) => (
        <div key={definition.id}>
          {definition.type !== "boolean" ? (
            <span className={label}>
              {definition.displayName}
              {definition.required ? <span className="text-rose-300"> *</span> : null}
            </span>
          ) : null}

          <FieldInput definition={definition} value={draft[definition.id]} state={state} onChange={(next) => setValue(definition.id, next)} />

          {errors[definition.id] ? <div className="mt-1 text-[11px] text-rose-300">{errors[definition.id]}</div> : null}
        </div>
      ))}

      <div className="flex gap-2">
        <button type="submit" className="rounded-lg bg-emerald-500/20 px-2.5 py-1.5 text-xs font-medium text-emerald-200">
          {submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-zinc-200" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
