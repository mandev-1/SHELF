/* ShELF — Hopper (gravity chute) — REFERENCE component.
   Prototype JSX (React via Babel). Re-express inside the real BuylistPanel.tsx.
   'items' is an ordered array; index 0 = top (newest), last element = next-to-buy (bottom).
   Wire setItems to useShelfStorage; persistence + types are the integrator's job. */

const { useState } = React;

/* Only the icons this component uses — swap for the repo's icon set */
const I = {
  plus: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14"/></svg>,
  arrowDown: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 5v14M19 12l-7 7-7-7"/></svg>,
  x: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}><path d="M6 6l12 12M18 6 6 18"/></svg>,
  funnel: (p) => <svg viewBox="0 0 26 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M2 2h22M6 7h14M10 12h6"/></svg>,
  target: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>,
  check: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5"/></svg>,
};

/* ---- Hopper — gravity chute ---- */
function Hopper({ data, onToast }) {
  const [items, setItems] = useState(data.hopper.map((h) => ({ id: h.id, name: h.name })));
  const [name, setName] = useState("");

  const toss = () => {
    if (!name.trim()) return;
    setItems((p) => [{ id: "h" + Date.now(), name: name.trim() }, ...p]);
    setName("");
  };
  const discard = (id) => setItems((p) => p.filter((x) => x.id !== id));
  const bump = (id) => setItems((p) => { const it = p.find((x) => x.id === id); return [...p.filter((x) => x.id !== id), it]; });
  const skip = (id) => setItems((p) => { const it = p.find((x) => x.id === id); return [it, ...p.filter((x) => x.id !== id)]; });
  const bought = (id) => { discard(id); onToast && onToast("Bought it. 🎉"); };

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
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && toss()} />
          <button className="mouth-btn" onClick={toss} disabled={!name.trim()}><I.plus /> Toss in</button>
        </div>

        {items.length === 0 ? (
          <div className="hopper-empty"><div className="big">The hopper's empty.</div>Toss something in and it'll drop to the bottom.</div>
        ) : (
          <React.Fragment>
            {waiting.length > 0 && (
              <div className="queue">
                {waiting.map((it, i) => (
                  <div className="puck" key={it.id}>
                    <span className="puck-pos">{items.length - i}</span>
                    <span className="puck-name">{it.name}</span>
                    <span className="puck-acts">
                      <button className="icon-btn" title="Bump to next" onClick={() => bump(it.id)}><I.arrowDown /></button>
                      <button className="icon-btn" title="Discard" onClick={() => discard(it.id)}><I.x /></button>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {waiting.length > 0 && <div className="funnel"><I.funnel /></div>}

            <div className="tray">
              <div className="tray-label"><I.target /> Next to buy</div>
              <div className="tray-row">
                <span className="tray-name">{tray.name}</span>
                <span className="tray-acts">
                  <button className="btn-ghost" onClick={() => skip(tray.id)}>Not yet</button>
                  <button className="btn-buy" onClick={() => bought(tray.id)}><I.check /> Bought</button>
                </span>
              </div>
            </div>
          </React.Fragment>
        )}
      </div>
    </div>
  );
}
