import { useState, useRef, useEffect, useLayoutEffect } from "react";
import type * as React from "react";
import type { CardLayout, CardWidth } from "../types/grid";
import { CARD_W_SNAPS } from "../types/grid";

const GRID_COLS = 12;

type Rects = Record<string, DOMRect>;

interface DragState {
  id: string;
  downX: number; downY: number;
  px: number; py: number;
  started: boolean;
  changed: boolean;
  target: string | null;
  targetAt: number;
  lockX: number | null;
  lockY: number | null;
  snapshot: CardLayout;
  base: { left: number; top: number };
  grabX: number; grabY: number;
  rects: Rects;
}

interface RzState {
  id: string;
  startX: number;
  startW: CardWidth;
  colW: number;
  gap: number;
  changed: boolean;
  snapshot: CardLayout;
}

export interface CardGrid {
  gridRef: React.MutableRefObject<HTMLDivElement | null>;
  slotRef: (id: string) => (el: HTMLElement | null) => void;
  dragId: string | null;
  resizeId: string | null;
  active: boolean;
  indexOf: (id: string) => number;
  w: (id: string) => CardWidth;
  startDrag: (e: React.PointerEvent, id: string) => void;
  startResize: (e: React.PointerEvent, id: string) => void;
  undoNow: () => void;
  undoChip: { label: string } | null;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Pointer-driven 12-col card grid with FLIP slide animations, dwell-buffered
 * retargeting (90ms hover + 8px travel before re-commit), edge-drag resize
 * snapped to 4/6/8/12, and an undo stack (max 30, Cmd/Ctrl+Z). Position is
 * driven purely by CSS `order` + `--cw` span so React keys / card state survive
 * re-placement. Respects prefers-reduced-motion (drops the slide animations,
 * keeps the function).
 */
export function useCardGrid(layout: CardLayout, setLayout: (next: CardLayout) => void): CardGrid {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const slotEls = useRef<Record<string, HTMLElement>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [resizeId, setResizeId] = useState<string | null>(null);
  const [undoChip, setUndoChip] = useState<{ label: string } | null>(null);

  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const setLayoutRef = useRef(setLayout);
  setLayoutRef.current = setLayout;

  const drag = useRef<DragState | null>(null);
  const rz = useRef<RzState | null>(null);
  const history = useRef<CardLayout[]>([]);
  const flipFrom = useRef<Rects | null>(null);
  const undoTimer = useRef<number | undefined>(undefined);

  const snapW = (s: number): CardWidth =>
    CARD_W_SNAPS.reduce((a, b) => (Math.abs(b - s) < Math.abs(a - s) ? b : a));
  const copyLayout = (l: CardLayout): CardLayout => ({ order: [...l.order], w: { ...l.w } });

  const captureRects = (): Rects => {
    const m: Rects = {};
    for (const id in slotEls.current) m[id] = slotEls.current[id].getBoundingClientRect();
    return m;
  };

  /* every layout commit first snapshots current visual positions for FLIP */
  const commit = (next: CardLayout) => {
    flipFrom.current = captureRects();
    setLayoutRef.current(next);
  };

  const pushHistory = (snapshot: CardLayout, label: string) => {
    history.current.push(snapshot);
    if (history.current.length > 30) history.current.shift();
    setUndoChip({ label });
    window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndoChip(null), 6000);
  };

  const undoNow = () => {
    const prev = history.current.pop();
    if (!prev) return;
    commit(prev);
    window.clearTimeout(undoTimer.current);
    setUndoChip(null);
  };

  /* Cmd/Ctrl+Z anywhere outside a form field */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || (e.key !== "z" && e.key !== "Z")) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (!history.current.length) return;
      e.preventDefault();
      undoNow();
    };
    window.addEventListener("keydown", h);
    return () => { window.removeEventListener("keydown", h); window.clearTimeout(undoTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* keep the dragged slot glued to the pointer (its grid cell stays in flow) */
  const positionDragged = () => {
    const d = drag.current;
    if (!d || !d.started) return;
    const el = slotEls.current[d.id];
    if (!el) return;
    el.style.transition = "none";
    el.style.transform = `translate(${d.px - d.grabX - d.base.left}px,${d.py - d.grabY - d.base.top}px)`;
  };

  /* FLIP: after a layout commit, slide every card from its old visual spot */
  const layoutKey = layout.order.join("|") + "::" + layout.order.map((id) => layout.w[id]).join(",");
  useLayoutEffect(() => {
    const from = flipFrom.current;
    if (!from) return;
    flipFrom.current = null;
    const reduce = prefersReducedMotion();
    const d = drag.current && drag.current.started ? drag.current : null;
    const els = slotEls.current;
    // settle in-flight transforms so we measure true cell positions
    for (const id in els) {
      if (d && id === d.id) continue;
      els[id].style.transition = "none";
      els[id].style.transform = "";
    }
    if (gridRef.current) void gridRef.current.offsetWidth;
    const moved: HTMLElement[] = [];
    const rects: Rects = {};
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
      if (!reduce && (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5)) {
        el.style.transform = `translate(${dx}px,${dy}px)`;
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
  const onDragMove = (e: PointerEvent) => {
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
    if (d.lockX != null && d.lockY != null) {
      if (Math.hypot(e.clientX - d.lockX, e.clientY - d.lockY) < 8) return;
      d.lockX = d.lockY = null;
    }
    let over: string | null = null;
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
        el.style.transition = prefersReducedMotion() ? "none" : "transform 0.2s ease";
        el.style.transform = "";
        window.setTimeout(() => { el.style.zIndex = ""; el.style.transition = ""; }, 230);
      }
      if (d.changed) pushHistory(d.snapshot, "Layout updated");
    }
    setDragId(null);
  };

  const startDrag = (e: React.PointerEvent, id: string) => {
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
  const onRzMove = (e: PointerEvent) => {
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

  const startResize = (e: React.PointerEvent, id: string) => {
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
      id, startX: e.clientX, startW: layoutRef.current.w[id] ?? 4,
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

  const slotRef = (id: string) => (el: HTMLElement | null) => {
    if (el) slotEls.current[id] = el;
    else delete slotEls.current[id];
  };

  return {
    gridRef, slotRef,
    dragId, resizeId,
    active: !!dragId || !!resizeId,
    indexOf: (id: string) => layout.order.indexOf(id),
    w: (id: string) => layout.w[id] ?? 4,
    startDrag, startResize, undoNow,
    undoChip,
  };
}
