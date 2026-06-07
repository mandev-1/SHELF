# Claude Code — paste this prompt

Copy everything in the fenced block below into Claude Code from the root of your ShELF repo.
The handoff folder (`README.md` + the four reference files) should be present so Claude can read it.

```
I'm adding per-week spending tracking to the Strategie / finance view of this app.

Read the design reference in ./design_handoff_weekly_spending/ first — especially
README.md (the spec), strategie.js (data model + date/week math), strategie.jsx (the UI),
and styles.css (.wk-* and .se-weekstrip / .se-date rules). These are HTML/JSX *prototypes*:
recreate the design in THIS codebase using its own framework, components, and styling
conventions — do not copy the prototype's script tags or window-scoped globals.

Goal: spending must be tracked as individual DATED transactions so it can be rolled up and
analyzed by week. Income stays per-month (monthly sources — no dates).

Implement, matching the README spec exactly:

1. DATA MODEL — change expenses from flat monthly category totals to dated transactions:
   { id, label, amt, cat, date: "YYYY-MM-DD" }. Keep amounts in a single base currency and
   convert only for display. Income rows stay { id, label, amt, kind } with no date.

2. WEEK MATH — port monthWeeks(key) and weekOfDate(key, date) from strategie.js verbatim:
   Monday-aligned weeks, clamped to the calendar month (W1 may be a short stub; the last week
   is the remaining days). Every weekly roll-up depends on this exact definition.

3. EDITOR — add a date field per spending row (clamped to the active month), a clickable
   weekly-breakdown strip (one mini bar per week), and make the Month/Week toggle a real filter
   on the dated rows. REMOVE any ÷4.33 "weekly" rescaling — it's fake; amounts are now real.
   When duplicating a month, remap expense dates into the new month (clamp the day).

4. DASHBOARD — add a "Spending by week" card: one row per week with a category-segmented bar
   (width = weekTotal / maxWeekTotal), a dashed weekly-average reference tick, and the week
   total (highlighted when above the weekly average). Include a category legend + avg key.

Derive everything else (month total, surplus, save rate, weekly totals/avg, category
composition) from the dated data — never store derived values. Persist edits the way the rest
of this app persists state. Match the existing visual system; reuse existing card/input/segmented
-control primitives rather than introducing new ones.
```

## Notes
- If your repo already stores transactions with dates, you mostly need steps 2–4 (the week
  bucketing + the two views) and can skip the model migration.
- The prototype is high-fidelity: exact colors, type, and spacing are in `styles.css`. Pull the
  `--hue-*` category palette and the `.wk-*` / `.se-*` rules from there.
- Income is intentionally dateless/monthly — don't "improve" it by adding dates.
