/* ShELF components — grounded dark */
const { useState, useEffect, useMemo, useRef } = React;

/* ---- icons ---- */
const I = {
  search: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>,
  check: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5"/></svg>,
  link: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>,
  plus: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14"/></svg>,
  chev: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m6 9 6 6 6-6"/></svg>,
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

/* ---- Hopper ---- */
function Hopper({ data }) {
  const [items, setItems] = useState(data.hopper);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [sort, setSort] = useState("newest");

  const toss = () => {
    if (!name.trim()) return;
    setItems((p) => [{ id: "h" + Date.now(), name: name.trim(), next: false }, ...p]);
    setName(""); setUrl(""); setNote("");
  };
  const discard = (id) => setItems((p) => p.filter((x) => x.id !== id));
  const view = sort === "newest" ? items : [...items].slice().reverse();

  return (
    <div className="hopper">
      <div className="hopper-head">
        <h2 className="hopper-title">Hopper</h2>
        <p className="hopper-sub">Toss items in the top. The bottom slot is the next one to buy.</p>
      </div>
      <div className="toss">
        <div className="toss-label">Toss in</div>
        <input className="fld" placeholder="What do you want to buy?" value={name}
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && toss()} />
        <div className="toss-row">
          <input className="fld" placeholder="URL (optional)" value={url} onChange={(e) => setUrl(e.target.value)} />
          <input className="fld" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="toss-btn" onClick={toss} disabled={!name.trim()}>Toss in</button>
        </div>
      </div>
      <div className="stack-head">
        <span className="stack-label">Stack ({items.length})</span>
        <div className="stack-sort">
          <button className={sort === "newest" ? "on" : ""} onClick={() => setSort("newest")}>newest first</button>
          <button className={sort === "oldest" ? "on" : ""} onClick={() => setSort("oldest")}>oldest first</button>
        </div>
      </div>
      <div className="stack-list">
        {view.map((it) => (
          <div className={"stack-item" + (it.next ? " stack-item--next" : "")} key={it.id}>
            {it.next ? <span className="stack-badge">NEXT</span> : null}
            <span className="stack-name">{it.name}</span>
            <div className="stack-actions">
              <button className="mini-btn" onClick={() => discard(it.id)}>Discard</button>
              <button className="mini-btn mini-btn--buy" onClick={() => discard(it.id)}>Bought</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="folder-empty" style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-inner)" }}>Hopper is empty — toss something in.</div>}
      </div>
    </div>
  );
}

Object.assign(window, { I, Favicon, Pillar, PromptCard, FolderCard, GoalCard, Hopper });
