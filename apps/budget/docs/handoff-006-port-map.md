# Handoff 006 → Budget App — 1:1 Port Map

> **For future Claude Code sessions.** This maps the design prototype at
> `.handoffs/006---holiday-budget-handoff-spinoff/Holiday Budget (1).html` to a porting
> plan for `apps/budget`. Read this before porting any new budget view.

## 1. What the handoff actually is

- A **single-file bundled React app** (a "bundler" export). 5.9 MB, but only ~190 lines
  — line 180 is one ~5.9 MB **minified** JS bundle; line 188 is a ~268 KB chunk.
- The only readable component name in the bundle is `function HolidayApp(...)`. React hooks
  are aliased/minified (`useState` appears 4×, total). **You cannot copy the JS 1:1** — it's
  minified. Treat the bundle as a *class/structure reference only*, not source.
- The bundle's UI copy is **not** stored as plain strings (keyword greps return ~0), so don't
  try to scrape labels from it.

### The real sources of truth (use these, not the bundle)
1. **`apps/budget/components/budget.css`** — the *complete, readable* design system, already
   copied into the app. Every component's exact styling + class hierarchy lives here. Line
   anchors are given per family below.
2. **`apps/budget/lib/budget-types.ts`** — the data model (`BudgetState`, `BudgetMember`,
   `BudgetExpense`, `BudgetTrip`), already ported from the extension's `src/types/grid.ts`.
3. **`apps/budget/components/BudgetPanel.tsx`** — the *already-ported* core view. Use it as the
   pattern (props `budget`/`setBudget`, modal style, `computeBalances`) for everything else.

### How to port a view (the method)
The JS is minified, so for each un-ported view you **rebuild the React markup** by:
1. Reading the family's CSS block in `budget.css` (anchors below) to learn the class hierarchy
   (e.g. `.gb-trip-card > .gb-trip-cover`, `.gb-trip-faces`, …).
2. Reusing those exact class names in JSX (the CSS is already loaded — no new styling needed).
3. Re-deriving the logic from the data model + the `BudgetPanel` patterns.
Markup structure can also be cross-checked against the live bundle by opening the HTML in a
browser and inspecting the DOM.

## 2. Data model status (`lib/budget-types.ts`)

| Type | Status | Gaps to add when porting |
|---|---|---|
| `BudgetState` (currency, splitBasis, members, expenses, monthlyBudget, settledMonths, trips) | ✅ present | `goals?` (savings goals) not modeled yet |
| `BudgetMember` (id, name, share, income, color, createdAt) | ✅ present | `emoji?: string` (avatar emoji — see `gb-emoji`) not modeled |
| `BudgetExpense` (…, receipt?, …) | ✅ present | `receipt` (data URL) exists → used by the Scan/import view |
| `BudgetTrip` (id, name, destination, start/endDate, datesTBD, color, cover, memberIds, expenses) | ✅ present | drives the whole Trips view |

## 3. Component catalog (240 classes, grouped)

CSS line numbers refer to `apps/budget/components/budget.css`. Status: ✅ ported · 🟡 partial · ❌ not ported.

### A. App shell / view switching — ❌
- `gb-viewseg`, `gb-viewseg-n` (CSS L3465) — segmented control switching the two main views.
- Inferred top-level views: **Shared/Monthly** (the ported `BudgetPanel`) ⇄ **Trips** (`gb-tripview` L3593).
- `gb-guest-page` (L3300) is a *separate* route reached by a personal link (see J).

### B. Shared Budget view — ✅ PORTED (`BudgetPanel.tsx`)
- Header: `gb-head`, `gb-title`, `gb-cur-seg`, `gb-add-btn`
- Member bar: `gb-memberbar` (L3074), `gb-memchip*`, `gb-av`
- Board tiles: `gb-board*` (L3404) — shared spend / your position / fair share
- Settle up: `gb-settle*` (L3100), `gb-bal-*` — greedy transfer suggestions (`computeBalances`)
- Ledger: `gb-ledger-body` (L3150), `gb-act-*` (L3243)
- Split basis: `gb-split*` (L3166), `gb-splitseg`, `gb-mem-*`, `gb-basis-*`, `gb-weight*`
- Expense modal: `gb-modal*` (L3193), `gb-fld`/`gb-field`, `gb-paidby`, `gb-paid-chip`, `gb-amt`, `gb-date`
- ⚠️ Note: a *richer* ledger style `gb-led-*` (L3150: `gb-led-paid`, `gb-led-split`, `gb-led-part`, `gb-led-clip`) exists in the handoff but the port used the simpler `gb-act-row`. Optional upgrade.

### C. Trips / Holiday view — ❌ (biggest un-ported piece)
- Container: `gb-tripview` (L3593)
- Grid of trips: `gb-trips-grid` (L3469), `gb-trip-card` (L3470), `gb-trip-card--add`, `gb-trip-add-plus`,
  `gb-trip-cover(-fallback)`, `gb-trip-faces`/`gb-trip-face`/`gb-trip-facemore`, `gb-trip-total`,
  `gb-trip-per`, `gb-trip-status`, `gb-trip-pending`, `gb-trip-count`, `gb-trip-name`, `gb-trip-meta`, `gb-trip-figs`, `gb-trip-foot`
- Trip detail hero: `gb-trip-hero*` (L3409) — `-img`, `-scrim`, `-emoji`, `-name`, `-meta`, `-actions`, `-body`; back button `gb-trip-back`
- Data: `BudgetTrip` (already typed). Each trip holds its own `expenses[]`.

