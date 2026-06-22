# Add-expense button — Claude Code handoff (Option A · ruled underline)

A boxless, modern **Add expense** button for the rustic ruled-paper UI: a
hand-inked circled **+** that rotates 90° on hover, beside a label underlined
with a hand-drawn blue rule. Meant to sit **top-right of the header**.

## Files
- `notebook-add-button.css` — the button styles (self-contained, no deps).
- `AddExpenseButton.jsx` — a React component (plain HTML version is in the demo).
- `notebook-add-button.html` — open it to see the button live, in the header
  context and as an isolated swatch. Hover to see the + rotate.
- `notebook-background.css` — the ruled-paper background it sits on (optional,
  only needed if the page doesn't already have it).

## Implement
1. Load `notebook-add-button.css` once in the app.
2. Render the button in the header's top-right. **React:** use
   `AddExpenseButton.jsx`. **Plain HTML:** copy the `<button class="add-expense-btn">…`
   block from `notebook-add-button.html` (it includes the exact inline `+` SVG).
3. Wire `onClick` to whatever opens the add-expense flow.

The header row should be a flex container with the title group on the left and
this button on the right:
```css
.header-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
```

## Anatomy / knobs
- **Icon** — inline SVG, a slightly irregular hand-drawn ring + plus. Recolor via
  the two `stroke="#4a6a92"` attributes.
- **Rotate-on-hover** — `.ae-plus { transition: transform .18s }` →
  `:hover .ae-plus { transform: rotate(90deg) }`. Also fires on `:focus-visible`.
- **Underline** — inline SVG data-URI on `.ae-lab::after` (a real bezier path, no
  SVG filters, so it renders on mobile). Change its color by editing the
  `stroke='%237db0e2'` in the data-URI (`%23` = `#`).
- **Palette** — ink `#2b4566`, soft ink `#4a6a92`, rule `#7db0e2`.
- **A11y** — `:focus-visible` shows a focus ring; the SVG is `aria-hidden` and the
  label carries the accessible name. Hit area ≈40px tall (touch-friendly).

No build step, no dependencies — just CSS + an SVG.
