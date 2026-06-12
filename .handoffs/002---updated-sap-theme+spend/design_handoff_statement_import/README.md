# Handoff: ShELF — Statement Import (Strategie tab)

## Overview
Design exploration for the **"Bring in a bank statement"** import surface in the Strategie panel. The user pastes or drops a bank export (`.csv` / `.txt` / `.pdf`), it is parsed **entirely on-device**, categorized, previewed, and committed into the month's statement book. This bundle contains **four full-modal directions (A–D)** plus **three micro-moment states** (drag-over, parsing, success+undo) that any direction can borrow.

## About the Design Files
The files in this bundle are **design references created in HTML** (React via Babel, on a pan/zoom design canvas). They are prototypes showing intended look and behavior — **not production code to copy directly**. The task is to **recreate the chosen design in the ShELF codebase** (React 19 + TypeScript + Vite + Tailwind + HeroUI, Manifest V3 extension) using its established patterns: the `useShelfStorage` hook for persistence, the existing modal/overlay patterns from the statement editor, and the CSS-variable token system already in `src/index.css`.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii and copy are final (dark theme shown; all values are tokens, so Day/SAP themes inherit automatically). Recreate pixel-perfectly with the codebase's existing token vocabulary.

## How to view
Open `Statement Import — Explorations.html` in a browser. It's a zoomable canvas; click any artboard to focus it fullscreen (←/→ to step, Esc to exit).

- Section "Bring in a bank statement": artboards **A · Ledger split**, **B · The altar**, **C · The scanner**, **D · Stepped wizard** (each 1080×680).
- Section "Micro-moments": **Drag-over**, **Parsing**, **Success + undo** (420×300).

The component markup lives in `import-art.jsx`; all styles in the `<style>` block of the HTML. `design-canvas.jsx` is just the presentation shell — ignore it.

## Screens / Views

### A · Ledger split — paste + live preview (recommended default)
- **Purpose**: paste raw statement text and watch rows parse in real time.
- **Layout**: modal 920px wide, radius 16px, bg `linear-gradient(180deg, #161619, #141417)`, border `rgba(255,255,255,0.11)`, shadow `0 40px 80px -24px rgba(0,0,0,0.7)` + 1px white inset highlight. Three bands:
  1. **Header** (pad 26/28/20): eyebrow "IMPORT" (10.5px/700/0.22em caps, emerald `#34d399`, with 12px up-arrow icon) → title "Bring in a bank statement" (23px/700/−0.02em) → sub (13px, `#91919b`, max 46ch). Right side: status chips row (26px tall pills, 11.5px/600): "✓ 24 recognized" (emerald tint: text `#d4f3e7`, bg accent 16%, border accent 35%), "2 duplicates" (neutral `#1b1b20`), "1 skipped" (amber: text `#f3d9a4`, bg `rgba(224,134,72,0.12)`).
  2. **Split body**: 2 equal columns, 1px gap filled by hairline; both panes bg `#0e0e11`, pad 16/20, min-height 320px.
     - **Left (paste)**: toolbar row of file-type chips `.csv .txt .pdf` (DM Mono 10.5px, bg `#212128`, radius 6, pad 3/7) + right-aligned "🔒 stays local" (11.5px `#66666f`, emerald lock icon). Below: monospace pasted text (DM Mono 11.5px, line-height 2) with syntax tinting — header line `#4b4b53`, dates `#91919b`, counterparty `#c9c9cf`, negative amounts `#e07a93`, positive amounts `#34d399`, plus a blinking emerald `▍` caret (1.1s steps).
     - **Right (live preview)**: pane bg tinted accent 2.5%. Head: "LIVE PREVIEW" (10.5px/700/0.16em caps emerald) + "May 2026" right. Parsed rows (see **Row spec**) with the last row at 38% opacity + slight blur ("still parsing"). Below: tally strip (bg `#161619`, border hairline, radius 11, pad 11/12): `In +42 000 · Out −5 179 · Net +36 821` — labels 11.5px `#66666f`, values DM Mono `#f0f0f2`, positives emerald.
  3. **Footer** (pad 18/28): left "🔒 100% local · reversible after import"; right buttons **Cancel** (ghost: transparent, 1px `rgba(255,255,255,0.11)` border, text `#c9c9cf`) and **Import 24 rows** (primary: `linear-gradient(180deg,#34d399,#16b981)`, ink `#04130d`, radius 10, h 38, emerald ring + `0 8px 24px -8px` emerald glow, up-arrow icon).

