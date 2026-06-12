# Handoff: ShELF — Strategie panel v2 (full feature build)

## Overview
This bundle is the complete, current design for the **Strategie** tab of ShELF — a personal life-and-capital dashboard: net-worth KPIs, a flip-card hero (5-year compounding projection ⇄ daily spending explorer), an order-of-operations savings ladder, month-over-month diffs, savings programs, pots, a full **accounts directory with an enterprise manager**, and a **statement editor** with local CSV/text import, review tables, and bulk editing.

It supersedes the earlier `shelf/design_handoff_strategie/` bundle in the repo. Everything in that bundle is included here in evolved form, plus many new systems (timeline scrubber, chart range-selection → bulk edit, accounts manager, ledger/bulk review mode, SAP office texture, axis outlier capping, hover distribution tips).

## About the Design Files
The files here are **design references created in HTML** (React 18 via in-browser Babel; no build step). They are prototypes showing intended look and behavior — **not production code to copy directly**. The task is to **recreate these designs in the ShELF codebase** (React 19 + TypeScript + Vite, `src/components/Strategie/*`), using its established patterns: typed props, `useShelfStorage` slices instead of the prototype's direct `localStorage`, the repo's icon set, and its theme system.

Much of this already exists in the repo (`StrategiePanel.tsx`, `StatementEditor.tsx`, `StatementImport.tsx`) — this handoff is largely a **delta**: compare against the prototype and port what's new or changed. See `CLAUDE_CODE_PROMPT.md` for a paste-ready Claude Code prompt with the delta list.

## Fidelity
**High-fidelity.** Colors, spacing, typography, interactions and animation timings are final intent. Recreate pixel-perfectly within the codebase's conventions. `styles.css` (v1 base) + `strategie-v2.css` (v2 overrides — later in cascade, wins) are the styling source of truth; all values live there as CSS custom properties.

## How to run the reference
Open **`Strategie — Single File.html`** (fully self-contained, works offline) or serve the folder and open **`Strategie Standalone.html`**. Tweaks panel (top-right) switches theme / accent / currency / surface / density / radius. State persists in `localStorage["shelf-strategie-v2"]`.

## Screens / Views

### 1. Shell & header
- Topbar: `Strategie` greeting. Page header: eyebrow `STRATEGIE · LIFE & CAPITAL PLAN`, H1 `Your 5-year strategy`.
- Right tools: currency segmented control (USD/EUR/GBP/CZK/JPY/CHF), **↔ EUR** compare toggle (shows a second currency inline on KPIs), and a quiet ghost **Statement** button — *deliberately understated; it is only the door to the editor, not a status display*.

### 2. KPI row
Four stat cards: Net worth, Monthly surplus (accent when positive), Projected 5Y, Emergency cover (n% of target). Values derive from state (see State Management).

### 3. Hero flip card (projection ⇄ spending)
One card, 3D Y-flip (`perspective: 1800px`, `.hero-stack.flipped` rotates; ~600ms). **The visible face must drive card height** (`.flipped .hero-front { position:absolute }` swap) or the taller face clips.
- **Projection face** — "Compounding engine": scenario seg (Conservative 4% / Balanced 7% / Aggressive 10% / S&P 500 avg), big projected figure, contrib vs growth legend (stacked column layout), SVG area chart with animated draw-in, monthly-investment slider + horizon slider.
- **Spending face** — "Where the money goes":
  - Stacked daily bars by category (`STMT_CATS` hues); whole column clipped to one pill shape (`rx` 6, capped at barW/2). Switches to weekly columns when the window is wide.
  - **Outlier-robust y-axis**: if max > 2.4 × the 85th percentile of non-zero columns, cap the axis at `niceCeil(p85 × 1.2)`; clipped columns get a small chevron marker at top and a `peak <amount> ↑ (axis capped)` note at the right of the axis.
  - Dashed average line (`avg/day` or `avg/wk`), category filter chips (toggle to hide), hover tooltip **portaled to `document.body`, position: fixed** (never render fixed overlays inside the flip subtree — transforms trap them), following the cursor with edge flipping.
  - **Marquee selection**: pointer-drag across columns selects a range (dashed accent band, outside dims to 0.3); hover inside shows an aggregated tooltip (range label, combined total, items sorted by size, "Click to open in the statement editor" hint); click inside opens the **bulk-edit review table scoped to those days**; click outside clears.
  - **Timeline scrubber** (below chart) — spans the **entire statement history**, not the active month: 52px inset rail with sparkline, month separators + month labels inside the rail, preset column (1M = active statement month / 3M / 6M / ALL), drag-to-create window with edge grips (resize) and middle-drag (pan), **scrub readout pill** follows the pointer while dragging, month-boundary snapping on release (±1 col), wheel zoom toward cursor, keyboard (←/→ day, ⇧ week, Esc reset), double-click reset, live right-side stats (range, total · avg · items, Reset chip). Window animates `left/width 0.22s cubic-bezier(0.2,0.8,0.2,1)`, suppressed while dragging.