### D. Trip day picker — ❌
- `gb-daypick`, `gb-day`, `gb-day-dow`/`-mon`/`-num` (L3226) — pick a day within a trip's date range.

### E. Spend chart — ❌
- `gb-spendchart-svg`/`-wrap`/`-axis`/`-tick`/`-peak` (L3237) — SVG daily-spend chart (also used in the guest view).

### F. Budget targets — ❌
- `gb-bud-*` (L3132): `-plan`, `-actual`, `-cur`, `-input`, `-fill`, `-track`, `-mark`, `-dot`, `-name`, `-of`, `-row`; `gb-budget-body`, `gb-budget-tag`
- Plan-vs-actual progress bar with an editable target. Data: `BudgetState.monthlyBudget`.

### G. Savings goals — ❌
- `gb-goal-*` (L3182): `-bar`, `-fig`, `-foot`, `-name`, `-top`; `gb-goals-body`
- Data: **not modeled yet** — add a `goals` shape to `BudgetState` when porting.

### H. Receipt scan / import — ❌  (this is the "import" feature in the branch name)
- `gb-scan-*` (L3273): `-drop`, `-thumb`, `-thumbwrap`, `-attached`, `-att-info`, `-remove`, `-status`,
  `-sweep`, `-ico`, `-line`, `-main`, `-sub`, `-field`
- Drag-drop a receipt → thumbnail + "sweep" scan animation → attach to an expense.
- Data: `BudgetExpense.receipt` (data URL) already exists.

### I. Invite manager — 🟡 (we shipped a simpler version)
- `gb-invite-*` (L3296): `-list`, `-row`, `-name`, `-url`, `-copy`, `-preview`, `-ghost`, `-add`, `-x`, `-act`, `-body`, `-link`, `-tag`
- **This is the canonical design for the per-person link feature** we built ad-hoc in `PersonModal`
  (the `?b=&me=` link + copy button). When porting, replace the ad-hoc share UI with this full
  invite manager (list of people + their URLs + copy + preview).

### J. Guest view — ❌ (large; ~40 classes)
- `gb-guest-page` (L3300) + `gb-guest-*`: `-ribbon`(`-l`) ("you are X"), `-position`/`-pos-row`/`-pos-rows`/`-pos-lab`/`-pos-sub`/`-pos-val`,
  `-ledger`/`-tx`(`-amt`/`-block`)/`-row`(`-main`/`-meta`/`-label`/`-amt`), `-shared`, `-add`, `-as`, `-card`(`-head`),
  `-emoji`, `-note`, `-foot`, `-head`, `-meta`, `-name`, `-exit`
- The proper landing page for a `?me=` personal link: a friend's own page with their position,
  their shared ledger, an "add expense as me" action, an activity timeline, and a spend-per-day chart.
- **Current state:** we reuse `BudgetPanel` with a "You're X" badge + paid-by default. The handoff
  wants a *dedicated* guest page. Decide per scope: keep the lightweight badge, or build this.

### K. Balances strip — ❌
- `gb-strip-*` (L3407): `-tile`, `-bals`, `-btn`, `-clear`, `-info`, `-name`, `-net`, `-tx`, `-txi`, `-action` — full-width balances strip (alt layout to the board tiles).

### L. Member customization — ❌
- `gb-hue`/`gb-hues` (L3222), `gb-emoji`/`gb-emoji-row` (L3517) — pick an avatar hue + emoji per member.
- Data: `BudgetMember.color` exists; add `emoji?: string`.

### M. Compact transaction list — ❌
- `gb-tx-*`: `-list`, `-name`, `-amt`, `-arrow`.

### N. Misc states / affordances
- `gb-armed` / `gb-armed-shake` — "armed" delete confirmation (shake) — replaces native `confirm`.
- `gb-hint-pop` / `gb-exit-hint`, `gb-empty`, `gb-link`, `gb-incl`.

## 4. Port status summary

| Area | Status |
|---|---|
| Shared Budget (members, expenses, settle-up, split basis, expense modal) | ✅ ported |
| Add/edit person modal + per-person `?b=&me=` link | 🟡 simplified (canonical = §I invite manager + §J guest page) |
| Trips / Holiday, day picker, spend chart, budget targets, savings goals, receipt scan/import, balances strip, guest page, hue/emoji picker | ❌ not ported |

## 5. Recommended porting order
1. **Trips view (C)** — largest self-contained feature; `BudgetTrip` already typed.
2. **Receipt scan / import (H)** — the named "import" feature; data field already exists.
3. **Spend chart (E)** + **budget targets (F)** — small, reusable, no new data.
4. **Invite manager (I)** + **guest page (J)** — upgrade the share feature to the handoff design.
5. **Member hue/emoji (L)**, **balances strip (K)**, **goals (G)** — polish; (G) needs a data-model add.

## 6. Caveats
- Logic is **rebuilt**, not copied (bundle is minified). Keep `budget.css` as-is; only add markup.
- Themes: the app renders under `data-theme="sap"` (set in `app/layout.tsx`); `day`/`neo` variants
  also exist in the CSS. Keep new components theme-token-driven (`var(--bg)`, `var(--accent)`, …).
- Stripped assets: `@font-face` and two texture images were removed during the port (fonts now load
  from Google Fonts). Don't reintroduce the UUID asset URLs.
- The handoff is large design-reference; per repo `CLAUDE.md`, only open it when explicitly porting.
