# Handoff: ShELF — Visual Flow goals layer + transition system (v4 delta)

## Overview
This bundle is the **v4 delta** on top of `design_handoff_strategie_v3/`. It contains the complete runnable prototype, but the new work is one feature area:

**Visual Flow becomes a two-layer goal-setting surface.** The Visual Flow tab now holds:
1. **The node flow** — the working canvas (sticky nodes, checklists, dashed wires, planes). This is the *default* view of the tab and a **minimal stand-in** for your real Visual Flow canvas.
2. **The camps layer** — "build a campsite down the road": a trail map with up to six **campsites** (top goals) pitched along it. Each camp opens its own **goal screen** (SMART goal defined at the top, cascading subgoals leading up to it, supplies wired to real money).
3. **A 3D transition system** connecting them — a **card flip** for camps ⇄ camp detail, and a **depth zoom** for camps ⇄ node flow. Both are pure Web Animations API on cloned DOM; a slat **cylinder** is kept as an alternate.

Everything is in `visual-flow.jsx` (new) + a Visual Flow / transition CSS block in `styles.css`, wired into the `flow` tab of `ShELF Dashboard.html`.

**Treat this as design truth for the goals layer and the transitions — and merge into your real Visual Flow canvas.** The node-flow component here is a mock built from a screenshot; in your app the camps layer and the transitions drop on top of your *actual* canvas (see "Integration" below).

## About the Design Files
HTML/React-18-via-Babel prototypes — design references, **not production code to copy verbatim**. Recreate in the ShELF codebase (React 19 + TS + Vite, `src/components/`) with its real patterns: typed props, `useShelfStorage` slices instead of raw `localStorage`, your icon set + theme tokens, and your existing Visual Flow canvas instead of the `NodesFlow` mock.

## Fidelity
High-fidelity for the camps layer, goal screen, and the **motion** (timings/easings are final intent). The node-flow canvas is **low-fi / illustrative only** — match your real one.

## How to run
Serve the folder, open `ShELF Dashboard.html`, click the **Visual Flow** tab. It opens on the node flow; **"⛺ Camps"** flips up to the camps map; click a tent to flip into its goal screen. Goals persist in `localStorage["shelf-goals-v1"]`; pot/debt progress is read live from `localStorage["shelf-strategie-v2"]`.

---

## Delta 1 — Data model (`visual-flow.jsx`, top)

Goals are their own slice, **independent of the Strategie slice** (which they only read):

```
shelf-goals-v1 = { goals: Goal[] }   // localStorage, max 6 used (VF_MAX)
Goal = {
  id, title, outcome,                 // outcome = "Point B"
  status: "notstarted"|"ontrack"|"atrisk"|"done",
  due?: "YYYY-MM",                    // month input
  link: null | { type: "pot"|"debt", id },   // "supplies"
  milestones: { id, label, done }[],  // cascading subgoals
  notes,                              // field journal
}
```

- `VF_STATUS` — the four statuses + hues (notstarted `#8b8b95`, ontrack = accent, atrisk `#e0a020`, done `#34c891`).
- `vfReadStrategie()` — reads the Strategie slice (falling back to `STRAT_STATE` seed), returns `{ pots, debts }` with each debt's `paid`/`remaining` computed from statement rows tagged `debtId` (same math as the debt card). **Read-only**; goals never write Strategie state.
- `vfProgress(goal, fin, currency)` — resolves progress: a pot link → saved/target %, a debt link → paid-off % (auto-complete when `remaining<=0`), otherwise subgoal completion %. Returns `{ pct, auto, line, name }`.
- `vfSmart(goal, reached)` — the "is it set well?" meter: **S** Point B named · **M** wired to money or ≥2 subgoals · **A** clear next subgoal · **R** journal note present · **T** target date set. Returns `{ checks, score }` (0–5).

## Delta 2 — The camps map (`CampMap`)
- A winding SVG **trail** (`vfTrailPath()`, catmull-rom → beziers) from a pulsing **"You are here"** marker to **"point B"** on the horizon, with six fixed campsite slots (`VF_SLOTS`, percentage coords) and italic distance cues (soon / this year / down the river).
- Each filled slot = a **campsite**: a tent (`VfTent`, status-hued) with a **campfire** dot whose state encodes status (unlit = not started, glowing = on track, amber flicker = at risk, ✓ = reached), plus a label chip (name · progress bar · status line). Empty slots show a dashed **"pitch a camp"** button.
- Header has **"⟲ Flip to the flow"** (→ node layer). Clicking a tent opens its goal screen; clicking "pitch a camp" creates a blank goal and opens it.

## Delta 3 — The goal screen (`GoalScreen`, `GoalCascade`)
A full view (not a modal), per the user's sketch:
- **Goal box at the top** (`.gs-goal`): title input, "Point B" outcome input, status buttons, a **"By when"** month input, and the **SMART meter** as a row of S/M/A/R/T chips that light up as each criterion is met ("SMART · n/5").
- **Cascading subgoals** (`GoalCascade`): subgoal boxes **zig-zag downward** (alternating x offsets from a fixed `X` array, `ROW = 92px` apart), connected by **dashed SVG wires** that flow from the goal box down through each box — "each one leads to the next, the chain leads to the goal." Inline editable, checkbox to complete, hover-× to remove, dashed add-box at the tail.
- **Right rail**: **Supplies** select (optgroups "Savings pots" `◌` / "Debts (payoff = arrival)" `↓`) + live progress bar; **Field journal** textarea.
- Top bar: "← Back to the map", "Campsite N of 6" crumb, "Break camp" (confirm-deletes). Esc = back.

