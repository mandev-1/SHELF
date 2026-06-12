/* Drag-to-reorder with FLIP animation + monogram favicon helper.
   Exports: useSortable, Monogram, hueFromString */
const { useRef, useState, useLayoutEffect } = React;

/* deterministic hue from a string (domain) */
function hueFromString(s) {
  let h = 0;
  for (let i = 0; i < (s || "").length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

/* a 1x1 transparent gif to suppress the native ghost drag image */
const BLANK_IMG = (() => {
  const img = new Image();
  img.src = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
  return img;
})();

/*
  useSortable(items, setItems, keyOf)
  - ref: attach to the container holding the sortable children
  - bind(key): spread onto each child (adds draggable + dnd handlers + data-sort-key)
  - dragKey: key currently being dragged (for an .is-dragging style)
  Children must be direct-ish descendants carrying data-sort-key (bind sets it).
*/
function useSortable(items, setItems, keyOf) {
  const ref = useRef(null);
  const [dragKey, setDragKey] = useState(null);
  const prevRects = useRef(null);

  const measure = () => {
    const m = {};
    if (ref.current) ref.current.querySelectorAll("[data-sort-key]").forEach((el) => {
      m[el.dataset.sortKey] = el.getBoundingClientRect();
    });
    return m;
  };

  // FLIP: after items reorder, slide displaced children from old → new position
  useLayoutEffect(() => {
    if (!prevRects.current || !ref.current) return;
    const prev = prevRects.current;
    prevRects.current = null;
    ref.current.querySelectorAll("[data-sort-key]").forEach((el) => {
      const p = prev[el.dataset.sortKey];
      if (!p) return;
      const n = el.getBoundingClientRect();
      const dx = p.left - n.left, dy = p.top - n.top;
      if (!dx && !dy) return;
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1)";
        el.style.transform = "";
      });
    });
  });

  const onDragStart = (e, key) => {
    setDragKey(key);
    try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", key); e.dataTransfer.setDragImage(BLANK_IMG, 0, 0); } catch (err) {}
  };
  const onDragEnter = (key) => {
    if (dragKey == null || key === dragKey) return;
    const from = items.findIndex((i) => keyOf(i) === dragKey);
    const to = items.findIndex((i) => keyOf(i) === key);
    if (from < 0 || to < 0) return;
    prevRects.current = measure();
    const next = items.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
  };
  const onDragEnd = () => setDragKey(null);

  const bind = (key) => ({
    "data-sort-key": key,
    draggable: true,
    onDragStart: (e) => onDragStart(e, key),
    onDragEnter: () => onDragEnter(key),
    onDragOver: (e) => e.preventDefault(),
    onDrop: (e) => e.preventDefault(),
    onDragEnd,
  });

  return { ref, bind, dragKey };
}

Object.assign(window, { useSortable, hueFromString });
