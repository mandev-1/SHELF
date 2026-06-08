import { useState, useEffect, useMemo } from "react";
import type { InventoryItem, InvCategory, InvAccessory } from "../../types/grid";
import { IcoPlus, IcoX, IcoCheck, IcoSell, IcoLink, IcoBox } from "./icons";

interface Props {
  items: InventoryItem[];
  onAdd: (item: Omit<InventoryItem, "id" | "addedAt">) => void;
  onUpdate: (id: string, patch: Partial<InventoryItem>) => void;
  onRemove: (id: string) => void;
  /** Pipe an item into the Hopper Selling ledger. */
  onSell?: (item: InventoryItem) => void;
}

const ALL_CATS: InvCategory[] = ["Tech", "Gear", "Music", "Photo", "Sport", "Home", "Other"];
const UNIT = "Kč";

function invMoney(v: number) {
  return (Number(v) || 0).toLocaleString("cs-CZ") + " " + UNIT;
}

function itemTotal(it: InventoryItem | InvDraft): number {
  const base = Number((it as InventoryItem).estimatedValue ?? (it as InvDraft).value ?? 0) || 0;
  const kids = (it.kids ?? []).reduce((a, k) => a + (Number(k.value) || 0), 0);
  return base + kids;
}

type InvDraft = {
  name: string;
  category: InvCategory;
  value: string;
  notes: string;
  sellUrl: string;
  kids: InvAccessory[];
};

