# Claude Code prompt — Strategie update

Paste everything below the line into Claude Code, run from the repo root (`00x---ShELF/`).
The `reference/` folder next to this file contains the HTML/JS/CSS prototype these changes are based on — they are **design references**, not code to copy verbatim. Recreate them in the existing React + TypeScript app using its established patterns (the `se-*`, `strat-*`, `rung-*`, `card` class system in `src/index.css`, `fmtMoney`/`CURRENCIES` from `src/components/Strategie/strategie.ts`, `crypto.randomUUID()` for ids, and chrome-storage persistence via `useShelfStorage`).

---

You are updating the **Strategie** feature of the ShELF browser-extension (React 18 + TypeScript + Vite). The relevant files:

- `src/components/Strategie/StrategiePanel.tsx` — dashboard; renders the `DEFAULT_LADDER` rungs (~line 319) and mounts `<StatementEditor>` (~line 630).
- `src/components/Strategie/StatementEditor.tsx` — the cashflow modal; `localBook`/`localOrder`/`active` state, `stepActive(dir)`, `addMonth()`, `toDisplay`/`toBase`, income column under `.se-col--in` (~line 175), `addIncome()`.
- `src/components/Strategie/strategie.ts` — constants incl. `DEFAULT_LADDER` (~line 186), `monthLabel`, `stepMonth`, `fmtMoney`, `CURRENCIES`.
- `src/components/Strategie/icons.tsx` — shared inline-SVG icons (`IcoX, IcoChev, IcoPlus, IcoTrash, IcoIn, IcoOut, IcoCheck, IcoLock`).
- `src/types/grid.ts` — `StrategieState`, `_defaultStrategie()`, `normalizeStrategie()`.
- `src/hooks/useShelfStorage.ts` — persistence (`strategieSaveStatement`, `strategieSetCurrency`, `setStrategie`, key `shelf-strategie`).
- `src/index.css` — global stylesheet where all `se-*` / `rung-*` classes live.

Read `reference/strategie.jsx`, `reference/strategie.js`, and `reference/styles.css` for the exact prototype implementation and CSS to port. Implement the three features below. Match spacing, radii, colors, and motion from the reference CSS, but use the project's existing tokens (`var(--surface)`, `var(--line)`, `var(--accent)`, `var(--hue-*)`, `var(--mono)`, `var(--r-inner)`, etc.) rather than hard-coding hex where a token exists.

## Feature 1 — Clickable month picker in StatementEditor

Today the month label (`.se-month`) between the prev/next arrows is static; you can only step one month at a time. Make the label a button that opens a dropdown to jump to any month.

- Turn `.se-month` into a `<button class="se-month se-month--btn">` with a caret (reuse `IcoChev` rotated, or add a small chevron) after the month name. Keep the existing net-surplus sub-line.
- Add `pickerOpen` state + a `ref`; close on outside-click (mousedown listener) and on Escape (fold into the existing Escape handler — first Escape closes the picker if open, otherwise the existing double-Escape closes the modal).
- The dropdown (`.se-monthmenu`, `role="listbox"`) lists every key in `localOrder`: each row shows a check on the active month, the `monthLabel(key)`, and that month's net (income−expenses) formatted with `fmtMoney`, colored rose when negative. Clicking a row sets `active` and closes.
- Last row is an "add" affordance: `Start {monthLabel(stepMonth(lastKey,1))}` that calls the existing `addMonth()` logic and closes.
- Keep the existing prev/next arrows working unchanged.

See `.se-monthpick`, `.se-month--btn`, `.se-month-caret`, `.se-monthmenu`, `.se-mo-opt`, `.se-mo-add` in `reference/styles.css` and the JSX in `reference/strategie.jsx` (search `se-monthpick`).

## Feature 2 — Ladder rung detail modal in StrategiePanel

Make each financial-ladder rung clickable, opening a detail modal.

1. **Enrich the ladder data.** Extend the `DEFAULT_LADDER` item type in `strategie.ts` with optional fields:
   ```ts
   icon: string;          // key into the icon set, e.g. "shield" | "gift" | "flame" | "vault" | "leaf" | "growth" | "target"
   hue: string;           // CSS color/token, e.g. "var(--hue-blue)"
   blurb: string;         // 1–2 sentence plain-language explanation
   target?: number;       // USD base, for the progress bar (e.g. emergency fund)
   accounts: { name: string; tag: string; balance: number }[]; // USD base balances
   history: { date: string; label: string; amt: number }[];    // ISO date; +in / −out, USD base
   ```
   Populate every rung. Use `reference/strategie.js` (search `ladder:`) for the full content — copy the blurbs, account names, and history verbatim. Keep your existing rung `id/title/note/status/pct` values; just add the new fields. (The reference uses a 7-step "order of operations"; you may either adopt that fuller list or map the content onto your current 5 rungs — your call, but keep the data shape above.)

2. **Make rungs clickable.** Wrap each rung's inner content in a `<button class="rung-hit">` with an `onClick` that sets `openStep` state to that rung. Add a chevron that fades in on hover (`.rung-chev`).

