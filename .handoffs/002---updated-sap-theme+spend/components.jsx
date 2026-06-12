/* ShELF — shell components for the standalone prototype.
   Pillar (sidebar) · PromptCard · FolderCard · GoalCard · Hopper · Favicon · I (icons).
   Markup matches the class vocabulary in styles.css. Exports to window for the host. */

const { useState, useRef } = React;

/* ---------- icon set (named I; strategie.jsx uses its own SI) ---------- */
const I = {
  search: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>,
  plus: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14"/></svg>,
  check: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5"/></svg>,
  x: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 6 6 18M6 6l12 12"/></svg>,
  trash: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14"/></svg>,
  link: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/></svg>,
  down: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m6 9 6 6 6-6"/></svg>,
};

/* ---------- favicon → deterministic monogram chip (offline-safe) ---------- */
const FAV_HUES = ["--hue-green", "--hue-blue", "--hue-purple", "--hue-orange", "--hue-rose", "--hue-zinc"];
function favHue(host) {
  let h = 0;
  for (let i = 0; i < host.length; i++) h = (h * 31 + host.charCodeAt(i)) >>> 0;
  return "var(" + FAV_HUES[h % FAV_HUES.length] + ")";
}
const FAV_SIZE = { "bm-fav": 11, "result-fav": 13, "pin-ico": 17 };
function Favicon({ host, cls }) {
  const clean = (host || "?").replace(/^www\./, "");
  const letter = clean.charAt(0).toUpperCase() || "?";
  const hue = favHue(clean);
  return (
    <span className={cls}>
      <span style={{
        width: "100%", height: "100%", display: "grid", placeItems: "center",
        borderRadius: "inherit", fontFamily: "var(--mono)", fontWeight: 600,
        fontSize: (FAV_SIZE[cls] || 12) + "px", lineHeight: 1,
        background: "color-mix(in srgb, " + hue + " 20%, transparent)", color: hue,
      }}>{letter}</span>
    </span>
  );
}

