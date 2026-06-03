---
name: ssot
description: |
  Read and maintain the project's Single Source of Truth — `.claude/.SSoT.md` —
  a tribal-knowledge sitrep covering session history, technical choices that
  worked, design choices that worked, choices that did not work and WHY, plus
  the canonical stylesheet/design tokens. Invoke when the user says `/ssot`,
  asks for "the SSOT", "tribal knowledge", "sitrep", or after any feature
  change that alters behavior, design tokens, persisted state, or architecture.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

# /ssot — Single Source of Truth maintainer

The canonical file is **`.claude/.SSoT.md`** at the project root (the
filesystem may store it as `.ssot.md`; macOS is case-insensitive — treat
both spellings as the same file). It is the authoritative design +
engineering contract for this project. When code and SSoT disagree, the
SSoT wins until the user explicitly amends it.

## On invocation

1. **Always read `.claude/.SSoT.md` first.** If it does not exist, create
   it from the template in §"File template" below and tell the user it
   was seeded empty.
2. Determine intent:
   - **Read / recall** ("what does the SSoT say about X", "show sitrep") →
     answer from the file; do not modify.
   - **Update after a feature change** (default when invoked after edits
     in this session, or when user says "update SSoT", "log this",
     "record this decision") → patch the relevant sections in place using
     `Edit`. Never rewrite the whole file when a targeted edit will do.
   - **Add a session entry** → append to §"Session log" with today's date
     (resolve relative dates to absolute YYYY-MM-DD).
3. After any write, summarize the diff in one or two sentences. Do not
   restate the whole file.

## What to record (and what NOT to)

Record:
- **What worked** — technical choice + the concrete reason it worked here
  (perf number, bug avoided, user feedback, simpler diff).
- **What did NOT work and WHY** — the failed approach, the symptom, the
  root cause. This is the highest-value content; never skip the WHY.
- **Design decisions** — token changes, layout shifts, component anatomy
  changes, theme rules. Update §2 (tokens) and the relevant §5 surface
  anatomy section.
- **Architectural seams** — new `useShelfStorage` keys, new persisted
  state, new message-passing contracts, new manifest permissions.
- **Stylesheet** — keep the design tokens block in §2 in sync with
  `src/index.css` `:root` and theme overrides. If they drift, the SSoT is
  the contract; flag the drift to the user before changing the CSS.

Do not record:
- Diff-level code changes that `git log` already captures.
- Transient debugging state.
- File reorganizations that don't change behavior (note them in the
  session log as one line, no anatomy edits).

## Current file structure (ShELF)

1. Surfaces (high-level)
2. Design tokens (dark / day / sap / glass / density — the stylesheet)
3. Typography
4. Layout primitives
5. Per-surface anatomy (5.1 Shelf, 5.2 Strategie, 5.3 Visual Flow,
   5.4 Hopper, 5.5 Pillar, 5.6 LLM Console + Prompt Library)
6. Statement editor (zoomed)
7. Data model (persisted keys, prototype seeds, currency, projection,
   date helpers)
8. Themes
9. Iconography
10. Open questions / known gaps
11. **Session log** — chronological tribal knowledge (add if missing)
12. **Decisions journal** — what worked / what didn't + WHY (add if
    missing)

If §11 or §12 are missing, create them on first update.

## Session log entry format

Append to §11 using this shape:

```markdown
### YYYY-MM-DD — <short title>
- **Context:** one line, why this session happened.
- **Changes:** bullets of what shipped (file paths OK, but prefer surface
  names from §5).
- **Outcome:** worked / partial / reverted. One line.
- **Follow-ups:** open threads, or "none".
```

## Decisions journal entry format

Append to §12 under either **Worked** or **Did NOT work**:

```markdown
- **<decision in plain language>** — <one-line outcome>.
  **Why:** <root cause / mechanism, not just the symptom>.
  **Applies to:** <surface, file, or scope>.
  **Date:** YYYY-MM-DD.
```

A "did not work" entry without a WHY is invalid — push back and ask the
user for the root cause before writing.

## File template (only if `.claude/.SSoT.md` is absent)

```markdown
# <Project> — SSoT

> Canonical design + engineering contract. When code disagrees with this
> file, this file wins until amended.

## 1. Surfaces
_TBD_

## 2. Design tokens
_TBD — mirror `:root` from the main stylesheet._

## 3. Typography
_TBD_

## 4. Layout primitives
_TBD_

## 5. Per-surface anatomy
_TBD_

## 6. Data model
_TBD_

## 7. Themes
_TBD_

## 8. Iconography
_TBD_

## 9. Open questions / known gaps
- none yet

## 10. Session log
- none yet

## 11. Decisions journal
### Worked
- none yet
### Did NOT work
- none yet
```

## Maintenance rules

- Edit in place with `Edit`; never `Write` the whole file unless seeding it.
- Keep the file under ~1500 lines; if a surface grows large, split its
  anatomy into a sibling `.claude/.SSoT.<surface>.md` and link from §5.
- Always resolve relative dates ("yesterday", "last week") to absolute
  YYYY-MM-DD before writing.
- If the user asks to record something whose WHY isn't clear, ask one
  short clarifying question before writing.
- Never silently delete entries from §11 or §12 — strike-through with a
  reason if a decision is later reversed.
