/* ShELF components — grounded dark */
const { useState, useEffect, useLayoutEffect, useMemo, useRef } = React;

/* ---- icons ---- */
const I = {
  search: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>,
  check: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5"/></svg>,
  link: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>,
  plus: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14"/></svg>,
  chev: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m6 9 6 6 6-6"/></svg>,
  arrowDown: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 5v14M19 12l-7 7-7-7"/></svg>,
  x: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}><path d="M6 6l12 12M18 6 6 18"/></svg>,
  funnel: (p) => <svg viewBox="0 0 26 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M2 2h22M6 7h14M10 12h6"/></svg>,
  target: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>,
  flip: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>,
  tag: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20.6 13.4 13 21a2 2 0 0 1-2.8 0l-7-7a2 2 0 0 1 0-2.8L10.6 3.6A2 2 0 0 1 12 3h6a2 2 0 0 1 2 2v6a2 2 0 0 1-.4 1.4Z"/><circle cx="16" cy="8" r="1.3" fill="currentColor" stroke="none"/></svg>,
  box: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>,
  external: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>,
  clock: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  trash: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>,
};

function Favicon({ host, cls = "bm-fav" }) {
  const [err, setErr] = useState(false);
  if (err) {
    const hue = window.hueFromString(host || "?");
    const letter = (host || "?").replace(/^www\./, "")[0].toUpperCase();
    return (
      <span className={cls} style={{ background: "hsl(" + hue + " 42% 42%)" }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ display: "block" }}>
          <text x="50" y="52" dominantBaseline="central" textAnchor="middle" fontSize="58" fontWeight="700" fontFamily="var(--font)" fill="#fff">{letter}</text>
        </svg>
      </span>
    );
  }
  return (
    <span className={cls}>
      <img src={window.favicon(host)} alt="" onError={() => setErr(true)} />
    </span>
  );
}

