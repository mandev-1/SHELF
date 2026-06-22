# "Doing now" — pipeline drawer (handoff)

A bottom pull-up drawer that holds **one active task + a queue of up to six
"up next" cards**, with marching arrows between them. Lifted 1:1 from the ShELF
node canvas. Open `doing-now-demo.html` to use the real thing.

## Files
- `doing-now.css` — all styles, self-contained (tokens inlined in `:root`).
- `DoingNow.jsx` — two exports:
  - **`<DoingNow … />`** — the presentational drawer (verbatim).
  - **`useDoingPipeline({ … })`** — drop-in hook that owns the pipeline state,
    persistence, and every mutation; hands you `drawerProps` to spread.
- `doing-now-demo.html` — a runnable demo: a fake canvas of tasks you right-click
  to add, with all interactions wired (toggle · done&next · promote · remove ·
  persistence). Copy the wiring from here.

## What it does
- **Toggle** — the bottom handle tab slides the drawer up/down; it shows a count
  badge (active + queued).
- **Active task** (left) — plane dot + label + optional tag, title (click to jump),
  optional note, and **✓ Done & next** / **Jump** buttons.
- **Up next** (right) — horizontally-scrolling queue cards, each with **‹ pull to
  active** and **× remove**. Numbered, capped at 6.
- **Add / remove** — from your node's right-click menu (see demo).
- Empty states for both the active slot and the queue.

## Data model
The pipeline is just an **ordered array of task IDs** (max `7` = 1 active + 6
queued). Index 0 is active; 1–6 are the queue. You give the hook a `resolve(id)`
that returns the live task:

```js
task = { id, plane, title, subtitle?, note?, tag?, done? }
```

`plane` is a key into the `DOING_PLANES` map (label + color) at the top of
`DoingNow.jsx`. **Replace that map with your own lanes/categories.** No lanes?
Use a single entry and give every task that key.

## Wire it up
```jsx
const pipe = useDoingPipeline({
  resolve: (id) => myTasksById[id],          // look up live task data
  onComplete: (id) => markTaskDone(id),       // your side-effect; hook also de-queues
  onJump: (plane, id) => focusNode(plane, id),// optional: focus your canvas
  storageKey: "my-doing-now",                 // optional: persists order + open state
});

// in your node's right-click menu:
pipe.inPipeline(id)
  ? <button onClick={() => pipe.remove(id)}>Remove from Doing now</button>
  : <button disabled={pipe.isFull} onClick={() => pipe.add(id)}>Add to Doing now</button>

// render the drawer inside a positioned container (see below):
<DoingNow {...pipe.drawerProps} />
```

The hook also returns `promote(id)`, `complete()`, `toggle()`, `setOpen(v)`,
`active`, `queue`, `count`, `isFull` if you want to drive it from elsewhere.

## ⚠️ Positioning contract
The drawer and handle are `position: absolute`, so they fill the **nearest
positioned ancestor** — not the page. Mount `<DoingNow>` inside a container that
is `position: relative; overflow: hidden;` and has a real height (a canvas /
work area). The demo's `.dn-stage` shows exactly this. The drawer height is the
`--nf-doing-h` CSS var (default `212px`); the handle reads it to sit flush on top.

## Tokens used
`--surface --surface-2 --panel --line --line-strong --fg --fg-2 --dim --faint
--accent --accent-bright --accent-deep --sh-1 --sh-2 --nf-doing-h`. They're
defined in `doing-now.css :root`; delete that block to inherit your app's theme.

No build step — plain CSS + a React component. (Demo uses React 18 + Babel via CDN.)
