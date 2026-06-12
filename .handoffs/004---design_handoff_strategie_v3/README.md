# Handoff: ShELF — Strategie panel v3 (delta: card grid system + debt tracking + live ladder)

## Overview
This bundle is the **delta on top of `design_handoff_strategie_v2/`** for the Strategie tab of ShELF. It contains the complete current prototype source, but the work is three new systems added since v2:

1. **Dashboard card grid** — a proper 12-column grid where every dashboard card can be dragged to any position and resized (⅓ · ½ · ⅔ · full width), with slide animations, dense packing, persistence and undo.
2. **Debt tracking** — an "Open debt" card with amortization payoff math and avalanche/snowball ordering, statement-driven balances (rows tagged as debt payments pay debts down automatically), net worth = assets − debt.
3. **Live ladder step 3** — "Kill high-interest debt" now derives its status, progress, tooltip and detail modal from the tracked debts instead of static seed data.

Plus one micro-feature: clicking an account link in the Accounts card asks for confirmation before opening the bank's site.

**You have local changes.** Treat this bundle as design truth for the four features above and *merge*, don't overwrite. Everything that was in v2 is unchanged in intent unless listed in the delta below.

## About the Design Files
The files here are **design references created in HTML** (React 18 via in-browser Babel; no build step) — prototypes showing intended look and behavior, **not production code to copy directly**. Recreate the designs in the ShELF codebase (React 19 + TypeScript + Vite, `src/components/Strategie/*`) using its established patterns: typed props, `useShelfStorage` slices instead of raw `localStorage`, the repo's icon set and theme system.

## Fidelity
**High-fidelity.** Colors, spacing, typography, interaction physics and animation timings are final intent. `styles.css` (base) + `strategie-v2.css` (overrides, later in cascade) remain the styling source of truth. New CSS sections: `proper card grid` (after the `.span-4` rule) and `DEBT CARD` (before the 1100px media query), plus `.ld-debt-hint` / `.ld-acct-*--cleared` for the ladder detail.

## How to run the reference
Serve the folder and open **`Strategie Standalone.html`**. State persists in `localStorage["shelf-strategie-v2"]`. To see pristine seed data (including seeded debts and tagged payment rows), clear that key first.

---

## Delta 1 — Dashboard card grid (`cardgrid.jsx`)

### Model
- Layout state: `cardLayout: { order: cardId[], w: { [cardId]: 4|6|8|12 } }`, persisted in the Strategie slice. `normalizeCardLayout(stored, legacyOrder)` filters unknown ids, appends missing ones, defaults widths (legacy `cardOrder: string[]` is accepted as a fallback for order).
- Card ids & default spans: `hero 8, ladder 4, diff 4, weekly 8, flow 4, debt 4, programs 4, accounts 4, pots 4, pillars 4, cats 8`.
- Grid: `grid-template-columns: repeat(12, 1fr); gap: 14px; align-items: start; grid-auto-flow: row dense` — dense packing means rows never leave holes.
- Each card renders inside a `CardSlot` wrapper positioned purely via CSS (`grid-column: span var(--cw)`, `order: index`) so React keys and card-internal state survive re-placement.

### Drag to place
- Grab handle: a 28×4px rounded pill, top-center of the card, fades in on card hover (hidden during any drag). `touch-action: none` (pointer events → works with touch).
- Pointer-driven (NOT HTML5 DnD). Drag starts after 5px of travel. The dragged slot stays in flow (its empty cell shows where it will land) while the card itself follows the pointer via `transform`; elevated `z-index: 60`, shadow `var(--sh-3), 0 18px 44px rgba(0,0,0,0.22)`, opacity 0.95.
- **FLIP slide animations**: every layout commit snapshots `getBoundingClientRect` of all slots before the state change; after render, non-dragged slots are translated from old→new position and released with `transform 0.22s cubic-bezier(0.2, 0.7, 0.3, 1)`.
- **Anti-jitter targeting** (important, this was explicitly requested): a hovered target must be dwelt on for ≥90ms before the move commits, and after each commit the pointer must travel ≥8px before retargeting. Hit-testing uses the *settled* (post-FLIP) rects, never in-flight animated positions.
- On release the dragged card animates into its cell (`transform 0.2s ease`); `body.cards-sorting` disables text selection during drags.

