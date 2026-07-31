// Schema management UI: the Fields tab edits a list's columns, the Views tab
// edits saved filters/sorts/layouts. Both write through the backend so schema
// changes go down the same validated path as everything else.

import { useState } from "react";
import type { FieldDefinition, ListDefinition, ListView, ListsState, ViewLayout } from "../../types/lists";
import type { ListBackend } from "./backend";
import { FIELD_TYPE_LABELS, uniqueFieldId } from "./schema";
import { validateFilter } from "./filter";

const field = "w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600";
const btn = "rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-zinc-200 disabled:opacity-40";
const smallBtn = "rounded border border-white/10 px-1.5 py-1 text-[11px] text-zinc-200";
const dangerBtn = "rounded border border-rose-400/30 px-1.5 py-1 text-[11px] text-rose-200 disabled:opacity-40";
const labelCls = "mb-1 block text-[11px] uppercase tracking-[0.16em] text-zinc-500";

const FIELD_TYPES = Object.keys(FIELD_TYPE_LABELS) as FieldDefinition["type"][];
const LAYOUTS: ViewLayout[] = ["list", "grid", "gallery", "calendar"];

interface EditorProps {
  list: ListDefinition;
  state: ListsState;
  backend: ListBackend;
  run: (action: () => Promise<unknown>) => void;
}

/* ── Fields ────────────────────────────────────────────────────────────── */

interface FieldDraft {
  displayName: string;
  type: FieldDefinition["type"];
  required: boolean;
  multiple: boolean;
  choices: string;
  lookupListId: string;
  validationRule: string;
  validationMessage: string;
}

const emptyFieldDraft: FieldDraft = {
  displayName: "",
  type: "text",
  required: false,
  multiple: false,
  choices: "",
  lookupListId: "",
  validationRule: "",
  validationMessage: "",
};

function draftToDefinition(list: ListDefinition, draft: FieldDraft): FieldDefinition {
  return {
    id: uniqueFieldId(list, draft.displayName),
    displayName: draft.displayName.trim(),
    type: draft.type,
    required: draft.required || undefined,
    multiple: draft.multiple || undefined,
    choices: draft.type === "choice" ? draft.choices.split(",").map((c) => c.trim()).filter(Boolean) : undefined,
    lookupListId: draft.type === "lookup" ? draft.lookupListId || undefined : undefined,
    validationRule: draft.validationRule.trim() || undefined,
    validationMessage: draft.validationMessage.trim() || undefined,
  };
}

