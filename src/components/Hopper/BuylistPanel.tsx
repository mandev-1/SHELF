import { useState } from "react";
import type { BuylistItem } from "../../types/grid";

interface Props {
  items: BuylistItem[];
  onAdd: (input: { title: string }) => void;
  onDiscard: (id: string) => void;
  onBuyBottom: () => void;
  onBump: (id: string) => void;
  onSkip: (id: string) => void;
  onToast?: (msg: string) => void;
}

function IcoPlus() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>;
}
function IcoX() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>;
}
function IcoArrowDown() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>;
}
function IcoCheck() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>;
}
function IcoTarget() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>;
}
function IcoFunnel() {
  return <svg viewBox="0 0 26 14" fill="none"><path d="M1 2 L13 12 L25 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>;
}

export function BuylistPanel({ items, onAdd, onDiscard, onBuyBottom, onBump, onSkip, onToast }: Props) {
  const [name, setName] = useState("");

  const toss = () => {
    const v = name.trim();
    if (!v) return;
    onAdd({ title: v });
    setName("");
  };

  const tray = items.length > 0 ? items[items.length - 1] : null;
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
          <input
            className="fld"
            placeholder="What do you want to buy?"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") toss(); }}
          />
          <button type="button" className="mouth-btn" onClick={toss} disabled={!name.trim()}>
            <IcoPlus /> Toss in
          </button>
        </div>

        {items.length === 0 ? (
          <div className="hopper-empty">
            <div className="big">The hopper's empty.</div>
            Toss something in and it'll drop to the bottom.
          </div>
        ) : (
          <>
            {waiting.length > 0 && (
              <div className="queue">
                {waiting.map((it, i) => (
                  <div className="puck" key={it.id}>
                    <span className="puck-pos">{items.length - i}</span>
                    <span className="puck-name">{it.title}</span>
                    <span className="puck-acts">
                      <button type="button" title="Bump to next" onClick={() => onBump(it.id)}><IcoArrowDown /></button>
                      <button type="button" title="Discard" onClick={() => onDiscard(it.id)}><IcoX /></button>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {waiting.length > 0 && <div className="funnel"><IcoFunnel /></div>}

            {tray && (
              <div className="tray">
                <div className="tray-label"><IcoTarget /> Next to buy</div>
                <div className="tray-row">
                  <span className="tray-name">{tray.title}</span>
                  <span className="tray-acts">
                    <button type="button" className="btn-ghost" onClick={() => onSkip(tray.id)}>Not yet</button>
                    <button
                      type="button"
                      className="btn-buy"
                      onClick={() => { onBuyBottom(); onToast?.("Bought it. 🎉"); }}
                    >
                      <IcoCheck /> Bought
                    </button>
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
