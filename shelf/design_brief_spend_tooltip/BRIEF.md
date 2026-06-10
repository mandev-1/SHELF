# Design brief: Daily spend chart — hover popup ("Where the money goes")

## Context
ShELF Bookmarks → Strategie tab → "Where the money goes" card. An SVG stacked
bar chart: one column per day (or per week on 6-month+ ranges), stack segments
colored by spending category. Hovering a column shows an HTML popup listing
**every expense row** behind that column: category dot · label · amount,
biggest first, with a header (day label + column total).

It works, but it's plain. We want a designed version of **just the popup**
(and optionally the hover affordance on the column itself).

## What exists today
See `CODE.md` in this folder — full current component + CSS. Behavior that
must be preserved:

- Popup follows the cursor (offset ~14px), flips horizontally past 60% width
  and vertically past 45% height so it never clips.
- Lists all items (capped at 24 + "…+N more"), sorted by amount descending.
- Weekly columns prefix each item with its day ("May 14 · Tesco").
- `pointer-events: none` on the popup (it must never steal the hover).
- Categories have fixed hues (see tokens below); the dot before each item and
  the chart segment share the hue.

## Pain points to design away
- Popup looks generic — flat box, no hierarchy beyond a header rule.
- No visual link between the hovered column and the popup.
- Long lists become a wall — no grouping, no scanning aid.
- The hovered column itself gets no highlight (other columns don't dim).

## Ideas worth exploring (not prescriptive)
- Category-grouped list with per-category subtotals.
- Hovered column highlight + non-hovered dim.
- A pointer/caret connecting popup to column.
- Subtle entrance motion (gated behind `prefers-reduced-motion`).

## Hard constraints
- React 19 + TypeScript + plain SVG — **no chart/tooltip libraries**.
- All colors via the CSS-variable tokens below (Day and SAP themes must
  inherit automatically — never hardcode the dark values).
- Popup is read-only; no buttons inside it.
- Must stay legible at 220–340px popup width.

## Design tokens (dark theme reference values)
- Accent: `#16b981`, bright `#34d399`, deep `#0c8f66`, ink-on-accent `#04130d`
- Surfaces: bg `#0b0b0d`, panel `#141417`, surface `#161619`, raised `#1b1b20`, popover `#212128`, inset `#0e0e11`
- Lines: `rgba(255,255,255,0.065)` / strong `0.11` / faint `0.04`
- Text: `#f0f0f2`, secondary `#c9c9cf`, muted `#91919b`, dim `#66666f`, faint `#4b4b53`
- Radii: card 16, inner 11, pill 999 · Type: DM Sans (UI), DM Mono (numbers)
- Category hues (fixed): housing `#6366f1`, groceries `#f59e0b`, eating out
  `#eab308`, taxi & delivery `#d946ef`, transport `#3b82f6`, home `#14b8a6`,
  electronics `#06b6d4`, clothing `#2dd4bf`, fun `#ec4899`, health `#22c55e`,
  shopping `#f97316`, vending `#a78bfa`, cash `#84cc16`, fees `#ef4444`,
  other `#94a3b8`

## Deliverables (mirror the design_handoff_statement_import bundle)
1. `Spend Tooltip — Explorations.html` — self-contained HTML canvas with 2–4
   artboard directions + micro-states (short list, 20-item list, edge flip,
   weekly mode with day prefixes).
2. `README.md` — source of truth: exact measurements, colors (as tokens),
   spacing, type sizes, copy. High fidelity.
3. `CLAUDE_CODE_PROMPT.md` — paste-ready prompt telling the implementing
   Claude Code session which direction to build and what to borrow from the
   others.
