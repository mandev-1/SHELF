/* ShELF — Inventory: a catalogue of what I own.
   Feeds total net worth (Strategie) and pipes items into the Selling ledger.
   Isolated babel scope — icons prefixed INV, components exported on window. */

const INV = {
  plus: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14"/></svg>,
  x: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" {...p}><path d="M6 6l12 12M18 6L6 18"/></svg>,
  sell: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20.6 13.4 13 21a2 2 0 0 1-2.8 0l-7-7a2 2 0 0 1 0-2.8L10.6 3.6A2 2 0 0 1 12 3h6a2 2 0 0 1 2 2v6a2 2 0 0 1-.4 1.4Z"/><circle cx="16" cy="8" r="1.3" fill="currentColor" stroke="none"/></svg>,
  link: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>,
  note: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14 3v5h5"/><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M8 13h6M8 17h4"/></svg>,
  box: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>,
  check: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5"/></svg>,
};

const INV_CATS = ["Tech", "Gear", "Music", "Photo", "Sport", "Home", "Other"];

function invMoney(v, unit) {
  return (Number(v) || 0).toLocaleString("cs-CZ") + " " + (unit || "Kč");
}

/* an item's value including its accessories */
function itemTotal(it) {
  const kids = (it.kids || []).reduce((a, k) => a + (Number(k.value) || 0), 0);
  return (Number(it.value) || 0) + kids;
}

