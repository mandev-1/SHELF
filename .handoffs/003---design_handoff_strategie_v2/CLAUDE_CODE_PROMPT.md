# Claude Code — paste this prompt

Run from the root of the **ShELF** repo (the one with `src/components/Strategie/`).

---

I have a design-handoff bundle at `design_handoff_strategie_v2/` containing the complete, current HTML/JSX design reference for the Strategie tab, plus a `README.md` documenting every screen, interaction, token and state shape. Read the README first, then the source files.

The repo already implements an earlier version of this panel (`StrategiePanel.tsx`, `StatementEditor.tsx`, `StatementImport.tsx`). Your job is to bring the implementation up to the reference. Treat the bundle as design truth for look & behavior, but implement everything in this codebase's conventions (React 19 + TS + Vite, typed props, `useShelfStorage` slice instead of raw localStorage, existing icon set and theme system).

Work through this delta list, in order. After each item, run the app and verify before moving on:

1. **Spend chart timeline scrubber** (`strategie-charts.jsx` → `DailySpendChart`): chart domain = entire statement history; rail with sparkline, month separators/labels, 1M/3M/6M/ALL presets, drag/resize/pan window with grips, scrub readout pill, month-boundary snapping, wheel zoom, keyboard nav, live stats + Reset. Replaces any fixed Month/3mo/6mo segmented control.
2. **Outlier-robust y-axis** on the spend chart: cap at `niceCeil(p85 × 1.2)` when max > 2.4×p85; chevron markers on clipped columns + "peak … ↑ (axis capped)" note. Columns are pill-clipped as whole stacks (clipPath, rx 6 capped at barW/2).
3. **Marquee range selection → bulk edit**: drag across columns selects; aggregated hover tooltip; click-inside opens StatementImport in edit mode scoped to those days; editor shows a clearable range chip and a "Bulk edit selection" button.
4. **Accounts**: extend the accounts directory with `kind` + `balance` (USD base) + `acctSchemaV` migration; build `AccountsCard` (grouped rows, allocation bar, inline balance edit) and `AccountsManager` (portal modal: search, kind chips, sortable columns, inline cell editing, multi-select bulk set-kind/remove, CSV export, add row, share bars, sticky header, footer totals). See `strategie-accounts.jsx`.
5. **Ladder rung hover distribution tip** (live from rungAccounts/accountsDirectory) and demoted header **Statement** button (plain ghost, no month/status).
6. **SAP theme office texture**: fixed backdrop layer (graph ruling + paper grain) behind cards, SAP-only; plus the light-theme button fixes (ghost/compare/flip buttons must use light surfaces under day/sap).
7. **Portal rule sweep**: every fixed overlay (chart tooltips, accounts manager, scrub pill) must portal to `document.body` — ancestor transforms (hero flip, card hover lifts) otherwise trap them. The hero flip card must size to the visible face.

Constraints:
- Do not regress existing features (statement import parsing, savings plans, pots, currency compare).
- Money stays in USD base internally; display via the currency table.
- Respect `prefers-reduced-motion`; keep all figures in the mono stack with `tabular-nums`.
- Don't port `tweaks-panel.jsx` — it's prototype scaffolding; wire theme/currency to the app's existing settings.

When done, list any intentional deviations from the reference and why.
