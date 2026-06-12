# Handoff: ShELF — Strategie panel (full build)

## Overview
This bundle is the complete design for the **Strategie** tab — the personal-finance dashboard that
currently renders a placeholder in the app. It is a rigid, mature financial view whose centerpiece
is a **5-year compound-growth projection**, surrounded by: KPI strip, a textbook
order-of-operations ladder, **dated spending tracked by week**, monthly cashflow, asset allocation,
sinking-fund "pots", a four-pillar life view, and a full-screen **statement editor** modal where
the user types in income (monthly) and dated expenses.

The defining data decision: **income is monthly**, **spending is individual dated transactions**
(`YYYY-MM-DD`), so everything can be rolled up and analyzed **per week**. Money is stored in a
single base currency (USD in the prototype) and only converted for display (USD / EUR / CZK).

## The target is already scaffolded — this replaces a placeholder
`"strategie"` is **already** a `DashboardView` in `src/FullApp.tsx`, with a working nav tab and
view-slide animation. Today it renders:

```tsx
dashboardView === "strategie" ? (
  <div className="max-w-[1640px] mx-auto py-16 px-6 text-center">
    <h1 …>Strategie</h1>
    <p …>This page is intentionally empty for now.</p>
  </div>
) : …
```

**The job:** build `src/components/StrategiePanel.tsx`, persist its state through
`useShelfStorage`, and swap it in for that placeholder block. Do **not** re-scaffold the tab, the
nav, the view-slide, the topbar, or the theme/accent system — they exist and work.

## About the design files
The files here are a **working prototype in HTML + React-via-Babel** — a faithful reference for
look, data model, and behavior, **not** code to paste in. ShELF is React 19 + TypeScript 5.6 +
Vite 6 + Tailwind v4 + HeroUI v3. Re-implement these decisions with the codebase's real patterns:
typed state in `useShelfStorage`, types in `src/types/grid.ts`, the `[data-theme]` token system in
`src/index.css`, and the existing `.card` / `.seg` / `.nav-btn` styling vocabulary.

The prototype keeps the panel in an **isolated Babel scope** and hangs helpers off `window`
(`window.STRAT`, `window.project`, `window.monthWeeks`, `window.fmtMoney`, etc.). That is a
prototype artifact — port these to proper module exports / a `utils/strategie.ts`. The sample
data in `strategie.js` exists only so the design reads realistically; wire to the real store and
seed sensible defaults instead.

## Fidelity
**High-fidelity.** Exact colors, type, spacing, and depth are in `styles.css` (the `STRATEGIE`,
`STATEMENT EDITOR`, and `Spending by week` sections — lines ~833–1263). Recreate pixel-faithfully
using the codebase's tokens; never hardcode a hex that a `var(--*)` already covers.

---

## Data model

```ts
type CatKey = "housing" | "food" | "transport" | "home" | "fun" | "health" | "shopping" | "other";

interface IncomeRow  { id: string; label: string; amt: number; kind: string; }            // amt = base/month
interface ExpenseRow { id: string; label: string; amt: number; cat: CatKey; date: string; } // date = "YYYY-MM-DD"
interface MonthStatement { income: IncomeRow[]; expenses: ExpenseRow[]; }

interface StrategieState {
  statements: { current: string; order: string[]; byMonth: Record<string, MonthStatement>; }; // key "YYYY-MM"
  positions:  { invested: number; emergencySaved: number; emergencyTarget: number; };
  pots: { id: string; name: string; target: number; saved: number; monthly: number; fromHopper: boolean; }[];
  // assumptions (horizon, return scenarios, inflation), ladder, allocation, pillars:
  // these are mostly static config in the prototype — keep as module constants unless you want them editable.
}
```

- **Income** rows are dateless and monthly. Do not add dates to income.
- **Expense** rows are individually dated. Fixed bills land on a set day; variable categories are
  spread across several dated lines within the month (see `_buildVariable` in `strategie.js`).
- All amounts are a **base currency** (USD). Currency switch only changes display; never rescale
  the stored value. The old "weekly = monthly ÷ 4.33" trick is **gone** — weekly figures are real
  sums of dated rows.

### Week math — port exactly (`strategie.js`)
Weeks are **Monday-aligned, clamped to the calendar month** (W1 may be a short stub; the last week
is the remaining days). Everything weekly depends on this contract:

```ts
function monthWeeks(key: string): { idx: number; startDay: number; endDay: number; label: string; range: string }[]
function weekOfDate(key: string, dateStr: string): number  // 1-indexed week within that month
function daysInMonth(key: string): number
function dayStr(key: string, day: number): string          // → "YYYY-MM-DD"
```

