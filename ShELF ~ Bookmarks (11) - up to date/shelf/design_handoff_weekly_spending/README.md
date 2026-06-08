# Handoff: Strategie — Dated Spending & Per-Week Tracking

## Overview
This is the **Strategie** panel of the ShELF personal-finance dashboard. The work in this
bundle reworks how spending is modeled and analyzed so the user can **track spending as it
evolves week by week**, while income stays **per-month** (European pay reality — salary +
freelance arrive monthly).

The headline change: spending is no longer a flat monthly figure per category. Every expense is
now a **dated transaction** (`YYYY-MM-DD`). That single change unlocks real weekly roll-ups in two
places:
1. The **Import statement** editor — a date field per row, a clickable weekly breakdown strip, and
   a real "By week" filter (not a cosmetic ÷4.33).
2. The dashboard — a new **"Spending by week"** card that shows per-week totals, category
   composition, and a weekly-average reference line.

## About the Design Files
The files in this bundle are **design references created in HTML/JSX** — a working prototype that
shows the intended look, data model, and behavior. They are **not** meant to be shipped as-is. The
task is to **recreate this design in the target codebase's environment** (React/Vue/Svelte/native,
whatever ShELF actually uses) following its established patterns, state management, and styling
conventions. If no environment exists yet, pick the most appropriate framework and implement there.

The prototype happens to be React-via-Babel with plain `window`-scoped modules; treat that as
incidental. Lift the **data model, math, and visual spec**, not the script-tag plumbing.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, and interactions are all specified below and
present in `styles.css`. Recreate the UI pixel-faithfully using the codebase's existing primitives.

## The Data Model (the important part)

All monetary values are stored in a **USD base**; the UI converts for display (USD / EUR / CZK).
A statement "book" is keyed by month (`"2026-04"`), and each month has:

```ts
type Statement = {
  income:   IncomeRow[];   // MONTHLY sources — no dates
  expenses: ExpenseRow[];  // DATED transactions
};

type IncomeRow  = { id: string; label: string; amt: number; kind: string };           // amt = USD/month
type ExpenseRow = { id: string; label: string; amt: number; cat: CatKey; date: string }; // date = "YYYY-MM-DD"
```

Income is intentionally **dateless and monthly**. Do not add dates to income.

Expenses are individually dated. Fixed bills (rent, utilities) land on a specific day; variable
categories (groceries, dining, transport, shopping, "everything else") are spread across several
dated lines within the month so the weekly view shows genuine variation.

### Week definition — implement exactly
Weeks are **Monday-aligned and clamped to the calendar month** (so W1 may be a short stub, and the
last week is whatever days remain). This is the contract the whole feature relies on:

```js
// weeks of a month → [{ idx, startDay, endDay, label:"W1", range:"Apr 1–5" }]
function monthWeeks(key) {           // key = "YYYY-MM"
  const [y, m] = key.split("-").map(Number);
  const dim = new Date(y, m, 0).getDate();   // days in month
  const weeks = []; let idx = 0; let day = 1;
  while (day <= dim) {
    const dow = new Date(y, m - 1, day).getDay();   // 0=Sun … 6=Sat
    const isoDow = dow === 0 ? 7 : dow;             // 1=Mon … 7=Sun
    const end = Math.min(dim, day + (7 - isoDow));  // extend to Sunday or month end
    idx++;
    weeks.push({ idx, startDay: day, endDay: end, label: "W" + idx, range: /* "Apr "+day+"–"+end */ });
    day = end + 1;
  }
  return weeks;
}

// which week (1-indexed) a date falls in, within its own month
function weekOfDate(key, dateStr) {
  const day = Number(dateStr.split("-")[2]);
  return monthWeeks(key).find(w => day >= w.startDay && day <= w.endDay)?.idx ?? monthWeeks(key).length;
}
```

Both helpers live on `window` in the prototype (`window.monthWeeks`, `window.weekOfDate`,
`window.daysInMonth`, `window.dayStr`) — see `strategie.js`. Port them as proper module exports.

