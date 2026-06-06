# Handoff: ShELF — Grounded Polish Pass

## Overview
This is a **visual-polish / "grounding" redesign** of the existing ShELF new-tab bookmark
extension. The goal was to take the current neon-emerald-on-glass UI and make it feel more
**grounded, calm, and intentional**: solid layered surfaces, real depth (shadows + inset
"recessed" wells) instead of glow, a refined accent, sharper typographic hierarchy, and a
clear focal hierarchy where the **Prompt Library is the hero** and the bookmark grid recedes.

It also adds three usability upgrades: **drag-to-reorder** (folders + Top-6 pins), **monogram
favicon fallbacks**, and a **hover-spotlight** on bookmark lists.

This is a **delta on the existing app**, not a greenfield build. Apply the changes below to the
real components rather than recreating the app from scratch.

## About the Design Files
The files in this bundle are **design references created in HTML/React-via-Babel** — a working
prototype showing the intended look and behavior. They are **not production code to copy
directly**. ShELF is a real React 19 + HeroUI + Tailwind v4 extension; the task is to
**re-implement these design decisions in the existing codebase** using its established patterns
(HeroUI `Surface`/`Input`, Tailwind utility classes, the `[data-theme]` token system in
`src/index.css`, the `useShelfStorage` hook for state).

The prototype hardcodes content (your real bookmarks/pins/prompts) purely so the design reads
realistically — ignore the sample data and wire to the real stores.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, depth, and interaction states are all
specified below with exact values. Recreate pixel-faithfully using the codebase's existing
libraries. Where the prototype and the real app differ structurally, preserve the real app's
data flow and only adopt the *visual* + *interaction* decisions.

---

## Design Language (the core of this pass)

Three depth tiers establish hierarchy:

1. **Raised hero** — the Prompt Library card: solid surface + drop shadow (`--sh-3`) + a 1px
   accent gradient hairline along its top edge. It floats above everything.
2. **Flush chrome** — Pillar, top bar, Top-6 pins, todos: solid surfaces with subtle 1px
   borders and small drop shadows (`--sh-1`/`--sh-2`).
3. **Recessed wells** — the folder cards: **inset** box-shadows so they read as carved *into*
   the desk surface, sitting below the page plane. On **dark** they are **frosted brushed-metal**
   pods (translucent graphite gradient + `backdrop-filter` blur + top sheen + lit bottom lip), so
   the ambient background glows *through* them. On **light** themes they are soft grooves.

Behind everything (dark especially) sits a **heavily diffused ambient background** — a slowly
drifting aurora of soft accent/blue/violet glows that blooms through the frosted pods and fills
the gaps. See "Ambient diffused background" below for exact values and the critical
implementation note.

The bookmark grid is deliberately **muted and bare-bones** so the eye orients fast: flat
recessed folders, hairline structure, small muted hue dot per folder for identity, quiet
titles, no competing fills or bright cards. Color and emphasis only appear **on interaction**
(hover-spotlight).

---

## Screens / Views

### 1. Shell layout
- **Layout**: `display:flex; height:100vh`. Left **Pillar** sidebar fixed `312px`
  (`flex-shrink:0`), right **Main** column `flex:1`.
- Page background (dark): a flat `linear-gradient(160deg, #0d0d10, #0a0a0c)` base, with the
  **ambient diffused aurora** layered above it (see "Ambient diffused background" under
  Interactions), `background-attachment: fixed`.

### 2. Pillar (sidebar) — maps to `src/components/Pillar.tsx`
- Background `--panel` (`#141417` dark), right border `1px var(--line)`.
- **Header**: eyebrow label "PILLAR" (10.5px, 600, `letter-spacing:.22em`, uppercase,
  `--accent-bright` @85% opacity) above the shelf name (22px, 600, `-0.02em`).