/* ---- Pillar ---- */
function Pillar({ data, todos, setTodos, onToast }) {
  const [draft, setDraft] = useState("");
  const [sub, setSub] = useState("");
  const [pins, setPins] = useState(data.pins);
  const pinSort = window.useSortable(pins, setPins, (p) => p.id);

  const addTask = () => {
    const v = draft.trim();
    if (!v) return;
    setTodos((p) => [{ id: "t" + Date.now(), title: v, sub: sub.trim(), done: false, focus: false }, ...p]);
    setDraft(""); setSub("");
  };
  const toggle = (id) => setTodos((p) => p.map((t) => {
    if (t.id !== id) return t;
    if (!t.done) onToast("Nice — one down.");
    return { ...t, done: !t.done };
  }));
  const remove = (id) => setTodos((p) => p.filter((t) => t.id !== id));

  return (
    <aside className="pillar">
      <div className="pillar-head">
        <div className="eyebrow">Pillar</div>
        <h1 className="pillar-name">{data.shelfName}</h1>
      </div>
      <div className="pillar-body">
        <div className="zone">
          <div className="zone-head">
            <span className="zone-title">Top 6</span>
            <span className="zone-hint">Drop bookmarks here</span>
          </div>
          <div className="pin-stack" ref={pinSort.ref}>
            {pins.map((p) => (
              <div className={"pin" + (pinSort.dragKey === p.id ? " is-dragging" : "")} key={p.id} {...pinSort.bind(p.id)}>
                <span className="pin-grip" aria-hidden="true"><span></span><span></span><span></span></span>
                <span className="pin-ico"><Favicon host={p.host} cls="" /></span>
                <span className="pin-meta">
                  <span className="pin-title">{p.title}</span>
                  <span className="pin-url">{p.url.replace(/^https?:\/\//, "")}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="zone">
          <div className="zone-head"><span className="zone-title">Todo</span></div>
          <div className="todo-add">
            <input className="fld" placeholder="Add a task…" value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()} />
            <input className="fld fld--sub" placeholder="Subtitle (optional)" value={sub}
              onChange={(e) => setSub(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()} />
          </div>
          <div className="todo-list">
            {todos.map((t) => (
              <div key={t.id}
                className={"todo" + (t.focus ? " todo--focus" : "") + (t.done ? " todo--done" : "")}>
                <button className={"cbox" + (t.done ? " cbox--on" : "")} onClick={() => toggle(t.id)} aria-label="toggle">
                  {t.done && <I.check />}
                </button>
                <div className="todo-main">
                  <div className="todo-row">
                    <span className="todo-title">{t.title}</span>
                    {t.link && <span className="todo-link"><I.link style={{ width: 13, height: 13 }} /></span>}
                    <button className="todo-x" onClick={() => remove(t.id)}>✕</button>
                  </div>
                  {t.tag
                    ? <div><span className={"todo-tag tag--" + t.tagClass}>{t.tag}</span>{t.sub ? <span className="todo-sub" style={{ marginLeft: 8, display: "inline" }}>{t.sub}</span> : null}</div>
                    : (t.sub ? <div className="todo-sub">{t.sub}</div> : null)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ---- Prompt Library ---- */
function PromptCard({ data, onToast }) {
  const [rows, setRows] = useState("One Row");
  const copy = (p) => { try { navigator.clipboard.writeText(p.full); } catch (e) {} onToast("Copied “" + p.name + "”"); };
  return (
    <section className="prompt-card">
      <div className="prompt-top">
        <div>
          <div className="prompt-eyebrow">Prompt Library</div>
          <h2 className="prompt-title">Prompt library</h2>
        </div>
        <div className="prompt-tools">
          <span className="prompt-rows-sel">
            Visible rows
            <button className="pill" onClick={() => setRows((r) => r === "One Row" ? "Two Rows" : "One Row")}>
              {rows} <I.chev style={{ width: 13, height: 13 }} />
            </button>
          </span>
          <span className="prompt-count">{data.prompts.length} saved</span>
          <button className="prompt-add">+ Prompt</button>
        </div>
      </div>
      <div className="prompt-grid">
        {data.prompts.map((p) => (
          <div className="prompt" key={p.id} onClick={() => copy(p)}>
            <div className="prompt-h">
              <span className="prompt-name">{p.name}</span>
              <span className="prompt-copy">Click to copy</span>
            </div>
            <div className="prompt-body">
              {p.lines.map((l, i) => (
                <div key={i}>{l.sys ? <span className="tok-sys">{l.sys}</span> : null}{l.rest}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---- Folder + Goal ---- */
function FolderCard({ folder, dragProps = {}, dragging = false }) {
  const count = folder.bookmarks.filter((b) => !b.sep).length;
  return (
    <div className={"folder" + (dragging ? " is-dragging" : "")} style={{ "--hue": folder.hue }} {...dragProps}>
      <div className="folder-head">
        <span className="folder-grip" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span></span>
        <span className="folder-title">{folder.title}</span>
        <span className="folder-count">{count}</span>
      </div>
      <div className="folder-body">
        {folder.bookmarks.length === 0 && <div className="folder-empty">Empty folder</div>}
        {folder.bookmarks.map((b, i) => {
          if (b.sep) return <div className="bm-sep" key={i} />;
          if (b.big) return (
            <a className="bm-big" key={i} href={b.url} target="_blank" rel="noreferrer">
              <span className="bm-big-thumb" style={{ background: b.color }}>{b.initials}</span>
              <span className="bm-big-meta">
                <span className="bm-big-title">{b.title}</span>
                <span className="bm-big-url">{b.url.replace(/^https?:\/\//, "")}</span>
              </span>
            </a>
          );
          return (
            <a className="bm" key={i} href={b.url} target="_blank" rel="noreferrer">
              <Favicon host={b.host} />
              <span className="bm-title">{b.title}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function GoalCard({ goal }) {
  return (
    <div className="goal">
      <div>
        <div className="goal-eyebrow">{goal.eyebrow}</div>
        <div className="goal-title" style={{ marginTop: 6 }}>{goal.title}</div>
      </div>
      <div className="goal-bar"><div className="goal-fill" style={{ width: goal.pct + "%" }} /></div>
      <div className="goal-foot">
        <button className="goal-cta">{goal.cta}</button>
        <span className="goal-pct">{goal.pct}%</span>
      </div>
    </div>
  );
}

/* ---- Hopper — gravity chute, flips to a Selling ledger ---- */

/* date helpers for the selling ledger */
const SALE_STATUS = ["listed", "reserved", "sold"];
const fmtD = (iso) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const fmtDT = (iso) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : "—");
const fmtShort = (iso) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—");
const saleHost = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch (_) { return url; } };

/* the edit "table" — opens when you click a listing */
function SaleEditor({ sale, onSave, onClose, onDelete }) {
  const [draft, setDraft] = useState({
    name: sale.name, url: sale.url || "", where: sale.where || "", price: sale.price, status: sale.status,
  });
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const dirty =
    draft.name !== sale.name || draft.url !== (sale.url || "") || draft.where !== (sale.where || "") ||
    Number(draft.price) !== sale.price || draft.status !== sale.status;

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
            <span className="sm-eyebrow"><I.tag /> Edit listing</span>
            <input className="sm-name" value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Item name" autoFocus />
          </div>
          <button className="icon-btn sm-close" onClick={onClose} title="Close (Esc)"><I.x /></button>
        </div>

        <div className="sm-body">
          <label className="sm-field sm-field--full">
            <span className="sm-label">Listing URL</span>
            <div className="sm-url">
              <input className="fld" value={draft.url} onChange={(e) => set("url", e.target.value)} placeholder="https://…  where you're selling it" />
              <a className={"sm-open" + (draft.url ? "" : " is-off")} href={draft.url || undefined} target="_blank" rel="noreferrer"
                title={draft.url ? "Open listing" : "Add a URL first"} onClick={(e) => { if (!draft.url) e.preventDefault(); }}>
                <I.external /> Open
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
              <div className="sm-price"><input className="fld" type="number" min="0" value={draft.price} onChange={(e) => set("price", e.target.value)} /><span className="sm-unit">{sale.unit}</span></div>
            </label>
          </div>

          <div className="sm-field">
            <span className="sm-label">Status</span>
            <div className="sm-seg">
              {SALE_STATUS.map((st) => (
                <button key={st} className={"sm-seg-btn sm-seg-btn--" + st + (draft.status === st ? " on" : "")} onClick={() => set("status", st)}>{st}</button>
              ))}
            </div>
          </div>

          <div className="sm-meta">
            <div className="sm-meta-cell"><span className="sm-meta-k">Created</span><span className="sm-meta-v">{fmtD(sale.createdAt)}</span></div>
            <div className="sm-meta-cell"><span className="sm-meta-k">Updated</span><span className="sm-meta-v">{fmtD(sale.updatedAt)}</span></div>
            <div className="sm-meta-cell"><span className="sm-meta-k">Sold</span><span className={"sm-meta-v" + (sale.soldAt ? " is-sold" : "")}>{sale.soldAt ? fmtD(sale.soldAt) : "—"}</span></div>
          </div>

          <div className="sm-hist">
            <div className="sm-hist-label"><I.clock /> History</div>
            <ol className="sm-hist-list">
              {(sale.history || []).map((h, i) => (
                <li className="sm-hist-row" key={i}>
                  <span className="sm-hist-dot"></span>
                  <span className="sm-hist-text">{h.text}</span>
                  <time className="sm-hist-time">{fmtDT(h.at)}</time>
                </li>
              ))}
              {(!sale.history || sale.history.length === 0) && <li className="sm-hist-empty">No changes logged yet.</li>}
            </ol>
          </div>
        </div>

        <div className="sm-foot">
          <button className="sm-del" onClick={() => onDelete(sale.id)}><I.trash /> Delete</button>
          <div className="sm-foot-r">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-buy" disabled={!dirty} onClick={() => { onSave(sale.id, draft); onClose(); }}><I.check /> Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hopper({ data, onToast, selling: sellingProp, setSelling: setSellingProp }) {
  const [items, setItems] = useState(data.hopper.map((h) => ({ id: h.id, name: h.name })));
  const [name, setName] = useState("");
  const [face, setFace] = useState("buy");                       // buy | sell
  const [sellingLocal, setSellingLocal] = useState((data.selling || []).map((s) => ({ ...s })));
  const selling = sellingProp || sellingLocal;
  const setSelling = setSellingProp || setSellingLocal;
  const [sceneH, setSceneH] = useState(null);
  const [flipping, setFlipping] = useState(false);
  const [editId, setEditId] = useState(null);
  const [saleFilter, setSaleFilter] = useState("selling");        // selling | all | sold
  const [sellW, setSellW] = useState(940);
  const [sellH, setSellH] = useState(null);
  const [resizing, setResizing] = useState(false);
  const flipTimer = useRef(null);
  const resz = useRef(null);

  const frontRef = useRef(null);
  const backRef = useRef(null);

  const toss = () => {
    if (!name.trim()) return;
    setItems((p) => [{ id: "h" + Date.now(), name: name.trim() }, ...p]);
    setName("");
  };
  const discard = (id) => setItems((p) => p.filter((x) => x.id !== id));
  const bump = (id) => setItems((p) => { const it = p.find((x) => x.id === id); return [...p.filter((x) => x.id !== id), it]; });
  const skip = (id) => setItems((p) => { const it = p.find((x) => x.id === id); return [it, ...p.filter((x) => x.id !== id)]; });
  const bought = (id) => { discard(id); onToast && onToast("Bought it. 🎉"); };

  /* central updater: diffs the patch, logs each change to history, stamps dates */
  const updateSale = (id, patch) => setSelling((p) => p.map((s) => {
    if (s.id !== id) return s;
    const now = new Date().toISOString().slice(0, 19);
    const money = (v) => Number(v).toLocaleString("cs-CZ");
    const changes = [];
    if (patch.name !== undefined && patch.name.trim() && patch.name !== s.name) changes.push(`Renamed → “${patch.name}”`);
    if (patch.where !== undefined && patch.where !== (s.where || "")) changes.push(`Where ${s.where || "—"} → ${patch.where || "—"}`);
    if (patch.url !== undefined && patch.url !== (s.url || "")) changes.push(patch.url ? `Listing link → ${saleHost(patch.url)}` : "Listing link removed");
    if (patch.price !== undefined && Number(patch.price) !== s.price) changes.push(`Price ${money(s.price)} → ${money(patch.price)} Kč`);
    if (patch.status !== undefined && patch.status !== s.status) changes.push(`Status ${s.status} → ${patch.status}`);
    if (!changes.length) return s;
    const next = { ...s, ...patch };
    if (patch.price !== undefined) next.price = Number(patch.price) || 0;
    if (patch.name !== undefined) next.name = patch.name.trim() || s.name;
    next.updatedAt = now;
    if (patch.status === "sold" && s.status !== "sold") next.soldAt = now;
    else if (patch.status !== undefined && patch.status !== "sold") next.soldAt = null;
    next.history = [...changes.map((text) => ({ at: now, text })), ...(s.history || [])];
    return next;
  }));

  const cycleStatus = (id) => {
    const s = selling.find((x) => x.id === id);
    if (!s) return;
    updateSale(id, { status: SALE_STATUS[(SALE_STATUS.indexOf(s.status) + 1) % SALE_STATUS.length] });
  };
  const dropSale = (id) => { setSelling((p) => p.filter((x) => x.id !== id)); setEditId(null); };

  const tray = items[items.length - 1];
  const waiting = items.slice(0, -1);

  /* keep the 3D scene as tall as whichever face is showing */
  useLayoutEffect(() => {
    const el = face === "buy" ? frontRef.current : backRef.current;
    if (el) setSceneH(el.offsetHeight);
  }, [face, items, selling, sellH, sellW, saleFilter]);

  const flip = () => {
    setFace((f) => (f === "buy" ? "sell" : "buy"));
    setFlipping(true);
    clearTimeout(flipTimer.current);
    flipTimer.current = setTimeout(() => setFlipping(false), 640);
  };
  useEffect(() => () => clearTimeout(flipTimer.current), []);

  const liveSales = selling.filter((s) => s.status !== "sold").length;

  /* filter: selling = not sold, sold = sold only, all = everything */
  const visibleSales = selling.filter((s) =>
    saleFilter === "all" ? true : saleFilter === "sold" ? s.status === "sold" : s.status !== "sold"
  );
  const SALE_FILTERS = [["selling", "Selling"], ["all", "All"], ["sold", "Sold"]];

  /* window-style resize from the bottom-right grip */
  const onResizeDown = (e) => {
    e.preventDefault(); e.stopPropagation();
    const ledger = e.currentTarget.parentElement;
    const avail = ledger.closest(".canvas-inner")?.clientWidth || window.innerWidth - 380;
    resz.current = { sx: e.clientX, sy: e.clientY, w: ledger.offsetWidth, h: ledger.offsetHeight, maxW: avail };
    setResizing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e) => {
    if (!resz.current) return;
    const r = resz.current;
    setSellW(Math.max(560, Math.min(r.maxW, r.w + (e.clientX - r.sx))));
    setSellH(Math.max(280, r.h + (e.clientY - r.sy)));
  };
  const onResizeUp = (e) => {
    if (!resz.current) return;
    resz.current = null; setResizing(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
  };

  return (
    <div className={"hopper" + (face === "sell" ? " hopper--sell" : "") + (resizing ? " is-resizing" : "")}
      style={{ width: face === "buy" ? 600 : sellW }}>
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
          <button className={"flip-btn" + (face === "sell" ? " flipped" : "")} onClick={flip}
            title={face === "buy" ? "Flip to what you're selling" : "Flip back to the hopper"}>
            <I.flip />
          </button>
          <div className="hopper-count">
            <b>{face === "buy" ? items.length : liveSales}</b>
            <span>{face === "buy" ? "in line" : "on sale"}</span>
          </div>
        </div>
      </div>

      <div className="flip-scene" style={sceneH ? { height: sceneH } : null}>
        <div className={"flipper" + (face === "sell" ? " is-flipped" : "")}>

          {/* ---- FRONT: the buying chute ---- */}
          <div className={"flip-face flip-front" + (face !== "buy" && !flipping ? " is-hidden" : "")} ref={frontRef} aria-hidden={face !== "buy"}>
            <div className="chute">
              <div className="mouth">
                <input className="fld" placeholder="What do you want to buy?" value={name} tabIndex={face === "buy" ? 0 : -1}
                  onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && toss()} />
                <button className="mouth-btn" onClick={toss} disabled={!name.trim()} tabIndex={face === "buy" ? 0 : -1}><I.plus /> Toss in</button>
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

          {/* ---- BACK: the selling ledger ---- */}
          <div className={"flip-face flip-back" + (face !== "sell" && !flipping ? " is-hidden" : "")} ref={backRef} aria-hidden={face !== "sell"}>
            <div className="ledger" style={sellH ? { height: sellH } : null}>
              <div className="ledger-bar">
                <div className="seg seg--filter">
                  {SALE_FILTERS.map(([id, label]) => {
                    const n = id === "all" ? selling.length : id === "sold" ? selling.length - liveSales : liveSales;
                    return (
                      <button key={id} className={"seg-btn seg-btn--" + id + (saleFilter === id ? " on" : "")}
                        onClick={() => setSaleFilter(id)}>{label}<span className="seg-n">{n}</span></button>
                    );
                  })}
                </div>
                <span className="ledger-bar-meta">{visibleSales.length} shown</span>
              </div>
              <div className="ledger-head">
                <span className="lh-tag"><I.tag /> Item</span>
                <span className="lh-where">Where</span>
                <span className="lh-listed">Listed</span>
                <span className="lh-status">Status</span>
                <span className="lh-price">Price</span>
                <span className="lh-x"></span>
              </div>
              <div className="ledger-body">
                {visibleSales.length === 0 ? (
                  <div className="hopper-empty"><div className="big">{saleFilter === "sold" ? "Nothing sold yet." : "Nothing here."}</div>{saleFilter === "selling" ? "You're all sold out." : "Try another filter."}</div>
                ) : visibleSales.map((s) => (
                  <div className={"sale-row" + (s.status === "sold" ? " is-sold" : "")} key={s.id}
                    role="button" tabIndex={face === "sell" ? 0 : -1}
                    onClick={() => setEditId(s.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditId(s.id); } }}
                    title="Click to edit listing">
                    <span className="sale-name">{s.name}{s.url ? <I.link className="sale-linked" /> : null}</span>
                    <span className="sale-where">{s.where}</span>
                    <span className="sale-listed">{fmtShort(s.createdAt)}</span>
                    <span className="sale-status">
                      <button className={"pill pill--" + s.status} onClick={(e) => { e.stopPropagation(); cycleStatus(s.id); }} title="Click to cycle status">{s.status}</button>
                    </span>
                    <span className="sale-price">{s.price.toLocaleString("cs-CZ")} {s.unit}</span>
                    <span className="sale-x"><button className="icon-btn" title="Remove" onClick={(e) => { e.stopPropagation(); dropSale(s.id); }} tabIndex={face === "sell" ? 0 : -1}><I.x /></button></span>
                  </div>
                ))}
              </div>
              <div className="ledger-foot">
                <span>{liveSales} listed</span>
                <span className="ledger-total">{selling.filter((s) => s.status !== "sold").reduce((a, s) => a + s.price, 0).toLocaleString("cs-CZ")} Kč open</span>
              </div>
              <div className="ledger-resize" title="Drag to resize"
                onPointerDown={onResizeDown} onPointerMove={onResizeMove} onPointerUp={onResizeUp} onPointerCancel={onResizeUp}>
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M11 4 4 11M11 8l-3 3"/></svg>
              </div>
            </div>
          </div>

        </div>
      </div>

      {editId && (() => {
        const sale = selling.find((s) => s.id === editId);
        if (!sale) return null;
        return <SaleEditor key={sale.id} sale={sale} onSave={updateSale} onClose={() => setEditId(null)} onDelete={dropSale} />;
      })()}
    </div>
  );
}

Object.assign(window, { I, Favicon, Pillar, PromptCard, FolderCard, GoalCard, Hopper });
