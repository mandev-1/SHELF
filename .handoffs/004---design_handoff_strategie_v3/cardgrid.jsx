/* ShELF — cardgrid: a proper 12-column dashboard grid for the Strategie cards.
   - Pointer-driven drag-to-place with FLIP slide animations.
   - Dwell-buffered retargeting (target must be hovered ~90ms, then pointer must
     travel 8px before the next move) so cards don't jitter-swap.
   - Edge-drag resize snapped to 4 / 6 / 8 / 12 columns (⅓ · ½ · ⅔ · full).
   - grid-auto-flow dense in CSS keeps rows packed — no holes.
   - Undo stack (floating chip + Cmd/Ctrl+Z), max 30 steps.
   Layout shape: { order: [cardId], w: { cardId: span } } — persisted by the host.
   Loaded BEFORE strategie.jsx; exports to window. */

const DEFAULT_CARD_ORDER = ["hero", "ladder", "diff", "weekly", "flow", "debt", "programs", "accounts", "pots", "pillars", "cats"];
const DEFAULT_CARD_W = { hero: 8, ladder: 4, diff: 4, weekly: 8, flow: 4, debt: 4, programs: 4, accounts: 4, pots: 4, pillars: 4, cats: 8 };
const CARD_W_SNAPS = [4, 6, 8, 12];
const GRID_COLS = 12;

function normalizeCardLayout(stored, legacyOrder) {
  const src = stored && Array.isArray(stored.order) ? stored.order : (Array.isArray(legacyOrder) ? legacyOrder : []);
  const kept = src.filter((id) => DEFAULT_CARD_ORDER.includes(id));
  const order = [...kept, ...DEFAULT_CARD_ORDER.filter((id) => !kept.includes(id))];
  const w = {};
  DEFAULT_CARD_ORDER.forEach((id) => {
    const v = stored && stored.w ? stored.w[id] : undefined;
    w[id] = CARD_W_SNAPS.includes(v) ? v : DEFAULT_CARD_W[id];
  });
  return { order, w };
}