- **Top 6 zone**: section head row ("Top 6" 13px/600 `--fg-2`, right hint "Drop bookmarks here"
  11px `--faint`). Pins stacked `gap:9px`.
  - **Pin**: `display:flex; align-items:center; gap:12px; padding:11px 12px`, bg `--surface`,
    `1px var(--line)`, radius `--r-inner`, `box-shadow:--sh-1`. Hover: bg `--surface-2`, border
    `--line-strong`, `translateY(-1px)`. A drag **grip** (3 stacked 11×1.5px bars, `--faint`)
    appears on hover at the left (`opacity 0→1`). Icon tile 38×38 radius 10. Title 14px/600,
    URL 11.5px `--dim` (both ellipsis-truncated, stacked in a flex column).
  - **Pins are drag-to-reorder** (see Interactions).
- **Todo zone**: two stacked inputs (task + optional subtitle) using `.fld` style, then the
  list. Todo item: `flex; gap:10px; padding:11px 12px`, bg `--surface`, `1px var(--line)`,
  radius `--r-inner`. Focused todos get `--todo--focus` tint
  (`color-mix(accent 9%, surface)` + accent border). Checkbox 17×17 radius 5; checked = filled
  `--accent` with a `#06281d` checkmark (dark theme) / white check (light themes). Tags:
  `tag--violet` (`#c9b6fc` on `rgba(139,92,246,.16)`), `tag--blue` (`#b6cdfc` on
  `rgba(91,137,222,.16)`). Done items: `opacity:.5` + line-through.

### 3. Top bar — `BookmarkGrid.tsx` header region / app shell
- `padding:20px 32px`, bottom `1px var(--line)`, `backdrop-filter:blur(8px)` over
  `color-mix(--bg 60%, transparent)`.
- Inner row `max-width:1500px; gap:22px`: **greeting** (28px/600, `-0.025em`; the word "smile"
  rendered in `--accent-bright`), **search** field (flex:1, max 540px), **nav** buttons.
- **Search**: pill (`border-radius:999px`), bg `--inset`, `1px var(--line)`, `padding:11px 18px`,
  search icon (`--dim`) + input + `⌘K` kbd chip. Focus-within: accent border +
  `0 0 0 4px accent@11%` ring.
- **Nav buttons**: 13.5px/600, `padding:9px 16px`, radius 11, bg `--surface`, `1px --line-strong`.
  Active (`--on`): `color-mix(accent 16%, surface)` bg, accent border, `--accent-ink` text.
  Three tabs: Shelf / Visual Flow / Hopper.

### 4. Prompt Library card (HERO) — `src/components/PromptLibraryCard.tsx`
- bg `--surface`, `1px var(--line)`, radius `--r-card`, **`box-shadow:--sh-3`** (deliberately
  more elevated than everything else), `padding:--pad`, `margin-bottom:30px`.
- **Top accent hairline**: `::before`, `height:1px`, `linear-gradient(90deg, transparent,
  accent@35%, transparent)`.
- Header: eyebrow "PROMPT LIBRARY" + title "Prompt library" (18px/600) on the left; on the
  right a "Visible rows" pill toggle, "{n} saved" count, and a "+ Prompt" accent button.
- Prompt grid: `grid-template-columns:1fr 1fr; gap:--gap`. Each prompt tile: bg `--inset`,
  `1px var(--line)`, radius `--r-inner`, `padding:15px 16px`, cursor pointer. Hover: accent@30%
  border, bg `--surface`, `translateY(-1px)`. Header row = name (14.5px/600) + "CLICK TO COPY"
  (10px/700 uppercase accent). Body = monospace (`DM Mono`) 12px, 2-line clamp, color `#88a596`
  (dark) / `#5a7065` (day) / `#46586f` (sap); `[SYSTEM]`-style tokens in `#7fb9d6`/`#2f6f93`.
- **Click a prompt → copy its full text to clipboard + toast.**

### 5. Folder grid — `src/components/BookmarkGrid.tsx`
- `display:grid; grid-template-columns:repeat(auto-fill, minmax(290px,1fr)); gap:--gap;
  align-items:start`.