### Derived values (all computed, never stored)
- `incomeBase` = Σ income.amt (monthly)
- `expenseBase` = Σ expenses.amt (the month's total spend)
- `surplusBase` = incomeBase − expenseBase; `saveRate` = surplus / income
- `weekTotals[i]` = Σ expenses where `weekOfDate === week.idx`
- `weekAvg` = expenseBase / weeks.length  (the dashed reference line)
- Per-week category composition = group that week's expenses by `cat`

## Categories (design tokens)
Each expense has a `cat`. The category → color map drives every dot, bar segment, and legend.
Pull the exact hues from `styles.css` / the `STMT_CATS` map in `strategie.jsx`:

| key        | label        | color token            |
|------------|--------------|------------------------|
| housing    | Housing      | `var(--hue-blue)`      |
| food       | Food         | `var(--hue-green)`     |
| transport  | Transport    | `var(--hue-orange)`    |
| home       | Home & bills | `var(--hue-purple)`    |
| fun        | Fun          | `var(--hue-rose)`      |
| health     | Health       | `var(--accent)`        |
| shopping   | Shopping     | `var(--hue-zinc)`      |
| other      | Other        | `var(--faint)`         |

(Confirm the precise token names against `styles.css` — never guess a `var(--*)` name.)

## Screens / Views

### 1. Dashboard card — "Spending by week"
- **Purpose**: at-a-glance per-week spend for the active month, without opening the editor.
- **Layout**: a `span-8` card in the 12-col `.strat-grid`. Header (eyebrow = "{Month} · dated
  spending", title = "Spending by week", right-aligned "Edit" ghost button that opens the editor).
  Body = one `.wk-row` per week.
- **Each `.wk-row`** is a 3-part grid:
  - `.wk-meta` (left): week name `W1` + date range `Apr 1–5`.
  - `.wk-track` (center): a horizontal bar whose width = `weekTotal / maxWeekTotal`. The bar is
    **segmented by category** (`flex-grow` per category amount, colored per the table above). A
    `.wk-avgtick` absolutely-positioned vertical dashed tick marks `weekAvg / maxWeekTotal`.
  - `.wk-amt` (right): the week total, abbreviated (e.g. `€720`). Add an `.over` modifier (warm
    color) when the week is above the weekly average.
- **Footer**: a key for the weekly-average dash + a category legend (dot + label per used category).

### 2. Editor — "Import statement" modal
The modal already existed; the spending column is what changed.
- **Modal width**: `min(1060px, 100%)` (widened from 960 to fit the date column).
- **Top tallies bar**: in month view shows `Income − Spending = Left to save (xx% saved · per
  month)`. In week view it swaps to `W2 spent · Weekly avg · Over/Under avg ({range})`.
- **Granularity control**: segmented `Whole month` / `By week`. (Previously this rescaled amounts
  by ÷4.33 — that is **removed**. It now filters the row list to the selected week; amounts are the
  real dated values.)
- **Income column**: header hint reads "monthly". Rows unchanged (label, kind, amount). No dates.
- **Spending column**:
  - Header hint reads "dated" in month view, or "W2 · Apr 6–12" in week view; sum reflects the
    shown rows.
  - **Weekly breakdown strip** (`.se-weekstrip`): one mini vertical-bar button per week (fill
    height = `weekTotal / maxWeek`), with abbreviated amount + `W#` label. Clicking a week focuses
    it (switches to "By week" + filters); clicking the active week again returns to month view.
  - **Week flip arrows** (`.se-wkflip`): prev/next arrows flank the strip on both sides. They step
    the focused week (entering "By week" mode), stay in sync with the strip highlight and row
    filter, and disable at the first/last week.
  - **Rows** (`.se-row`): category dot · label input · **date input** (`type="date"`, `min`/`max`
    clamped to the month) · category select · amount input · delete. Rows are sorted
    chronologically. In week view only that week's rows show.
  - **Add expense** button: seeds a new row dated to the 15th (month view) or the focused week's
    start day (week view); label says "Add expense in W2" in week view.
  - **Empty state**: "Nothing spent in W3 — add a row or pick another week." (week) / "Nothing spent
    yet — add a row." (month).
- **Duplicate-to-next-month**: when seeding a new month from the current one, expense dates are
  **remapped** to the new month (day clamped to the new month's length). See `cloneMonth(mo, newKey)`.

## Interactions & Behavior
- Clicking a weekly bar (strip or dashboard) focuses that week. Clicking the focused week again
  unfocuses (back to whole month).
- Editing a date re-buckets the row into its week live; the strip, tallies, and dashboard card all
  recompute. Ignore empty date edits (`if (e.target.value)`).
- Date inputs are clamped to the active month (`min = day 1`, `max = last day`).
- Currency switch (USD/EUR/CZK) only converts display; the stored base is USD. No period rescaling
  remains anywhere.

## State Management
- `book` / `draft`: the statements-by-month object (deep-cloned into a draft while editing, applied
  on save).
- `viewKey`: active month (`"2026-04"`).
- `gran`: `"month" | "week"`.
- `weekIdx`: focused week (1-indexed); clamped to `monthWeeks(viewKey).length` whenever the month
  changes.
- Dashboard reads the **active month** from `STRAT.statements.current`.

## Design Tokens
Colors, spacing, radii, shadows, fonts, and the `--hue-*` palette are all defined in
`styles.css`. Use those tokens; do not introduce new colors. Mono/tabular numerals are used for all
money figures (`font-variant-numeric: tabular-nums`).

## Assets
No new image assets. All visuals are CSS + inline SVG icons (`SI.*` in `strategie.jsx`).

## Files in this bundle
- `strategie.js` — data model, statement builder, date/week helpers, currency + projection math. **Start here.**
- `strategie.jsx` — the Strategie panel + the Import-statement editor (the UI for everything above).
- `styles.css` — full stylesheet; the relevant sections are "STATEMENT EDITOR" and the `.wk-*`
  (weekly card) + `.se-weekstrip` / `.se-date` rules.
- `ShELF Dashboard.html` — the host page that mounts the panel (load order + script tags reference).
