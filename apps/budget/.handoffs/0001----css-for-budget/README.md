# Handoff: Budget App Elevation (ambient background + delight pass)

Target codebase: `SHELF` repo → `apps/budget` (React/Next app; main stylesheet `apps/budget/components/budget.css`).

## Overview

This bundle documents an "elevation" pass on the Budget app, aimed at making it fun, easy, and exec-friendly. It adds:

1. **Living ambient background** — slow-drifting aurora glows that tint to the open trip's accent color, plus a soft vignette
2. **View-in transitions** for People / Trips / Trip-detail
3. **Count-up stat tiles** on trip detail
4. **"Where it went"** category-breakdown card
5. **Quick-fill chips** in the Add-expense modal
6. **Copy summary** button on the Settle-up card
7. **Confetti** when a settle-up payment squares a trip
8. Two bug fixes found while porting (hero gradient cascade, overlay stacking)
9. Optional demo seed: "Berlin gig weekend" band trip

## About the Design Files

`Budget.dc.html` (+ `support.js` runtime) is a **design reference created in HTML** — a working prototype showing intended look and behavior, not production code. Recreate these changes inside the real `apps/budget` React components and `budget.css`, following the codebase's existing patterns (CSS classes in `budget.css`, not inline styles). Class names below are suggestions consistent with the existing `gb-*` / `tc-*` conventions.

## Fidelity

**High-fidelity.** Colors, sizes, easings, and copy below are final — recreate exactly. Everything composes with the app's existing tokens (`--accent`, `--fg`, `--dim`, `--line`, `--surface`, `--hue-*`).

---

## 1. Ambient background system

The app's `.bg-diffuse` layer stays. Add four fixed, non-interactive layers behind the content (above `.bg-diffuse`, below the notebook paper content). All are `position: fixed; z-index: 0; pointer-events: none; aria-hidden`.

```css
/* budget.css — ambient background */
@keyframes gbDriftA {
  0%, 100% { transform: translate3d(-3%, -2%, 0) scale(1); }
  50%      { transform: translate3d(4%, 3%, 0) scale(1.1); }
}
@keyframes gbDriftB {
  0%, 100% { transform: translate3d(3%, 2%, 0) scale(1.08); }
  50%      { transform: translate3d(-4%, -3%, 0) scale(1); }
}

.gb-ambient { position: fixed; inset: -20%; z-index: 0; pointer-events: none; }

/* warm sun, top-right */
.gb-ambient--sun {
  background: radial-gradient(38% 32% at 82% 4%, rgba(255, 203, 130, 0.48), transparent 70%);
  animation: gbDriftA 26s ease-in-out infinite;
}
/* accent-tinted glow, mid-left */
.gb-ambient--accent {
  background: radial-gradient(36% 32% at 6% 36%,
    color-mix(in srgb, var(--gb-ambient, var(--accent)) 26%, transparent), transparent 72%);
  animation: gbDriftB 34s ease-in-out infinite;
}
/* accent echo, bottom */
.gb-ambient--echo {
  background: radial-gradient(32% 36% at 72% 90%,
    color-mix(in srgb, var(--gb-ambient, var(--accent)) 17%, transparent), transparent 75%);
  animation: gbDriftA 42s ease-in-out infinite reverse;
}
/* vignette — sits at inset: 0, no animation */
.gb-ambient--vignette {
  inset: 0;
  background: radial-gradient(120% 90% at 50% 40%, transparent 62%, rgba(24, 38, 66, 0.08) 100%);
}
```

**Trip-aware tint.** `--gb-ambient` is set on the app root and follows navigation: when a trip is open it takes the trip's accent (`trip.color`, e.g. `var(--hue-purple)`); otherwise it falls back to `var(--accent)`.

```tsx
// on the app root element, whenever view/openTrip changes
rootEl.style.setProperty('--gb-ambient', openTrip?.color ?? 'var(--accent)');
```

**Toggle.** Expose an "Ambient glow" boolean setting; when off, render none of the four layers (the flat notebook background remains). Consider honoring `prefers-reduced-motion` by pausing the drift animations.