- **Folder = recessed well** (signature):
  - **Dark theme = frosted brushed-metal pod**:
    ```
    background:
      linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,0) 42%),   /* top sheen */
      linear-gradient(180deg, rgba(24,25,30,.66), rgba(14,15,18,.74));            /* graphite, translucent */
    backdrop-filter: blur(7px) saturate(135%);   /* frosted — lets the aurora glow through */
    box-shadow:
      inset 0 1px 1px rgba(0,0,0,.5),            /* seated top edge */
      inset 0 9px 20px -12px rgba(0,0,0,.7),     /* deep recess */
      inset 0 0 0 1px rgba(255,255,255,.05),     /* etched rim */
      inset 0 -1px 0 rgba(255,255,255,.07);      /* lit bottom lip */
    ```
    Hover lightens the graphite a step and strengthens the rim/lip.
  - **Light themes (day/sap) = soft groove**: `background:rgba(0,0,0,.035)`,
    `box-shadow: inset 0 2px 4px rgba(0,0,0,.09), inset 0 -1px 0 rgba(255,255,255,.7),
    inset 0 0 0 1px rgba(0,0,0,.05)`. (Hover deepens slightly.)
  - `is-dragging` → `opacity:.4`. **Folders are drag-to-reorder.**
  - **Folders are drag-to-reorder.**
- **Folder head**: `flex; align-items:center; gap:9px; padding:13px --pad 9px; cursor:grab`.
  A small **6×6 hue dot** (`::before`, `--hue` @65% opacity) for folder identity, then the title
  (14px/600 `--fg-2`), then a muted count (11px `--faint`, tabular). A faint dot-grid drag grip
  appears on hover.
- **Bookmark row** (`.bm`): `flex; align-items:center; gap:10px; padding:6px 10px; radius:8px`
  (dense). Favicon 18×18 **no background tile** (floats), `opacity:.85` at rest. Title 13.5px
  `--fg-2`, ellipsis. **Hover** = `background: color-mix(accent 12%, transparent)`, title→`--fg`,
  favicon `opacity:1 scale(1.08)`.
- **Hover-spotlight**: `.folder-body:hover .bm { opacity:.45 }` and
  `.folder-body:hover .bm:hover { opacity:1 }` — hovering the list dims siblings so the focused
  row stands alone. Applies to `.bm-big` too.
- **Empty folder**: centered italic "Empty folder" 13px `--faint`.
- **Expanded bookmark** (`.bm-big`, optional image card): muted now — transparent bg, hairline
  border, 38×38 colored initials thumb, hover = faint accent tint.
- **Goal/progress card** (`.goal`): also muted to match — transparent, hairline border, no
  shadow, neutral text, desaturated progress bar (`color-mix(hue-blue 60%, muted)`), ghost CTA.

### 6. Hopper (buy-list) — `src/components/BuylistPanel.tsx`
- `max-width:880px; margin:0 auto`. Title 30px/600.
- **Toss-in card**: solid surface card, label "TOSS IN", a name input, then a row of
  URL + Note inputs + an accent "Toss in" button (disabled when name empty).
- **Stack list**: non-"next" items are **muted/lowkey** — `background:transparent`, hairline
  border, name in `--muted` 14px/500. The bottom **next-to-buy** item pops:
  `background:color-mix(accent 11%, surface)`, accent border, `box-shadow:--sh-2`, an accent
  "NEXT" badge, name in `--fg` 15px/600. Each item has Discard + accent "Bought" buttons.

### 7. Toast
- Fixed `top:84px; right:26px`. `color-mix(accent 16%, surface-3)` bg, accent border, radius 12,
  `--sh-pop`, check icon + message. Slides in `translateY(-8px)→0` over 0.22s. Auto-dismiss ~1.9s.

