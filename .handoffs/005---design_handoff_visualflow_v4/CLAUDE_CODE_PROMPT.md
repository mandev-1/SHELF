# Claude Code — paste this prompt

Run from the root of the **ShELF** repo (the one with `src/components/`).

---

I have a design-handoff bundle at `design_handoff_visualflow_v4/` — the v4 **delta** adding a goal-setting layer and a view-transition system to the **Visual Flow** tab. Read its `README.md` first (it documents only what's new since the v3 handoff), then `visual-flow.jsx` and the Visual Flow / transition CSS in `styles.css`.

**I have continued developing this repo since the last handoff, and Visual Flow already exists here as a real canvas.** Before writing anything, inspect the current Visual Flow implementation in `src/components/` and reconcile. Critically: **the `NodesFlow` component in the bundle is a throwaway mock built from a screenshot — do NOT port it. Use my real Visual Flow canvas as the node layer.** Merge the new features onto it; do not regress my work. Flag conflicts in your summary rather than overwriting.

Implement in this order, verifying after each:

1. **Goals data slice**: a `useShelfStorage` slice `{ goals: Goal[] }` (max 6), `Goal = { id, title, outcome, status, due?, link: null|{type:"pot"|"debt", id}, milestones: {id,label,done}[], notes }`. A read-only selector joins it to existing pots/debts for live progress (pot saved/target %, debt paid-off %, else subgoal %). Never mutate finance state from goals.
2. **Camps layer** over the Visual Flow canvas: a trail map with up to six campsites (status-hued tents + campfire state), "You are here" → "point B", "pitch a camp" for empty slots. Campsites need an anchor position + an `openGoal(id)` click. If the canvas is a node graph, prefer making campsites a pinned **node type**; otherwise an absolutely-positioned overlay. Add a "⛺ Camps" / "⟲ Flip to the flow" affordance to toggle layers; the tab should default to the node layer.
3. **Goal screen** (own route/view): goal box at top (title, Point B outcome, status, "by when" month, **SMART meter** S/M/A/R/T chips that light as each is met), **cascading subgoals** zig-zagging downward connected by wires (inline edit / check / remove / add), right rail with **Supplies** (pot/debt link + live progress) and a **field journal** note.
4. **Transition system**: port `goTrans` as a small `useViewTransition` hook wrapping route swaps. Two motions: **card flip** for camps ⇄ camp detail (the ~940ms "human" flip — anticipation wind-up, forward arc via translateZ + slight rotateX, overshoot-and-settle, camera scale dip; faces backface-hidden, back pre-rotated 180°, perspective ~2200px), and **depth zoom** for camps ⇄ node flow (outgoing pushes toward you + blurs/fades, incoming rises from 0.9). Consider the native **View Transitions API** for the zoom/crossfade and keep the bespoke keyframes for the flip. **Respect `prefers-reduced-motion` with an instant cut.** The cylinder runner is optional/showpiece — skip unless trivial.

Constraints:
- Goals slice is independent; it only *reads* pots/debts.
- Money display via the existing currency table; `tabular-nums` for figures.
- Keep all v3 features working (Strategie panel, debt card + ladder tie-in, dashboard card grid).
- Don't port `tweaks-panel.jsx` or `NodesFlow`.

When done, list intentional deviations and anything you reconciled against my existing Visual Flow rather than rebuilt.