### 4. Order of operations (ladder)
7 rungs (Starter buffer → Goal & taxable); done rungs check off, current shows a progress track. Hover anywhere on a rung: **distribution tooltip** (absolute within the card) — step total, per-account rows with % shares and mini stacked bar (step hue at descending opacities 1/.68/.45/.3/.2), footer gauge "n% of all parked money sits in this step"; queued steps show an empty-state line. Click → **ladder detail modal**: editable account rows (name, tag, balance) persisted per rung (`rungAccounts`), autofilled from the accounts directory.

### 5. Month diff card ("vs March")
Net change figure + per-category deltas (green negative spend, red positive).

### 6. Savings programs
Monthly contribution rows (Building savings ČS, DIP) with hues, contributed-to-date total, add/remove, kind select; program contributions can be mapped from statement import rows (`savingsPlanId`).

### 7. Pots
Goal pots with progress bars, % and ETA (e.g. `54% · AUG ’26`), per-pot menu (rename, retarget, delete), add form.

### 8. Accounts (card + enterprise manager)  ← NEW
- **Card** (span-4, eyebrow "Net worth"): total across accounts, kind-allocation bar, rows grouped by kind (group label in kind hue + group sum). Balance is **click-to-edit inline** (Enter commits, Esc cancels). One header button: **Manage**.
- **Manager modal** — *must be portaled to `document.body`* (fixed overlay; ancestor transforms otherwise trap it):
  - Header: eyebrow/title, `{n} accounts · {total} total`, close ×; Esc and veil-click close.
  - Toolbar: search (name+note), kind filter chips with color dots, spacer, **CSV export** (name,kind,note,balance in display currency,url), **Add account** (appends editable blank row, unique name).
  - Bulk bar (when selection ≥1): `{n} selected`, **Set kind…** select, **Remove** (confirm), **Clear**.
  - Table (CSS grid `30px 1.7fr 130px 1fr 138px 72px 34px`): select-all checkbox; Account (inline-edit, ↗ link if url); Kind (colored dot + select); Note (inline-edit); Balance (inline-edit, mono, right); **Share** (mini bar in kind hue + %); hover-reveal row delete ×.
  - Sortable headers (Account / Kind / Balance) with ↑↓ indicator; sticky header; footer `{shown} of {n} shown · {sum}` + grand total.
- Account kinds: checking `#5b9cff`, savings `#34c891`, brokerage `#a384df`, pension `#e0905a`, building `#6595ee`, crypto `#e0a020`, cash `#8b8b95`.
- Balances stored in USD base; display = base × `CURRENCIES[code].rate`; edits divide back.

### 9. Statement editor (modal)
Month stepper, By month / By week granularity (weekly strip with flip arrows), income & spending columns with category selects and dated rows, live footer tallies, savings-plan chips. **Range chip** appears when opened from a chart selection (filters list to those days; click chip to clear). Spending column header has **Bulk edit [selection]** → opens the review table (below) in edit mode scoped to the month or the selected day range; Apply replaces only the scoped rows. Nothing persists until **Save statement**.

### 10. Statement import / review table (modal over the editor)
Two modes, one component:
- **Import mode**: paste statement text or drop `.csv/.txt/.pdf` (parsed 100% locally — copy stresses "nothing is uploaded"); parser summary (count, distinct months, errors); review table with include checkboxes, duplicate detection, per-row month/kind/category/savings-plan controls; footer `{n} of {m} rows will merge…`; **Import n rows** merges into the editor draft.
- **Edit (bulk) mode** (`editRows` prop): same table loaded with existing expense rows — sort, drag/shift row selection, bulk rewrite (label, category/savings plan), uncheck-to-remove; **Apply n rows** replaces the scoped rows in the editor draft.

