import type { CSSProperties, ReactNode } from "react";
import type { CardGrid } from "../../hooks/useCardGrid";

/**
 * Wraps a dashboard card: grab handle on hover (top center) + resize handle
 * (right edge). Position comes from CSS `order` + `--cw` span, so React keys and
 * card-internal state stay stable across re-placement.
 */
export function CardSlot({ grid, id, children }: { grid: CardGrid; id: string; children: ReactNode }) {
  const w = grid.w(id);
  const frac = w === 4 ? "⅓" : w === 6 ? "½" : w === 8 ? "⅔" : "full";
  return (
    <div
      ref={grid.slotRef(id)}
      className={`card-slot${grid.dragId === id ? " is-dragging" : ""}${grid.resizeId === id ? " is-resizing" : ""}`}
      style={{ ["--cw" as string]: w, order: grid.indexOf(id) } as CSSProperties}
    >
      <button
        type="button"
        className="card-grip"
        title="Drag to move"
        aria-label="Drag to move this card"
        onPointerDown={(e) => grid.startDrag(e, id)}
      />
      <div
        className="card-resize"
        title="Drag to resize — snaps to ⅓ · ½ · ⅔ · full"
        onPointerDown={(e) => grid.startResize(e, id)}
      />
      {grid.resizeId === id && <div className="card-size-tag">{w}/12 · {frac}</div>}
      {children}
    </div>
  );
}

/** Floating bottom-center undo chip shown after a drag/resize commit. */
export function LayoutUndoChip({ chip, onUndo }: { chip: { label: string } | null; onUndo: () => void }) {
  if (!chip) return null;
  return (
    <div className="layout-undo" role="status">
      <span>{chip.label}</span>
      <button type="button" onClick={onUndo}>Undo</button>
      <span className="layout-undo-kbd">⌘Z</span>
    </div>
  );
}