function useCardGrid(layout, setLayout) {
  const { useState, useRef, useEffect, useLayoutEffect } = React;

  const gridRef = useRef(null);
  const slotEls = useRef({});
  const [dragId, setDragId] = useState(null);
  const [resizeId, setResizeId] = useState(null);
  const [undoChip, setUndoChip] = useState(null);

  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const setLayoutRef = useRef(setLayout);
  setLayoutRef.current = setLayout;

  const drag = useRef(null);
  const rz = useRef(null);
  const history = useRef([]);
  const flipFrom = useRef(null);
  const undoTimer = useRef(null);

  const snapW = (s) => CARD_W_SNAPS.reduce((a, b) => (Math.abs(b - s) < Math.abs(a - s) ? b : a));
  const copyLayout = (l) => ({ order: [...l.order], w: { ...l.w } });

  const captureRects = () => {
    const m = {};
    for (const id in slotEls.current) m[id] = slotEls.current[id].getBoundingClientRect();
    return m;
  };

  /* every layout commit first snapshots current visual positions for FLIP */
  const commit = (next) => {
    flipFrom.current = captureRects();
    setLayoutRef.current(next);
  };

  const pushHistory = (snapshot, label) => {
    history.current.push(snapshot);
    if (history.current.length > 30) history.current.shift();
    setUndoChip({ label });
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoChip(null), 6000);
  };

  const undoNow = () => {
    const prev = history.current.pop();
    if (!prev) return;
    commit(prev);
    clearTimeout(undoTimer.current);
    setUndoChip(null);
  };

  /* Cmd/Ctrl+Z anywhere outside a form field */
  useEffect(() => {
    const h = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || (e.key !== "z" && e.key !== "Z")) return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (!history.current.length) return;
      e.preventDefault();
      undoNow();
    };
    window.addEventListener("keydown", h);
    return () => { window.removeEventListener("keydown", h); clearTimeout(undoTimer.current); };
  }, []);

  /* keep the dragged slot glued to the pointer (its grid cell stays in flow) */
  const positionDragged = () => {
    const d = drag.current;
    if (!d || !d.started) return;
    const el = slotEls.current[d.id];
    if (!el) return;
    el.style.transition = "none";
    el.style.transform = "translate(" + (d.px - d.grabX - d.base.left) + "px," + (d.py - d.grabY - d.base.top) + "px)";
  };

  /* FLIP: after a layout commit, slide every card from its old visual spot */
  const layoutKey = layout.order.join("|") + "::" + layout.order.map((id) => layout.w[id]).join(",");
  useLayoutEffect(() => {
    const from = flipFrom.current;
    if (!from) return;
    flipFrom.current = null;
    const d = drag.current && drag.current.started ? drag.current : null;
    const els = slotEls.current;
    // settle in-flight transforms so we measure true cell positions
    for (const id in els) {
      if (d && id === d.id) continue;
      els[id].style.transition = "none";
      els[id].style.transform = "";
    }
    if (gridRef.current) void gridRef.current.offsetWidth;
    const moved = [];
    const rects = {};
    for (const id in els) {
      const el = els[id];
      if (d && id === d.id) {
        el.style.transition = "none";
        el.style.transform = "";
        const nr = el.getBoundingClientRect();
        rects[id] = nr;
        d.base = { left: nr.left, top: nr.top };
        positionDragged();
        continue;
      }
      const nr = el.getBoundingClientRect();
      rects[id] = nr;
      const or = from[id];
      if (!or) continue;
      const dx = or.left - nr.left;
      const dy = or.top - nr.top;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        el.style.transform = "translate(" + dx + "px," + dy + "px)";
        moved.push(el);
      }
    }
    if (d) d.rects = rects; // refreshed hit-test rects (settled positions)
    if (moved.length && gridRef.current) void gridRef.current.offsetWidth;
    for (const el of moved) {
      el.style.transition = "transform 0.22s cubic-bezier(0.2, 0.7, 0.3, 1)";
      el.style.transform = "";
    }
  }, [layoutKey]);

  /* ----- drag to place ----- */
  const onDragMove = (e) => {
    const d = drag.current;
    if (!d) return;
    d.px = e.clientX;
    d.py = e.clientY;
    if (!d.started) {
      if (Math.hypot(e.clientX - d.downX, e.clientY - d.downY) < 5) return;
      d.started = true;
      d.rects = captureRects();
      const r = d.rects[d.id];
      d.base = { left: r.left, top: r.top };
      d.grabX = d.downX - r.left;
      d.grabY = d.downY - r.top;
      setDragId(d.id);
      document.body.classList.add("cards-sorting");
    }
    positionDragged();

    // anti-jitter: after a move, the pointer must travel before retargeting
    if (d.lockX != null) {
      if (Math.hypot(e.clientX - d.lockX, e.clientY - d.lockY) < 8) return;
      d.lockX = d.lockY = null;
    }
    let over = null;
    for (const id in d.rects) {
      if (id === d.id) continue;
      const r = d.rects[id];
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { over = id; break; }
    }
    if (!over) { d.target = null; return; }
    const now = performance.now();
    if (over !== d.target) { d.target = over; d.targetAt = now; return; }
    if (now - d.targetAt < 90) return; // dwell buffer

    const cur = layoutRef.current;
    const from = cur.order.indexOf(d.id);
    const to = cur.order.indexOf(over);
    if (from < 0 || to < 0 || from === to) return;
    const order = [...cur.order];
    order.splice(to, 0, order.splice(from, 1)[0]);
    commit({ order, w: { ...cur.w } });
    d.changed = true;
    d.target = null;
    d.lockX = e.clientX;
    d.lockY = e.clientY;
  };

  const endDrag = () => {
    const d = drag.current;
    if (!d) return;
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
    drag.current = null;
    document.body.classList.remove("cards-sorting");
    if (d.started) {
      const el = slotEls.current[d.id];
      if (el) {
        el.style.zIndex = "60";
        el.style.transition = "transform 0.2s ease";
        el.style.transform = "";
        setTimeout(() => { el.style.zIndex = ""; el.style.transition = ""; }, 230);
      }
      if (d.changed) pushHistory(d.snapshot, "Layout updated");
    }
    setDragId(null);
  };

  const startDrag = (e, id) => {
    if (drag.current || rz.current) return;
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    drag.current = {
      id, downX: e.clientX, downY: e.clientY, px: e.clientX, py: e.clientY,
      started: false, changed: false, target: null, targetAt: 0,
      lockX: null, lockY: null,
      snapshot: copyLayout(layoutRef.current),
      base: { left: 0, top: 0 }, grabX: 0, grabY: 0, rects: {},
    };
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  };

  /* ----- edge-drag resize ----- */
  const onRzMove = (e) => {
    const r = rz.current;
    if (!r) return;
    const dx = e.clientX - r.startX;
    const px = r.startW * (r.colW + r.gap) - r.gap + dx;
    const s = snapW((px + r.gap) / (r.colW + r.gap));
    const cur = layoutRef.current;
    if (cur.w[r.id] !== s) {
      commit({ order: [...cur.order], w: { ...cur.w, [r.id]: s } });
      r.changed = true;
    }
  };

  const endRz = () => {
    const r = rz.current;
    if (!r) return;
    window.removeEventListener("pointermove", onRzMove);
    window.removeEventListener("pointerup", endRz);
    window.removeEventListener("pointercancel", endRz);
    rz.current = null;
    document.body.classList.remove("cards-sorting");
    if (r.changed) pushHistory(r.snapshot, "Card resized");
    setResizeId(null);
  };

  const startResize = (e, id) => {
    if (drag.current || rz.current) return;
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const gridEl = gridRef.current;
    if (!gridEl) return;
    const gr = gridEl.getBoundingClientRect();
    const cs = getComputedStyle(gridEl);
    const gap = parseFloat(cs.columnGap) || 14;
    rz.current = {
      id, startX: e.clientX, startW: layoutRef.current.w[id],
      colW: (gr.width - gap * (GRID_COLS - 1)) / GRID_COLS, gap,
      changed: false,
      snapshot: copyLayout(layoutRef.current),
    };
    setResizeId(id);
    document.body.classList.add("cards-sorting");
    window.addEventListener("pointermove", onRzMove);
    window.addEventListener("pointerup", endRz);
    window.addEventListener("pointercancel", endRz);
  };

  const slotRef = (id) => (el) => {
    if (el) slotEls.current[id] = el;
    else delete slotEls.current[id];
  };

  const chip = undoChip ? (
    <div className="layout-undo" role="status">
      <span>{undoChip.label}</span>
      <button type="button" onClick={undoNow}>Undo</button>
      <span className="layout-undo-kbd">⌘Z</span>
    </div>
  ) : null;

  return {
    gridRef, slotRef,
    dragId, resizeId,
    active: !!dragId || !!resizeId,
    indexOf: (id) => layout.order.indexOf(id),
    w: (id) => layout.w[id] || 4,
    startDrag, startResize, undoNow,
    chip,
  };
}

/* Wraps a dashboard card: grab handle on hover (top center) + resize handle
   (right edge). Position comes from CSS order + --cw span, so React keys and
   card state stay stable across re-placement. */
function CardSlot({ grid, id, children }) {
  const w = grid.w(id);
  const frac = w === 4 ? "⅓" : w === 6 ? "½" : w === 8 ? "⅔" : "full";
  return (
    <div
      ref={grid.slotRef(id)}
      className={"card-slot" + (grid.dragId === id ? " is-dragging" : "") + (grid.resizeId === id ? " is-resizing" : "")}
      style={{ "--cw": w, order: grid.indexOf(id) }}
    >
      <button type="button" className="card-grip" title="Drag to move"
        aria-label="Drag to move this card"
        onPointerDown={(e) => grid.startDrag(e, id)}></button>
      <div className="card-resize" title="Drag to resize — snaps to ⅓ · ½ · ⅔ · full"
        onPointerDown={(e) => grid.startResize(e, id)}></div>
      {grid.resizeId === id && <div className="card-size-tag">{w}/12 · {frac}</div>}
      {children}
    </div>
  );
}

Object.assign(window, { useCardGrid, CardSlot, normalizeCardLayout, DEFAULT_CARD_ORDER, DEFAULT_CARD_W });
