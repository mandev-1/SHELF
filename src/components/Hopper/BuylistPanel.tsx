import { useState, useLayoutEffect, useEffect, useRef } from "react";
import type { BuylistItem, SaleItem, SaleStatus } from "../../types/grid";

interface Props {
  items: BuylistItem[];
  saleItems: SaleItem[];
  onAdd: (input: { title: string }) => void;
  onDiscard: (id: string) => void;
  onBuyBottom: () => void;
  onBump: (id: string) => void;
  onSkip: (id: string) => void;
  onSaleAdd: (item: Omit<SaleItem, "id">) => void;
  onSaleUpdate: (id: string, patch: Partial<SaleItem>) => void;
  onSaleRemove: (id: string) => void;
  face: "buy" | "sell";
  onSetFace: (face: "buy" | "sell") => void;
  onToast?: (msg: string) => void;
}

/* ---- icons (matching proto exactly) ---- */
function IPlus(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14"/></svg>;
}
function IX(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}><path d="M6 6l12 12M18 6 6 18"/></svg>;
}
function IArrowDown(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 5v14M19 12l-7 7-7-7"/></svg>;
}
function ICheck(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5"/></svg>;
}
function ITarget(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>;
}
function IFunnel(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 26 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M2 2h22M6 7h14M10 12h6"/></svg>;
}
function IFlip(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>;
}
function ITag(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20.6 13.4 13 21a2 2 0 0 1-2.8 0l-7-7a2 2 0 0 1 0-2.8L10.6 3.6A2 2 0 0 1 12 3h6a2 2 0 0 1 2 2v6a2 2 0 0 1-.4 1.4Z"/><circle cx="16" cy="8" r="1.3" fill="currentColor" stroke="none"/></svg>;
}
function ILink(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>;
}
function IExternal(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>;
}
function IClock(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
}
function ITrash(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>;
}
function IRows(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.5h18M3 14.5h18"/></svg>;
}

/* ---- date helpers ---- */
const fmtD = (iso: string) => iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtDT = (iso: string) => iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : "—";
const fmtShort = (iso: string) => iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—";
const saleHost = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch (_) { return url; } };

const SALE_STATUS: SaleStatus[] = ["listed", "reserved", "sold"];
const SALE_FILTERS: [string, string][] = [["selling", "Selling"], ["all", "All"], ["sold", "Sold"]];

