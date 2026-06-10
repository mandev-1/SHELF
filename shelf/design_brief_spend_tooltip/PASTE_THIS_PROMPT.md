# Paste this into the design session (claude.ai or a fresh Claude Code acting as designer)

---

You are designing one focused micro-feature for **ShELF Bookmarks** (a dark,
premium personal-finance dashboard inside a Chrome new-tab extension —
DM Sans / DM Mono, emerald accent, token-driven theming).

The feature: the **hover popup of a daily-spending stacked bar chart**. The
attached `BRIEF.md` is the contract — read it fully first. `CODE.md` shows the
current working implementation (plain SVG + an absolutely positioned HTML
popup); the screenshot(s) show how it looks today.

Produce a design exploration bundle, exactly this shape:

1. **`Spend Tooltip — Explorations.html`** — one self-contained HTML file
   (inline CSS/JS, Google-fonts link OK) presented as a zoomable canvas of
   artboards: 2–4 distinct directions for the popup, each shown over a
   realistic chart mock, plus micro-state boards: 3-item list, 20-item list
   with the "+N more" treatment, right-edge flip, bottom-edge flip, weekly
   mode (items prefixed "May 14 ·"). Use the dark-theme token values from the
   brief; label every artboard.
2. **`README.md`** — high-fidelity source of truth for the winning details:
   exact paddings, radii, type sizes/weights, row heights, colors expressed as
   the token names from the brief, copy strings, motion specs (durations,
   easings, reduced-motion behavior).
3. **`CLAUDE_CODE_PROMPT.md`** — a short paste-ready prompt for the
   implementing Claude Code session: which direction to implement, what to
   borrow from the runner-ups, and the rule that README measurements override
   the HTML.

Constraints you may not break: no chart/tooltip libraries; popup stays
`pointer-events: none`; category hues are fixed; everything themeable via the
listed tokens. Keep the data honest — amounts in the mocks should look like
real Czech spending (Kč, thousands with thin spaces).

---

Attach alongside this prompt: `BRIEF.md`, `CODE.md`, and 1–2 screenshots of
the current chart + popup.
