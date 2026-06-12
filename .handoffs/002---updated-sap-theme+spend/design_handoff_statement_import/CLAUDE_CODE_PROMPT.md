# Claude Code — paste this prompt

Run from the root of the **ShELF** repo (the one with `src/FullApp.tsx`).

---

I'm adding a **statement import** flow to the Strategie panel. The design handoff lives in `design_handoff_statement_import/` — read `README.md` first; it is self-sufficient.

The bundle contains an HTML design canvas with **four directions (A–D)** and three micro-moment states. Implement direction **A · Ledger split** as the modal's main state, and borrow:
- **B's** drop-zone styling for the *empty* state (before any text is pasted),
- the **drag-over**, **parsing**, and **success + undo** micro-moments as the corresponding transient states,
- **D's** warning-row treatment for skipped lines.

Requirements:
1. Recreate the design in this codebase's stack (React 19 + TS + Tailwind + HeroUI), reusing the existing CSS-variable tokens in `src/index.css` so Day and SAP themes work automatically. Do NOT ship the HTML/Babel files.
2. Parsing is 100% client-side: Czech bank CSV (`Datum;Protistrana;Detaily;Částka;Měna`, semicolon-delimited, decimal comma, dd.mm.yyyy), plus plain `.txt`. Unparseable lines become "skipped" rows, never errors.
3. Category pre-fill from a counterparty keyword map using the existing Strategie categories; chips are clickable to recategorize.
4. Duplicate detection on (date, amount, counterparty) — counted in a header chip, excluded by default.
5. Import commits into the existing statements store (`useShelfStorage` slice, `statements.byMonth`) for the detected month; keep the imported row ids so a one-click **Undo** can revert the whole batch.
6. Respect `prefers-reduced-motion` for all animations (caret blink, shimmer, puck drop-in).

Match the README's measurements, colors, and copy exactly — it is the source of truth. Open the HTML canvas in a browser if you need to see the design live.
