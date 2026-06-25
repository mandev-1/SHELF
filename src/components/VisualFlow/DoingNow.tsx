// ============================================================================
// "Doing now" — bottom pull-up pipeline drawer  (component + state hook)
// ----------------------------------------------------------------------------
// Based on handoff 010. The drawer holds ONE active item + a queue of "up next"
// items. An item is either a TASK (resolves to a Visual Flow todo) or a BLOCKER
// (handoff 011 — a time block that auto-jumps to the active slot when its start
// time hits). Persistence is CONTROLLED via props (`state` + `onChange`) — ShELF
// persists through useShelfStorage (`visualFlow.doingNow`), never localStorage.
//
// DATA MODEL
//   The pipeline is an ORDERED ARRAY OF IDS (max 7 = 1 active + 6 queued); index
//   0 is active. Ids are task ids or blocker ids. `resolve(id)` returns a
//   DoingTask carrying everything the card needs (blocker phase/status baked in).
// ============================================================================

import { Fragment, useCallback, useMemo } from "react";
import type { MouseEventHandler, ReactNode } from "react";

export const NF_DOING_MAX = 7; // 1 active + 6 queued

export type DoingItemKind = "task" | "blocker";
export type DoingBlockerPhase = "pending" | "active" | "ended";

/** A resolved pipeline item — `resolve(id)` returns this. */
export interface DoingTask {
  kind: DoingItemKind;
  id: string;
  title: string;
  // task fields
  plane?: string;
  planeLabel?: string;
  planeColor?: string;
  subtitle?: string;
  note?: string;
  tag?: string;
  done?: boolean;
  // blocker fields (precomputed by the host against the current time)
  phase?: DoingBlockerPhase;
  statusText?: string;
  /** Just the blocker's start time (e.g. "14:45") — shown muted in the compact stack. */
  startText?: string;
}

/** Persisted pipeline slice (lives at `visualFlow.doingNow`). */
export interface DoingPipelineState {
  pipeline: string[];
  open: boolean;
}

function blockerDotColor(phase?: DoingBlockerPhase): string {
  return phase === "active" ? "#ef4444" : phase === "ended" ? "var(--dim)" : "#e6b400";
}

// ─────────────────────────────────────────────────────────────────────────────
// The hook — owns pipeline mutations over CONTROLLED state.
//   state      : the persisted { pipeline, open } slice
//   onChange   : persist the next slice (e.g. write visualFlow.doingNow)
//   resolve    : (id) => DoingTask | null — look up a live task/blocker
//   onComplete : optional side-effect when the active item is finished/cleared
//   onEdit     : optional — open the editor for an item (task editor / blocker editor)
// ─────────────────────────────────────────────────────────────────────────────
export function useDoingPipeline({
  state,
  onChange,
  resolve,
  onComplete,
  onEdit,
}: {
  state: DoingPipelineState;
  onChange: (next: DoingPipelineState) => void;
  resolve: (id: string) => DoingTask | null | undefined;
  onComplete?: (id: string) => void;
  onEdit?: (item: DoingTask) => void;
}) {
  const { pipeline, open } = state;

  const tasks = useMemo(
    () => pipeline.map((id) => resolve(id)).filter(Boolean).slice(0, NF_DOING_MAX) as DoingTask[],
    [pipeline, resolve],
  );

  const active = tasks[0] || null;
  const queue = tasks.slice(1, NF_DOING_MAX);

  const inPipeline = useCallback((id: string) => pipeline.includes(id), [pipeline]);
  const isFull = pipeline.length >= NF_DOING_MAX;

  const add = useCallback((id: string) => {
    if (pipeline.includes(id) || pipeline.length >= NF_DOING_MAX) {
      onChange({ pipeline, open: true });
      return;
    }
    onChange({ pipeline: [...pipeline, id], open: true });
  }, [pipeline, onChange]);

  const remove = useCallback((id: string) => onChange({ pipeline: pipeline.filter((x) => x !== id), open }), [pipeline, open, onChange]);
  const promote = useCallback((id: string) => onChange({ pipeline: [id, ...pipeline.filter((x) => x !== id)], open }), [pipeline, open, onChange]); // pull to active
  const toggle = useCallback(() => onChange({ pipeline, open: !open }), [pipeline, open, onChange]);
  const setOpen = useCallback((v: boolean) => onChange({ pipeline, open: v }), [pipeline, onChange]);

  const complete = useCallback(() => {
    const id = pipeline[0];
    if (id == null) return;
    if (onComplete) onComplete(id);
    onChange({ pipeline: pipeline.filter((x) => x !== id), open });
  }, [pipeline, open, onComplete, onChange]);

  const drawerProps: DoingNowProps = {
    active,
    queue,
    open,
    onToggle: toggle,
    onComplete: complete,
    onPromote: promote,
    onRemove: remove,
    onEdit: onEdit || (() => {}),
  };

  return { drawerProps, add, remove, promote, complete, toggle, setOpen, inPipeline, isFull, active, queue, count: tasks.length };
}

