# Handoff: ShELF — Hopper Redesign (gravity chute)

## Scope
This handoff covers **ONLY the Hopper view** (the buy-list). Target file:
**`src/components/BuylistPanel.tsx`** in the SHELF repo (React 19 + HeroUI + Tailwind v4).
Everything else in the app is out of scope here. Apply this as a redesign of the existing
Buylist/Hopper component — reuse the app's existing token system (`[data-theme]` vars in
`src/index.css`) and persistence (`useShelfStorage`). Do **not** copy the prototype's
Babel/HTML verbatim; re-implement in the real component using its patterns.

## Concept
The Hopper is a **gravity chute**: you *toss* items in at the **top**, they queue downward, and
whatever **sinks to the bottom is "next to buy."** The model is **self-consistent** — the oldest
item is automatically the next-to-buy; there is **no manual `next` flag**.

```
┌──────────────────────────────┐
│  [ input ............ ] Toss in │  ← intake "mouth" (dashed bottom lip)
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
│  ③  espresso grinder      ↓ ✕ │  ← queue pucks (numbered = place in line)
│  ②  nabíječka na 2s baterky↓ ✕ │
│             ▽ (funnel)         │
│ ╔════════════════════════════╗│
│ ║ ◎ NEXT TO BUY              ║│  ← dispense tray (accent-tinted, elevated)
│ ║ mýčka + instalace  Not yet  Bought ║│
│ ╚════════════════════════════╝│
└──────────────────────────────┘
```

## Data model & behavior
State: an **ordered array** `items: { id: string; name: string }[]`. Index `0` = top of chute
(newest); the **last element = bottom of chute = next to buy.** Persist via `useShelfStorage`.

| Action | Trigger | Effect |
|---|---|---|
| **Toss in** | type a name, click "Toss in" or press Enter | `unshift` new item to front (index 0). Clear input. Ignore empty/whitespace. |
| **Bump to next** (↓ on a queue puck) | hover puck → click ↓ | move that item to the **end** of the array (it becomes next-to-buy) |
| **Discard** (✕ on a queue puck) | hover puck → click ✕ | remove it |
| **Not yet** (on tray) | click | move the tray item (last) to the **front** (index 0) — sends it back up the chute |
| **Bought** (on tray) | click | remove the tray item + fire a toast `"Bought it. 🎉"` |

Derived each render:
```
const tray    = items[items.length - 1];   // next to buy (bottom)
const waiting = items.slice(0, -1);         // everything above, newest first
```
Queue puck number = **place in line to be bought** = `items.length - i` (so the puck just above
the tray shows `2`, the tray itself is effectively `1`). Render `waiting` top→down.

**Empty state**: when `items.length === 0`, hide the queue/funnel/tray and show the
`.hopper-empty` message inside the chute (the intake mouth stays).

**Entrance animation gotcha (important):** the puck drop-in animates **transform only**, NOT
opacity. Do not animate `opacity` from 0 — if the browser throttles the animation (background
tab, etc.) the element can stick at the first frame and stay invisible. Keep pucks at full
opacity at rest; animate only the slide/scale.

## Reference JSX (prototype — re-express in BuylistPanel.tsx)
Icons (`I.plus`, `I.arrowDown`, `I.x`, `I.funnel`, `I.target`, `I.check`) are simple inline
stroke SVGs — swap for the repo's icon set.

