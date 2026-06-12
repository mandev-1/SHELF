/* ShELF — LadderDetail modal. Port of src/components/Strategie/LadderDetail.tsx. */

const LD_MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtLdDate(s) {
  const [y, m, d] = (s || "").split("-").map(Number);
  if (!y) return "";
  if (!d) return LD_MONTH_ABBR[(m || 1) - 1] + " " + y;
  return LD_MONTH_ABBR[(m || 1) - 1] + " " + d + ", " + y;
}

function LadderDetail({ rung, currency, totalSteps, directory, persistedRows, onSetRungAccounts, onUpsertAccountDictEntry, onClose }) {
  const { useState, useEffect, useCallback, useMemo } = React;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState([]);

  const displayRows = useMemo(() => {
    if (persistedRows) {
      return persistedRows.map((p) => {
        const d = directory.find((x) => x.name === p.accountRef);
        return { name: p.accountRef, tag: d ? d.tag : "", url: d ? d.url : undefined, balance: p.balance };
      });
    }
    return (rung.accounts || []).map((a) => ({ name: a.name, tag: a.tag, url: undefined, balance: a.balance }));
  }, [persistedRows, directory, rung]);

  const startEdit = useCallback(() => {
    setDraft(displayRows.map((r) => ({ name: r.name, tag: r.tag, url: r.url || "", balance: r.balance })));
    setEditing(true);
  }, [displayRows]);

  const cancelEdit = useCallback(() => { setEditing(false); setDraft([]); }, []);

  const saveEdit = useCallback(() => {
    const cleaned = draft
      .map((r) => ({ ...r, name: r.name.trim() }))
      .filter((r) => r.name.length > 0);
    for (const r of cleaned) {
      onUpsertAccountDictEntry({ name: r.name, tag: r.tag.trim(), url: r.url.trim() || undefined });
    }
    onSetRungAccounts(rung.id, cleaned.map((r) => ({ accountRef: r.name, balance: Number.isFinite(r.balance) ? r.balance : 0 })));
    setEditing(false);
    setDraft([]);
  }, [draft, onSetRungAccounts, onUpsertAccountDictEntry, rung.id]);

  useEffect(() => {
    const h = (e) => {
      if (e.key !== "Escape") return;
      if (editing) { cancelEdit(); return; }
      onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [editing, cancelEdit, onClose]);

  const f = (v) => window.fmtMoney(v, currency);
  const statusLabel = rung.status === "done" ? "Funded" : rung.status === "active" ? "In progress" : "Not started yet";
  const total = displayRows.reduce((a, x) => a + (x.balance || 0), 0);
  const pctOfTarget = rung.target ? Math.min(100, Math.round((total / rung.target) * 100)) : null;

  const onDraftName = (idx, name) => {
    setDraft((prev) => {
      const next = [...prev];
      const row = { ...next[idx], name };
      const hit = directory.find((d) => d.name === name);
      if (hit) {
        if (!row.tag) row.tag = hit.tag;
        if (!row.url) row.url = hit.url || "";
      }
      next[idx] = row;
      return next;
    });
  };

  return (
    <div className="ld-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ld-modal" role="dialog" aria-modal="true" aria-label={rung.title}
        style={{ "--step-hue": rung.hue || "var(--accent)" }}>
        <div className="ld-hero">
          <div className="ld-hero-wash" aria-hidden="true"></div>
          <div className="ld-hero-ghost" aria-hidden="true"><RungIcon icon={rung.icon} /></div>
          <button className="ld-close" onClick={onClose} aria-label="Close"><IcoX /></button>
          <div className="ld-hero-row">
            <span className="ld-hero-badge"><RungIcon icon={rung.icon} /></span>
            <span className={"ld-status ld-status--" + rung.status}>
              {rung.status === "done" ? <IcoCheck /> : rung.status === "queued" ? <IcoLock /> : <IcoClock />}
              {statusLabel}{rung.status === "active" && typeof rung.pct === "number" ? " · " + rung.pct + "%" : ""}
            </span>
          </div>
          <div className="ld-hero-foot">
            <span className="ld-step">Step {rung.id} of {totalSteps}</span>
            <h2 className="ld-title">{rung.title}</h2>
          </div>
        </div>

        <div className="ld-body">
          {rung.blurb && <p className="ld-blurb">{rung.blurb}</p>}

          <div className="ld-sec-head">
            <h3 className="ld-sec-title">Where the money sits</h3>
            <div className="ld-sec-actions">
              {!editing && displayRows.length > 0 && <span className="ld-sec-total">{f(total)}</span>}
              {!editing ? (
                <button className="ld-edit-btn" onClick={startEdit} aria-label="Edit accounts">
                  <IcoPencil />{displayRows.length > 0 ? "Edit" : "Add"}
                </button>
              ) : (
                <div className="ld-edit-actions">
                  <button className="ld-edit-btn ld-edit-btn--ghost" onClick={cancelEdit}>Cancel</button>
                  <button className="ld-edit-btn ld-edit-btn--primary" onClick={saveEdit}>Save</button>
                </div>
              )}
            </div>
          </div>

          {!editing && (
            displayRows.length > 0 ? (
              <div className="ld-accts">
                {displayRows.map((a, i) => (
                  <div className="ld-acct" key={i}>
                    <span className="ld-acct-dot"></span>
                    <span className="ld-acct-meta">
                      {a.url ? (
                        <a className="ld-acct-name ld-acct-link" href={a.url} target="_blank" rel="noopener noreferrer">
                          {a.name}<span className="ld-acct-linkmark" aria-hidden="true">↗</span>
                        </a>
                      ) : (
                        <span className="ld-acct-name">{a.name}</span>
                      )}
                      {a.tag && <span className="ld-acct-tag">{a.tag}</span>}
                    </span>
                    <span className="ld-acct-bal">{f(a.balance)}</span>
                  </div>
                ))}
                {pctOfTarget !== null && rung.target && (
                  <div className="ld-target">
                    <div className="ld-target-bar"><span style={{ width: pctOfTarget + "%" }}></span></div>
                    <div className="ld-target-foot">
                      <span>{pctOfTarget}% of target</span>
                      <span>{f(total)} / {f(rung.target)}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="ld-empty">Nothing here yet — click <em>Add</em> to link an account, or this step will unlock once the earlier ones are funded.</div>
            )
          )}

          {editing && (
            <div className="ld-edit">
              <datalist id={"acct-dict-" + rung.id}>
                {directory.map((d) => <option key={d.name} value={d.name} />)}
              </datalist>
              {draft.length === 0 && (
                <div className="ld-empty">No accounts yet — add one below.</div>
              )}
              {draft.map((row, i) => (
                <div className="ld-edit-row" key={i}>
                  <div className="ld-edit-fields">
                    <input className="ld-edit-input ld-edit-input--name" list={"acct-dict-" + rung.id}
                      placeholder="Account name" value={row.name}
                      onChange={(e) => onDraftName(i, e.target.value)} />
                    <input className="ld-edit-input ld-edit-input--tag" placeholder="Tag (e.g. Instant access)"
                      value={row.tag}
                      onChange={(e) => setDraft((p) => { const n = [...p]; n[i] = { ...n[i], tag: e.target.value }; return n; })} />
                    <input className="ld-edit-input ld-edit-input--bal" type="number" inputMode="decimal" placeholder="0"
                      value={Number.isFinite(row.balance) ? row.balance : ""}
                      onChange={(e) => setDraft((p) => { const n = [...p]; n[i] = { ...n[i], balance: e.target.value === "" ? 0 : Number(e.target.value) }; return n; })} />
                    <button className="ld-edit-trash" onClick={() => setDraft((p) => p.filter((_, j) => j !== i))} aria-label="Remove row">
                      <IcoTrash />
                    </button>
                  </div>
                  <input className="ld-edit-input ld-edit-input--url"
                    placeholder="https://… (optional — opens when you click the name)"
                    value={row.url}
                    onChange={(e) => setDraft((p) => { const n = [...p]; n[i] = { ...n[i], url: e.target.value }; return n; })} />
                </div>
              ))}
              <button className="ld-edit-add" onClick={() => setDraft((p) => [...p, { name: "", tag: "", url: "", balance: 0 }])}>
                <IcoPlus /> Add account
              </button>
            </div>
          )}

          <div className="ld-sec-head ld-sec-head--mt">
            <h3 className="ld-sec-title">History</h3>
            {(rung.history || []).length > 0 && (
              <span className="ld-sec-sub">{rung.history.length} moves</span>
            )}
          </div>

          {(rung.history || []).length > 0 ? (
            <ol className="ld-time">
              {[...rung.history].reverse().map((h, i) => (
                <li className="ld-event" key={i}>
                  <span className="ld-event-node"></span>
                  <span className="ld-event-date">{fmtLdDate(h.date)}</span>
                  <span className="ld-event-label">{h.label}</span>
                  <span className={"ld-event-amt " + (h.amt > 0 ? "pos" : h.amt < 0 ? "neg" : "zero")}>
                    {h.amt > 0 ? "+" : h.amt < 0 ? "−" : ""}{h.amt ? f(Math.abs(h.amt)) : "—"}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="ld-empty">No moves recorded yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LadderDetail, fmtLdDate });