## Interactions & Behavior — global rules
- **Fixed/portal rule**: every fixed-position overlay (tooltips, modals, scrub pills) renders via portal at `document.body`. Ancestor `transform`/`backdrop-filter` (card hover lifts, the hero flip, reveal animations) otherwise re-anchor them.
- Reveal animations: cards rise 10px/fade ~0.55s `cubic-bezier(0.5,0,0.15,1)` staggered; chart lines draw in; bars grow with `@keyframes` + `backwards` delays. Respect `prefers-reduced-motion`.
- Toasts: bottom toast with check icon, ~1.9s.
- Esc closes the topmost modal only (inner modals `stopPropagation`); destructive actions use `confirm`.
- All money in **USD base** internally; format with `fmtMoney(base, code, {abbr})`.

## State Management
`localStorage["shelf-strategie-v2"]` (in the real app: a `useShelfStorage` slice). Shape (see `strategie-data.js` → `STRAT_STATE`):
- `statements: { byMonth: { 'YYYY-MM': { income[], expenses[] } }, order: string[], current }` — expenses `{ id, label, amt(base), cat, date?, savingsPlanId? }`
- `positions` (projection inputs), `pots[]`, `savingsPlans[]`, `memberships[]`
- `rungAccounts: { [rungId]: { accountRef, balance }[] }`
- `accountsDirectory: { name, kind, tag, balance(base), url? }[]` + `acctSchemaV` (bump to refresh seed slice on schema change while preserving user statements/pots)
- UI state (selected window, sort, filters, search) is ephemeral — do not persist.

## Design Tokens
Source of truth: `:root` + `[data-theme]` blocks in `styles.css` / `strategie-v2.css`. Highlights:
- **Themes**: dark (default), `day`, `sap` (bold blue: accent `#0070f2`, deep `#0058c4`, bright `#1b90ff`; office backdrop = fine 28px + major 140px blue graph ruling at rgba(0,84,200,.09/.16) + `sap-noise.svg` paper grain on a separate layer, SAP-only).
- **Accent sets** (accent/bright/deep): emerald `#16b981/#34d399/#0c8f66`, blue `#5b9cff`, purple `#c98bff`, orange `#e0905a`, amber `#d97706`, SAP `#0070f2`.
- Radius: card `--r-card` (default 14px), inner = card − 5 (min 6). Density variants via `[data-density]`. Surfaces: `solid` | `glass` via `[data-surface]`.
- Type: system sans + `--mono` stack for all figures (`tabular-nums` everywhere money appears). Caps-labels: 10px/700/0.09–0.12em tracking.

## Assets
- `sap-noise.svg` — generated SVG turbulence paper grain (SAP theme).
- No external images; icons are inline SVG (see `strategie-icons.jsx`, `AmI` in `strategie-accounts.jsx`) — map to the repo's icon set.

## Files
| File | What it is |
|---|---|
| `Strategie Standalone.html` | Host page (script load order matters) |
| `Strategie — Single File.html` | Self-contained runnable reference |
| `styles.css` / `strategie-v2.css` | v1 base / v2 overrides — styling source of truth |
| `strategie-data.js` | `STRAT_STATE` seed, currencies, categories, ladder, finance helpers, `ACCOUNT_KINDS` |
| `strategie.jsx` | `StrategiePanel` + KPI/ladder/pots/programs + `StatementEditor` |
| `strategie-charts.jsx` | Projection chart + `DailySpendChart` (marquee, timeline scrubber, tooltips) |
| `strategie-import.jsx` | `StatementImport` (import + bulk-edit modes) |
| `strategie-accounts.jsx` | `AccountsCard` + `AccountsManager` |
| `strategie-ladder-detail.jsx` | Ladder rung detail modal |
| `strategie-month-diff.jsx` | Month-over-month diff card |
| `strategie-icons.jsx` / `data.js` / `tweaks-panel.jsx` | Icons / shell sample data / prototype-only tweaks shell (do **not** port) |
