import { useState, useEffect } from "react";
import type { InventoryItem, InvCategory } from "../../types/grid";

interface Props {
  items: InventoryItem[];
  onAdd: (item: Omit<InventoryItem, "id" | "addedAt">) => void;
  onUpdate: (id: string, patch: Partial<InventoryItem>) => void;
  onRemove: (id: string) => void;
}

const ALL_CATS: InvCategory[] = ["Tech", "Music", "Photo", "Sport", "Home", "Gear", "Other"];

function IcoPlus() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>;
}
function IcoX() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>;
}
function IcoCheck() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>;
}
function IcoTag() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>;
}

function ItemModal({
  item,
  onSave,
  onClose,
}: {
  item: Partial<InventoryItem> & { isNew?: boolean };
  onSave: (data: Omit<InventoryItem, "id" | "addedAt">) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(item.name ?? "");
  const [category, setCategory] = useState<InvCategory>(item.category ?? "Tech");
  const [value, setValue] = useState(item.estimatedValue != null ? String(item.estimatedValue) : "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [url, setUrl] = useState(item.url ?? "");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), category, estimatedValue: parseFloat(value) || 0, notes: notes.trim() || undefined, url: url.trim() || undefined });
  };

  return (
    <div className="inv-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="inv-modal">
        <div className="inv-modal-head">
          <div className="inv-modal-title">{item.isNew ? "Add item" : "Edit item"}</div>
          <button type="button" className="ghost-btn" onClick={onClose}><IcoX /></button>
        </div>
        <div className="inv-modal-body">
          <div>
            <div className="inv-modal-label">Name</div>
            <input className="fld" style={{ width: "100%" }} placeholder="Item name" value={name} autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); }} />
          </div>
          <div>
            <div className="inv-modal-label">Category</div>
            <div className="inv-cat-seg">
              {ALL_CATS.map((c) => (
                <button key={c} type="button" className={`inv-cat-btn${category === c ? " on" : ""}`} onClick={() => setCategory(c)}>{c}</button>
              ))}
            </div>
          </div>
          <div className="inv-modal-row2">
            <div>
              <div className="inv-modal-label">Estimated value</div>
              <input className="fld" style={{ width: "100%" }} type="number" min="0" step="0.01" placeholder="0" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <div>
              <div className="inv-modal-label">URL (optional)</div>
              <input className="fld" style={{ width: "100%" }} placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
          </div>
          <div>
            <div className="inv-modal-label">Notes</div>
            <textarea className="fld" style={{ width: "100%", minHeight: 72, resize: "vertical" }} placeholder="Condition, serial number, purchase date…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="inv-modal-foot">
          <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="ghost-btn ok" onClick={save} disabled={!name.trim()}>
            <IcoCheck /> {item.isNew ? "Add item" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function InventoryPanel({ items, onAdd, onUpdate, onRemove }: Props) {
  const [filterCat, setFilterCat] = useState<InvCategory | "all">("all");
  const [modalItem, setModalItem] = useState<(Partial<InventoryItem> & { isNew?: boolean }) | null>(null);

  const filtered = filterCat === "all" ? items : items.filter((it) => it.category === filterCat);
  const totalValue = items.reduce((sum, it) => sum + it.estimatedValue, 0);

  const catCounts = ALL_CATS.reduce((acc, c) => {
    acc[c] = items.filter((it) => it.category === c).length;
    return acc;
  }, {} as Record<InvCategory, number>);

  return (
    <div className="inv">
      <div className="inv-head">
        <div className="inv-head-l">
          <div>
            <div className="inv-eyebrow">Catalogue</div>
            <div className="inv-title">Inventory</div>
          </div>
          {totalValue > 0 && (
            <div className="inv-total">
              <div className="inv-total-lab">Total est. value</div>
              <div className="inv-total-val">{totalValue.toLocaleString()}</div>
              <div className="inv-total-sub">{items.length} item{items.length !== 1 ? "s" : ""}</div>
            </div>
          )}
        </div>
        <button type="button" className="ghost-btn ok" onClick={() => setModalItem({ isNew: true })}>
          <IcoPlus /> Add item
        </button>
      </div>

      {items.length > 0 && (
        <div className="inv-filters">
          <button type="button" className={`chip-filter${filterCat === "all" ? " on" : ""}`} onClick={() => setFilterCat("all")}>
            All <span className="chip-n">{items.length}</span>
          </button>
          {ALL_CATS.filter((c) => catCounts[c] > 0).map((c) => (
            <button key={c} type="button" className={`chip-filter${filterCat === c ? " on" : ""}`} onClick={() => setFilterCat(c)}>
              {c} <span className="chip-n">{catCounts[c]}</span>
            </button>
          ))}
        </div>
      )}

      <div className="inv-grid">
        {filtered.map((it) => (
          <div key={it.id} className="inv-card" onClick={() => setModalItem(it)}>
            <div className="inv-card-top">
              <span className={`inv-cat inv-cat--${it.category}`}>{it.category}</span>
              <button
                type="button"
                className="inv-card-x ghost-btn"
                style={{ padding: "2px 6px" }}
                onClick={(e) => { e.stopPropagation(); onRemove(it.id); }}
              >
                <IcoX />
              </button>
            </div>
            <p className="inv-name">{it.name}</p>
            {it.estimatedValue > 0 && <div className="inv-value">{it.estimatedValue.toLocaleString()}</div>}
            {it.notes ? (
              <p className="inv-card-notes">{it.notes}</p>
            ) : (
              <p className="inv-card-notes inv-card-notes--empty">No notes</p>
            )}
            <div className="inv-card-foot">
              <button
                type="button"
                className="inv-sell"
                onClick={(e) => { e.stopPropagation(); /* TODO: pre-fill ledger */ }}
              >
                <IcoTag /> List for sale
              </button>
            </div>
          </div>
        ))}

        <button type="button" className="inv-card inv-card--add" onClick={() => setModalItem({ isNew: true })}>
          <IcoPlus /> Add item
        </button>
      </div>

      {modalItem && (
        <ItemModal
          item={modalItem}
          onSave={(data) => {
            if ((modalItem as InventoryItem).id) {
              onUpdate((modalItem as InventoryItem).id, data);
            } else {
              onAdd(data);
            }
            setModalItem(null);
          }}
          onClose={() => setModalItem(null)}
        />
      )}
    </div>
  );
}
