// ============================================================================
// Blockers — time-block nodes for a canvas  (logic + components)
// ----------------------------------------------------------------------------
// Pair with blockers.css. Exports:
//   • useBlockers({ storageKey, onFire })  — owns blocker state, the ticking
//        clock, persistence, and fires onFire(blocker) once when one goes active.
//   • <BlockerNode blocker now onEdit onClear onPointerDown onContextMenu/>
//   • <BlockerDraft draft setDraft onCommit onCancel/>  — the create/edit popover
//   • <BlockerMenu .../>                                — right-click menu
//   • helpers: nfBlockerStatus, nfDurLabel, NF_BLOCKER_DURS, nfToDatetimeLocal
//
// DATA MODEL
//   blocker = { id, x, y, label, due (ms epoch, the START), dur (minutes) }
//   x / y are whatever coordinate space your canvas uses (the demo stores px
//   relative to the stage; ShELF stores 0–100% of a fixed world). The hook is
//   agnostic — it just persists what you hand it.
// ============================================================================

const NF_BLOCKER_DURS = [30, 45, 60]; // flip-toggle options (minutes)

function nfDurLabel(min) {
  return min >= 60 ? (min % 60 === 0 ? (min / 60) + "h" : Math.floor(min / 60) + "h" + (min % 60) + "m") : min + "m";
}
function nfClock(ms) { return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function nfDueVal(due) {
  if (due == null) return Infinity;
  const ms = typeof due === "number" ? due : Date.parse(due);
  return isNaN(ms) ? Infinity : ms;
}
// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in LOCAL time
function nfToDatetimeLocal(due) {
  if (due == null) return "";
  const ms = typeof due === "number" ? due : Date.parse(due);
  if (isNaN(ms)) return "";
  const d = new Date(ms - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}
// three-phase status of a time block at a given `now`
function nfBlockerStatus(due, dur, now) {
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
// Hook — state, persistence, ticking clock, and one-shot firing.
//   onFire(blocker) runs once when a blocker crosses into its active window.
//   storageKey (optional) persists the blocker array to localStorage.
// ─────────────────────────────────────────────────────────────────────────────
function useBlockers({ storageKey, onFire } = {}) {
  const { useState, useEffect, useRef, useCallback } = React;

  const [blockers, setBlockers] = useState(() => {
    if (storageKey) {
      try { const s = JSON.parse(localStorage.getItem(storageKey)); if (Array.isArray(s)) return s; } catch (e) { /* ignore */ }
    }
    return [];
  });
  useEffect(() => {
    if (!storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(blockers)); } catch (e) { /* ignore */ }
  }, [blockers, storageKey]);

  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(t); }, []);

  const add = useCallback((x, y, label, dueMs, dur) => {
    const id = "blk-" + Date.now().toString(36);
    setBlockers((bs) => [...bs, { id, x, y, label: label || "Blocker", due: dueMs, dur: dur || 30 }]);
    return id;
  }, []);
  const update = useCallback((id, patch) => setBlockers((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b))), []);
  const remove = useCallback((id) => setBlockers((bs) => bs.filter((b) => b.id !== id)), []);

  // fire once when a blocker enters its active window
  const firedRef = useRef({});
  useEffect(() => {
    blockers.forEach((b) => {
      const st = nfBlockerStatus(b.due, b.dur, now);
      if (st.phase === "active" && !firedRef.current[b.id]) {
        firedRef.current[b.id] = true;
        onFire && onFire(b);
      }
      if (st.phase === "pending") firedRef.current[b.id] = false; // re-arm if start moved later
    });
  }, [now, blockers, onFire]);

  return { blockers, now, add, update, remove };
}

// ─────────────────────────────────────────────────────────────────────────────
// Blocker node (presentational). Position it via style on the wrapper, or let
// `blocker.x/.y` drive `left/top` as the demo does.
// ─────────────────────────────────────────────────────────────────────────────
function BlockerNode({ blocker, now, dragging, flashing, onEdit, onClear, onPointerDown }) {
  const st = nfBlockerStatus(blocker.due, blocker.dur, now);
  return (
    <div
      className={"nf-blocker nf-blocker--" + st.phase + (dragging ? " nf-blocker--dragging" : "") + (flashing ? " nf-blocker--flash" : "")}
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
// Draft popover — create or edit. `draft` shape:
//   { x, y, label, due (datetime-local string), dur (min), edit?: id }
// ─────────────────────────────────────────────────────────────────────────────
function BlockerDraft({ draft, setDraft, onCommit, onCancel }) {
  return (
    <React.Fragment>
      <div className="nf-menu-scrim" onMouseDown={onCancel} onContextMenu={(e) => { e.preventDefault(); onCancel(); }}></div>
      <div className="nf-blocker-draft"
        style={{ left: Math.max(8, Math.min(draft.x, window.innerWidth - 280)), top: Math.max(8, Math.min(draft.y, window.innerHeight - 260)) }}
        onMouseDown={(e) => e.stopPropagation()}>
        <div className="nf-blocker-draft-title">⛔ {draft.edit ? "Edit blocker" : "New blocker"}</div>
        <label className="nf-fld">
          <span className="nf-fld-lab">Label</span>
          <input className="nf-fld-input" autoFocus value={draft.label} placeholder="e.g. Leave for the airport"
            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            onKeyDown={(e) => { if (e.key === "Enter" && draft.due) onCommit(); }} />
        </label>
        <label className="nf-fld">
          <span className="nf-fld-lab">Starts</span>
          <input className="nf-fld-input" type="datetime-local" value={draft.due}
            onChange={(e) => setDraft((d) => ({ ...d, due: e.target.value }))} />
        </label>
        <div className="nf-fld">
          <span className="nf-fld-lab">Duration</span>
          <div className="nf-blocker-seg">
            {NF_BLOCKER_DURS.map((min) => (
              <button key={min} type="button" className={"nf-blocker-seg-btn" + ((draft.dur || 30) === min ? " on" : "")}
                onClick={() => setDraft((d) => ({ ...d, dur: min }))}>{nfDurLabel(min)}</button>
            ))}
          </div>
        </div>
        <div className="nf-blocker-draft-foot">
          <button type="button" className="nf-editor-ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="nf-editor-save" disabled={!draft.due} onClick={onCommit}>{draft.edit ? "Save" : "Set blocker"}</button>
        </div>
      </div>
    </React.Fragment>
  );
}

if (typeof window !== "undefined") {
  Object.assign(window, { useBlockers, BlockerNode, BlockerDraft, nfBlockerStatus, nfDurLabel, nfToDatetimeLocal, NF_BLOCKER_DURS });
}