/* ---- SaleEditor modal ---- */
function SaleEditor({ sale, onSave, onClose, onDelete }: {
  sale: SaleItem;
  onSave: (id: string, patch: Partial<SaleItem>) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState({
    name: sale.name,
    url: sale.url || "",
    where: sale.where || "",
    price: sale.price,
    status: sale.status,
  });
  const set = (k: keyof typeof draft, v: string | number | SaleStatus) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const dirty =
    draft.name !== sale.name ||
    draft.url !== (sale.url || "") ||
    draft.where !== (sale.where || "") ||
    Number(draft.price) !== sale.price ||
    draft.status !== sale.status;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="sale-modal-backdrop" onMouseDown={onClose}>
      <div className="sale-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sm-head">
          <div className="sm-head-l">
            <span className="sm-eyebrow"><ITag style={{ width: 12, height: 12 }} /> Edit listing</span>
            <input
              className="sm-name"
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Item name"
              autoFocus
            />
          </div>
          <button type="button" className="icon-btn sm-close" onClick={onClose} title="Close (Esc)"><IX /></button>
        </div>

        <div className="sm-body">
          <label className="sm-field sm-field--full">
            <span className="sm-label">Listing URL</span>
            <div className="sm-url">
              <input className="fld" value={draft.url} onChange={(e) => set("url", e.target.value)} placeholder="https://…  where you're selling it" />
              <a
                className={"sm-open" + (draft.url ? "" : " is-off")}
                href={draft.url || undefined}
                target="_blank"
                rel="noreferrer"
                title={draft.url ? "Open listing" : "Add a URL first"}
                onClick={(e) => { if (!draft.url) e.preventDefault(); }}
              >
                <IExternal style={{ width: 13, height: 13 }} /> Open
              </a>
            </div>
          </label>

          <div className="sm-row2">
            <label className="sm-field">
              <span className="sm-label">Where</span>
              <input className="fld" value={draft.where} onChange={(e) => set("where", e.target.value)} placeholder="Bazoš, FB Marketplace…" />
            </label>
            <label className="sm-field">
              <span className="sm-label">Price</span>
              <div className="sm-price">
                <input className="fld" type="number" min="0" value={draft.price} onChange={(e) => set("price", e.target.value)} />
                <span className="sm-unit">{sale.unit}</span>
              </div>
            </label>
          </div>

          <div className="sm-field">
            <span className="sm-label">Status</span>
            <div className="sm-seg">
              {SALE_STATUS.map((st) => (
                <button
                  key={st}
                  type="button"
                  className={"sm-seg-btn sm-seg-btn--" + st + (draft.status === st ? " on" : "")}
                  onClick={() => set("status", st)}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="sm-meta">
            <div className="sm-meta-cell"><span className="sm-meta-k">Created</span><span className="sm-meta-v">{fmtD(sale.createdAt)}</span></div>
            <div className="sm-meta-cell"><span className="sm-meta-k">Updated</span><span className="sm-meta-v">{fmtD(sale.updatedAt)}</span></div>
            <div className="sm-meta-cell"><span className="sm-meta-k">Sold</span><span className={"sm-meta-v" + (sale.soldAt ? " is-sold" : "")}>{sale.soldAt ? fmtD(sale.soldAt) : "—"}</span></div>
          </div>

          <div className="sm-hist">
            <div className="sm-hist-label"><IClock style={{ width: 13, height: 13 }} /> History</div>
            <ol className="sm-hist-list">
              {(sale.history || []).map((h, i) => (
                <li className="sm-hist-row" key={i}>
                  <span className="sm-hist-dot"></span>
                  <span className="sm-hist-text">{h.text}</span>
                  <time className="sm-hist-time">{fmtDT(h.at)}</time>
                </li>
              ))}
              {(!sale.history || sale.history.length === 0) && (
                <li className="sm-hist-empty">No changes logged yet.</li>
              )}
            </ol>
          </div>
        </div>

        <div className="sm-foot">
          {sale.status !== "sold" && (
            <button type="button" className="sm-del" onClick={() => onDelete(sale.id)}>
              <ITrash style={{ width: 14, height: 14 }} /> Delete
            </button>
          )}
          <div className="sm-foot-r">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="btn-buy"
              disabled={!dirty}
              onClick={() => { onSave(sale.id, draft); onClose(); }}
            >
              <ICheck style={{ width: 14, height: 14 }} /> Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- bulk add listings (spreadsheet-style) ---- */
type BulkRow = { name: string; where: string; price: string; unit: string; status: SaleStatus; url: string };
const blankBulkRow = (): BulkRow => ({ name: "", where: "", price: "", unit: "Kč", status: "listed", url: "" });

function SaleBulkAdd({ onAdd, onClose }: {
  onAdd: (rows: Omit<SaleItem, "id">[]) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<BulkRow[]>(() => [blankBulkRow(), blankBulkRow(), blankBulkRow()]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [onClose]);

  const patch = (i: number, p: Partial<BulkRow>) =>
    setRows((rs) => rs.map((r, ix) => (ix === i ? { ...r, ...p } : r)));
  const addRow = () => setRows((rs) => [...rs, blankBulkRow()]);
  const removeRow = (i: number) => setRows((rs) => (rs.length > 1 ? rs.filter((_, ix) => ix !== i) : rs));

  // paste a block from a spreadsheet — tab/comma separated, one listing per line,
  // starting at the row pasted into (columns: item, where, price, unit, status, url)
  const onPasteRows = (e: React.ClipboardEvent, rowIndex: number) => {
    const text = e.clipboardData.getData("text");
    if (!/[\t\n]/.test(text)) return; // single value — normal paste
    e.preventDefault();
    const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length > 0);
    const parsed: BulkRow[] = lines.map((l) => {
      const c = l.split(/\t|,(?=\s*\S)/);
      const st = (c[4] || "").trim().toLowerCase();
      return {
        name: (c[0] ?? "").trim(),
        where: (c[1] ?? "").trim(),
        price: (c[2] ?? "").trim(),
        unit: (c[3] ?? "").trim() || "Kč",
        status: (SALE_STATUS as string[]).includes(st) ? (st as SaleStatus) : "listed",
        url: (c[5] ?? "").trim(),
      };
    });
    setRows((prev) => [...prev.slice(0, rowIndex), ...parsed, ...prev.slice(rowIndex + parsed.length)]);
  };

  const filled = rows.filter((r) => r.name.trim().length > 0);
  const commit = () => {
    if (filled.length === 0) return;
    const now = new Date().toISOString().slice(0, 19);
    const out: Omit<SaleItem, "id">[] = filled.map((r) => ({
      name: r.name.trim(),
      where: r.where.trim(),
      price: parseFloat(r.price.replace(/[^\d.-]/g, "")) || 0,
      unit: r.unit.trim() || "Kč",
      status: r.status,
      url: r.url.trim() || undefined,
      createdAt: now,
      updatedAt: now,
      soldAt: null,
      history: [],
    }));
    onAdd(out);
    onClose();
  };

  return (
    <div className="sba-veil" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sba-modal" role="dialog" aria-modal="true" aria-label="Add multiple listings">
        <div className="sba-head">
          <div>
            <div className="sba-eyebrow">Selling</div>
            <h2 className="sba-title">Add multiple listings</h2>
            <div className="sba-sub">Type, or paste rows straight from a spreadsheet (item · where · price · unit · status · url).</div>
          </div>
          <button className="sba-close" onClick={onClose} aria-label="Close"><IX style={{ width: 14, height: 14 }} /></button>
        </div>

        <div className="sba-table">
          <div className="sba-row sba-thead">
            <span>Item</span><span>Where</span><span className="sba-right">Price</span><span>Unit</span><span>Status</span><span>Link</span><span />
          </div>
          {rows.map((r, i) => (
            <div className="sba-row" key={i}>
              <input className="sba-in" placeholder="What you're selling" value={r.name}
                onChange={(e) => patch(i, { name: e.target.value })}
                onPaste={(e) => onPasteRows(e, i)} autoFocus={i === 0} />
              <input className="sba-in" placeholder="Platform / buyer" value={r.where}
                onChange={(e) => patch(i, { where: e.target.value })} onPaste={(e) => onPasteRows(e, i)} />
              <input className="sba-in sba-right sba-mono" inputMode="decimal" placeholder="0" value={r.price}
                onChange={(e) => patch(i, { price: e.target.value })} onPaste={(e) => onPasteRows(e, i)} />
              <input className="sba-in" placeholder="Kč" value={r.unit}
                onChange={(e) => patch(i, { unit: e.target.value })} onPaste={(e) => onPasteRows(e, i)} />
              <select className="sba-in sba-sel" value={r.status} onChange={(e) => patch(i, { status: e.target.value as SaleStatus })}>
                {SALE_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input className="sba-in" placeholder="https://…" value={r.url}
                onChange={(e) => patch(i, { url: e.target.value })} onPaste={(e) => onPasteRows(e, i)} />
              <button className="sba-del" title="Remove row" onClick={() => removeRow(i)}><IX style={{ width: 13, height: 13 }} /></button>
            </div>
          ))}
        </div>

        <div className="sba-foot">
          <button className="sba-addrow" onClick={addRow}><IPlus style={{ width: 13, height: 13 }} /> Add row</button>
          <span className="sba-spacer" />
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="sba-commit" onClick={commit} disabled={filled.length === 0}>
            <ICheck style={{ width: 14, height: 14 }} /> Add {filled.length || ""} listing{filled.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- Hopper component ---- */
export function BuylistPanel({
  items, saleItems,
  onAdd, onDiscard, onBuyBottom, onBump, onSkip,
  onSaleAdd, onSaleUpdate, onSaleRemove,
  face, onSetFace,
  onToast,
}: Props) {
  const [name, setName] = useState("");
  const [flipping, setFlipping] = useState(false);
  const [sceneH, setSceneH] = useState<number | null>(null);
  const [saleFilter, setSaleFilter] = useState("selling");
  const [editId, setEditId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [sellW, setSellW] = useState(940);
  const [sellH, setSellH] = useState<number | null>(null);
  const [resizing, setResizing] = useState(false);

  const flipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resz = useRef<{ sx: number; sy: number; w: number; h: number; maxW: number } | null>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);

  const toss = () => {
    if (!name.trim()) return;
    onAdd({ title: name.trim() });
    setName("");
  };

  const tray = items.length > 0 ? items[items.length - 1] : null;
  const waiting = items.slice(0, -1);

  useLayoutEffect(() => {
    const el = face === "buy" ? frontRef.current : backRef.current;
    if (el) setSceneH(el.offsetHeight);
  }, [face, items, saleItems, sellH, sellW, saleFilter]);

  const flip = () => {
    onSetFace(face === "buy" ? "sell" : "buy");
    setFlipping(true);
    if (flipTimer.current) clearTimeout(flipTimer.current);
    flipTimer.current = setTimeout(() => setFlipping(false), 640);
  };
  useEffect(() => () => { if (flipTimer.current) clearTimeout(flipTimer.current); }, []);

  /* updateSale: diffs, logs changes, stamps dates */
  const updateSale = (id: string, patch: Partial<SaleItem>) => {
    onSaleUpdate(id, (() => {
      const s = saleItems.find((x) => x.id === id);
      if (!s) return patch;
      const now = new Date().toISOString().slice(0, 19);
      const money = (v: number) => Number(v).toLocaleString("cs-CZ");
      const changes: string[] = [];
      if (patch.name !== undefined && patch.name.trim() && patch.name !== s.name) changes.push(`Renamed → "${patch.name}"`);
      if (patch.where !== undefined && patch.where !== (s.where || "")) changes.push(`Where ${s.where || "—"} → ${patch.where || "—"}`);
      if (patch.url !== undefined && patch.url !== (s.url || "")) changes.push(patch.url ? `Listing link → ${saleHost(patch.url)}` : "Listing link removed");
      if (patch.price !== undefined && Number(patch.price) !== s.price) changes.push(`Price ${money(s.price)} → ${money(Number(patch.price))} ${s.unit}`);
      if (patch.status !== undefined && patch.status !== s.status) changes.push(`Status ${s.status} → ${patch.status}`);
      if (!changes.length) return patch;
      const next: Partial<SaleItem> = { ...patch };
      if (patch.price !== undefined) next.price = Number(patch.price) || 0;
      if (patch.name !== undefined) next.name = patch.name.trim() || s.name;
      next.updatedAt = now;
      if (patch.status === "sold" && s.status !== "sold") next.soldAt = now;
      else if (patch.status !== undefined && patch.status !== "sold") next.soldAt = null;
      next.history = [...changes.map((text) => ({ at: now, text })), ...(s.history || [])];
      return next;
    })());
  };

  const cycleStatus = (id: string) => {
    const s = saleItems.find((x) => x.id === id);
    if (!s) return;
    const next = SALE_STATUS[(SALE_STATUS.indexOf(s.status) + 1) % SALE_STATUS.length];
    if (next === "sold") { setEditId(id); return; }
    updateSale(id, { status: next });
  };

  const dropSale = (id: string) => { onSaleRemove(id); setEditId(null); };

  useEffect(() => {
    if (!confirmDeleteId) return;
    const h = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setConfirmDeleteId(null);
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [confirmDeleteId]);

  const liveSales = saleItems.filter((s) => s.status !== "sold").length;
  const visibleSales = saleItems.filter((s) =>
    saleFilter === "all" ? true : saleFilter === "sold" ? s.status === "sold" : s.status !== "sold"
  );

  /* resize grip */
  const onResizeDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    const ledger = e.currentTarget.parentElement!;
    const avail = (ledger.closest(".canvas-inner") as HTMLElement)?.clientWidth || window.innerWidth - 380;
    resz.current = { sx: e.clientX, sy: e.clientY, w: ledger.offsetWidth, h: ledger.offsetHeight, maxW: avail };
    setResizing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!resz.current) return;
    const r = resz.current;
    setSellW(Math.max(560, Math.min(r.maxW, r.w + (e.clientX - r.sx))));
    setSellH(Math.max(280, r.h + (e.clientY - r.sy)));
  };
  const onResizeUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!resz.current) return;
    resz.current = null; setResizing(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
  };

  return (
    <div
      className={"hopper" + (face === "sell" ? " hopper--sell" : "") + (resizing ? " is-resizing" : "")}
      style={{ width: face === "buy" ? 600 : sellW }}
    >
      <div className="hopper-head">
        <div>
          <h2 className="hopper-title">{face === "buy" ? "Hopper" : "Selling"}</h2>
          <p className="hopper-sub">
            {face === "buy"
              ? "Toss things in the top. The one that sinks to the bottom is next to buy."
              : "The other side of the chute — everything you've got on the market."}
          </p>
        </div>
        <div className="hopper-head-r">
          <button
            type="button"
            className={"flip-btn" + (face === "sell" ? " flipped" : "")}
            onClick={flip}
            title={face === "buy" ? "Flip to what you're selling" : "Flip back to the hopper"}
          >
            <IFlip />
          </button>
          <div className="hopper-count">
            <b>{face === "buy" ? items.length : liveSales}</b>
            <span>{face === "buy" ? "in line" : "on sale"}</span>
          </div>
        </div>
      </div>

      <div className="flip-scene" style={sceneH ? { height: sceneH } : undefined}>
        <div className={"flipper" + (face === "sell" ? " is-flipped" : "")}>

          {/* FRONT: buying chute */}
          <div
            ref={frontRef}
            className={"flip-face flip-front" + (face !== "buy" && !flipping ? " is-hidden" : "")}
            aria-hidden={face !== "buy"}
          >
            <div className="chute">
              <div className="mouth">
                <input
                  className="fld"
                  placeholder="What do you want to buy?"
                  value={name}
                  tabIndex={face === "buy" ? 0 : -1}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") toss(); }}
                />
                <button type="button" className="mouth-btn" onClick={toss} disabled={!name.trim()} tabIndex={face === "buy" ? 0 : -1}>
                  <IPlus style={{ width: 14, height: 14 }} /> Toss in
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
                            <button type="button" className="icon-btn" title="Bump to next" onClick={() => onBump(it.id)}><IArrowDown style={{ width: 14, height: 14 }} /></button>
                            <button type="button" className="icon-btn" title="Discard" onClick={() => onDiscard(it.id)}><IX style={{ width: 14, height: 14 }} /></button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {waiting.length > 0 && <div className="funnel"><IFunnel style={{ width: 22, height: 12 }} /></div>}
                  {tray && (
                    <div className="tray">
                      <div className="tray-label"><ITarget style={{ width: 14, height: 14 }} /> Next to buy</div>
                      <div className="tray-row">
                        <span className="tray-name">{tray.title}</span>
                        <span className="tray-acts">
                          <button type="button" className="btn-ghost" onClick={() => onSkip(tray.id)}>Not yet</button>
                          <button type="button" className="btn-buy" onClick={() => { onBuyBottom(); onToast?.("Bought it. 🎉"); }}>
                            <ICheck style={{ width: 14, height: 14 }} /> Bought
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
          <div
            ref={backRef}
            className={"flip-face flip-back" + (face !== "sell" && !flipping ? " is-hidden" : "")}
            aria-hidden={face !== "sell"}
          >
            <div className="ledger" style={sellH ? { height: sellH } : undefined}>
              <div className="ledger-bar">
                <div className="seg seg--filter">
                  {SALE_FILTERS.map(([id, label]) => {
                    const n = id === "all" ? saleItems.length : id === "sold" ? saleItems.length - liveSales : liveSales;
                    return (
                      <button
                        key={id}
                        type="button"
                        className={"seg-btn seg-btn--" + id + (saleFilter === id ? " on" : "")}
                        onClick={() => setSaleFilter(id)}
                      >
                        {label}<span className="seg-n">{n}</span>
                      </button>
                    );
                  })}
                </div>
                <span className="ledger-bar-meta">{visibleSales.length} shown</span>
              </div>

              <div className="ledger-head">
                <span className="lh-tag"><ITag style={{ width: 12, height: 12 }} /> Item</span>
                <span className="lh-where">Where</span>
                <span className="lh-listed">Listed</span>
                <span className="lh-status">Status</span>
                <span className="lh-price">Price</span>
                <span className="lh-x"></span>
              </div>

              <div className="ledger-body">
                {visibleSales.length === 0 ? (
                  <div className="hopper-empty">
                    <div className="big">{saleFilter === "sold" ? "Nothing sold yet." : "Nothing here."}</div>
                    {saleFilter === "selling" ? "You're all sold out." : "Try another filter."}
                  </div>
                ) : visibleSales.map((s) => (
                  <div
                    key={s.id}
                    className={"sale-row" + (s.status === "sold" ? " is-sold" : "")}
                    role="button"
                    tabIndex={face === "sell" ? 0 : -1}
                    onClick={() => setEditId(s.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditId(s.id); } }}
                    title="Click to edit listing"
                  >
                    <span className="sale-name">
                      {s.name}
                      {s.url ? <ILink className="sale-linked" style={{ width: 12, height: 12, marginLeft: 5, opacity: 0.5 }} /> : null}
                    </span>
                    <span className="sale-where">{s.where}</span>
                    <span className="sale-listed">{fmtShort(s.createdAt)}</span>
                    <span className="sale-status">
                      <button
                        type="button"
                        className={"pill pill--" + s.status}
                        onClick={(e) => { e.stopPropagation(); cycleStatus(s.id); }}
                        title="Click to cycle status"
                        tabIndex={face === "sell" ? 0 : -1}
                      >
                        {s.status}
                      </button>
                    </span>
                    <span className="sale-price">{s.price.toLocaleString("cs-CZ")} {s.unit}</span>
                    <span className="sale-x">
                      {s.status !== "sold" && <button
                        type="button"
                        className="icon-btn"
                        title="Remove"
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(s.id); }}
                        tabIndex={face === "sell" ? 0 : -1}
                      >
                        <IX style={{ width: 14, height: 14 }} />
                      </button>}
                    </span>
                  </div>
                ))}
              </div>

              <div className="ledger-foot">
                <span>{liveSales} listed</span>
                <span className="ledger-total">
                  {saleItems.filter((s) => s.status !== "sold").reduce((a, s) => a + s.price, 0).toLocaleString("cs-CZ")} Kč open
                </span>
              </div>

              <div className="ledger-add">
                <button
                  type="button"
                  className="ledger-add-btn ledger-add-morph"
                  tabIndex={face === "sell" ? 0 : -1}
                  title="Add several listings at once"
                  onClick={() => setBulkOpen(true)}
                >
                  <span className="ledger-add-face ledger-add-face--rest">
                    <IPlus style={{ width: 14, height: 14 }} /> Add listing
                  </span>
                  <span className="ledger-add-face ledger-add-face--hover" aria-hidden="true">
                    <IRows style={{ width: 14, height: 14 }} /> Add multiple
                  </span>
                </button>
              </div>

              <div
                className="ledger-resize"
                title="Drag to resize"
                onPointerDown={onResizeDown}
                onPointerMove={onResizeMove}
                onPointerUp={onResizeUp}
                onPointerCancel={onResizeUp}
              >
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                  <path d="M11 4 4 11M11 8l-3 3"/>
                </svg>
              </div>
            </div>
          </div>

        </div>
      </div>

      {editId && (() => {
        const sale = saleItems.find((s) => s.id === editId);
        if (!sale) return null;
        return (
          <SaleEditor
            key={sale.id}
            sale={sale}
            onSave={updateSale}
            onClose={() => setEditId(null)}
            onDelete={dropSale}
          />
        );
      })()}

      {bulkOpen && (
        <SaleBulkAdd
          onAdd={(out) => {
            // saleItemAdd prepends — add in reverse so the first row ends up on top
            [...out].reverse().forEach((row) => onSaleAdd(row));
            onToast?.(`Added ${out.length} listing${out.length === 1 ? "" : "s"}`);
          }}
          onClose={() => setBulkOpen(false)}
        />
      )}

      {confirmDeleteId && (() => {
        const sale = saleItems.find((s) => s.id === confirmDeleteId);
        const label = sale?.name?.trim() ? `“${sale.name.trim()}”` : "This listing";
        return (
          <div className="sba-veil" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmDeleteId(null); }}>
            <div className="si-leave-card" role="alertdialog" aria-modal="true" aria-label="Remove listing">
              <div className="si-leave-title">Remove this listing?</div>
              <div className="si-leave-body">{label} will be permanently removed from the Selling ledger. This can’t be undone.</div>
              <div className="si-leave-actions">
                <button className="se-btn se-btn--ghost" onClick={() => setConfirmDeleteId(null)} autoFocus>Keep</button>
                <button
                  className="se-btn se-btn--danger"
                  onClick={() => { dropSale(confirmDeleteId); setConfirmDeleteId(null); onToast?.("Listing removed"); }}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