```jsx
function Hopper({ items, setItems, onToast }) {
  const [name, setName] = useState("");

  const toss = () => {
    if (!name.trim()) return;
    setItems(p => [{ id: "h" + Date.now(), name: name.trim() }, ...p]);
    setName("");
  };
  const discard = id => setItems(p => p.filter(x => x.id !== id));
  const bump    = id => setItems(p => { const it = p.find(x => x.id === id); return [...p.filter(x => x.id !== id), it]; });
  const skip    = id => setItems(p => { const it = p.find(x => x.id === id); return [it, ...p.filter(x => x.id !== id)]; });
  const bought  = id => { discard(id); onToast?.("Bought it. 🎉"); };

  const tray = items[items.length - 1];
  const waiting = items.slice(0, -1);

  return (
    <div className="hopper">
      <div className="hopper-head">
        <div>
          <h2 className="hopper-title">Hopper</h2>
          <p className="hopper-sub">Toss things in the top. The one that sinks to the bottom is next to buy.</p>
        </div>
        <div className="hopper-count"><b>{items.length}</b><span>in line</span></div>
      </div>

      <div className="chute">
        <div className="mouth">
          <input className="fld" placeholder="What do you want to buy?" value={name}
            onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && toss()} />
          <button className="mouth-btn" onClick={toss} disabled={!name.trim()}><I.plus/> Toss in</button>
        </div>

        {items.length === 0 ? (
          <div className="hopper-empty"><div className="big">The hopper's empty.</div>Toss something in and it'll drop to the bottom.</div>
        ) : (
          <>
            {waiting.length > 0 && (
              <div className="queue">
                {waiting.map((it, i) => (
                  <div className="puck" key={it.id}>
                    <span className="puck-pos">{items.length - i}</span>
                    <span className="puck-name">{it.name}</span>
                    <span className="puck-acts">
                      <button className="icon-btn" title="Bump to next" onClick={() => bump(it.id)}><I.arrowDown/></button>
                      <button className="icon-btn" title="Discard" onClick={() => discard(it.id)}><I.x/></button>
                    </span>
                  </div>
                ))}
              </div>
            )}
            {waiting.length > 0 && <div className="funnel"><I.funnel/></div>}
            <div className="tray">
              <div className="tray-label"><I.target/> Next to buy</div>
              <div className="tray-row">
                <span className="tray-name">{tray.name}</span>
                <span className="tray-acts">
                  <button className="btn-ghost" onClick={() => skip(tray.id)}>Not yet</button>
                  <button className="btn-buy" onClick={() => bought(tray.id)}><I.check/> Bought</button>
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

## Styles
All exact CSS is in **`hopper.css`** in this folder — copy it wholesale, or translate to
Tailwind/your styling layer. It depends on these existing ShELF tokens (already defined per
theme in `src/index.css`):
`--fg --fg-2 --muted --dim --faint --surface --surface-2 --surface-3 --inset --line
--line-strong --line-faint --accent --accent-bright --accent-deep --accent-ink --r-card
--r-inner --sh-1 --sh-2 --sh-pop`. Also relies on the shared `.fld` input style and a `.toast`.

### Key visual decisions (so it matches exactly)
- **`.chute`** = a recessed metallic column. **Dark**: translucent graphite gradient +
  `backdrop-filter: blur(7px) saturate(135%)` + inset shadows (top groove, deep recess, etched
  rim, lit bottom lip) so the app's ambient background glows through it. **Light themes**: a
  simple soft inset groove (`rgba(0,0,0,.03)` + inset shadow, no backdrop-filter).
- **`.mouth`** = intake row: the shared `.fld` input + a tinted accent "Toss in" button, with a
  **dashed bottom border** suggesting the drop slot.
- **`.puck`** = waiting item: solid `--surface-2` card, `--sh-1`, a square **position badge**
  (`.puck-pos`), the name, and hover-revealed ↓/✕ icon buttons. Drop-in animates transform only.
- **`.funnel`** = a small 3-line tapering glyph centered between the queue and the tray.
- **`.tray`** = the hero slot: `color-mix(accent 13%, surface)` fill, accent border, an
  accent-colored glow shadow. Holds an uppercase **"NEXT TO BUY"** label (target icon), the item
  name at 18px/600, a ghost **"Not yet"** and a solid accent **"Bought"** button. On dark the
  Bought button text is `#06281d`; on light themes it's `#fff` (and the label uses `--accent-deep`).

## Constraints
- Visual + interaction redesign only — keep existing data flow, storage, and any
  fields the real buylist persists (if it stores URLs/notes, keep persisting them even though the
  redesigned intake only exposes a name field — or add them back as a secondary expand if needed;
  confirm with product before dropping data).
- Works across all three themes (Dark / Day / SAP) via the existing token system.

## Files in this folder
- `README.md` — this doc
- `hopper.css` — exact styles for the chute, mouth, pucks, funnel, tray, toast
- `Hopper.jsx` — the prototype component (reference)