/* ── Editor modal — 1:1 with `InvEditor` in the design handoff ──────────── */
function InvEditor({
  item, isNew, onSave, onClose, onDelete,
}: {
  item: InventoryItem | null;
  isNew: boolean;
  onSave: (id: string | null, data: Omit<InventoryItem, "id" | "addedAt">) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const [d, setD] = useState<InvDraft>({
    name:     item?.name ?? "",
    category: item?.category ?? "Other",
    value:    item?.estimatedValue != null ? String(item.estimatedValue) : "",
    notes:    item?.notes ?? "",
    sellUrl:  item?.sellUrl ?? "",
    kids:     (item?.kids ?? []).map((k) => ({ ...k })),
  });
  const set = <K extends keyof InvDraft>(k: K, v: InvDraft[K]) => setD((p) => ({ ...p, [k]: v }));

  const addKid  = () => setD((p) => ({ ...p, kids: [...p.kids, { id: crypto.randomUUID(), name: "", value: 0 }] }));
  const setKid  = (id: string, patch: Partial<InvAccessory>) => setD((p) => ({ ...p, kids: p.kids.map((k) => (k.id === id ? { ...k, ...patch } : k)) }));
  const dropKid = (id: string) => setD((p) => ({ ...p, kids: p.kids.filter((k) => k.id !== id) }));
  const kidsTotal = d.kids.reduce((a, k) => a + (Number(k.value) || 0), 0);

  const valid = d.name.trim().length > 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = () => {
    if (!valid) return;
    const cleanedKids = d.kids
      .filter((k) => k.name.trim())
      .map((k) => ({ id: k.id, name: k.name.trim(), value: Number(k.value) || 0 }));
    onSave(item?.id ?? null, {
      name: d.name.trim(),
      category: d.category,
      estimatedValue: Number(d.value) || 0,
      notes: d.notes.trim() || undefined,
      sellUrl: d.sellUrl.trim() || undefined,
      kids: cleanedKids.length ? cleanedKids : undefined,
    });
    onClose();
  };

  return (
    <div className="sale-modal-backdrop" onMouseDown={onClose}>
      <div className="sale-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sm-head">
          <div className="sm-head-l">
            <span className="sm-eyebrow"><IcoBox /> {isNew ? "Add to inventory" : "Edit item"}</span>
            <input
              className="sm-name"
              value={d.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="What is it?"
              autoFocus
            />
          </div>
          <button type="button" className="icon-btn sm-close" onClick={onClose} title="Close (Esc)"><IcoX /></button>
        </div>

        <div className="sm-body">
          <div className="sm-row2">
            <label className="sm-field">
              <span className="sm-label">Category</span>
              <div className="sm-seg inv-cat-seg">
                {ALL_CATS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={"sm-seg-btn" + (d.category === c ? " on" : "")}
                    onClick={() => set("category", c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </label>
          </div>

          <label className="sm-field">
            <span className="sm-label">Purchase value</span>
            <div className="sm-price">
              <input className="fld" type="number" min="0" value={d.value} onChange={(e) => set("value", e.target.value)} placeholder="0" />
              <span className="sm-unit">{UNIT}</span>
            </div>
          </label>

          <label className="sm-field sm-field--full">
            <span className="sm-label">Quick link to sell it</span>
            <input
              className="fld"
              value={d.sellUrl}
              onChange={(e) => set("sellUrl", e.target.value)}
              placeholder="https://…  marketplace / resale link"
            />
          </label>

          <label className="sm-field">
            <span className="sm-label">Notes</span>
            <textarea
              className="fld inv-notes-fld"
              rows={3}
              value={d.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Condition, accessories, where it lives…"
            />
          </label>

          <div className="sm-field inv-kids-field">
            <div className="inv-kids-head">
              <span className="sm-label">Accessories &amp; extras</span>
              {kidsTotal > 0 && <span className="inv-kids-sum">+{invMoney(kidsTotal)}</span>}
            </div>
            {d.kids.length > 0 && (
              <div className="inv-kids-rows">
                {d.kids.map((k) => (
                  <div className="inv-kid-row" key={k.id}>
                    <span className="inv-kid-dot" />
                    <input
                      className="fld inv-kid-name"
                      value={k.name}
                      onChange={(e) => setKid(k.id, { name: e.target.value })}
                      placeholder="Charger, case, spare…"
                    />
                    <div className="inv-kid-price">
                      <input
                        className="fld"
                        type="number" min="0"
                        value={k.value || ""}
                        onChange={(e) => setKid(k.id, { value: Number(e.target.value) || 0 })}
                        placeholder="0"
                      />
                      <span className="sm-unit">{UNIT}</span>
                    </div>
                    <button type="button" className="icon-btn inv-kid-x" title="Remove accessory" onClick={() => dropKid(k.id)}>
                      <IcoX />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="inv-kid-add" onClick={addKid}>
              <IcoPlus /> Add accessory
            </button>
          </div>
        </div>

        <div className="sm-foot">
          {!isNew && item ? (
            <button type="button" className="sm-del" onClick={() => { onDelete(item.id); onClose(); }}>
              <IcoX /> Remove
            </button>
          ) : <span />}
          <div className="sm-foot-r">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="button" className="btn-buy" disabled={!valid} onClick={submit}>
              <IcoCheck /> {isNew ? "Add item" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InventoryPanel({ items, onAdd, onUpdate, onRemove, onSell }: Props) {
  const [filterCat, setFilterCat] = useState<InvCategory | "all">("all");
  const [editId, setEditId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const total = useMemo(() => items.reduce((a, it) => a + itemTotal(it), 0), [items]);
  const filtered = filterCat === "all" ? items : items.filter((it) => it.category === filterCat);
  const catCounts = ALL_CATS.reduce((acc, c) => {
    acc[c] = items.filter((it) => it.category === c).length;
    return acc;
  }, {} as Record<InvCategory, number>);

  const editItem = items.find((it) => it.id === editId) ?? null;

  const handleSave = (id: string | null, data: Omit<InventoryItem, "id" | "addedAt">) => {
    if (id) onUpdate(id, data);
    else onAdd(data);
  };

  return (
    <div className="inv">
      <div className="inv-head">
        <div className="inv-head-l">
          <div>
            <div className="card-eyebrow inv-eyebrow">Inventory</div>
            <h2 className="inv-title">What I own</h2>
          </div>
          <div className="inv-total">
            <span className="inv-total-lab">Total value</span>
            <span className="inv-total-val">{invMoney(total)}</span>
            <span className="inv-total-sub">
              {items.length} item{items.length === 1 ? "" : "s"} · feeds net worth
            </span>
          </div>
        </div>
        <button type="button" className="btn-buy inv-add-btn" onClick={() => setAdding(true)}>
          <IcoPlus /> Add item
        </button>
      </div>

      <div className="inv-filters">
        <button
          type="button"
          className={"chip-filter" + (filterCat === "all" ? " on" : "")}
          onClick={() => setFilterCat("all")}
        >
          All <span className="chip-n">{items.length}</span>
        </button>
        {ALL_CATS.filter((c) => catCounts[c] > 0).map((c) => (
          <button
            key={c}
            type="button"
            className={"chip-filter" + (filterCat === c ? " on" : "")}
            onClick={() => setFilterCat(c)}
          >
            {c} <span className="chip-n">{catCounts[c]}</span>
          </button>
        ))}
      </div>

      <div className="inv-grid">
        {filtered.map((it) => {
          const total = itemTotal(it);
          const hasKids = (it.kids?.length ?? 0) > 0;
          return (
            <article key={it.id} className="inv-card" onClick={() => setEditId(it.id)} title="Click to edit">
              <div className="inv-card-top">
                <span className={"inv-cat inv-cat--" + (it.category || "Other")}>{it.category || "Other"}</span>
                <button
                  type="button"
                  className="icon-btn inv-card-x"
                  title="Remove"
                  onClick={(e) => { e.stopPropagation(); onRemove(it.id); }}
                >
                  <IcoX />
                </button>
              </div>
              <h3 className="inv-name">{it.name}</h3>
              <div className="inv-value">
                {invMoney(total)}
                {hasKids && (
                  <span className="inv-value-base">{invMoney(it.estimatedValue)} + extras</span>
                )}
              </div>
              {hasKids && (
                <ul className="inv-kids-list">
                  {it.kids!.map((k) => (
                    <li className="inv-kid-chip" key={k.id}>
                      <span className="inv-kid-dot" />
                      <span className="inv-kid-chip-name">{k.name}</span>
                      {k.value ? <em>{invMoney(k.value)}</em> : null}
                    </li>
                  ))}
                </ul>
              )}
              {it.notes
                ? <p className="inv-card-notes">{it.notes}</p>
                : <p className="inv-card-notes inv-card-notes--empty">No notes yet</p>}
              <div className="inv-card-foot">
                <button
                  type="button"
                  className="inv-sell"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onSell) onSell({ ...it, estimatedValue: total });
                    onRemove(it.id);
                    if (it.sellUrl) { try { window.open(it.sellUrl, "_blank", "noopener,noreferrer"); } catch { /* ignore */ } }
                  }}
                  title="List this in the Selling ledger"
                >
                  <IcoSell /> Sell it
                </button>
                {it.sellUrl ? (
                  <span className="inv-haslink" title="Has a sell link"><IcoLink /></span>
                ) : null}
              </div>
            </article>
          );
        })}

        <button type="button" className="inv-card inv-card--add" onClick={() => setAdding(true)}>
          <IcoPlus />
          <span>Add item</span>
        </button>
      </div>

      {editItem && (
        <InvEditor
          key={editItem.id}
          item={editItem}
          isNew={false}
          onSave={handleSave}
          onClose={() => setEditId(null)}
          onDelete={(id) => { onRemove(id); setEditId(null); }}
        />
      )}
      {adding && (
        <InvEditor
          key="new"
          item={null}
          isNew
          onSave={handleSave}
          onClose={() => setAdding(false)}
          onDelete={() => {}}
        />
      )}
    </div>
  );
}
