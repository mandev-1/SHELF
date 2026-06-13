/* ShELF — useSortable: minimal HTML5 drag-to-reorder for a flat list.
   Usage:
     const sort = useSortable(items, setItems, (it) => it.id);
     <div ref={sort.ref}>
       {items.map(it => <Card key={it.id} dragProps={sort.bind(it.id)} dragging={sort.dragKey === it.id} />)}
     </div>
   Spread dragProps onto the element that should act as the drag handle. */
function useSortable(items, setItems, keyOf) {
  const { useState, useRef } = React;
  const [dragKey, setDragKey] = useState(null);
  const dragKeyRef = useRef(null);
  const ref = useRef(null);

  const set = (k) => { dragKeyRef.current = k; setDragKey(k); };

  const moveTo = (targetKey) => {
    const dk = dragKeyRef.current;
    if (dk == null || dk === targetKey) return;
    setItems((prev) => {
      const arr = [...prev];
      const from = arr.findIndex((it) => keyOf(it) === dk);
      const to = arr.findIndex((it) => keyOf(it) === targetKey);
      if (from < 0 || to < 0 || from === to) return prev;
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
  };

  const bind = (key) => ({
    draggable: true,
    onDragStart: (e) => {
      set(key);
      try {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(key));
      } catch (_) {}
    },
    onDragOver: (e) => e.preventDefault(),
    onDragEnter: (e) => { e.preventDefault(); moveTo(key); },
    onDragEnd: () => set(null),
    onDrop: (e) => { e.preventDefault(); set(null); },
  });

  return { ref, bind, dragKey };
}

Object.assign(window, { useSortable });
