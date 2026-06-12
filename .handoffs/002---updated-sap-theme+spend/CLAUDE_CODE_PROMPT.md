# Claude Code — paste this prompt

Run from the root of the **ShELF** repo (the one with `src/FullApp.tsx`). Make sure this
`design_handoff_strategie/` folder is in the repo so Claude can read it.

```
Build the Strategie tab. It's already scaffolded in src/FullApp.tsx as a DashboardView with a
working nav tab and view-slide animation, but currently renders a placeholder ("This page is
intentionally empty for now."). Replace that placeholder with the real panel.

First read ./design_handoff_strategie/ — README.md is the spec; strategie.js has the data model +
date/week + projection math; strategie.jsx is the full UI; styles.css has exact styling
(STRATEGIE, STATEMENT EDITOR, "Spending by week" sections). These are HTML/React-via-Babel
PROTOTYPES — recreate the design in THIS codebase (React 19 + TS + Tailwind v4 + HeroUI v3) using
its real patterns. Do NOT copy the prototype's window globals or Babel scope, and do NOT
re-scaffold the tab/nav/topbar/theme — they already work.

Deliver:

1. src/utils/strategie.ts — port the helpers verbatim in behavior: monthWeeks(key),
   weekOfDate(key,date), daysInMonth, dayStr, project(principal,monthly,rate,months), and money
   formatting. Weeks are Monday-aligned and clamped to the calendar month (see README).

2. src/types/grid.ts — add the Strategie types (IncomeRow, ExpenseRow dated YYYY-MM-DD,
   MonthStatement, StrategieState, pots) and a normalizeStrategie() validator that clamps expense
   dates to their month and fills sensible defaults.

3. src/hooks/useShelfStorage.ts — add a "shelf-strategie" slice following the EXACT buylist
   pattern already in this file: key constant, normalize on hydrate, add the key to the bulk get(),
   a persisting setter, typed actions (save statement, add pot, set monthly invest), export them
   from the hook, and include the key in backup export/import. Must run without chrome.* too.

4. src/components/StrategiePanel.tsx (+ split sub-components if large) — the full panel: header
   with currency segmented control + Import-statement button; 4 KPI cards; 12-col grid with the
   5-year projection hero (SVG area chart + scenario toggle + monthly-invest slider), the
   order-of-operations ladder, the "Spending by week" card (category-segmented bars + dashed
   weekly-average tick), cashflow + savings ring, allocation bar, and pots (with "From Hopper" that
   reads the existing buylist store); plus the four life pillars; plus the full-screen StatementEditor
   modal (monthly income column; dated spending column with date inputs, a week strip with prev/next
   flip arrows, and a Whole-month/By-week toggle; month stepper that creates+seeds the next month;
   footer tallies + Save).

5. src/FullApp.tsx — replace the strategie placeholder branch with <StrategiePanel/> inside the
   existing max-w-[1640px] mx-auto wrapper, wiring props/state from useShelfStorage().

Income is MONTHLY (no dates). Spending is individual DATED transactions so it rolls up by week —
keep that model; never reintroduce ÷4.33 weekly rescaling. Money is stored in one base currency and
only converted for display. Derive all totals/weeks/projection — don't store derived values. Match
the existing .card / .seg / .nav-btn vocabulary and the [data-theme] tokens; verify dark/day/sap.
There's no test runner — typecheck with `npm run build` (tsc -b) and load dev/ unpacked per CLAUDE.md.
```

## Notes
- The repo already lists `"strategie"` in the `DashboardView` union and the nav `order` array — no
  nav changes needed.
- Reuse the existing toast affordance in `FullApp` rather than adding a new one.
- `npm run dev` + load the `dev/` folder unpacked (not `dist/`) per the repo's CLAUDE.md.
