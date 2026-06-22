// ============================================================================
// "Doing now" — bottom pull-up pipeline drawer  (component + state hook)
// ----------------------------------------------------------------------------
// Pair with doing-now.css. Two exports:
//   • <DoingNow … />        — the presentational drawer (verbatim from ShELF).
//   • useDoingPipeline(...)  — a drop-in hook that owns the pipeline state and
//                              hands you the exact props <DoingNow> wants, plus
//                              helpers to wire into your nodes (add/remove/etc).
//
// DATA MODEL
//   The pipeline is just an ORDERED ARRAY OF TASK IDS (max 7 = 1 active + 6
//   queued). Position 0 is the active task; 1..6 are "up next". You supply a
//   `resolve(id) -> task` function so the drawer can look up live task data:
//
//     task = { id, plane, title, subtitle?, note?, tag?, done? }
//
//   `plane` is a key into your PLANES map (label + color). If you don't have
//   planes/lanes, pass a single-entry map and give every task that key.
// ============================================================================

const NF_DOING_MAX = 7; // 1 active + 6 queued

// Plane = a lane/category. Replace with your own; keys must match task.plane.
// `color` can be any CSS color or var(). `label` shows on the active card.
const DOING_PLANES = {
  main:      { label: "Main flow",      color: "#0070f2" },
  grazeland: { label: "Grazeland",      color: "#16a34a" },
  drone:     { label: "Drone build",    color: "#9333ea" },
  bin:       { label: "Bin",            color: "#64748b" },
  buneka:    { label: "Buneka [IDEA]",  color: "#e11d8f" },
};
function doingPlaneLabel(id) { return (DOING_PLANES[id] && DOING_PLANES[id].label) || id; }
function doingPlaneColor(id) { return (DOING_PLANES[id] && DOING_PLANES[id].color) || "var(--accent)"; }