/* ---------- Pillar (sidebar) ---------- */
function Pin({ pin, dragProps, dragging, onRemove }) {
  return (
    <div className={"pin" + (dragging ? " is-dragging" : "")} {...dragProps}>
      <div className="pin-grip"><span></span><span></span><span></span></div>
      <Favicon host={pin.host} cls="pin-ico" />
      <div className="pin-meta">
        <a className="pin-title" href={pin.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{pin.title}</a>
        <span className="pin-url">{pin.host}</span>
      </div>
      <button className="pin-remove" onClick={onRemove} aria-label="Remove pin">Unpin</button>
    </div>
  );
}

function Todo({ todo, onToggle, onRemove }) {
  const cls = "todo" + (todo.done ? " todo--done" : todo.focus ? " todo--focus" : "");
  return (
    <div className={cls}>
      <button className={"cbox" + (todo.done ? " cbox--on" : "")} onClick={onToggle} aria-label="Toggle done">
        {todo.done && <I.check />}
      </button>
      <div className="todo-main">
        <div className="todo-row">
          <span className="todo-title">{todo.title}</span>
          {todo.link && <a className="todo-link" href={todo.link} target="_blank" rel="noreferrer"><I.link /></a>}
        </div>
        {todo.sub && <div className="todo-sub">{todo.sub}</div>}
        {todo.tag && <span className={"todo-tag tag--" + (todo.tagType || "violet")}>{todo.tag}</span>}
      </div>
      <button className="todo-x" onClick={onRemove} aria-label="Delete task"><I.x /></button>
    </div>
  );
}

function Pillar({ data, todos, setTodos, onToast }) {
  const [pins, setPins] = useState(data.pins);
  const [draft, setDraft] = useState("");
  const pinSort = useSortable(pins, setPins, (p) => p.host + p.title);

  const open = todos.filter((t) => !t.done).length;

  const addTodo = () => {
    const title = draft.trim();
    if (!title) return;
    setTodos((prev) => [{ id: "t" + Date.now(), title }, ...prev]);
    setDraft("");
    onToast && onToast("Task added");
  };
  const toggle = (id) => {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
    const t = todos.find((x) => x.id === id);
    if (t && !t.done) onToast && onToast("Nice — one off the list");
  };
  const removeTodo = (id) => setTodos((prev) => prev.filter((t) => t.id !== id));

  return (
    <aside className="pillar">
      <div className="pillar-head">
        <div className="eyebrow">Your shelf</div>
        <h2 className="pillar-name">{data.shelfName}</h2>
      </div>
      <div className="pillar-body">
        <div className="zone">
          <div className="zone-head">
            <span className="zone-title">Top 6</span>
            <span className="zone-hint">drag to reorder</span>
          </div>
          <div className="pin-stack" ref={pinSort.ref}>
            {pins.map((p) => {
              const key = p.host + p.title;
              return (
                <Pin key={key} pin={p} dragProps={pinSort.bind(key)} dragging={pinSort.dragKey === key}
                  onRemove={() => setPins((prev) => prev.filter((x) => x.host + x.title !== key))} />
              );
            })}
          </div>
        </div>

        <div className="zone">
          <div className="zone-head">
            <span className="zone-title">Todo</span>
            <span className="zone-hint">{open} open</span>
          </div>
          <div className="todo-add">
            <input className="fld" placeholder="Add a task…" value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addTodo(); }} />
          </div>
          <div className="todo-list">
            {todos.map((t) => (
              <Todo key={t.id} todo={t} onToggle={() => toggle(t.id)} onRemove={() => removeTodo(t.id)} />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ---------- Prompt library card ---------- */
function PromptCard({ data, onToast }) {
  const prompts = data.prompts || [];
  const copy = (p) => {
    const text = (p.sys ? p.sys + "\n" : "") + p.body;
    try { navigator.clipboard && navigator.clipboard.writeText(text); } catch (_) {}
    onToast && onToast("Copied “" + p.name + "”");
  };
  return (
    <div className="prompt-card">
      <div className="prompt-top">
        <div>
          <div className="prompt-eyebrow">Prompt library</div>
          <h3 className="prompt-title">Saved prompts</h3>
        </div>
        <div className="prompt-tools">
          <span className="prompt-count">{prompts.length} prompts</span>
          <button className="prompt-add" onClick={() => onToast && onToast("Prompt editor lives in the full app")}>+ New prompt</button>
        </div>
      </div>
      <div className="prompt-grid">
        {prompts.map((p, i) => (
          <div className="prompt" key={i} onClick={() => copy(p)}>
            <div className="prompt-h">
              <span className="prompt-name">{p.name}</span>
              <span className="prompt-copy">Click to copy</span>
            </div>
            <div className="prompt-body">{p.sys && <span className="tok-sys">{p.sys} </span>}{p.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Folder card ---------- */
function FolderCard({ folder, dragProps, dragging }) {
  const count = folder.bookmarks.filter((b) => !b.sep).length;
  return (
    <div className={"folder" + (dragging ? " is-dragging" : "")} style={{ "--hue": folder.hue || "var(--hue-zinc)" }}>
      <div className="folder-head" {...dragProps}>
        <div className="folder-grip"><span></span><span></span><span></span><span></span></div>
        <span className="folder-title">{folder.title}</span>
        <span className="folder-count">{count}</span>
      </div>
      <div className="folder-body">
        {folder.bookmarks.length === 0 && <div className="folder-empty">Empty folder</div>}
        {folder.bookmarks.map((b, i) =>
          b.sep ? (
            <div className="bm-sep" key={i}></div>
          ) : (
            <a className="bm" key={i} href={b.url} target="_blank" rel="noreferrer">
              <Favicon host={b.host} cls="bm-fav" />
              <span className="bm-title">{b.title}</span>
            </a>
          )
        )}
      </div>
    </div>
  );
}

/* ---------- Goal card ---------- */
function GoalCard({ goal }) {
  if (!goal) return null;
  return (
    <div className="goal">
      <div className="goal-eyebrow">{goal.eyebrow}</div>
      <div className="goal-title">{goal.title}</div>
      <div className="goal-bar"><div className="goal-fill" style={{ width: goal.pct + "%" }}></div></div>
      <div className="goal-foot">
        <button className="goal-cta">{goal.cta}</button>
        <span className="goal-pct">{goal.pct}%</span>
      </div>
    </div>
  );
}

/* ---------- Hopper view (gravity chute) ---------- */
function Hopper({ data, onToast }) {
  const [items, setItems] = useState(data.hopper || []);
  const [val, setVal] = useState("");

  const add = () => {
    const name = val.trim();
    if (!name) return;
    setItems((prev) => [{ name }, ...prev]);   // toss in at the top
    setVal("");
    onToast && onToast("Tossed in “" + name + "”");
  };
  const removeAt = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const bottomIdx = items.length - 1;
  const bottom = items[bottomIdx];
  const queue = items.slice(0, -1);

  const buy = () => { onToast && onToast("Bought “" + bottom.name + "” ✓"); removeAt(bottomIdx); };
  const discard = () => { onToast && onToast("Set aside “" + bottom.name + "”"); removeAt(bottomIdx); };

  return (
    <div className="hopper">
      <div className="hopper-head">
        <div>
          <h2 className="hopper-title">Hopper</h2>
          <p className="hopper-sub">Toss in anything you might buy. It falls to the bottom — you only ever decide on the next one.</p>
        </div>
        <div className="hopper-count"><b>{items.length}</b><span>in queue</span></div>
      </div>
      <div className="chute">
        <div className="mouth">
          <input className="fld" placeholder="Add something to consider…" value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
          <button className="mouth-btn" onClick={add} disabled={!val.trim()}><I.plus /> Toss in</button>
        </div>

        {queue.length > 0 && (
          <div className="queue">
            {queue.map((it, i) => (
              <div className="puck" key={i}>
                <span className="puck-pos">{i + 1}</span>
                <span className="puck-name">{it.name}</span>
                <div className="puck-acts">
                  <button className="icon-btn" onClick={() => removeAt(i)} aria-label="Remove"><I.trash /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="funnel"><I.down /></div>

        {bottom ? (
          <div className="tray">
            <div className="tray-label"><I.down /> Next to buy</div>
            <div className="tray-row">
              <span className="tray-name">{bottom.name}</span>
              <div className="tray-acts">
                <button className="btn-ghost" onClick={discard}>Not now</button>
                <button className="btn-buy" onClick={buy}><I.check /> Bought it</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="hopper-empty"><div className="big">Hopper's empty.</div>Toss something in above.</div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { I, Favicon, Pillar, PromptCard, FolderCard, GoalCard, Hopper });
