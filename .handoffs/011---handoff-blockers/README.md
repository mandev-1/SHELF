# Blockers — handoff (time-block nodes for a canvas)

Hazard-barrier nodes that reserve a **window of time** on a canvas. A blocker has
a **start** + a **duration** (30 / 45 / 60 min, flip-toggle) and runs through
three phases — **pending → active → ended** — firing once when it goes active.
1:1 with the ShELF node canvas. Open `blockers-demo.html` to use the real thing.

## Files
- `blockers.css` — all styles, self-contained (tokens inlined in `:root`).
- `Blockers.jsx` — the logic + components:
  - **`useBlockers({ storageKey, onFire })`** — owns the blocker array, a ticking
    clock, persistence, and calls `onFire(blocker)` **once** when one goes active.
  - **`<BlockerNode>`**, **`<BlockerDraft>`** — the node + the create/edit popover.
  - helpers: `nfBlockerStatus`, `nfDurLabel`, `nfToDatetimeLocal`, `NF_BLOCKER_DURS`.
- `blockers-demo.html` — runnable: right-click to add, drag to move, right-click a
  blocker to edit/clear. Copy the wiring from here.

## Behaviour
- **Create** — right-click empty canvas → “⛔ Add blocker here” → a popover with
  **Label**, **Starts** (`datetime-local`), and **Duration** flip-toggles
  (`30m / 45m / 1h`, default 30).
- **Phases** (driven by the ticking `now`):
  - `pending` — amber stripes, shows the window + countdown: `14:43–15:28 · in 4m`.
  - `active` — red, pulsing, `⛔ Blocking · 18m left`; **fires `onFire` once**.
  - `ended` — muted grey, `… · ended`, with a **Clear** button.
- **Edit / clear** — right-click a blocker → **Edit time…** (reopens the popover)
  or **Clear blocker**. Active/ended blockers also show an inline **Clear** button.
- **Drag** to reposition. State persists if you pass `storageKey`.

## ⚠️ Right-click guard (the one gotcha)
Blocker nodes use class `.nf-blocker` (NOT `.nf-node`). Your canvas's
`onContextMenu` that opens the “add blocker” menu **must bail when the target is
already a blocker / menu / draft**, or it will override the blocker's own menu:

```js
onContextMenu={(e) => {
  if (e.target.closest(".nf-blocker, .nf-menu, .nf-blocker-draft")) return; // ← required
  e.preventDefault();
  /* …open the “Add blocker here” menu… */
}}
```

(If your canvas also has regular nodes, include their selector too, e.g.
`".nf-node, .nf-blocker, .nf-menu, .nf-blocker-draft"`.)

## Wire it up
```jsx
const blk = useBlockers({
  storageKey: "my-blockers",
  onFire: (b) => {
    // YOUR side-effect when a block starts. In ShELF: raise a toast +
    // push it to the top of the "Doing now" pipeline so it interrupts you.
    toast("⛔ Blocking now — " + b.label);
  },
});

// render
{blk.blockers.map((b) => (
  <BlockerNode key={b.id} blocker={b} now={blk.now}
    onPointerDown={(e) => startDrag(e, b)}
    onEdit={(e) => openNodeMenu(b.id, e.clientX, e.clientY)}
    onClear={() => blk.remove(b.id)} />
))}

// create:  blk.add(x, y, label, startMs, durationMinutes)
// edit:     blk.update(id, { label, due, dur })
// remove:   blk.remove(id)
```

## Data model
```
blocker = { id, x, y, label, due (ms epoch = START), dur (minutes) }
```
`x`/`y` are whatever coordinate space your canvas uses — the demo stores **px
relative to the stage**; ShELF stores **0–100 % of a fixed world** and converts
on add. The hook is agnostic: it persists exactly what you give it.

## Coordinate note
`<BlockerNode>` sets `left/top` from `blocker.x/.y` directly, so those values must
be in the units your stage expects (px in the demo). If your canvas is
pan/zoomed, convert screen → world on create and on drag (the demo shows the
simple px case; ShELF multiplies by the world size).

No build step — plain CSS + a React component. (Demo uses React 18 + Babel via CDN.)