## 2. View-in transition

Applied to the root container of each view (People grid, Trips gallery, Trip detail) so switching views glides instead of snapping. Elements remount on navigation, which restarts the animation.

```css
@keyframes gbViewIn {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: none; }
}
.gb-view-in { animation: gbViewIn 0.32s cubic-bezier(0.2, 0.7, 0.3, 1) both; }
```

## 3. Count-up stat tiles (trip detail)

The three tile numbers (TRIP SPEND / PER PERSON / TO SETTLE) animate to new values whenever expenses change. 650 ms, cubic ease-out, rAF-driven; renders via the existing currency formatter so rounding/format is unchanged. No animation on first mount — only on value change.

```tsx
function CountUp({ value, fmt }: { value: number; fmt: (v: number) => string }) {
  const [v, setV] = useState(value);
  const shown = useRef(value);
  shown.current = v;
  useEffect(() => {
    const from = shown.current, to = value;
    if (from === to) return;
    const t0 = performance.now(); let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 650);
      const e = 1 - Math.pow(1 - k, 3);           // cubic ease-out
      setV(from + (to - from) * e);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{fmt(v)}</>;
}
// usage: <CountUp value={stats.total} fmt={(v) => formatAmount(v, mainCurrency)} />
```

## 4. "Where it went" category card (trip detail)

A slim card between the stat-tile row and the ledger board. Hidden when the trip has no spend (settlements excluded). Amounts are converted to the trip's main currency.

Layout:
- Card padding `14px 18px 15px`, `margin-bottom: 16px`, column flex, `gap: 10px`
- Header row: existing `card-eyebrow` style, text `WHERE IT WENT`; right-aligned lead line `11.5px` `var(--dim)`, e.g. `Fun leads · 62%` (top category + rounded share)
- Stacked bar: `height: 12px; border-radius: 999px; overflow: hidden; display: flex; gap: 2px`; one segment per category, `width: <pct>%`, `min-width: 4px`, background = category hue, `title="<Category> · <amount>"`, `transition: width 0.5s cubic-bezier(0.2, 0.7, 0.3, 1)`
- Legend (top 5, descending): wrapping flex row, `gap: 6px 16px`; each item `12.5px` `var(--dim)` with a `9px × 9px` radius-`3px` swatch, category name, then amount in `var(--fg)` weight 650 tabular-nums

Category hues (existing app palette):

```css
Groceries #34c891   Dining #e0905a   Transport #0070f2
Housing   #a384df   Fun    #e07a93   Health    #16b6c8
Fees      #8fa5c4   Other  #5e7698   Settlement #2fb46b
```

## 5. Quick-fill chips (Add-expense modal)

A wrapping chip row directly under the "What was it?" title field. Tapping a chip sets **title + category** in one tap (amount stays focused on the user).

Presets (label → title / category):

```
🍽️ Dinner → Dinner / Dining        🍻 Drinks → Drinks / Dining
🚕 Taxi → Taxi / Transport          🛒 Groceries → Groceries / Groceries
⛽ Fuel → Fuel / Transport          🎟️ Tickets → Tickets / Fun
🎸 Gear rental → Gear rental / Fun  🛎️ Hotel → Hotel / Housing
```

```css
.gb-quickfills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.gb-quickfill {
  border: 1px solid var(--line); background: var(--surface); color: var(--fg);
  border-radius: 999px; padding: 4px 11px; font-size: 12.5px; cursor: pointer;
}
.gb-quickfill:hover { border-color: var(--accent); color: var(--accent); }
```

## 6. "Copy summary" (Settle-up card header)

Small secondary button, right-aligned in the Settle-up card head (`margin-left: auto`; border `1px solid var(--line)`, `var(--surface)` bg, radius 8px, padding `5px 10px`, `12px`/600, hover → accent border + text). Copies plain text for the group chat and shows toast `Summary copied — paste it in the group chat`:

```
🏖️ Croatia road trip — Split → Dubrovnik
Spend €1,027 · €257 per person · 4 travelling
To settle:
• Bára → Adam: €86
• Carl → Adam: €42
```