export function FieldsEditor({ list, state, backend, run }: EditorProps) {
  const [draft, setDraft] = useState<FieldDraft>(emptyFieldDraft);
  const [editingId, setEditingId] = useState<string | null>(null);

  const ruleError = draft.validationRule.trim() ? validateFilter(draft.validationRule) : null;

  const submit = () => {
    if (!draft.displayName.trim() || ruleError) return;

    if (editingId) {
      const { id: _ignored, ...patch } = draftToDefinition(list, draft);
      run(() => backend.updateField(list.id, editingId, patch));
    } else {
      run(() => backend.addField(list.id, draftToDefinition(list, draft)));
    }

    setDraft(emptyFieldDraft);
    setEditingId(null);
  };

  const startEdit = (definition: FieldDefinition) => {
    setEditingId(definition.id);
    setDraft({
      displayName: definition.displayName,
      type: definition.type,
      required: !!definition.required,
      multiple: !!definition.multiple,
      choices: (definition.choices ?? []).join(", "),
      lookupListId: definition.lookupListId ?? "",
      validationRule: definition.validationRule ?? "",
      validationMessage: definition.validationMessage ?? "",
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        {list.fields.map((definition) => (
          <div key={definition.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-zinc-100">
                {definition.displayName}
                {definition.required ? <span className="text-rose-300"> *</span> : null}
                {definition.system ? <span className="ml-1 text-[10px] uppercase tracking-wider text-zinc-600">built-in</span> : null}
              </div>
              <div className="text-[11px] text-zinc-500">
                {FIELD_TYPE_LABELS[definition.type]}
                {definition.multiple ? " · multi" : ""}
                {" · "}
                <code className="text-zinc-600">{definition.id}</code>
              </div>
            </div>

            <button type="button" className={smallBtn} onClick={() => startEdit(definition)}>Edit</button>
            <button type="button" className={smallBtn} onClick={() => run(() => backend.moveField(list.id, definition.id, -1))}>↑</button>
            <button type="button" className={smallBtn} onClick={() => run(() => backend.moveField(list.id, definition.id, 1))}>↓</button>
            <button
              type="button"
              className={dangerBtn}
              disabled={!!definition.system}
              title={definition.system ? "Built-in fields cannot be removed" : undefined}
              onClick={() => run(() => backend.removeField(list.id, definition.id))}
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-white/10 bg-zinc-950/30 p-3">
        <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-zinc-500">{editingId ? "Edit field" : "New field"}</div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <span className={labelCls}>Name</span>
            <input className={field} value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} />
          </div>
          <div>
            <span className={labelCls}>Type</span>
            <select className={field} value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as FieldDefinition["type"] })}>
              {FIELD_TYPES.map((type) => (
                <option key={type} value={type}>{FIELD_TYPE_LABELS[type]}</option>
              ))}
            </select>
          </div>
        </div>

        {draft.type === "choice" ? (
          <div className="mt-2">
            <span className={labelCls}>Options (comma separated)</span>
            <input className={field} value={draft.choices} onChange={(event) => setDraft({ ...draft, choices: event.target.value })} />
          </div>
        ) : null}

        {draft.type === "lookup" ? (
          <div className="mt-2">
            <span className={labelCls}>Looks up</span>
            <select className={field} value={draft.lookupListId} onChange={(event) => setDraft({ ...draft, lookupListId: event.target.value })}>
              <option value="">Pick a list…</option>
              {state.lists.filter((entry) => entry.id !== list.id).map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.name}</option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="mt-2 flex gap-4">
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input type="checkbox" checked={draft.required} onChange={(event) => setDraft({ ...draft, required: event.target.checked })} />
            Required
          </label>
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input type="checkbox" checked={draft.multiple} onChange={(event) => setDraft({ ...draft, multiple: event.target.checked })} />
            Allow multiple
          </label>
        </div>

        <div className="mt-2">
          <span className={labelCls}>Validation rule (optional)</span>
          <input className={field} placeholder="e.g. Amount ge 0" value={draft.validationRule} onChange={(event) => setDraft({ ...draft, validationRule: event.target.value })} />
          {ruleError ? <div className="mt-1 text-[11px] text-rose-300">{ruleError}</div> : null}
          <input
            className={`${field} mt-2`}
            placeholder="Message shown when the rule fails"
            value={draft.validationMessage}
            onChange={(event) => setDraft({ ...draft, validationMessage: event.target.value })}
          />
        </div>

        <div className="mt-3 flex gap-2">
          <button type="button" className="rounded-lg bg-emerald-500/20 px-2.5 py-1.5 text-xs font-medium text-emerald-200 disabled:opacity-40" disabled={!draft.displayName.trim() || !!ruleError} onClick={submit}>
            {editingId ? "Save field" : "Add field"}
          </button>
          {editingId ? (
            <button type="button" className={btn} onClick={() => { setEditingId(null); setDraft(emptyFieldDraft); }}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ── Views ─────────────────────────────────────────────────────────────── */

export function ViewsEditor({ list, backend, run }: EditorProps) {
  const [editing, setEditing] = useState<ListView | null>(null);

  const filterError = editing?.filter?.trim() ? validateFilter(editing.filter) : null;

  const startNew = () => {
    setEditing({
      id: crypto.randomUUID(),
      name: "New view",
      layout: "list",
      fieldIds: list.fields.map((definition) => definition.id),
    });
  };

  const save = () => {
    if (!editing || filterError) return;
    const view = editing;
    run(() => backend.defineView(list.id, view));
    setEditing(null);
  };

  const toggleField = (fieldId: string) => {
    if (!editing) return;
    setEditing({
      ...editing,
      fieldIds: editing.fieldIds.includes(fieldId)
        ? editing.fieldIds.filter((entry) => entry !== fieldId)
        : [...editing.fieldIds, fieldId],
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        {list.views.map((view) => (
          <div key={view.id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-zinc-100">
                {view.name}
                {view.id === list.defaultViewId ? <span className="ml-1 text-[10px] uppercase tracking-wider text-emerald-300/70">default</span> : null}
              </div>
              <div className="truncate text-[11px] text-zinc-500">
                {view.layout} · {view.fieldIds.length} fields{view.filter ? ` · ${view.filter}` : ""}
              </div>
            </div>

            <button type="button" className={smallBtn} onClick={() => setEditing(view)}>Edit</button>
            <button type="button" className={smallBtn} disabled={view.id === list.defaultViewId} onClick={() => run(() => backend.updateList(list.id, { defaultViewId: view.id }))}>
              Default
            </button>
            <button type="button" className={dangerBtn} disabled={list.views.length <= 1} onClick={() => run(() => backend.removeView(list.id, view.id))}>
              Delete
            </button>
          </div>
        ))}
      </div>

      {editing ? (
        <div className="rounded-lg border border-white/10 bg-zinc-950/30 p-3">
          <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-zinc-500">View</div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <span className={labelCls}>Name</span>
              <input className={field} value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
            </div>
            <div>
              <span className={labelCls}>Layout</span>
              <select className={field} value={editing.layout} onChange={(event) => setEditing({ ...editing, layout: event.target.value as ViewLayout })}>
                {LAYOUTS.map((layout) => (
                  <option key={layout} value={layout}>{layout}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-2">
            <span className={labelCls}>Fields shown</span>
            <div className="flex flex-wrap gap-2">
              {list.fields.map((definition) => (
                <label key={definition.id} className="flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300">
                  <input type="checkbox" checked={editing.fieldIds.includes(definition.id)} onChange={() => toggleField(definition.id)} />
                  {definition.displayName}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-2">
            <span className={labelCls}>Filter</span>
            <input
              className={field}
              placeholder="e.g. Done eq false and contains(Title, 'draft')"
              value={editing.filter ?? ""}
              onChange={(event) => setEditing({ ...editing, filter: event.target.value })}
            />
            {filterError ? <div className="mt-1 text-[11px] text-rose-300">{filterError}</div> : null}
          </div>

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              <span className={labelCls}>Sort by</span>
              <div className="flex gap-2">
                <select
                  className={field}
                  value={editing.sort?.[0]?.fieldId ?? ""}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      sort: event.target.value
                        ? [{ fieldId: event.target.value, direction: editing.sort?.[0]?.direction ?? "asc" }]
                        : undefined,
                    })
                  }
                >
                  <option value="">Insertion order</option>
                  {list.fields.map((definition) => (
                    <option key={definition.id} value={definition.id}>{definition.displayName}</option>
                  ))}
                </select>
                <select
                  className={field}
                  disabled={!editing.sort?.length}
                  value={editing.sort?.[0]?.direction ?? "asc"}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      sort: editing.sort?.length
                        ? [{ fieldId: editing.sort[0].fieldId, direction: event.target.value as "asc" | "desc" }]
                        : undefined,
                    })
                  }
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </div>
            </div>

            {editing.layout === "calendar" ? (
              <div>
                <span className={labelCls}>Date field</span>
                <select className={field} value={editing.dateFieldId ?? ""} onChange={(event) => setEditing({ ...editing, dateFieldId: event.target.value || undefined })}>
                  <option value="">First date field</option>
                  {list.fields.filter((definition) => definition.type === "dateTime").map((definition) => (
                    <option key={definition.id} value={definition.id}>{definition.displayName}</option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <div className="mt-3 flex gap-2">
            <button type="button" className="rounded-lg bg-emerald-500/20 px-2.5 py-1.5 text-xs font-medium text-emerald-200 disabled:opacity-40" disabled={!editing.name.trim() || !!filterError} onClick={save}>
              Save view
            </button>
            <button type="button" className={btn} onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" className={btn} onClick={startNew}>
          New view
        </button>
      )}
    </div>
  );
}