### 8. Search results (replaces grid when query non-empty)
- Result head "{n} results for "{q}"". Each result row: favicon + (title 14px/600 + url 12px
  `--dim`) + folder name on the right (`--faint`). Hover/selected = `--surface-2` + accent border.

---

## Interactions & Behavior

### Drag-to-reorder (folders + Top-6 pins)
- Implemented in the prototype via a `useSortable(items, setItems, keyOf)` hook (`dragsort.jsx`)
  using **HTML5 drag-and-drop + a FLIP animation**:
  - `dragstart`: mark dragged key, set a **transparent 1×1 gif** as the drag image (suppresses
    the native ghost), fade the source element to `opacity:.4`.
  - `dragenter` on another item: snapshot all child `getBoundingClientRect()`s, reorder the array
    in state, then in a `useLayoutEffect` apply the FLIP — set each moved child's transform to its
    *old* position with `transition:none`, then on next frame transition to `transform:''` over
    `0.3s cubic-bezier(.2,.9,.3,1)`. Displaced cards glide smoothly.
  - `dragend`: clear dragged key.
- **In the real codebase**, prefer the library already in use (the repo uses `gridstack` for the
  grid and likely a DnD pattern for Top-6). Reproduce the *feel*: suppressed native ghost, source
  fades, neighbors animate into place, persist new order via `useShelfStorage`. The custom hook is
  only a reference if no DnD primitive exists.

### Hover-spotlight (bookmark lists)
- Pure CSS (above). Add `transition: background-color .13s, opacity .15s` to rows.

### Ambient diffused background (the aurora)
- A full-viewport layer of large, soft, blurred radial glows that slowly drifts. Rich on dark;
  dialed to a calm whisper on light themes (`opacity:.5`, more blur).
- **Exact layer (dark):**
  ```
  .bg-diffuse{
    position:fixed; inset:-15%; z-index:0; pointer-events:none;
    background:
      radial-gradient(38% 44% at 34% 36%, color-mix(in srgb, var(--accent) 32%, transparent), transparent 70%),
      radial-gradient(44% 46% at 82% 60%, color-mix(in srgb, var(--hue-blue) 32%, transparent), transparent 72%),
      radial-gradient(50% 42% at 60% 6%, color-mix(in srgb, var(--hue-purple) 24%, transparent), transparent 72%),
      radial-gradient(46% 52% at 30% 98%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 72%);
    filter: blur(64px) saturate(140%);
    opacity: 0.55;   /* dark: deliberately restrained */
    animation: drift 34s ease-in-out infinite alternate;
  }
  @keyframes drift{0%{transform:translate3d(0,0,0) scale(1)}
    50%{transform:translate3d(-2%,1.5%,0) scale(1.06)}
    100%{transform:translate3d(1.5%,-1.5%,0) scale(1.02)}}
  ```
- **Per-theme treatment (intentional, keep distinct):**
  - **Dark** — subtle: the spread layout above at `opacity:.55`.
  - **Day** — calmest: `[data-theme="day"] .bg-diffuse{opacity:.5; filter:blur(85px) saturate(118%)}`.
  - **SAP** — splatter pooled into the **bottom-right corner** (not spread):
    ```
    [data-theme="sap"] .bg-diffuse{
      background:
        radial-gradient(52% 52% at 93% 96%,  color-mix(in srgb, var(--accent) 34%, transparent), transparent 70%),
        radial-gradient(42% 44% at 72% 102%, color-mix(in srgb, var(--hue-purple) 24%, transparent), transparent 72%),
        radial-gradient(40% 42% at 102% 72%, color-mix(in srgb, var(--hue-blue) 30%, transparent), transparent 72%);
      opacity:.7; filter:blur(80px) saturate(120%);
    }
    ```
