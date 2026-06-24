// ============================================================================
// ConnectionPicker — a clickable square with two connection points per side,
// replacing the 8-checkbox "Connection points" grid in the node right-click menu
// on Grazeland / custom planes. Each point toggles a slot in the node's
// `grazelandHandleVisibility` map (the same 8 slots: top1/top2/right1/right2/
// bottom1/bottom2/left1/left2). Theme-driven via the app's CSS vars.
// ============================================================================

import type { ShelfGrazelandHandleSlot, ShelfGrazelandHandleVisibility } from "../../types/grid";

// Point ids match the handle slots. top/bottom run left→right (33%/67%);
// left/right run top→bottom (33%/67%) — the same convention as the node handles.
const CP_POINTS: { id: ShelfGrazelandHandleSlot; label: string; x: number; y: number }[] = [
  { id: "top1", label: "Top 1", x: 33, y: 0 },
  { id: "top2", label: "Top 2", x: 67, y: 0 },
  { id: "right1", label: "Right 1", x: 100, y: 33 },
  { id: "right2", label: "Right 2", x: 100, y: 67 },
  { id: "bottom1", label: "Bottom 1", x: 33, y: 100 },
  { id: "bottom2", label: "Bottom 2", x: 67, y: 100 },
  { id: "left1", label: "Left 1", x: 0, y: 33 },
  { id: "left2", label: "Left 2", x: 0, y: 67 },
];

export function ConnectionPicker({
  active,
  onToggle,
}: {
  /** Current visibility per slot; missing slots default to visible. */
  active?: ShelfGrazelandHandleVisibility;
  onToggle: (slot: ShelfGrazelandHandleSlot, next: boolean) => void;
}) {
  return (
    <div className="cp-picker" onMouseDown={(e) => e.stopPropagation()}>
      <div className="cp-picker-stage">
        <div className="cp-picker-square" aria-hidden="true" />
        {CP_POINTS.map((p) => {
          const on = active?.[p.id] ?? true;
          return (
            <button
              key={p.id}
              type="button"
              className={"cp-picker-point" + (on ? " on" : "")}
              style={{ left: p.x + "%", top: p.y + "%" }}
              aria-pressed={on}
              aria-label={p.label}
              title={p.label}
              onClick={(e) => {
                e.stopPropagation();
                onToggle(p.id, !on);
              }}
            >
              {on && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12l5 5L20 7" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
