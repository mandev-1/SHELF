import { useState, useRef, useEffect } from "react";
import type { BuylistItem, SaleItem, SaleStatus } from "../../types/grid";

interface Props {
  items: BuylistItem[];
  saleItems: SaleItem[];
  onAdd: (input: { title: string }) => void;
  onDiscard: (id: string) => void;
  onBuyBottom: () => void;
  onBump: (id: string) => void;
  onSkip: (id: string) => void;
  onSaleAdd: (item: Omit<SaleItem, "id" | "listedAt">) => void;
  onSaleUpdate: (id: string, patch: Partial<SaleItem>) => void;
  onSaleRemove: (id: string) => void;
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
function IcoFlip() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7H4M4 7l4-4M4 7l4 4M4 17h16M20 17l-4 4M20 17l-4-4"/></svg>;
}
function IcoLink() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
}

const STATUS_ORDER: SaleStatus[] = ["listed", "reserved", "sold"];

function SaleModal({
  item,
  onSave,
  onClose,
}: {
  item: Partial<SaleItem> & { isNew?: boolean };
  onSave: (patch: Omit<SaleItem, "id" | "listedAt">) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(item.title ?? "");
  const [platform, setPlatform] = useState(item.platform ?? "");
  const [price, setPrice] = useState(item.price != null ? String(item.price) : "");
  const [status, setStatus] = useState<SaleStatus>(item.status ?? "listed");
  const [url, setUrl] = useState(item.url ?? "");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), platform, price: parseFloat(price) || 0, status, url: url.trim() || undefined });
  };

  return (
    <div className="sale-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sale-modal">
        <div className="sm-head">
          <div className="sm-head-l">
            <div className="sm-eyebrow">{item.isNew ? "New listing" : "Edit listing"}</div>
            <input
              className="sm-name fld"
              placeholder="Item name"
              value={title}
              autoFocus
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") save(); }}
            />
          </div>
          <button type="button" className="sm-close ghost-btn" onClick={onClose}><IcoX /></button>
        </div>
        <div className="sm-body">
          <div className="sm-field">
            <div className="sm-label">Platform</div>
            <input className="fld" placeholder="e.g. Vinted, Facebook, eBay" value={platform} onChange={(e) => setPlatform(e.target.value)} />
          </div>
          <div className="sm-row2">
            <div className="sm-field">
              <div className="sm-label">Asking price</div>
              <div className="sm-price">
                <input className="fld" type="number" min="0" step="0.01" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
            </div>
            <div className="sm-field">
              <div className="sm-label">URL (optional)</div>
              <input className="fld" placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
          </div>
          <div className="sm-field">
            <div className="sm-label">Status</div>
            <div className="sm-seg">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`sm-seg-btn sm-seg-btn--${s}${status === s ? " on" : ""}`}
                  onClick={() => setStatus(s)}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "12px 18px", borderTop: "1px solid var(--line-faint)" }}>
          <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="ghost-btn ok" onClick={save} disabled={!title.trim()}>
            <IcoCheck /> {item.isNew ? "Add listing" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BuylistPanel({
  items, saleItems,
  onAdd, onDiscard, onBuyBottom, onBump, onSkip,
  onSaleAdd, onSaleUpdate, onSaleRemove,
  onToast,
}: Props) {
  const [name, setName] = useState("");
  const [flipped, setFlipped] = useState(false);
  const [filterStatus, setFilterStatus] = useState<SaleStatus | "all">("all");
  const [modalItem, setModalItem] = useState<(Partial<SaleItem> & { isNew?: boolean }) | null>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const [sceneHeight, setSceneHeight] = useState<number | undefined>(undefined);

  const toss = () => {
    const v = name.trim();
    if (!v) return;
    onAdd({ title: v });
    setName("");
  };

  useEffect(() => {
    const el = flipped ? backRef.current : frontRef.current;
    if (el) setSceneHeight(el.offsetHeight);
  }, [flipped, items, saleItems]);

  const tray = items.length > 0 ? items[items.length - 1] : null;
  const waiting = items.slice(0, -1);

  const filtered = filterStatus === "all" ? saleItems : saleItems.filter((s) => s.status === filterStatus);
  const counts: Record<string, number> = { listed: 0, reserved: 0, sold: 0 };
  for (const s of saleItems) counts[s.status] = (counts[s.status] ?? 0) + 1;
  const totalListed = saleItems.filter((s) => s.status !== "sold").reduce((sum, s) => sum + s.price, 0);

  return (
    <div className="hopper">
      <div className="hopper-head">
        <div>
          <h2 className="hopper-title">Hopper</h2>
          <p className="hopper-sub">Toss things in the top. The one that sinks to the bottom is next to buy.</p>
        </div>
        <div className="hopper-head-r">
          <div className="hopper-count"><b>{items.length}</b><span>in line</span></div>
          <button
            type="button"
            className={`flip-btn${flipped ? " flipped" : ""}`}
            title={flipped ? "Show buy queue" : "Show selling ledger"}
            onClick={() => setFlipped((f) => !f)}
          >
            <IcoFlip />
          </button>
        </div>
      </div>

      <div className="flip-scene" style={sceneHeight != null ? { height: sceneHeight } : undefined}>
        <div className={`flipper${flipped ? " is-flipped" : ""}`}>
          {/* FRONT: buy queue */}
          <div ref={frontRef} className={`flip-face flip-front${flipped ? " is-hidden" : ""}`}>
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
                          <button type="button" className="btn-buy" onClick={() => { onBuyBottom(); onToast?.("Bought it. 🎉"); }}>
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

          {/* BACK: selling ledger */}
          <div ref={backRef} className={`flip-face flip-back${!flipped ? " is-hidden" : ""}`}>
            <div className="ledger">
              <div className="ledger-bar">
                <div className="seg seg--filter">
                  {([["all", "All"], ...STATUS_ORDER.map((s) => [s, s.charAt(0).toUpperCase() + s.slice(1)])] as [string, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={`seg-btn${filterStatus === key ? " on" : ""}`}
                      onClick={() => setFilterStatus(key as SaleStatus | "all")}
                    >
                      {label}
                      {key !== "all" && <span className="seg-n">{counts[key] ?? 0}</span>}
                    </button>
                  ))}
                </div>
                <div className="ledger-bar-meta">{saleItems.filter((s) => s.status !== "sold").length} active</div>
              </div>

              <div className="ledger-head">
                <span>Item</span>
                <span>Platform</span>
                <span>Listed</span>
                <span>Status</span>
                <span className="lh-price">Price</span>
                <span />
              </div>

              <div className="ledger-body">
                {filtered.length === 0 ? (
                  <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--faint)", fontSize: 13 }}>
                    No items. Add your first listing below.
                  </div>
                ) : (
                  filtered.map((s) => (
                    <div key={s.id} className={`sale-row${s.status === "sold" ? " is-sold" : ""}`} onClick={() => setModalItem(s)}>
                      <span className="sale-name">
                        {s.url && <IcoLink />}
                        {s.title}
                      </span>
                      <span className="sale-where">{s.platform}</span>
                      <span className="sale-listed">{s.listedAt}</span>
                      <span>
                        <button type="button" className={`pill pill--${s.status}`} onClick={(e) => {
                          e.stopPropagation();
                          const next = STATUS_ORDER[(STATUS_ORDER.indexOf(s.status) + 1) % STATUS_ORDER.length];
                          onSaleUpdate(s.id, { status: next });
                        }}>
                          {s.status}
                        </button>
                      </span>
                      <span className="sale-price">{s.price > 0 ? `${s.price.toFixed(0)}` : "—"}</span>
                      <span className="sale-x">
                        <button type="button" className="ghost-btn" style={{ padding: "2px 6px" }} onClick={(e) => { e.stopPropagation(); onSaleRemove(s.id); }}>
                          <IcoX />
                        </button>
                      </span>
                    </div>
                  ))
                )}
              </div>

              {saleItems.length > 0 && (
                <div className="ledger-foot">
                  <span>Total</span>
                  <span />
                  <span />
                  <span />
                  <span className="ledger-total">{totalListed > 0 ? `${totalListed.toFixed(0)} listed` : "—"}</span>
                  <span />
                </div>
              )}

              <div style={{ padding: "10px 4px 4px" }}>
                <button
                  type="button"
                  className="ghost-btn ok"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => setModalItem({ isNew: true })}
                >
                  <IcoPlus /> Add listing
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {modalItem && (
        <SaleModal
          item={modalItem}
          onSave={(patch) => {
            if ((modalItem as SaleItem).id) {
              onSaleUpdate((modalItem as SaleItem).id, patch);
            } else {
              onSaleAdd(patch);
            }
            setModalItem(null);
          }}
          onClose={() => setModalItem(null)}
        />
      )}
    </div>
  );
}