### B · The altar — one luminous drop zone
- **Purpose**: the empty/first-run state; maximum calm.
- **Layout**: full-bleed stage with radial emerald glow (accent 7% at 50%/38%) over the dark bg. Centered column:
  - Eyebrow "IMPORT" centered.
  - **Drop zone**: 620px wide, pad 54/40/46, radius 22, dashed 1.5px border (accent 38% mixed into hairline), bg accent 3%; **four corner ticks**: 14×14px, 2px solid emerald, only the two outer edges drawn, 6px corner radius, positioned −2px outside each corner.
  - **Orb**: 58px circle, `linear-gradient(180deg,#34d399,#0c8f66)`, ink `#04130d` up-arrow 22px, double glow: `0 0 0 8px` accent 12% ring + `0 0 48px -6px` accent 55%.
  - Title "Drop your statement" 26px/700/−0.02em; sub "or paste anywhere — ⌘V" 13.5px `#91919b` with kbd caps (DM Mono 11px, bg `#212128`, 1px border + 2px bottom border, radius 5).
  - File-type chips row; below the zone a trust line: "🔒 parsed on device · nothing uploaded · undo any import" (11.5px `#66666f`, emerald lock, `·` separators in `#4b4b53`).
  - **Background texture**: ~10 absolutely-positioned faint DM Mono fragments of statement text (`−1 234,56`, `CZK`, `Datum;Částka`…) in `#4b4b53` at 50% opacity scattered around the edges; one tinted emerald.

### C · The scanner — parsing as theater
- **Purpose**: the in-progress state as a moment of delight.
- **Layout**: 660px column.
  - **Paper statement**: 430px, light paper gradient (`#f4f2ec → #e9e6dd`), ink `#2c2a25`, radius 10/10/0/0, `perspective(700px) rotateX(8deg)` origin bottom, soft upward shadow. Head "VÝPIS Z ÚČTU — 05 / 2026" (DM Mono 10px/700/0.18em, `#6b675c`, bottom rule). 4–5 transaction lines (DM Mono 11px, grid `46px 1fr auto`), income tinted `#0c8f66`, last line fading to 40%.
  - **Scan slit**: 14px tall pill, near-black `#060607` with inner black ring; inside, a 2px **scan beam** spanning 4%–96%: horizontal emerald gradient, `0 0 18px` glow, pulsing opacity 0.55→1 (2.2s alternate; disabled under `prefers-reduced-motion`).
  - **Progress**: 5px track (bg `#1b1b20`, hairline border) with `#0c8f66→#34d399` fill at 61%; label "Parsing on device… **61%** · 14 of 23 rows" (11.5px, pct in DM Mono emerald).
  - **Category pucks**: wrapping row of 36px pills (bg `#161619`, border = category hue 30%): 8px glowing hue dot, name 12px/600 `#c9c9cf`, amount DM Mono 11.5px `#91919b`, count badge (10px/700, bg `#212128`, pill). Each puck animates in with a 14px drop + overshoot, staggered 80ms.
  - Footer: trust line + ghost Cancel + disabled "Import when done" (primary desaturated 25%, no glow).

### D · Stepped wizard — Paste → Review → Import
- **Purpose**: explicit 3-step flow when users want control.
- **Layout**: modal 920px, grid `240px 1fr`.
  - **Left rail**: bg `#0e0e11`, right hairline, pad 26/22. Eyebrow; then 3 steps (grid rows, pad 10, radius 10): each = 24px round dot (DM Mono 11px/700) + bold label 13px + sub 11px. Done step: emerald-tinted dot with check. Active step: row bg accent 6%, dot filled with the primary gradient, ink `#04130d`. Future: neutral. Bottom-anchored note: "🔒 Parsed locally. You can undo the whole batch afterwards." (11px/1.6 `#66666f`).
  - **Main**: pad 26/28. Title "Review 23 rows" + sub "Tap a category to change it. Confident guesses are pre-filled." Rows list inside a card (bg `#0e0e11`, hairline, radius 11, pad 8). Includes one **warning row**: amber-dashed border, bg `rgba(224,134,72,0.07)`, `!` mark, "Unrecognized line "#REF;;–"", category chip "skipped" in orange hue. Footer: Back (ghost) ↔ "Import into May" (primary).