/* small editor for one inventory item (also used for "add new") */
function InvEditor({ item, onSave, onClose, onDelete, isNew }) {
  const { useState, useEffect } = React;
  const [d, setD] = useState({
    name: item.name || "", cat: item.cat || "Other", value: item.value || "",
    notes: item.notes || "", sellUrl: item.sellUrl || "",
    kids: (item.kids || []).map((k) => ({ ...k })),
  });
  const set = (k, v) => setD((p) => ({ ...p, [k]: v }));
  const valid = d.name.trim().length > 0;
  const unit = item.unit || "Kč";

  const addKid = () => setD((p) => ({ ...p, kids: [...p.kids, { id: "k" + Date.now(), name: "", value: "" }] }));
  const setKid = (id, patch) => setD((p) => ({ ...p, kids: p.kids.map((k) => (k.id === id ? { ...k, ...patch } : k)) }));
  const dropKid = (id) => setD((p) => ({ ...p, kids: p.kids.filter((k) => k.id !== id) }));
  const kidsTotal = d.kids.reduce((a, k) => a + (Number(k.value) || 0), 0);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="sale-modal-backdrop" onMouseDown={onClose}>
      <div className="sale-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sm-head">
          <div className="sm-head-l">
            <span className="sm-eyebrow"><INV.box /> {isNew ? "Add to inventory" : "Edit item"}</span>
            <input className="sm-name" value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="What is it?" autoFocus />
          </div>
          <button className="icon-btn sm-close" onClick={onClose} title="Close (Esc)"><INV.x /></button>
        </div>

        <div className="sm-body">
          <div className="sm-row2">
            <label className="sm-field">
              <span className="sm-label">Category</span>
              <div className="sm-seg inv-cat-seg">
                {INV_CATS.map((c) => (
                  <button key={c} className={"sm-seg-btn" + (d.cat === c ? " on" : "")} onClick={() => set("cat", c)}>{c}</button>
                ))}
              </div>
            </label>
          </div>

          <label className="sm-field">
            <span className="sm-label">Purchase value</span>
            <div className="sm-price"><input className="fld" type="number" min="0" value={d.value} onChange={(e) => set("value", e.target.value)} placeholder="0" /><span className="sm-unit">{item.unit || "Kč"}</span></div>
          </label>

          <label className="sm-field sm-field--full">
            <span className="sm-label">Quick link to sell it</span>
            <input className="fld" value={d.sellUrl} onChange={(e) => set("sellUrl", e.target.value)} placeholder="https://…  marketplace / resale link" />
          </label>

          <label className="sm-field">
            <span className="sm-label">Notes</span>
            <textarea className="fld inv-notes-fld" rows="3" value={d.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Condition, accessories, where it lives…" />
          </label>

          <div className="sm-field inv-kids-field">
            <div className="inv-kids-head">
              <span className="sm-label">Accessories &amp; extras</span>
              {kidsTotal > 0 && <span className="inv-kids-sum">+{invMoney(kidsTotal, unit)}</span>}
            </div>
            {d.kids.length > 0 && (
              <div className="inv-kids-rows">
                {d.kids.map((k) => (
                  <div className="inv-kid-row" key={k.id}>
                    <span className="inv-kid-dot"></span>
                    <input className="fld inv-kid-name" value={k.name} onChange={(e) => setKid(k.id, { name: e.target.value })} placeholder="Charger, case, spare…" />
                    <div className="inv-kid-price">
                      <input className="fld" type="number" min="0" value={k.value} onChange={(e) => setKid(k.id, { value: e.target.value })} placeholder="0" />
                      <span className="sm-unit">{unit}</span>
                    </div>
                    <button className="icon-btn inv-kid-x" title="Remove accessory" onClick={() => dropKid(k.id)}><INV.x /></button>
                  </div>
                ))}
              </div>
            )}
            <button className="inv-kid-add" onClick={addKid}><INV.plus /> Add accessory</button>
          </div>
        </div>

        <div className="sm-foot">
          {!isNew ? <button className="sm-del" onClick={() => onDelete(item.id)}><INV.x /> Remove</button> : <span />}
          <div className="sm-foot-r">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-buy" disabled={!valid} onClick={() => { onSave(item.id, { ...d, value: Number(d.value) || 0, kids: d.kids.filter((k) => k.name.trim()).map((k) => ({ ...k, value: Number(k.value) || 0 })) }); onClose(); }}><INV.check /> {isNew ? "Add item" : "Save"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Inventory({ items, setItems, onSell, onToast }) {
  const { useState, useMemo } = React;
  const [editId, setEditId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [catFilter, setCatFilter] = useState("all");

  const unit = items[0]?.unit || "Kč";
  const total = useMemo(() => items.reduce((a, it) => a + itemTotal(it), 0), [items]);
  const catsPresent = useMemo(() => INV_CATS.filter((c) => items.some((it) => it.cat === c)), [items]);
  const shown = catFilter === "all" ? items : items.filter((it) => it.cat === catFilter);

  const saveItem = (id, patch) => {
    if (id == null) {
      const nid = "i" + Date.now();
      setItems((p) => [...p, { id: nid, unit, ...patch }]);
      onToast && onToast("Added to inventory");
    } else {
      setItems((p) => p.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    }
  };
  const removeItem = (id) => { setItems((p) => p.filter((it) => it.id !== id)); setEditId(null); };
  const sellItem = (it) => {
    onSell && onSell({ ...it, value: itemTotal(it) });
    setItems((p) => p.filter((x) => x.id !== it.id));
    if (it.sellUrl) { try { window.open(it.sellUrl, "_blank", "noopener"); } catch (_) {} }
    const extra = (it.kids || []).length;
    onToast && onToast("“" + it.name + "”" + (extra ? " + " + extra + " extras" : "") + " moved to the Selling ledger");
  };

  const editItem = items.find((it) => it.id === editId) || null;

  return (
    <div className="inv">
      <div className="inv-head">
        <div className="inv-head-l">
          <div>
            <div className="card-eyebrow">Inventory</div>
            <h2 className="inv-title">What I own</h2>
          </div>
          <div className="inv-total">
            <span className="inv-total-lab">Total value</span>
            <span className="inv-total-val">{invMoney(total, unit)}</span>
            <span className="inv-total-sub">{items.length} item{items.length === 1 ? "" : "s"} · feeds net worth</span>
          </div>
        </div>
        <button className="btn-buy inv-add-btn" onClick={() => setAdding(true)}><INV.plus /> Add item</button>
      </div>

      <div className="inv-filters">
        <button className={"chip-filter" + (catFilter === "all" ? " on" : "")} onClick={() => setCatFilter("all")}>All <span className="chip-n">{items.length}</span></button>
        {catsPresent.map((c) => (
          <button key={c} className={"chip-filter" + (catFilter === c ? " on" : "")} onClick={() => setCatFilter(c)}>
            {c} <span className="chip-n">{items.filter((it) => it.cat === c).length}</span>
          </button>
        ))}
      </div>

      <div className="inv-grid">
        {shown.map((it) => (
          <article key={it.id} className="inv-card" onClick={() => setEditId(it.id)} title="Click to edit">
            <div className="inv-card-top">
              <span className={"inv-cat inv-cat--" + (it.cat || "Other")}>{it.cat || "Other"}</span>
              <button className="icon-btn inv-card-x" title="Remove" onClick={(e) => { e.stopPropagation(); removeItem(it.id); }}><INV.x /></button>
            </div>
            <h3 className="inv-name">{it.name}</h3>
            <div className="inv-value">
              {invMoney(itemTotal(it), it.unit || unit)}
              {(it.kids || []).length > 0 && <span className="inv-value-base">{invMoney(it.value, it.unit || unit)} + extras</span>}
            </div>
            {(it.kids || []).length > 0 && (
              <ul className="inv-kids-list">
                {it.kids.map((k) => (
                  <li className="inv-kid-chip" key={k.id}><span className="inv-kid-dot"></span><span className="inv-kid-chip-name">{k.name}</span>{k.value ? <em>{invMoney(k.value, it.unit || unit)}</em> : null}</li>
                ))}
              </ul>
            )}
            {it.notes ? <p className="inv-card-notes">{it.notes}</p> : <p className="inv-card-notes inv-card-notes--empty">No notes yet</p>}
            <div className="inv-card-foot">
              <button className="inv-sell" onClick={(e) => { e.stopPropagation(); sellItem(it); }} title="List this in the Selling ledger">
                <INV.sell /> Sell it
              </button>
              {it.sellUrl ? <span className="inv-haslink" title="Has a sell link"><INV.link /></span> : null}
            </div>
          </article>
        ))}

        <button className="inv-card inv-card--add" onClick={() => setAdding(true)}>
          <INV.plus />
          <span>Add item</span>
        </button>
      </div>

      {editItem && <InvEditor key={editItem.id} item={editItem} onSave={saveItem} onClose={() => setEditId(null)} onDelete={removeItem} />}
      {adding && <InvEditor key="new" item={{ unit }} isNew onSave={saveItem} onClose={() => setAdding(false)} onDelete={() => {}} />}
    </div>
  );
}

Object.assign(window, { Inventory });