export interface DoingNowProps {
  active: DoingTask | null;
  queue: DoingTask[];
  open: boolean;
  onToggle: () => void;
  onComplete: () => void;
  onPromote: (id: string) => void;
  onRemove: (id: string) => void;
  onEdit: (item: DoingTask) => void;
  /** Right-click anywhere on the drawer → host opens a menu (e.g. "Add blocker"). */
  onContextMenu?: MouseEventHandler<HTMLDivElement>;
}

// ─────────────────────────────────────────────────────────────────────────────
// The drawer (presentational). Task markup is verbatim from handoff 010; blocker
// items render with a hazard tint + countdown (handoff 011 vocabulary).
// ─────────────────────────────────────────────────────────────────────────────
export function DoingNow({ active, queue, open, onToggle, onComplete, onPromote, onRemove, onEdit, onContextMenu }: DoingNowProps) {
  const count = (active ? 1 : 0) + queue.length;
  return (
    <Fragment>
      {/* bottom handle tab */}
      <button type="button" className={"nf-doing-handle" + (open ? " on" : "")}
        style={{ bottom: open ? "var(--nf-doing-h)" : 0 }}
        onClick={onToggle} title="Doing now" aria-expanded={open}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 15l6-6 6 6" /></svg>
        <span className="nf-doing-handle-lab">Doing now</span>
        {count > 0 && <span className="nf-doing-handle-count">{count}</span>}
      </button>

      {/* the panel */}
      <div className={"nf-doing" + (open ? " open" : "")} aria-hidden={!open} onContextMenu={onContextMenu}>
        <div className="nf-doing-inner">
          {/* active item */}
          <div className="nf-doing-now">
            <div className="nf-doing-eyebrow">Doing now</div>
            {active ? (
              active.kind === "blocker" ? (
                <div className={"nf-doing-active nf-doing-active--blocker nf-doing-active--" + (active.phase ?? "pending")}>
                  <div className="nf-doing-active-head">
                    <span className="nf-doing-active-dot" style={{ background: blockerDotColor(active.phase) }} aria-hidden="true"></span>
                    <span className="nf-doing-active-plane">⛔ Blocker</span>
                  </div>
                  <button type="button" className="nf-doing-active-title" onClick={() => onEdit(active)} title="Edit blocker">
                    {active.title}
                  </button>
                  {active.statusText && <div className="nf-doing-active-note">{active.statusText}</div>}
                  <div className="nf-doing-active-foot">
                    <button type="button" className="nf-doing-done" onClick={onComplete}>✓ Clear</button>
                    <button type="button" className="nf-doing-jump" onClick={() => onEdit(active)}>Edit</button>
                  </div>
                </div>
              ) : (
                <div className="nf-doing-active">
                  <div className="nf-doing-active-head">
                    <span className="nf-doing-active-dot" style={{ background: active.planeColor }} aria-hidden="true"></span>
                    <span className="nf-doing-active-plane">{active.planeLabel}</span>
                    {active.tag && <span className="nf-doing-active-tag">{active.tag}</span>}
                  </div>
                  <button type="button" className={"nf-doing-active-title" + (active.done ? " done" : "")} onClick={() => onEdit(active)} title="Edit task">
                    {active.subtitle ? active.title + " · " + active.subtitle : active.title}
                  </button>
                  {active.note && <div className="nf-doing-active-note">{active.note}</div>}
                  <div className="nf-doing-active-foot">
                    <button type="button" className="nf-doing-done" onClick={onComplete}>✓ Done &amp; next</button>
                    <button type="button" className="nf-doing-jump" onClick={() => onEdit(active)}>Edit</button>
                  </div>
                </div>
              )
            ) : (
              <div className="nf-doing-empty">Nothing in progress.<br />Right-click a task → <span>Add to Doing now</span>.</div>
            )}
          </div>

          {/* advance arrows */}
          <div className="nf-doing-arrows" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <svg key={i} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path strokeLinecap="round" strokeLinejoin="round" d="M15 6l-6 6 6 6" /></svg>
            ))}
          </div>

          {/* up-next pipeline */}
          <div className="nf-doing-pipe">
            <div className="nf-doing-pipe-lab">Up next <span>{queue.length}/{NF_DOING_MAX - 1}</span></div>
            <div className="nf-doing-pipe-row">
              {queue.length === 0 ? (
                <div className="nf-doing-pipe-empty">Queue is empty — pull tasks in from the canvas.</div>
              ) : (() => {
                // When 2+ blockers are queued, collapse them into ONE compact
                // vertical stack of mini-rows (instead of a full card each), so a
                // run of time-blocks doesn't eat the whole "Up next" row. A lone
                // blocker keeps its normal card. Indices stay the queue position.
                const stackBlockers = queue.filter((t) => t.kind === "blocker").length >= 2;
                const cards: ReactNode[] = [];
                const minis: ReactNode[] = [];
                queue.forEach((t, i) => {
                  if (t.kind === "blocker" && stackBlockers) {
                    minis.push(
                      <div key={t.id} className={"nf-doing-blocker-mini nf-doing-card--" + (t.phase ?? "pending")}>
                        <button type="button" className="nf-doing-blocker-mini-title" onClick={() => onEdit(t)} title={(t.statusText ? t.title + " · " + t.statusText : t.title) + " — edit blocker"}>
                          {t.title}
                          {t.startText && <span className="nf-doing-blocker-mini-time"> ({t.startText})</span>}
                        </button>
                        <span className="nf-doing-blocker-mini-idx">{i + 1}</span>
                        <button type="button" className="nf-doing-blocker-mini-btn" onClick={() => onPromote(t.id)} title="Pull into Doing now" aria-label="Pull into Doing now">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 6l-6 6 6 6" /></svg>
                        </button>
                        <button type="button" className="nf-doing-blocker-mini-rm" onClick={() => onRemove(t.id)} title="Remove from queue" aria-label="Remove">×</button>
                      </div>
                    );
                  } else if (t.kind === "blocker") {
                    cards.push(
                      <div key={t.id} className={"nf-doing-card nf-doing-card--blocker nf-doing-card--" + (t.phase ?? "pending")}>
                        <span className="nf-doing-card-idx">{i + 1}</span>
                        <span className="nf-doing-card-dot" style={{ background: blockerDotColor(t.phase) }} aria-hidden="true"></span>
                        <button type="button" className="nf-doing-card-title" onClick={() => onEdit(t)} title="Edit blocker">
                          {t.title}
                        </button>
                        {t.statusText && <div className="nf-doing-card-sub">{t.statusText}</div>}
                        <div className="nf-doing-card-actions">
                          <button type="button" className="nf-doing-card-promote" onClick={() => onPromote(t.id)} title="Pull into Doing now" aria-label="Pull into Doing now">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 6l-6 6 6 6" /></svg>
                          </button>
                          <button type="button" className="nf-doing-card-rm" onClick={() => onRemove(t.id)} title="Remove from queue" aria-label="Remove">×</button>
                        </div>
                      </div>
                    );
                  } else {
                    cards.push(
                      <div key={t.id} className={"nf-doing-card" + (t.done ? " done" : "")}>
                        <span className="nf-doing-card-idx">{i + 1}</span>
                        <span className="nf-doing-card-dot" style={{ background: t.planeColor }} aria-hidden="true"></span>
                        <button type="button" className="nf-doing-card-title" onClick={() => onEdit(t)} title={(t.subtitle ? t.title + " · " + t.subtitle : t.title) + " — edit task"}>
                          {t.subtitle ? t.title + " · " + t.subtitle : t.title}
                        </button>
                        <div className="nf-doing-card-actions">
                          <button type="button" className="nf-doing-card-promote" onClick={() => onPromote(t.id)} title="Pull into Doing now" aria-label="Pull into Doing now">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 6l-6 6 6 6" /></svg>
                          </button>
                          <button type="button" className="nf-doing-card-rm" onClick={() => onRemove(t.id)} title="Remove from queue" aria-label="Remove">×</button>
                        </div>
                      </div>
                    );
                  }
                });
                return (
                  <>
                    {cards}
                    {minis.length > 0 && <div className="nf-doing-blocker-stack">{minis}</div>}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </Fragment>
  );
}