### Category palette (drives every dot / bar segment / legend)
| key | label | token |
|---|---|---|
| housing | Housing | `var(--hue-blue)` |
| food | Food | `var(--hue-green)` |
| transport | Transport | `var(--hue-orange)` |
| home | Home & bills | `var(--hue-purple)` |
| fun | Fun | `var(--hue-rose)` |
| health | Health | `var(--accent)` |
| shopping | Shopping | `var(--hue-zinc)` |
| other | Other | `var(--faint)` |

### Derived (compute, never store)
income total · expense total · surplus (= income − expense) · savings rate · `toPots`/`toInvest`
split · per-week totals (`weekOfDate` buckets) · weekly average (= month total ÷ #weeks) · per-week
category composition · net worth (invested + emergency + Σ pots) · emergency coverage months · the
projection series.

### Projection
```ts
project(principal, monthlyContribution, annualReturn, months) // → [{ m, bal, contrib, growth }]
// monthly compounding: bal = bal*(1+r/12) + monthly
```
Three return scenarios (Conservative 5% / Balanced 7% / Growth 9%), default Balanced. Horizon 5y.

---

## Layout & components (build these)

Top-level `.strat` is a vertical flex stack: **header → KPI row → 12-col grid → life pillars**.

### Header (`.strat-head`)
Eyebrow "Strategie · Life & capital plan" + title "Your 5-year strategy" on the left; on the right
a **currency segmented control** (USD/EUR/CZK) and the **"Import statement"** ghost button (label
flips to "Statement · {Mon YYYY}" with an accent `.ok` style once edited). Button opens the editor.

> Currency: the prototype keeps currency in panel state. In production, decide whether it's
> panel-local or a persisted setting in `useShelfStorage` (recommended — mirror `accent`/`theme`).

### KPI row (`.kpi-row`, 4 cards)
Net worth · Monthly surplus (+ savings-rate sub) · **Projected · 5Y** (accent-tinted card) · Emergency
cover (months, target 6). Values use the mono font + `tabular-nums`.

### 12-col grid (`.strat-grid`)
1. **Projection (hero, `span-8`)** — scenario segmented control; big projected number; a
   contributions-vs-growth split legend; the **SVG area chart** (`ProjectionChart`: total accent
   area + neutral contributions area on top → the visible accent band *is* compound growth;
   dashed contributions line; gridlines; Now/Y1…Y5 axis); and a **monthly-investment slider**
   (0–2500, step 50) that re-runs the projection live.
2. **Order of operations (`span-4`)** — an `<ol>` ladder of rungs with `done` / `active` / `queued`
   status (check / number / lock marks), notes, and a progress bar on active rungs.
3. **Spending by week (`span-8`)** — one `.wk-row` per week: `W#` + date range · a
   **category-segmented bar** (width = `weekTotal / maxWeekTotal`, segments `flex-grow` by category
   amount) with an absolutely-positioned **dashed weekly-average tick** · the week total (gets an
   `.over` warm color when above the weekly average). Footer = avg key + category legend. An "Edit"
   button opens the editor.
4. **Cashflow (`span-4`)** — Income / Expenses / Surplus / → Invested / → Pots rows + a savings-rate
   **Ring**. "Edit" opens the editor.
5. **Allocation (`span-4`)** — a stacked allocation bar + legend (equity / bonds / cash) with each
   slice's share of `positions.invested`.
6. **Pots (`span-8`)** — sinking-fund cards (name, saved/target, progress bar, monthly + ETA). A
   **"From Hopper"** menu seeds a new pot from a Hopper (buy-list) item name — see integration note.

### Life pillars (`.pillars`)
Four `.life-card`s (Money / Health / Learning / Career) with a metric, state, note, and a left
accent rail (`tone-warn` → orange rail). Static/illustrative in the prototype.

### Statement editor modal (`StatementEditor`)
Full-screen `.se-backdrop` + centered `.se-modal` (≈1060px). Closes on Esc / backdrop / Cancel.
- **Period bar**: month stepper (prev disabled at first month; next steps to the next existing
  month, or **creates** the next month seeded from the current one via `cloneMonth`, remapping each
  expense `date` into the new month). Plus a **"Spending: Whole month / By week"** segmented toggle.
- **Income column**: header hint "monthly"; rows = label + amount + delete; "Add income".
- **Spending column**: header hint "dated" (or the active week range). Then the **week strip**:
  prev/next **flip arrows** (`.se-wkflip`) flank a row of mini bars (one per week) — clicking a bar
  or arrow focuses a week (enters By-week), clicking the active bar returns to month view; arrows
  disable at the first/last week. Rows = category dot + label + **date input** (`type="date"`,
  min/max clamped to the month) + category select + amount + delete; sorted chronologically; in
  By-week mode filtered to the focused week. "Add expense" seeds a row dated to the focused week's
  start (or the 15th in month view).
- **Footer tallies**: month view → Income − Spending = Left to save (xx% saved). Week view → "W2
  spent · Weekly avg · Over/Under avg". Plus **Cancel / Save to dashboard** (commit filters empty
  rows, persists, recomputes cashflow, toasts).