### Resize
- Handle: 4×34px pill on the card's right edge (hover-reveal, `cursor: ew-resize`).
- Width snaps to **4 / 6 / 8 / 12 columns**; a pill badge appears top-right of the card while resizing: `{w}/12 · ⅓|½|⅔|full`. Neighbors FLIP-slide as widths change. Dashed accent outline on the resizing card.

### Undo
- Every completed drag/resize pushes the prior layout onto an undo stack (max 30) and shows a floating chip bottom-center: label ("Layout updated" / "Card resized") + accent **Undo** button + `⌘Z` kbd hint; auto-hides after 6s. `Cmd/Ctrl+Z` (outside form fields) also undoes. Undo itself FLIP-animates.

### Responsive
- ≤1100px: all slots span 12; resize handles hidden; drag still works (vertical reorder).

## Delta 2 — Debt tracking

### Data model (`strategie-data.js`)
- `debts: { id, name, kind, principal, rate, payment }[]` — `principal` = starting balance in **USD base**; `rate` = APR %; `payment` = planned monthly payment (base).
- `debtStrategy: "avalanche" | "snowball"`, `debtSchemaV` (migration: seed slice refreshed when version bumps, preserving statements/pots — same pattern as `acctSchemaV`).
- `DEBT_KINDS` (customizable kinds with hues): consumer `#e08648`, student `#6595ee`, card `#e0647a`, family `#34c891`, mortgage `#a384df`, business `#e0a020`, other `#8b8b95`. `debtHue(debt)` resolves kind → hue.
- `debtMonthsLeft(balance, payment, apr)` — standard amortization: `null` if no payment, `Infinity` if payment ≤ monthly interest, else `ceil(−log(1 − r·B/P) / log(1+r))` with `r = apr/1200` (plain `B/P` at 0%).
- Statement expense rows gain optional `debtId` (mutually exclusive with `savingsPlanId`).
- **Remaining balance is statement-driven**: `remaining = max(0, principal − Σ all rows tagged with that debtId)`.

### Spending semantics
Debt payments are transfers, not spending — mirror the savings-plan rule everywhere:
- `exp = expAll − toPlansMonth − toDebtMonth`; surplus still `inc − expAll`.
- Excluded from: category breakdown (`expensesByCat`), daily spend chart, weekly bars, category chips.
- Hero spending face shows an extra split item: `{amount} to debt` (tooltip explains).
- **Net worth KPI** = invested + emergency − open debt; sub-label literally `Invested + emergency − debt`.