### Row spec (shared by A and D)
Grid `42px 1fr auto 92px`, gap 12, pad 8.5/10, radius 9, zebra striping `rgba(255,255,255,0.022)` on odd rows.
- date: DM Mono 11px `#66666f`
- counterparty: 13px/600 `#f0f0f2` + detail 11.5px `#66666f` (ellipsized)
- **category chip**: 10.5px/700, pill, per-category hue — text = hue, bg = hue 14%, border = hue 28%. Hues: Groceries/Income `#34c891`, Transport `#6595ee`, Subs `#a384df`, Shopping `#e08648`, Eating out `#e07a93`, neutral `#8b8b95`.
- amount: DM Mono 12.5px right-aligned `#c9c9cf`; income `#34d399`.

### Micro-moments
- **Drag-over**: compact altar zone (340px) — border goes solid emerald, bg accent 7%, inner `0 0 64px -12px` emerald glow; orb shrinks to 46px; copy "Release to parse" + filename "vypis-05-2026.csv · 14 KB".
- **Parsing**: 320px card (bg `#161619`, radius 14): progress bar at 38% with a white shimmer sweeping across (1.4s linear loop), 4 skeleton rows (11px pills, bg `#212128`, widths 34px / 57–84% / 52px), caption "reading 23 rows…".
- **Success + undo**: centered 50px emerald check orb + "24 rows added to May" (15px/600) + "Net +36 821 CZK · Undo" (12px `#66666f`, Undo in emerald with translucent underline). Auto-dismissable toast or end-screen.

## Interactions & Behavior
- **Entry points**: "Import statement" button in Strategie; also accept a global paste (⌘V) and file-drop anywhere over the panel while the modal is open (direction B's promise).
- **Parsing**: run on every paste/drop, debounced ~150ms, fully client-side. Expected input: Czech bank CSV `Datum;Protistrana;Detaily;Částka;Měna` (semicolon-delimited, `dd.mm.yyyy`, decimal comma, thin-space thousands). Tolerate `.txt` (same shape) and `.pdf` via text extraction. Unparseable lines → "skipped" with reason, never a hard failure.
- **Live preview** (A): rows appear as parsed; the in-flight row renders ghosted (38% opacity). Tally updates live.
- **Category guessing**: pre-fill from counterparty keyword map (existing Strategie categories); chip click cycles or opens a small picker (reuse `seg` control from the rung editor).
- **Duplicates**: match on (date, amount, counterparty); mark as chip count and exclude by default.
- **Import**: commits rows into `statements.byMonth` for the detected month (default = month of most rows; show it in the header). Primary button label always carries the count: "Import N rows".
- **Undo**: one-click batch revert for the last import (store the imported row ids).
- **Close**: ✕, Esc, or Cancel; confirm only if parsed rows exist.
- **Motion**: puck drop-in 0.5s `cubic-bezier(0.2,1.2,0.3,1)` staggered 80ms; beam pulse 2.2s; shimmer 1.4s; all gated behind `prefers-reduced-motion: no-preference`.

## State Management
```
importDraft: {
  rawText: string,
  rows: { id, date, who, detail, amountMinor, currency, category, status: "ok"|"dup"|"skip", reason? }[],
  month: "2026-05",
  parsing: boolean, progress: number,
  lastImportIds: string[]   // for batch undo
}
```
Persist nothing until Import; after Import, write through the existing storage hook and keep `lastImportIds` for the session.

## Design Tokens (dark theme)
- Accent: `#16b981`, bright `#34d399`, deep `#0c8f66`, ink-on-accent `#04130d`, tint text `#d4f3e7`
- Surfaces: bg `#0b0b0d`, panel `#141417`, surface `#161619`, raised `#1b1b20`, popover `#212128`, inset `#0e0e11`
- Lines: `rgba(255,255,255,0.065)` / strong `0.11` / faint `0.04`
- Text: `#f0f0f2`, secondary `#c9c9cf`, muted `#91919b`, dim `#66666f`, faint `#4b4b53`
- Hues: zinc `#8b8b95`, orange `#e08648`, green `#34c891`, blue `#6595ee`, purple `#a384df`, rose `#e07a93`; negative amounts `#e07a93`
- Radii: card 16, inner 11, chip/pill 999; buttons h 38 r 10; chips h 26
- Type: DM Sans (UI), DM Mono (numbers, code, kbd); eyebrows 10.5px/700 caps 0.16–0.22em
- Use the existing CSS variables in `src/index.css` — Day and SAP themes must work without extra code.

## Assets
None. All icons are inline 24-viewBox stroke SVGs (up-arrow, lock, check) — recreate with the codebase's icon set if one exists.

## Files
- `Statement Import — Explorations.html` — canvas host; **all CSS** in its `<style>` block
- `import-art.jsx` — all artboard markup (variants A–D + moments); sample row data at top
- `design-canvas.jsx` — presentation shell only, not part of the design