---

## State / persistence — follow the `buylist` pattern in `useShelfStorage.ts`
The recently-added buy-list slice is the exact template to copy. For Strategie:

1. **Key**: add `const STRATEGIE_KEY = "shelf-strategie";` next to the other key constants.
2. **Type + validator**: add the interfaces above to `src/types/grid.ts`, and a
   `normalizeStrategie(raw): StrategieState` that hard-validates shape and fills defaults
   (mirror `normalizeBuylist`). **Guard against malformed dates** — clamp `date` to its month.
3. **State + hydration**: a `setStrategieState` `useState`, add `STRATEGIE_KEY` to the keys array
   in the bulk `.get(...)`, and hydrate with `normalizeStrategie(result[STRATEGIE_KEY])`.
4. **Setter + actions**: a `setStrategie` that persists via `getStorage()?.set({ [STRATEGIE_KEY]: … })`,
   plus typed actions: `strategieSaveStatement(book, order, active)`, `strategieAddPot(name)`,
   `strategieSetMonthlyInvest(n)`, etc. — each calling `setStrategie`.
5. **Export** them from the hook's return object and include `STRATEGIE_KEY` in the backup
   export/import (`ShelfBackupData`), like `buylist`.
- Everything must run **without `chrome.*`** (plain Vite dev) — `getStorage()` already guards this.

## Integration points
- **`FullApp.tsx`**: replace the placeholder branch with
  `<StrategiePanel … />`, wrapped in the existing `max-w-[1640px] mx-auto` container. Pull
  Strategie state + actions from `useShelfStorage()` (already destructured there). Currency, if
  persisted, comes from the hook too.
- **Hopper / "From Hopper"**: the prototype reads `window.SHELF_DATA.hopper`. In the real app this
  is the **`buylist`** store (`BuylistItem[]`, already in `useShelfStorage`). Map pot-creation to
  buy-list item titles.
- **Toasts**: reuse the existing toast affordance in `FullApp` (the celebration/limit toasts) or a
  HeroUI toast — don't introduce a new toast system.
- **Theme/accent**: the panel already inherits `[data-theme]` + the runtime accent palette set in
  `FullApp`. The accent-tinted KPI, rings, bars, and `.over` color all key off `--accent` /
  `--hue-*` and adapt automatically. Verify all three themes (dark / day / sap).

## Tokens used (all already defined in `src/index.css`)
`--accent` / `--accent-bright` / `--accent-deep`, surfaces `--surface[-2/-3]` / `--inset` / `--panel`,
lines `--line[-strong/-faint]`, text `--fg` / `--fg-2` / `--muted` / `--dim` / `--faint`, hues
`--hue-blue/green/orange/purple/rose/zinc`, depth `--sh-1/-2/-3/-pop`, geometry `--r-card` /
`--r-inner` / `--pad` / `--gap`, fonts DM Sans (UI) + DM Mono (`var(--mono)`, all figures, tabular).
If any `--hue-*` or `--mono` name differs in the real `index.css`, use the real name — never ship an
unresolved `var()`.

## Files in this bundle
- `README.md` — this spec.
- `strategie.js` — **start here**: data model, statement builder, date/week helpers, currency +
  projection math.
- `strategie.jsx` — the full panel + statement editor (all components & markup to reproduce).
- `styles.css` — exact styles; relevant sections: `STRATEGIE` (~833), `STATEMENT EDITOR` (~1003),
  `Spending by week` (~1243).
- `ShELF Dashboard.html` — prototype host (load order / mount reference).

## Target files (recap)
| Area | Real file |
|---|---|
| The panel + editor + chart | **new** `src/components/StrategiePanel.tsx` (split sub-components as needed) |
| Finance/date/projection helpers | **new** `src/utils/strategie.ts` |
| Types | `src/types/grid.ts` |
| Persistence | `src/hooks/useShelfStorage.ts` (`shelf-strategie` key) |
| Mount (replace placeholder) | `src/FullApp.tsx` (`dashboardView === "strategie"`) |
| Tokens / themes | `src/index.css` (already defined) |
