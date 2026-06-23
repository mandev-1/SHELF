// ============================================================================
// Doing-now "Edit Task" — full-screen two-column task editor.
// Opened from a Doing-now task item's "Edit" button (not the canvas editor).
// Edits title / subtitle / note / checklist (left) and tag / deadline /
// fixed-meeting / completed (right). Saves a Partial<ShelfPillarTodoItem>.
// ============================================================================

import { useState } from "react";
import type { ShelfPillarTodoItem, ShelfTodoChecklistItem } from "../../types/grid";

function newChecklistId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `ck-${Date.now().toString(36)}`;
  }
}

export interface DoingTaskEditorProps {
  task: ShelfPillarTodoItem;
  planeLabel: string;
  planeColor: string;
  onSave: (updates: Partial<ShelfPillarTodoItem>) => void;
  onJump: () => void;
  onClose: () => void;
}

export function DoingTaskEditor({ task, planeLabel, planeColor, onSave, onJump, onClose }: DoingTaskEditorProps) {
  const [title, setTitle] = useState(task.text ?? "");
  const [subtitle, setSubtitle] = useState(task.subtitle ?? "");
  const [note, setNote] = useState(task.note ?? "");
  const [tag, setTag] = useState(task.tag ?? "");
  const [date, setDate] = useState(task.date ?? "");
  const [fixedMeeting, setFixedMeeting] = useState(!!task.fixedMeeting);
  const [done, setDone] = useState(!!task.done);
  const [checklist, setChecklist] = useState<ShelfTodoChecklistItem[]>(
    () => (task.checklist ?? []).map((c) => ({ ...c })),
  );

  const addSubtask = () => setChecklist((cs) => [...cs, { id: newChecklistId(), text: "", done: false }]);
  const editSubtask = (id: string, patch: Partial<ShelfTodoChecklistItem>) =>
    setChecklist((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const removeSubtask = (id: string) => setChecklist((cs) => cs.filter((c) => c.id !== id));

  const save = () => {
    const cleanedChecklist = checklist
      .map((c) => ({ ...c, text: c.text.trim() }))
      .filter((c) => c.text);
    onSave({
      text: title.trim() || task.text,
      subtitle: subtitle.trim() || undefined,
      note: note.trim() ? note : undefined,
      tag: tag.trim() || undefined,
      date: date.trim() || undefined,
      checklist: cleanedChecklist.length ? cleanedChecklist : undefined,
      fixedMeeting: fixedMeeting || undefined,
      done,
    });
    onClose();
  };

  return (
    // Pinned to the canvas with `inset: 0` (NOT fixed, NOT portaled) — fills the
    // canvas box exactly, corners clipped by the canvas's overflow:hidden+radius.
    <div className="nf-te" role="dialog" aria-modal="true">
      {/* fixed top bar */}
      <div className="nf-te-head">
        <div className="nf-te-eyebrow">
          <span className="nf-te-dot" style={{ background: planeColor }} aria-hidden="true" />
          <span className="nf-te-plane">{planeLabel}</span>
          <span className="nf-te-kicker">Edit task</span>
        </div>
        <div className="nf-te-actions">
          <button type="button" className="nf-editor-ghost" onClick={onJump}>Jump to node</button>
          <button type="button" className="nf-editor-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="nf-editor-save" onClick={save}>Save changes</button>
          <button type="button" className="nf-te-close" onClick={onClose} aria-label="Close">×</button>
        </div>
      </div>

      {/* the only scroll region — body grows/scrolls inside the box */}
      <div className="nf-te-body">
        <div className="nf-te-grid">
          {/* left column */}
          <div className="nf-te-col">
            <label className="nf-fld">
              <span className="nf-fld-lab">Title</span>
              <input className="nf-fld-input nf-te-title" autoFocus value={title} placeholder="Task title"
                onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="nf-fld">
              <span className="nf-fld-lab">Subtitle</span>
              <input className="nf-fld-input" value={subtitle} placeholder="Optional"
                onChange={(e) => setSubtitle(e.target.value)} />
            </label>
            <label className="nf-fld">
              <span className="nf-fld-lab">Note</span>
              <textarea className="nf-fld-input nf-te-note" value={note} placeholder="Optional"
                onChange={(e) => setNote(e.target.value)} />
            </label>
            <div className="nf-fld">
              <span className="nf-fld-lab">Checklist</span>
              <div className="nf-te-check">
                {checklist.map((c) => (
                  <div key={c.id} className="nf-te-check-row">
                    <input type="checkbox" className="nf-te-cbox" checked={c.done}
                      onChange={(e) => editSubtask(c.id, { done: e.target.checked })} aria-label="Subtask done" />
                    <input className={"nf-fld-input nf-te-check-input" + (c.done ? " is-done" : "")} value={c.text}
                      placeholder="Subtask"
                      onChange={(e) => editSubtask(c.id, { text: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubtask(); } }} />
                    <button type="button" className="nf-te-check-rm" onClick={() => removeSubtask(c.id)} aria-label="Remove subtask">×</button>
                  </div>
                ))}
                <button type="button" className="nf-te-check-add" onClick={addSubtask}>+ Add subtask</button>
              </div>
            </div>
          </div>

          {/* right column */}
          <div className="nf-te-col">
            <label className="nf-fld">
              <span className="nf-fld-lab">Tag</span>
              <input className="nf-fld-input" value={tag} placeholder="Optional"
                onChange={(e) => setTag(e.target.value)} />
            </label>
            <label className="nf-fld">
              <span className="nf-fld-lab">Deadline</span>
              <input className="nf-fld-input" type="datetime-local" value={date}
                onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className={"nf-te-toggle" + (fixedMeeting ? " on" : "")}>
              <input type="checkbox" className="nf-te-cbox" checked={fixedMeeting}
                onChange={(e) => setFixedMeeting(e.target.checked)} />
              <span className="nf-te-toggle-lab">Fixed meeting <span className="nf-te-toggle-sub">— show start time, not a countdown</span></span>
            </label>
            <label className={"nf-te-toggle" + (done ? " on" : "")}>
              <input type="checkbox" className="nf-te-cbox" checked={done}
                onChange={(e) => setDone(e.target.checked)} />
              <span className="nf-te-toggle-lab">Completed</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
