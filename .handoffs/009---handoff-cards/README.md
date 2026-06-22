# Trip cards — handoff ("On the road" + "Reconcile")

The two stacked cards in the open-trip view, **1:1 with the live app**. Open
`trip-cards-demo.html` — that is the target.

> Note: the demo's *screenshot preview* may flatten the Kraków photo on the
> Reconcile card into a plain blue wash — that's a preview-renderer quirk. Open
> the file in a real browser and the cityscape shows through the scrim (the
> image loads fine; the CSS is lifted verbatim from the shipping app).

## Files
- `trip-cards.css` — all styles, self-contained (tokens inlined in `:root`).
- `TripCards.jsx` — React structure for both cards (presentational).
- `trip-cards-demo.html` — the target, on the ruled-paper background.
- `assets/krakow.png` — the photo behind the Reconcile card.

## On the road / Who paid what  (white card)
- Header: eyebrow `ON THE ROAD`, title **Who paid what**, `+ Add expense` ghost
  button (white, thin border, blue text) on the right.
- Each expense row wraps into **three tiers**:
  1. a small **category dot** (left) + the **amount** (right, bold).
  2. the **label** + `"<category> · <date>"` meta.
  3. **split avatars** + `"split N"` (left) · **payer avatar** + `"paid"` (right).
- Rows tint to `--surface-2` on hover/tap (`.is-active` in the demo shows this).

## Reconcile / Settle up  (Kraków photo + white scrim)
- The `.rec` modifier layers a **near-white vertical scrim over `assets/krakow.png`**
  (`50% 72% / cover`) so text stays legible while the city shows through. This is
  the deliberate look — keep the scrim light.
- Balance rows: avatar · name · bar · net. Bar fill: green `#34c891` = owed,
  red `#ef6b6b` = owes, empty = square. (Length ∝ `|net|`; see `TripCards.jsx`.)
- When everything nets to zero, show the green dashed **“✓ This trip is squared up”**
  banner; otherwise render the hairline-separated `Name → Name … amount` rows.

## Colors / tokens (light theme)
| token | value | use |
|---|---|---|
| surface | `#ffffff` | card bg |
| surface-2 | `#edf3fc` | row hover, bar track |
| line | `rgba(0,84,200,.16)` | borders, hairlines |
| fg | `#071a35` | titles, amounts |
| fg-2 | `#173155` | tx names |
| dim | `#5e7698` | eyebrow, meta, labels |
| faint | `#8fa5c4` | zero balance |
| accent-deep | `#0046ad` | Add-expense text |
| gb-pos | `#34c891` | owed / green |
| gb-neg | `#ef6b6b` | owes / red |
| member | `#16b6c8` | the cyan “Me” avatar |

Member avatar = initial on the member's hue, with a faint top highlight + inner
ring (`.tc-av`). Hues in the app: `#0070f2` `#e07a93` `#34c891` `#e0905a`
`#a384df` (plus the cyan `#16b6c8` used here).

## Implement
1. Load `trip-cards.css` (or merge its rules) and ship `assets/krakow.png`. If
   your app already defines the tokens, delete the `:root` block to inherit them.
2. Render `OnTheRoadCard` then `ReconcileCard` (see bottom of `TripCards.jsx`), or
   copy the markup from `trip-cards-demo.html` for a non-React app.
3. The photo background is **only** on the Reconcile card (`.tc-card.rec`).

No build step, no dependencies — plain CSS + markup + one image.