- **CRITICAL implementation note (don't skip):** Use a **real element**, NOT a `body::before`
  pseudo — the pseudo failed to composite in testing. Render `<div class="bg-diffuse">` as a
  **sibling placed *before*** the main app container, both inside the root, and give the app
  container `position:relative; z-index:1` (here `.shell`) so it paints **above** the `z-index:0`
  glow. The aurora then shows through the transparent canvas/gaps, and because the dark folder pods
  use `backdrop-filter`, it **blooms through the frosted metal**. The pillar/top bar are opaque and
  sit on top. React: a fragment of `[<div className="bg-diffuse"/>, <div className="shell">…</div>]`.

### Theme switching — `src/index.css` `[data-theme]` + theme setter
- Three themes already exist (Dark default / `day` / `sap`). The prototype's tokens are tuned
  versions; reconcile with the real token blocks (values in Design Tokens below).
- **Critical bug fix to carry over**: when switching `data-theme` at runtime, surfaces whose
  `background-color` is driven by a CSS variable can **freeze mid-interpolation** if `transition`
  includes the `background` shorthand or `all`. Two safeguards used:
  1. Transition **`background-color`** explicitly (never the `background` shorthand, never `all`).
  2. During the swap, add a `.no-transition` class to `<html>` for one frame
     (`*{transition:none!important}`), flip the theme, then remove it after a double `rAF`.
  - If ShELF's existing theme switch already animates cleanly, keep it; if you see stuck colors on
    theme change, apply safeguard #2.

### Monogram favicon fallback
- On `<img onError>`, render a colored tile: hue = deterministic hash of the hostname
  (`h = (h*31 + charCode) >>> 0; h % 360`), `background: hsl(<hue> 42% 42%)`, and the first
  letter of the de-`www.`'d host centered. **Use an inline SVG with `viewBox="0 0 100 100"`,
  `font-size:58`, centered text** so the monogram scales to any tile size (pins 38px, rows 18px).

### Clipboard / toast
- Prompt tiles copy `prompt.full` via `navigator.clipboard.writeText`; show the toast.

---

## State Management
Map to existing `useShelfStorage` / component state. State needed:
- `folders` (ordered) + setter — order persisted on drag.
- `pins` (Top-6, ordered) + setter — order persisted on drag.
- `todos` (add / toggle-done / delete; `focus` flag + `tag`).
- `hopper` items (toss-in / discard / bought; one flagged `next`).
- `query` (search) → derived results index over folders + pins.
- `tab` (shelf / flow / hopper).
- Tweakables that became real product settings: **theme** (dark/day/sap), **accent**, **surface**
  (solid/glass), **density** (compact/regular/comfy), **corner radius**. In the prototype these
  are a Tweaks panel; in production these map to the existing settings/theme store. Density +
  radius are driven by CSS custom props (`--pad`, `--gap`, `--r-card`, `--r-inner`).

---

## Design Tokens (exact)

### Accent (refined emerald, default/dark)
```
--accent:        #16b981
--accent-bright: #34d399
--accent-deep:   #0c8f66
--accent-ink:    #d4f3e7
```
Per-theme accent: **day** `#d97706 / #f59e0b / #b45309 / #7c4a0c`,
**sap** `#0070f2 / #1b90ff / #0058c4 / #084298`. (Switching theme sets the matching accent.)

### Surfaces — Dark (default)
```
--bg:#0b0b0d  --bg-grad-a:#0d0d10  --bg-grad-b:#0a0a0c
--panel:#141417  --surface:#161619  --surface-2:#1b1b20  --surface-3:#212128  --inset:#0e0e11
--line:rgba(255,255,255,.065)  --line-strong:rgba(255,255,255,.11)  --line-faint:rgba(255,255,255,.04)
--fg:#f3f3f4  --fg-2:#c9c9cf  --muted:#91919b  --dim:#66666f  --faint:#4b4b53
```
### Surfaces — Day
```
--bg:#f4f3f1  grad #fafaf9→#e7e5e4  --panel:#fbfaf9  --surface:#fff  --surface-2:#f5f4f2
--surface-3:#ebe9e6  --inset:#f1efec
--line:rgba(28,25,23,.09)  --line-strong:rgba(28,25,23,.16)  --line-faint:rgba(28,25,23,.055)
--fg:#1c1917  --fg-2:#292524  --muted:#57534e  --dim:#78716c  --faint:#a8a29e
```
### Surfaces — SAP
```
--bg:#dee6f0  grad #e8eef5→#d4dce8  --panel:#eef3f9  --surface:#fff  --surface-2:#eef2f8
--surface-3:#e2e9f3  --inset:#eaf0f7
--line:rgba(0,112,242,.14)  --line-strong:rgba(0,112,242,.26)  --line-faint:rgba(10,30,60,.06)
--fg:#0a0a0a  --fg-2:#1a2433  --muted:#4a5568  --dim:#687891  --faint:#9aa7bd
```
### Folder hue palette (calm, not neon)
Dark: zinc `#8b8b95`, orange `#e08648`, green `#34c891`, blue `#6595ee`, purple `#a384df`,
rose `#e07a93`. (Day/SAP have slightly adjusted versions — see `styles.css`.)

### Depth (dark)
```
--sh-1: 0 1px 2px rgba(0,0,0,.45)
--sh-2: 0 2px 6px rgba(0,0,0,.35), 0 1px 2px rgba(0,0,0,.4)
--sh-3: 0 10px 30px -10px rgba(0,0,0,.65), 0 2px 6px rgba(0,0,0,.4)
--sh-pop:0 24px 60px -18px rgba(0,0,0,.8), 0 4px 12px rgba(0,0,0,.5)
```
Light themes use softer, color-tinted versions of the same scale (see `styles.css`).
**Recessed folder insets** are listed under Folder grid above.

### Geometry / density
```
--r-card:16px (user-tunable 6–22)   --r-inner: r-card − 5   --r-pill:999px
density: --pad / --gap → compact 15/11 · regular 20/16 · comfy 24/20
```
### Type
- Family: **DM Sans** (UI), **DM Mono** (prompt code). Weights 400–700.
- Scale used: greeting 28 · hopper title 30 · card title 18 · folder/pin title 14–14.5 ·
  body/rows 13.5 · labels 10.5–11 (uppercase, `.16–.22em` tracking) · mono 12.

---

## Assets
- **Favicons**: fetched live from `https://www.google.com/s2/favicons?domain=<host>&sz=64`.
  Fallback = generated monogram (no asset needed). In the extension, use the browser's own
  favicon source where available.
- **Icons**: inline SVG stroke icons (search, check, link, plus, chevron) — replace with the
  repo's existing icon set.
- No external image assets. No brand assets from third parties.

## Files (in this bundle)
- `ShELF Dashboard.html` — the full prototype entry (theme/accent/density tweak wiring, layout,
  search, tabs, toast).
- `styles.css` — **the design system**: every token, surface, depth, recessed-well, spotlight,
  and component style. This is the primary reference for exact values.
- `components.jsx` — Pillar, PromptCard, FolderCard, GoalCard, Hopper, Favicon (monogram).
- `dragsort.jsx` — `useSortable` FLIP drag-reorder hook + `hueFromString` monogram helper.
- `data.js` — sample content only (ignore; wire to real stores).
- `tweaks-panel.jsx` — prototype-only tweak UI (not for production; maps to real settings store).

## Target components (recap)
| Design area            | Real file |
|------------------------|-----------|
| Sidebar / Top-6 / Todo | `src/components/Pillar.tsx` |
| Grid / folders / search/ top bar | `src/components/BookmarkGrid.tsx` |
| Prompt Library         | `src/components/PromptLibraryCard.tsx` |
| Hopper / buy-list      | `src/components/BuylistPanel.tsx` |
| Theme tokens           | `src/index.css` (`[data-theme]` blocks) |
| Persistence            | `src/hooks/useShelfStorage.ts` |