### Open debt card (`strategie-debt.jsx`, span-4, eyebrow "Liabilities")
- Header right: segmented **Avalanche | Snowball** (persisted). Avalanche sorts open debts by APR desc; snowball by remaining asc. With >1 open debt, the first row gets an uppercase accent-outlined pill **PAY FIRST** (tooltip: "Suggested next target — highest APR" / "smallest balance").
- Summary block: large total open (24px/700), caption `open across N debts · {x} paid this month`.
- Per-debt row: kind-hue dot · name (double-click renames via prompt) · kind label · remaining (bold, tabular) · hover-reveal pencil. Below: progress bar (paid %, kind hue fill), foot line `{pct}% paid · {rate}% APR` (or `· interest-free`) ↔ `~{n} mo · {Mon YYYY}` payoff (edge cases: "payment below interest", "no payment set"). If paid this month: accent line `−{x} this month, from your statement`.
- Pencil opens an inline editor strip (grid `1.2fr 0.7fr 0.9fr 1.2fr auto` on `--surface-2`): **Balance** (editing it adjusts principal so remaining matches), **APR %**, **Per month** (placeholder = this month's tagged payments), **Kind** select, remove ×. Removing confirms; statement rows keep amounts but lose the link.
- Cleared debts collapse to a struck-through row with an accent "cleared" tag.
- Add form (same pattern as savings programs): name + kind select + balance input + Add.

### Statement tagging (mirror savings plans exactly)
- Editor & import & bulk-edit category selects get a second optgroup **"Debt payments"** with options `debt:{id}` labelled `↓ {name}` (savings plans use `→`). Selecting one sets `debtId` and clears `savingsPlanId` and vice versa; picking a plain category clears both.
- Category dot color resolves debt → `debtHue`, then plan hue, then category hue.
- Import auto-tagging: after savings-plan name matching, fall back to debt name matching (`foldAscii` substring) — `debtAuto` only when no `planAuto`.
- Bulk rewrite supports `debt:` prefix; merge/apply paths carry `debtId` through.

## Delta 3 — Ladder step 3 goes live

- `rungLive(rung)`: when any debt with `rate ≥ 8` has remaining > 0, step 3 renders as `active` with `pct = paid share of high-interest principal`, note `"{open} open above 8% APR — pay down first"`, and a swapped blurb ("…Clear everything above ~8% APR before putting more into the market — payments you tag in your statement track the progress here."). Original "paid off in full" copy returns only when actually cleared.
- Rung hover tooltip for step 3 lists the open high-interest debts (tag = `{rate}% APR`, balance = remaining); its footer becomes the sentence "Open balances above 8% APR — clear these before investing more." Step-3 balances are excluded from the "all parked money" grand total.
- **Ladder detail modal** (`strategie-ladder-detail.jsx`) accepts a `debtView` prop `{ rows, history, paid, principal }` (passed only for rung 3):
  - Section title becomes **"What's still owed"**; rows = all tracked debts with APR tags and live remaining; cleared ones struck-through + "CLEARED" badge.
  - **No Edit button** for this section (other steps keep theirs) — instead a dim hint: "Balances update automatically from statement rows tagged as debt payments. Edit debts on the *Open debt* card."
  - Progress bar: `{pct}% paid off` + `{paid} of {principal}`.
  - **"Payment history"** timeline replaces static seed history: every `debtId`-tagged row across all months, `{label} — {debt name}`, newest first, amounts positive. Empty state: "No payments tagged yet — mark statement rows as debt payments and they'll show up here."

## Delta 4 — Account link confirmation
In `AccountsCard`, account-name links (`a.acct-link` with `url`) intercept click: `confirm("This will open {bank} in a new tab. Are you sure?")` — bank = name segment before "—". Cancel prevents navigation.

---

## State Management (v3 additions to the slice)
```
cardLayout:   { order: string[], w: Record<cardId, 4|6|8|12> }
debts:        { id, name, kind, principal, rate, payment }[]
debtStrategy: "avalanche" | "snowball"
debtSchemaV:  number
expenses[*].debtId?: string        // statement rows, exclusive with savingsPlanId
```
Undo stack and drag/resize state are ephemeral — do not persist.

## Files
| File | What it is |
|---|---|
| `Strategie Standalone.html` | Host page (script load order matters — `cardgrid.jsx` and `strategie-debt.jsx` load before `strategie.jsx`) |
| `cardgrid.jsx` | **NEW** — grid engine: `useCardGrid`, `CardSlot`, `normalizeCardLayout`, FLIP + dwell-buffer drag, snap resize, undo |
| `strategie-debt.jsx` | **NEW** — `DebtCard` |
| `strategie-data.js` | + `DEBT_KINDS`, `debtHue`, `debtMonthsLeft`, debt seed, seeded tagged payment rows, `debtId` exclusion in `expensesByCat` |
| `strategie.jsx` | + grid wiring, debt totals/net-worth math, `rungLive`, `debtHistory`, `debtView` pass-through, editor debt optgroup |
| `strategie-import.jsx` | + `debts` prop, debt optgroups, `debtId` through import/bulk/apply, debt auto-tagging |
| `strategie-ladder-detail.jsx` | + `debtView` mode (live rows, paid bar, payment history, hidden Edit) |
| `strategie-accounts.jsx` | + account-link confirm |
| `styles.css` | + `proper card grid` section, `DEBT CARD` section, ladder-detail debt styles, responsive grid rules |
| everything else | unchanged from v2 (`strategie-charts.jsx` got a one-line `debtId` exclusion) |

`tweaks-panel.jsx` is prototype scaffolding — do **not** port.
