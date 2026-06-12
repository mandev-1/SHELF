# Claude Code — paste this prompt

Run from the root of the **ShELF** repo (the one with `src/components/Strategie/`).

---

I have a design-handoff bundle at `design_handoff_strategie_v3/` — the v3 **delta** for the Strategie tab. Read its `README.md` first (it documents only what changed since the v2 handoff), then the source files it points to.

**Important: I have continued developing this repo since the last handoff.** Before changing anything, inspect the current state of `src/components/Strategie/*` and reconcile — some v2 items may already be implemented, possibly differently. Merge the v3 features into what exists; do not regress or overwrite my local work. Where my local implementation conflicts with the reference, prefer my data-layer/typing choices but match the reference's look and interaction behavior, and flag the conflict in your final summary.

Work through this delta list in order; run the app and verify after each item:

1. **Dashboard card grid** (`cardgrid.jsx`): replace the static card layout with a 12-column grid where each card is wrapped in a slot positioned via CSS `order` + `grid-column: span var(--cw)`, `grid-auto-flow: row dense`. Pointer-driven drag via a top-center grab handle (FLIP slide animations, 90ms dwell + 8px travel anti-jitter buffering, dragged card follows pointer while its empty cell previews the drop). Right-edge resize snapping to 4/6/8/12 cols with a live size badge. Undo stack (max 30) with floating chip + Cmd/Ctrl+Z. Persist `cardLayout { order, w }` in the Strategie storage slice; ≤1100px everything spans 12 and resize is disabled.
2. **Debt data model** (`strategie-data.js`): `debts[]` (principal/rate/payment, USD base), `DEBT_KINDS`, `debtMonthsLeft` amortization helper, `debtStrategy`, schema-versioned seed migration. Statement expense rows gain optional `debtId` (exclusive with `savingsPlanId`); remaining balance = principal − Σ tagged payments.
3. **Open debt card** (`strategie-debt.jsx`): total open, avalanche/snowball toggle with "pay first" suggestion, per-debt progress bars + `~n mo · payoff date`, hover pencil → inline editor (balance/APR/payment/kind/remove), add form, cleared rows struck through. Net worth KPI = assets − open debt (sub-label "Invested + emergency − debt").
4. **Statement integration**: "Debt payments" optgroup in every category select (editor, import, bulk rewrite); debt payments excluded from spending/categories/charts like savings plans; "to debt" split item on the spending face; import auto-tags by debt-name match when no savings plan matches.
5. **Live ladder step 3**: status/pct/note/blurb derive from open ≥8% APR debt; hover tooltip lists open high-interest debts; detail modal gets the `debtView` mode — "What's still owed" rows, % paid off bar, statement-driven "Payment history", no Edit button, hint pointing to the debt card.
6. **Account link confirm** in `AccountsCard`: confirm dialog before opening an account URL.

Constraints:
- Money stays in USD base internally; display via the currency table; `tabular-nums` mono for all figures.
- Respect `prefers-reduced-motion` (disable FLIP/slide animations, keep function).
- Don't port `tweaks-panel.jsx`.
- Keep all v2 features working (timeline scrubber, marquee → bulk edit, accounts manager, savings plans, pots, currency compare).

When done, list any intentional deviations from the reference and why, plus anything you found already implemented locally that you reconciled rather than rebuilt.
