# Strategie update — Claude Code handoff

This bundle describes three additions to the **Strategie** feature, to implement in the real
ShELF extension codebase (React 18 + TypeScript + Vite).

## What's here
- **`PROMPT.md`** — the paste-ready prompt. Open it, copy everything below the `---`, and paste it
  into Claude Code running from your repo root (`00x---ShELF/`). It references your real file paths.
- **`reference/`** — the HTML/JS/CSS **design prototype** the changes are based on. These are design
  references (a standalone mock), *not* production code to copy verbatim:
  - `ShELF Dashboard.html` — open in a browser to see the intended look & behavior.
  - `strategie.jsx` — prototype React (search `se-monthpick`, `function LadderDetail`, `se-mem`).
  - `strategie.js` — prototype data (search `ladder:`, `memberships:`).
  - `styles.css` — prototype CSS to port (`.se-*`, `.ld-*`, `.rung-*`, `.se-tile*`, `.se-mem*`).

## Fidelity
**High-fidelity.** Colors, type, spacing, radii, and interactions are final. Recreate them in the
app's existing class system and design tokens — don't ship the HTML.

## The three features (summary)
1. **Month picker** — make the StatementEditor month label a dropdown that jumps to any month (with per-month net), keeping the prev/next arrows.
2. **Ladder detail modal** — make each financial-ladder rung clickable, opening a hue-themed modal with a blurb, "where the money sits" accounts (+ optional target bar) and a history timeline. Requires enriching `DEFAULT_LADDER`.
3. **Editable memberships** — a grid of small brand tiles in the income column (the recurring subscriptions), with tap-to-pause, an inline add/edit/remove editor, and chrome-storage persistence (new `memberships` field on `StrategieState`).

Full specs, exact data, file paths, and acceptance checks are in `PROMPT.md`.