(When there are no pending transfers the last block is `All square ✓`.)

## 7. Confetti on square-up

When logging a settle-up payment transitions the trip from unsettled to **squared** (sum of pending transfers < 0.5 in main currency), fire a one-shot confetti burst + toast `All square 🎉`. Compute the would-be stats on the next expense list *before* committing state, so the trigger is exact.

```ts
function confettiBurst() {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:400;overflow:hidden';
  document.body.appendChild(host);
  const hues = ['#0070f2', '#36d399', '#ffb054', '#e07a93', '#a384df', '#ffd166'];
  for (let i = 0; i < 90; i++) {
    const p = document.createElement('div');
    const size = 6 + Math.random() * 8;
    p.style.cssText = `position:absolute;top:-4%;left:${Math.random() * 100}%;width:${size}px;height:${size * 0.6}px;background:${hues[i % hues.length]};border-radius:2px;opacity:0.95`;
    host.appendChild(p);
    p.animate(
      [{ transform: 'translate3d(0,-20px,0) rotate(0deg)' },
       { transform: `translate3d(${(Math.random() - 0.5) * 30}vw,105vh,0) rotate(${360 + Math.random() * 720}deg)` }],
      { duration: 1400 + Math.random() * 1400, delay: Math.random() * 500,
        easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'forwards' }
    );
  }
  setTimeout(() => host.remove(), 3600);
}
```

## 8. Bug fixes worth porting

**Trip-hero gradient washed out (SAP theme).** The glass `.card` background rule overrides the hero's accent gradient. Fix: declare the gradient explicitly on the hero (wins by specificity/order):

```css
.gb-trip-hero {
  background: linear-gradient(135deg,
    color-mix(in srgb, var(--trip-hue, var(--accent)) 88%, #000) 0%,
    var(--trip-hue, var(--accent)) 100%);
}
```

**Overlay stacking under `.notebook-page`.** `notebook-background.css` applies `position: relative; z-index: 1` to direct children of `.notebook-page`, which cancels `position: fixed` on modals/context menus rendered as direct children. Fix: render overlays as **siblings** of the paper wrapper (or portal them to `document.body`), never as direct children of `.notebook-page`.

## 9. Demo seed (optional)

"Berlin gig weekend" 🎷 — Kreuzberg, Berlin · 2–4 Jul 2026 · all four members · EUR (CZK secondary), accent `var(--hue-purple)`:

```
Backline rental — vintage keys   €260  Fun        paid by Adam
Rehearsal room — Funkhaus, 4h    €180  Fun        paid by Bára
Band dinner — Prater Garten      €112  Dining     paid by Dita
Cabs to soundcheck                €34  Transport  paid by Carl
```

## Interactions & behavior summary

- Ambient layers: purely decorative, never intercept pointer events, recolor instantly on navigation (no transition needed — glows are subtle)
- View transition: 0.32s, runs on every view mount, including back-navigation
- Count-up: 650 ms per change; concurrent changes restart from the currently displayed value
- Category bar: segment widths animate 0.5 s on data change
- Confetti: only on the unsettled → squared transition caused by logging a settlement; never on expense edits
- All new buttons/chips: hover state = accent border + accent text, no size change

## Design tokens introduced

- `--gb-ambient` — ambient tint; open trip's accent or `var(--accent)`
- Sun glow `rgba(255, 203, 130, 0.48)` · vignette `rgba(24, 38, 66, 0.08)`
- Confetti palette: `#0070f2 #36d399 #ffb054 #e07a93 #a384df #ffd166`
- Easings: `cubic-bezier(0.2, 0.7, 0.3, 1)` (UI), `cubic-bezier(.2,.6,.3,1)` (confetti), cubic ease-out (count-up)
- Durations: view-in 0.32 s · count-up 0.65 s · bar 0.5 s · drift 26/34/42 s

## Files

- `Budget.dc.html` — the full working prototype (open in a browser; state persists to localStorage)
- `support.js` — prototype runtime, required next to the HTML; not part of the handoff spec