## Delta 4 — The transition system (the important / reusable part)

A small engine swaps views with a 3D animation. **Mechanism:** `goTrans(apply, dir, mode)` snapshots the outgoing `.vf-view` (cloning live input/checkbox/textarea/select values via `vfCloneWithValues`), applies the React state change, then a `useLayoutEffect` fires `vfRunTransition(wrap, snap, outH, dir, mode)` against the freshly-rendered incoming view. All animation is **Web Animations API on throwaway clones in an absolutely-positioned overlay** — React state has already swapped underneath, hidden until the animation resolves, then the overlay is removed. `dir` is +1 (deeper/forward) or −1 (back).

Three runners, selected per move:

| Move | `mode` | Runner | Feel |
|---|---|---|---|
| camps map ⇄ **camp detail** (open tent, pitch, back, break) | `cardflip` | `vfRunCardFlip` | the canvas **turns over** once on its Y axis — camps on the front face, goal screen on the back |
| camps map ⇄ **node flow** (Flip to the flow / ⛺ Camps) | `depthzoom` | `vfRunDepthZoom` | **descend** into the layer beneath (outgoing pushes toward you + blurs/fades, incoming rises from 0.9) |
| (alternate, unused) | `cylinder` | `vfRunCylinder` | the showpiece: view slices into 12 slats that roll around a virtual cylinder in a staggered wave |

`VF_TRANSITION` is the module-level default; each call passes an explicit `mode`, so the table above is what actually runs. **Card-flip tuning (final, "human" feel):** ~940ms; **anticipation** (≈4° wind-up the opposite way) → main turn with a soft forward **arc** (`translateZ` dip + slight `rotateX` tilt, like a hand turning a card) → **overshoot** ~5° past flat → ease back to settle; the camera (`.vf-flip3d-cam`) does a gentle scale-dip (1→0.952→1) + 2° `rotateX` wave; `perspective: 2200px`; faces are `backface-visibility: hidden`, back face pre-rotated 180°. **All transitions respect `prefers-reduced-motion`** — `goTrans` detects it and does an instant cut (no overlay).

Relevant CSS in `styles.css`: `.vf-stage`, `.vf-view` (transform-origin center), `.vf-zoom*` (depth zoom), `.vf-flip3d*` (card flip), `.vf-cyl*` (cylinder).

## Delta 5 — Node flow mock (`NodesFlow`) — **replace, don't port**
A static illustrative canvas: toolbar ("Visual Flow of Action", Copy for AI, search), dot-grid, 7 sticky nodes (`NF_NODES` incl. dark "bleeding edge" and a faded "blocked" card), dashed wires, green ports, plane tabs (`NF_PLANES`). **This is a stand-in for your real Visual Flow canvas** — see Integration.

## Delta 6 — Wiring + defaults
- `ShELF Dashboard.html`: `visual-flow.jsx` loads before `strategie.jsx`; the `flow` tab renders `<VisualFlow currency={t.currency} onToast={showToast} />`.
- The Visual Flow tab **defaults to the node layer** (`useState("nodes")`).
- The user's current Tweaks (saved): **dark theme, accent `#16b981`** (emerald). These are runtime theme tokens, not part of the goals feature.

---

## Integration — putting this on your real canvas
The camps layer and transitions are deliberately decoupled from whatever the flow is built on:

1. **Goals slice** → a `useShelfStorage` slice with the `Goal` shape above; a selector joins it to your existing pots/debts for live progress. Never mutate finance state from goals.
2. **Camps as an overlay or node type** → the campsites only need (a) an anchor position on your canvas and (b) an `openGoal(id)` click. If your Visual Flow is a node graph (React Flow / custom), campsites can be a **pinned node type** so your existing pan/zoom/layout handles them; otherwise an absolutely-positioned marker layer over the canvas.
3. **Goal screen** → an independent route/view; it doesn't care which canvas launched it.
4. **Transitions** → port `goTrans` + the chosen runner(s) as a small hook (`useViewTransition`) wrapping your route swap. `vfCloneWithValues` is only needed because the prototype animates DOM clones — in your app you may prefer the native **View Transitions API** for the cross-fade/zoom and keep the bespoke `cardflip` keyframes for the camp open. Keep the `prefers-reduced-motion` cut.
5. **Replace `NodesFlow`** entirely with your real canvas; keep only the "⛺ Camps" affordance to flip layers.

## State (v4 additions)
```
shelf-goals-v1: { goals: Goal[] }     // NEW, independent slice
// reads (never writes): shelf-strategie-v2 → pots, debts
```
Transition/animation state is fully ephemeral.

## Files
| File | What it is |
|---|---|
| `visual-flow.jsx` | **NEW** — everything: data helpers, `CampMap`, `GoalScreen`/`GoalCascade`, `NodesFlow` (mock), the transition engine (`goTrans` + `vfRunCardFlip`/`vfRunDepthZoom`/`vfRunCylinder`), `VisualFlow` orchestrator |
| `styles.css` | + Visual Flow section (`.vf*`, `.camp*`, `.gs*`) and transition CSS (`.vf-zoom*`, `.vf-flip3d*`, `.vf-cyl*`) |
| `ShELF Dashboard.html` | `flow` tab renders `VisualFlow`; loads `visual-flow.jsx`; tab defaults handled in `App` |
| everything else | unchanged from v3 (Strategie panel, debt card, card grid, etc.) — included so the page runs |

Do **not** port `tweaks-panel.jsx` or the `NodesFlow` mock.
