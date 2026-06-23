// ============================================================================
// Blockers — time-block nodes for a canvas (handoff 011)
// ----------------------------------------------------------------------------
// Ported 1:1 from `.handoffs/011---handoff-blockers/Blockers.jsx`. The helpers
// and the presentational <BlockerNode> / <BlockerDraft> markup are verbatim;
// only TS types were added. The handoff's `useBlockers` hook (which owned a
// local array + localStorage) is NOT ported — VisualFlowPanel owns the blocker
// array via `visualFlow.blockers` and runs the clock / fire-once itself, per the
// project rule that persisted state goes through useShelfStorage.
//
// DATA MODEL
//   blocker = { id, x, y, label, due (ms epoch = START), dur (minutes) }
//   x / y are flow-space coordinates (rendered inside React Flow's ViewportPortal).
// ============================================================================

import { Fragment } from "react";
import type { Blocker } from "../../types/grid";

export const NF_BLOCKER_DURS = [30, 45, 60]; // flip-toggle options (minutes)

export function nfDurLabel(min: number): string {
  return min >= 60 ? (min % 60 === 0 ? min / 60 + "h" : Math.floor(min / 60) + "h" + (min % 60) + "m") : min + "m";
}
function nfClock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function nfDueVal(due: number | string | null | undefined): number {
  if (due == null) return Infinity;
  const ms = typeof due === "number" ? due : Date.parse(due);
  return isNaN(ms) ? Infinity : ms;
}
// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in LOCAL time
export function nfToDatetimeLocal(due: number | string | null | undefined): string {
  if (due == null) return "";
  const ms = typeof due === "number" ? due : Date.parse(due);
  if (isNaN(ms)) return "";
  const d = new Date(ms - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

export type BlockerPhase = "pending" | "active" | "ended";
export interface BlockerStatus {
  phase: BlockerPhase;
  text: string;
  win?: string;
  left?: number;
}

// three-phase status of a time block at a given `now`
export function nfBlockerStatus(due: number, dur: number, now: number): BlockerStatus {
  const start = nfDueVal(due);
  if (start === Infinity) return { phase: "pending", text: "no time set" };
  const end = start + (dur || 30) * 60000;
  const win = nfClock(start) + "–" + nfClock(end);
  if (now < start) {
    const mm = Math.round((start - now) / 60000);
    const rel = mm < 60 ? mm + "m" : Math.round(mm / 60) + "h";
    return { phase: "pending", text: win + " · in " + rel, win };
  }
  if (now < end) {
    const left = Math.max(1, Math.round((end - now) / 60000));
    return { phase: "active", text: "Blocking · " + left + "m left", win, left };
  }
  return { phase: "ended", text: win + " · ended", win };
}

// ─────────────────────────────────────────────────────────────────────────────
// Blocker node (presentational). In ShELF it renders inside React Flow's
// ViewportPortal, so `blocker.x/.y` drive `left/top` in flow coordinates.
// ─────────────────────────────────────────────────────────────────────────────
export interface BlockerNodeProps {
  blocker: Blocker;
  now: number;
  dragging?: boolean;
  flashing?: boolean;
  onEdit?: (e: React.MouseEvent) => void;
  onClear?: () => void;
  onPointerDown?: (e: React.PointerEvent) => void;
}

export function BlockerNode({ blocker, now, dragging, flashing, onEdit, onClear, onPointerDown }: BlockerNodeProps) {
  const st = nfBlockerStatus(blocker.due, blocker.dur, now);
  return (
    <div
      // `nopan nodrag` — keep React Flow's pane from panning/capturing the pointer
      // so our custom drag (onPointerDown → updateBlocker) actually moves the node.
      className={"nf-blocker nopan nodrag nf-blocker--" + st.phase + (dragging ? " nf-blocker--dragging" : "") + (flashing ? " nf-blocker--flash" : "")}
      style={{ left: blocker.x, top: blocker.y }}
      onPointerDown={onPointerDown}
      onContextMenu={(e) => { e.preventDefault(); onEdit && onEdit(e); }}>
      <div className="nf-blocker-stripe" aria-hidden="true"></div>
      <div className="nf-blocker-body">
        <div className="nf-blocker-head">
          <svg className="nf-blocker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            {st.phase === "active"
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M5 11V7a7 7 0 0 1 14 0v4M4 11h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9z" />}
          </svg>
          <span className="nf-blocker-title">{blocker.label}</span>
          <span className="nf-blocker-dur">{nfDurLabel(blocker.dur || 30)}</span>
        </div>
        <div className="nf-blocker-time">{st.phase === "active" ? "⛔ " + st.text : st.text}</div>
      </div>
      {(st.phase === "active" || st.phase === "ended") && (
        <button type="button" className="nf-blocker-dismiss" title="Dismiss blocker"
          onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onClear && onClear(); }}>Clear</button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Draft popover — create or edit. `x`/`y` are SCREEN coords (popover position);
// `fx`/`fy` carry the flow-space point for create (ignored by this component).
// ─────────────────────────────────────────────────────────────────────────────
export interface BlockerDraftState {
  x: number;
  y: number;
  /** flow-space point for a new blocker */
  fx?: number;
  fy?: number;
  label: string;
  /** datetime-local string */
  due: string;
  dur: number;
  /** id of the blocker being edited, if any */
  edit?: string;
}

export interface BlockerDraftProps {
  draft: BlockerDraftState;
  setDraft: React.Dispatch<React.SetStateAction<BlockerDraftState | null>>;
  onCommit: () => void;
  onCancel: () => void;
}

export function BlockerDraft({ draft, setDraft, onCommit, onCancel }: BlockerDraftProps) {
  // Positioned entirely in CSS as a top-anchored, centered, height-capped modal
  // (NOT click-anchored). The create flow opens from the bottom Doing-now drawer,
  // so a popover placed at the click point slid under the viewport's bottom edge;
  // anchoring high + max-height/scroll guarantees the footer is always reachable.
  return (
    <Fragment>
      <div className="nf-menu-scrim" onMouseDown={onCancel} onContextMenu={(e) => { e.preventDefault(); onCancel(); }}></div>
      <div className="nf-blocker-draft" onMouseDown={(e) => e.stopPropagation()}>
        <div className="nf-blocker-draft-title">⛔ {draft.edit ? "Edit blocker" : "New blocker"}</div>
        <label className="nf-fld">
          <span className="nf-fld-lab">Label</span>
          <input className="nf-fld-input" autoFocus value={draft.label} placeholder="e.g. Leave for the airport"
            onChange={(e) => setDraft((d) => (d ? { ...d, label: e.target.value } : d))}
            onKeyDown={(e) => { if (e.key === "Enter" && draft.due) onCommit(); }} />
        </label>
        <label className="nf-fld">
          <span className="nf-fld-lab">Starts</span>
          <input className="nf-fld-input" type="datetime-local" value={draft.due}
            onChange={(e) => setDraft((d) => (d ? { ...d, due: e.target.value } : d))} />
        </label>
        <div className="nf-fld">
          <span className="nf-fld-lab">Duration</span>
          <div className="nf-blocker-seg">
            {NF_BLOCKER_DURS.map((min) => (
              <button key={min} type="button" className={"nf-blocker-seg-btn" + ((draft.dur || 30) === min ? " on" : "")}
                onClick={() => setDraft((d) => (d ? { ...d, dur: min } : d))}>{nfDurLabel(min)}</button>
            ))}
          </div>
        </div>
        <div className="nf-blocker-draft-foot">
          <button type="button" className="nf-editor-ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="nf-editor-save" disabled={!draft.due} onClick={onCommit}>{draft.edit ? "Save" : "Set blocker"}</button>
        </div>
      </div>
    </Fragment>
  );
}