3. **Build `<LadderDetail step currency onClose>`** (new component, can live in `StrategiePanel.tsx` or its own file). Structure (see `reference/strategie.jsx`, search `function LadderDetail`, and `.ld-*` in `reference/styles.css`):
   - `.ld-backdrop` (click-out + Escape to close) → `.ld-modal` with `--step-hue` set from `step.hue`.
   - **Hero header** (`.ld-hero`): a hue-tinted gradient wash, a large ghost icon, a close button, an icon badge, a status pill (`Funded` / `In progress · {pct}%` / `Not started yet`), the step number ("Step N of …"), and the title.
   - **Body**: the blurb; a "Where the money sits" section listing `accounts` (dot + name + tag + balance) with a summed total, and — when `target` is set — a progress bar `total/target` with percent; a "History" section as a vertical timeline (newest first) with date, label, and signed amount (green `+` / rose `−` / muted `—`). Empty `accounts`/`history` show a tasteful empty-state line.
   - All money via `fmtMoney(value, currency)`.

4. **Icons.** Add the ladder icons (`shield, gift, flame, vault, leaf, growth, target`) plus `IcoClock` to `icons.tsx`, following the existing inline-SVG style (24×24, `stroke="currentColor"`, rounded caps). SVG paths are in `reference/strategie.jsx` (search `const SI =`).

## Feature 3 — Editable "Memberships" block in StatementEditor

The left income column has empty space below "Add income". Add a **Memberships** block there: the recurring subscriptions behind the "Subscriptions" expense line, shown as small square tiles, fully editable.

1. **Data + persistence.** Add to `StrategieState` in `grid.ts`:
   ```ts
   memberships: { id: string; name: string; plan: string; price: number; color: string; mono: string }[];
   // price is USD base/mo
   ```
   Seed `_defaultStrategie()` with the nine memberships from `reference/strategie.js` (search `memberships:`): Netflix 13 `#E50914` "N", Spotify 6 `#1DB954` "S", YouTube Premium 12 `#FF0033` "YT", ChatGPT 20 `#10A37F` "AI", iCloud+ 3 `#3B82F6` "iC", Disney+ 9 `#1A47BE` "D+", Game Pass 11 `#107C10` "GP", Adobe CC 8 `#DA1F26` "Ae", Notion 8 `#8E8E93` "No" (these sum to ~90 USD ≈ the Subscriptions bill). Handle missing/legacy data in `normalizeStrategie()` (default to `[]` or the seed). Add a persistence setter in `useShelfStorage.ts` (e.g. `strategieSetMemberships`) that writes back to the `shelf-strategie` key, mirroring `strategieSetCurrency`; thread it down to `StatementEditor` as a prop (alongside the existing `onSave`).

2. **Render the block** below the "Add income" button inside `.se-col--in` (see `.se-mem*` and `.se-tile*` in `reference/styles.css`, and `reference/strategie.jsx` search `se-mem`):
   - Header: a repeat-icon pill, "Memberships" title, and the summed active total `{fmtMoney}/mo`.
   - A grid of `.se-tile` squares (`grid-template-columns: repeat(auto-fill, minmax(46px, 1fr))`), each tinted with its brand color via a `--brand` CSS var, showing the monogram. **Tap a tile to pause it** (grayscale + strike line; excluded from the total) — track paused ids in local state. Hover shows a tooltip (`.se-tile-tip`) with name / plan / price.
   - A dashed `.se-tile--add` "+" tile at the end opens the editor in add-mode.
   - Footer: "{n} active · {m} paused" and a hint "tap to pause · ✎ to edit".

3. **Editor (`.se-mem-editor`)** — an inline panel that appears below the grid (NOT a centered popover):
   - Live preview tile (color + monogram), Name input, Plan input, a Price field prefixed with the currency code (display value via `toDisplay`, store via `toBase`), a Badge/monogram input (auto-derived from the name as up-to-2 uppercase initials unless the user types their own), and a row of color swatches.
   - Swatch palette: `["#E50914","#FF6B2C","#F59E0B","#1DB954","#10A37F","#3B82F6","#1A47BE","#8B5CF6","#EC4899","#8E8E93"]`. Selected swatch gets a ring.
   - Actions: **Cancel**, **Add**/**Save**; in edit-mode also **Remove**.
   - Editing an existing tile: a small ✎ button (`.se-tile-edit`) appears at the tile's top-right on hover; clicking it (stopPropagation so it doesn't toggle pause) opens the editor pre-filled. New ids via `crypto.randomUUID()`.
   - Persist every add/edit/remove through the storage setter from step 1.

   ⚠️ The editor panel is a normal in-flow flex child — give it its **own** entrance keyframe (`translateY` only, no `translateX(-50%)`). In the prototype, reusing the month-picker's centered keyframe shifted it left out of the column; don't repeat that.

## Acceptance checks
- StatementEditor: clicking the month opens a jump menu with per-month nets; arrows still work; Escape closes picker then modal.
- Ladder: every rung opens a hue-themed detail modal with accounts total, optional target bar, and a history timeline; queued/empty rungs show empty states; close via ✕ / backdrop / Escape.
- Memberships: tiles render as a square grid inside the income column; tap pauses (total updates); + adds; hover ✎ edits with Remove; prices round-trip through the active currency; the editor panel stays within the income column. All three persist across reload via chrome storage.
- `npm run build` (tsc) passes with no type errors; no console errors at runtime.