// ─────────────────────────────────────────────────────────────────────────────
// The hook — owns pipeline state, persistence, and all mutations.
//   resolve(id)  : (id) => task | undefined   — look up live task data
//   onComplete(id): optional side-effect when a task is finished (e.g. mark the
//                   node done in YOUR store). The hook also drops it from queue.
//   onJump(plane, id): optional — focus the node on your canvas.
//   storageKey   : optional localStorage key to persist the order + open state.
// ─────────────────────────────────────────────────────────────────────────────
function useDoingPipeline({ resolve, onComplete, onJump, storageKey } = {}) {
  const { useState, useEffect, useCallback, useMemo } = React;

  const [state, setState] = useState(() => {
    if (storageKey) {
      try {
        const s = JSON.parse(localStorage.getItem(storageKey));
        if (s && Array.isArray(s.pipeline)) return { pipeline: s.pipeline, open: !!s.open };
      } catch (e) { /* ignore */ }
    }
    return { pipeline: [], open: false };
  });
  useEffect(() => {
    if (!storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }, [state, storageKey]);

  const setPipeline = useCallback((fn) => setState((s) => ({ ...s, pipeline: fn(s.pipeline) })), []);

  // resolve ids → live tasks, drop any that no longer exist, cap at max
  const tasks = useMemo(() => state.pipeline
    .map((id) => (resolve ? resolve(id) : null))
    .filter(Boolean)
    .slice(0, NF_DOING_MAX), [state.pipeline, resolve]);

  const active = tasks[0] || null;
  const queue = tasks.slice(1, NF_DOING_MAX);

  const inPipeline = useCallback((id) => state.pipeline.includes(id), [state.pipeline]);
  const isFull = state.pipeline.length >= NF_DOING_MAX;

  const add = useCallback((id) => {
    setPipeline((p) => (p.includes(id) || p.length >= NF_DOING_MAX) ? p : [...p, id]);
    setState((s) => ({ ...s, open: true }));
  }, [setPipeline]);
  const remove   = useCallback((id) => setPipeline((p) => p.filter((x) => x !== id)), [setPipeline]);
  const promote  = useCallback((id) => setPipeline((p) => [id, ...p.filter((x) => x !== id)]), [setPipeline]); // pull to active
  const toggle   = useCallback(() => setState((s) => ({ ...s, open: !s.open })), []);
  const setOpen  = useCallback((v) => setState((s) => ({ ...s, open: v })), []);

  const complete = useCallback(() => {
    setState((s) => {
      const id = s.pipeline[0];
      if (id == null) return s;
      if (onComplete) onComplete(id);
      return { ...s, pipeline: s.pipeline.filter((x) => x !== id) };
    });
  }, [onComplete]);

  // props ready to spread onto <DoingNow {...drawerProps} />
  const drawerProps = {
    active, queue,
    open: state.open,
    onToggle: toggle,
    onComplete: complete,
    onPromote: promote,
    onRemove: remove,
    onJump: onJump || (() => {}),
  };

  return { drawerProps, add, remove, promote, complete, toggle, setOpen, inPipeline, isFull, active, queue, count: tasks.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// The drawer (presentational). Verbatim structure from ShELF's node canvas.
// ─────────────────────────────────────────────────────────────────────────────
function DoingNow({ active, queue, open, onToggle, onComplete, onPromote, onRemove, onJump }) {
  const count = (active ? 1 : 0) + queue.length;
  return (
    <React.Fragment>
      {/* bottom handle tab */}
      <button type="button" className={"nf-doing-handle" + (open ? " on" : "")}
        style={{ bottom: open ? "var(--nf-doing-h)" : 0 }}
        onClick={onToggle} title="Doing now" aria-expanded={open}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 15l6-6 6 6" /></svg>
        <span className="nf-doing-handle-lab">Doing now</span>
        {count > 0 && <span className="nf-doing-handle-count">{count}</span>}
      </button>

      {/* the panel */}
      <div className={"nf-doing" + (open ? " open" : "")} aria-hidden={!open}>
        <div className="nf-doing-inner">
          {/* active task */}
          <div className="nf-doing-now">
            <div className="nf-doing-eyebrow">Doing now</div>
            {active ? (
              <div className="nf-doing-active">
                <div className="nf-doing-active-head">
                  <span className="nf-doing-active-dot" style={{ background: doingPlaneColor(active.plane) }} aria-hidden="true"></span>
                  <span className="nf-doing-active-plane">{doingPlaneLabel(active.plane)}</span>
                  {active.tag && <span className="nf-doing-active-tag">{active.tag}</span>}
                </div>
                <button type="button" className={"nf-doing-active-title" + (active.done ? " done" : "")} onClick={() => onJump(active.plane, active.id)} title="Jump to node">
                  {active.subtitle ? active.title + " · " + active.subtitle : active.title}
                </button>
                {active.note && <div className="nf-doing-active-note">{active.note}</div>}
                <div className="nf-doing-active-foot">
                  <button type="button" className="nf-doing-done" onClick={onComplete}>✓ Done &amp; next</button>
                  <button type="button" className="nf-doing-jump" onClick={() => onJump(active.plane, active.id)}>Jump</button>
                </div>
              </div>
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
              ) : (
                queue.map((t, i) => (
                  <div key={t.id} className={"nf-doing-card" + (t.done ? " done" : "")}>
                    <span className="nf-doing-card-idx">{i + 1}</span>
                    <span className="nf-doing-card-dot" style={{ background: doingPlaneColor(t.plane) }} aria-hidden="true"></span>
                    <button type="button" className="nf-doing-card-title" onClick={() => onJump(t.plane, t.id)} title={(t.subtitle ? t.title + " · " + t.subtitle : t.title) + " — jump to node"}>
                      {t.subtitle ? t.title + " · " + t.subtitle : t.title}
                    </button>
                    <div className="nf-doing-card-actions">
                      <button type="button" className="nf-doing-card-promote" onClick={() => onPromote(t.id)} title="Pull into Doing now" aria-label="Pull into Doing now">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 6l-6 6 6 6" /></svg>
                      </button>
                      <button type="button" className="nf-doing-card-rm" onClick={() => onRemove(t.id)} title="Remove from queue" aria-label="Remove">×</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

// expose for the demo / non-module usage
if (typeof window !== "undefined") {
  Object.assign(window, { DoingNow, useDoingPipeline, DOING_PLANES, NF_DOING_MAX });
}
