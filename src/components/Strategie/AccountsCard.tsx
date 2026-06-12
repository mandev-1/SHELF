import { useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ACCOUNT_KINDS, type AccountDictEntry, type AccountKind } from "../../types/grid";
import { CURRENCIES, fmtMoney } from "./strategie";

// ─── icons (inline, matching the reference AmI set) ──────────────────────────
const AmI = {
  plus: () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>,
  x: () => <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>,
  trash: () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14" /></svg>,
  search: () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>,
  dl: () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" /></svg>,
  table: () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 10v10" /></svg>,
  ext: () => <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h6v6M20 4l-9 9" /></svg>,
};

function amKindOf(id: string | undefined) {
  return ACCOUNT_KINDS.find((k) => k.id === id) ?? ACCOUNT_KINDS[ACCOUNT_KINDS.length - 1];
}

// ─── click-to-edit cell: Enter/blur commits, Esc cancels ─────────────────────
function AmEdit({ display, editValue, onCommit, mono, right, title }: {
  display: ReactNode;
  editValue: string;
  onCommit: (v: string) => void;
  mono?: boolean;
  right?: boolean;
  title?: string;
}) {
  const [ed, setEd] = useState(false);
  const [v, setV] = useState("");
  const cancel = useRef(false);
  const cls = (mono ? " am-mono" : "") + (right ? " am-right" : "");
  if (!ed) {
    return (
      <button
        className={"am-cell-btn" + cls}
        title={title || "Click to edit"}
        onClick={() => { setV(editValue); cancel.current = false; setEd(true); }}
      >
        {display}
      </button>
    );
  }
  return (
    <input
      className={"am-cell-in" + cls}
      autoFocus
      value={v}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { setEd(false); if (!cancel.current) onCommit(v); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        else if (e.key === "Escape") { cancel.current = true; e.currentTarget.blur(); }
        e.stopPropagation();
      }}
    />
  );
}

type SortKey = "name" | "kind" | "balance";

// ─── the full manager modal ──────────────────────────────────────────────────
function AccountsManager({ accounts, currency, onChange, onClose, onToast }: {
  accounts: AccountDictEntry[];
  currency: string;
  onChange: (next: AccountDictEntry[]) => void;
  onClose: () => void;
  onToast?: (msg: string) => void;
}) {
  const cur = CURRENCIES[currency] || CURRENCIES.USD;
  const kinds = ACCOUNT_KINDS;
  const [q, setQ] = useState("");
  const [kf, setKf] = useState<"all" | AccountKind>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "balance", dir: -1 });
  const [sel, setSel] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const fmt = (base: number | undefined) => fmtMoney(base || 0, currency, { abbr: false });
  const total = accounts.reduce((a, x) => a + (x.balance || 0), 0);

  const rows = useMemo(() => {
    let r = accounts.map((a, i) => ({ ...a, _i: i }));
    if (kf !== "all") r = r.filter((a) => (a.kind || "cash") === kf);
    const needle = q.trim().toLowerCase();
    if (needle) r = r.filter((a) => (a.name + " " + (a.tag || "")).toLowerCase().includes(needle));
    const d = sort.dir;
    r = [...r].sort((x, y) => {
      if (sort.key === "balance") return ((x.balance || 0) - (y.balance || 0)) * d;
      if (sort.key === "kind") return String(x.kind || "zz").localeCompare(String(y.kind || "zz")) * d;
      return x.name.localeCompare(y.name) * d;
    });
    return r;
  }, [accounts, q, kf, sort]);

  const shownSum = rows.reduce((a, x) => a + (x.balance || 0), 0);
  const kindsPresent = kinds.filter((k) => accounts.some((a) => (a.kind || "cash") === k.id));

  const patch = (i: number, p: Partial<AccountDictEntry>) =>
    onChange(accounts.map((a, ix) => (ix === i ? { ...a, ...p } : a)));
  const toggleSel = (i: number) =>
    setSel((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const allVisSel = rows.length > 0 && rows.every((r) => sel.has(r._i));
  const toggleAll = () => setSel(allVisSel ? new Set() : new Set(rows.map((r) => r._i)));

  const bulkKind = (k: string) => {
    if (!k) return;
    onChange(accounts.map((a, ix) => (sel.has(ix) ? { ...a, kind: k as AccountKind } : a)));
    onToast?.("Set " + sel.size + " account" + (sel.size === 1 ? "" : "s") + " to " + amKindOf(k).label);
    setSel(new Set());
  };
  const bulkDelete = () => {
    if (!window.confirm("Remove " + sel.size + " account" + (sel.size === 1 ? "" : "s") + "?")) return;
    onChange(accounts.filter((_, ix) => !sel.has(ix)));
    setSel(new Set());
  };
  const addRow = () => {
    let n = 1, name: string;
    do { name = "New account" + (n > 1 ? " " + n : ""); n++; } while (accounts.some((a) => a.name === name));
    onChange([...accounts, { name, kind: "checking", balance: 0, tag: "" }]);
    onToast?.("Account added — click its cells to edit");
  };
  const exportCsv = () => {
    const esc = (v: unknown) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const lines = ["name,kind,note,balance_" + cur.code.toLowerCase() + ",url"];
    for (const a of accounts) lines.push([a.name, a.kind || "", a.tag || "", Math.round((a.balance || 0) * cur.rate), a.url || ""].map(esc).join(","));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const u = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = u; el.download = "accounts.csv"; el.click();
    setTimeout(() => URL.revokeObjectURL(u), 4000);
    onToast?.("Exported " + accounts.length + " accounts");
  };

  const Th = ({ k, children, right }: { k: SortKey; children: ReactNode; right?: boolean }) => (
    <button
      className={"am-th" + (sort.key === k ? " on" : "") + (right ? " am-right" : "")}
      onClick={() => setSort((s) => (s.key === k ? { key: k, dir: (-s.dir) as 1 | -1 } : { key: k, dir: k === "balance" ? -1 : 1 }))}
    >
      {children}<span className="am-th-dir">{sort.key === k ? (sort.dir > 0 ? "↑" : "↓") : ""}</span>
    </button>
  );

  return (
    <div className="am-veil" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="am-modal" role="dialog" aria-label="Manage accounts">
        <div className="am-head">
          <div>
            <div className="am-eyebrow">Net worth</div>
            <h2 className="am-title">Accounts</h2>
            <div className="am-sub">{accounts.length} account{accounts.length === 1 ? "" : "s"} · {fmt(total)} total</div>
          </div>
          <button className="am-close" onClick={onClose} aria-label="Close"><AmI.x /></button>
        </div>

        <div className="am-toolbar">
          <label className="am-search"><AmI.search /><input placeholder="Search accounts…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <div className="am-chips">
            <button className={"am-chip" + (kf === "all" ? " on" : "")} onClick={() => setKf("all")}>All</button>
            {kindsPresent.map((k) => (
              <button key={k.id} className={"am-chip" + (kf === k.id ? " on" : "")} style={{ ["--k" as string]: k.hue } as React.CSSProperties} onClick={() => setKf(kf === k.id ? "all" : k.id)}>
                <i />{k.label}
              </button>
            ))}
          </div>
          <span className="am-spacer" />
          <button className="am-tool" onClick={exportCsv}><AmI.dl /> CSV</button>
          <button className="am-tool am-tool--primary" onClick={addRow}><AmI.plus /> Add account</button>
        </div>

        {sel.size > 0 && (
          <div className="am-bulk">
            <b>{sel.size} selected</b>
            <select className="am-kind am-bulk-kind" value="" onChange={(e) => bulkKind(e.target.value)}>
              <option value="" disabled>Set kind…</option>
              {kinds.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
            <button className="am-tool am-tool--danger" onClick={bulkDelete}><AmI.trash /> Remove</button>
            <button className="am-tool" onClick={() => setSel(new Set())}>Clear</button>
          </div>
        )}

        <div className="am-table">
          <div className="am-grid-row am-thead">
            <span className="am-cellc"><input type="checkbox" className="am-chk" checked={allVisSel} onChange={toggleAll} aria-label="Select all" /></span>
            <Th k="name">Account</Th>
            <Th k="kind">Kind</Th>
            <span className="am-th-static">Note</span>
            <Th k="balance" right>Balance · {cur.code}</Th>
            <span className="am-th-static am-right">Share</span>
            <span />
          </div>
          {rows.map((a) => {
            const h = amKindOf(a.kind || "cash");
            const pct = total > 0 ? ((a.balance || 0) / total) * 100 : 0;
            return (
              <div className={"am-grid-row am-row" + (sel.has(a._i) ? " sel" : "")} key={a._i}>
                <span className="am-cellc"><input type="checkbox" className="am-chk" checked={sel.has(a._i)} onChange={() => toggleSel(a._i)} aria-label={"Select " + a.name} /></span>
                <span className="am-name-cell">
                  <AmEdit display={a.name} editValue={a.name}
                    onCommit={(v) => { const nm = v.trim(); if (nm) patch(a._i, { name: nm }); }} />
                  {a.url && <a className="am-ext" href={a.url} target="_blank" rel="noreferrer" title={a.url}><AmI.ext /></a>}
                </span>
                <span className="am-kind-cell">
                  <i className="am-dot" style={{ background: h.hue }} />
                  <select className="am-kind" value={a.kind || "cash"} onChange={(e) => patch(a._i, { kind: e.target.value as AccountKind })}>
                    {ACCOUNT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
                  </select>
                </span>
                <AmEdit display={a.tag || <span className="am-dim">—</span>} editValue={a.tag || ""}
                  onCommit={(v) => patch(a._i, { tag: v.trim() })} title="Note — click to edit" />
                <AmEdit mono right display={fmt(a.balance)} editValue={String(Math.round((a.balance || 0) * cur.rate))}
                  onCommit={(v) => { const n = parseFloat(String(v).replace(/[^\d.-]/g, "")); if (Number.isFinite(n)) patch(a._i, { balance: Math.round(n / cur.rate) }); }}
                  title="Balance — click to edit" />
                <span className="am-share">
                  <i><b style={{ width: Math.min(100, pct) + "%", background: h.hue }} /></i>
                  <span className="am-mono">{pct >= 0.5 ? Math.round(pct) + "%" : "·"}</span>
                </span>
                <button className="am-del" title={"Remove " + a.name}
                  onClick={() => { if (window.confirm('Remove "' + a.name + '"?')) onChange(accounts.filter((_, ix) => ix !== a._i)); }}><AmI.x /></button>
              </div>
            );
          })}
          {rows.length === 0 && <div className="am-empty">Nothing matches{q ? ' "' + q + '"' : ""}.</div>}
        </div>

        <div className="am-foot">
          <span>{rows.length === accounts.length ? accounts.length + " accounts" : rows.length + " of " + accounts.length + " shown · " + fmt(shownSum)}</span>
          <span className="am-mono">Total {fmt(total)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── compact card ─────────────────────────────────────────────────────────────
export function AccountsCard({ accounts, currency, onChange, onToast }: {
  accounts: AccountDictEntry[];
  currency: string;
  onChange: (next: AccountDictEntry[]) => void;
  onToast?: (msg: string) => void;
}) {
  const [mgr, setMgr] = useState(false);
  const cur = CURRENCIES[currency] || CURRENCIES.USD;
  const kinds = ACCOUNT_KINDS;
  const total = accounts.reduce((a, x) => a + (x.balance || 0), 0);

  const indexed = accounts.map((a, i) => ({ a, i }));
  const groups = kinds
    .map((k) => ({ k, rows: indexed.filter(({ a }) => (a.kind || "cash") === k.id) }))
    .filter((g) => g.rows.length > 0);

  const patch = (i: number, p: Partial<AccountDictEntry>) =>
    onChange(accounts.map((x, ix) => (ix === i ? { ...x, ...p } : x)));

  return (
    <div className="card span-4">
      <div className="card-head">
        <div>
          <div className="card-eyebrow">Net worth</div>
          <div className="card-title">Accounts</div>
        </div>
        <button className="ghost-btn" onClick={() => setMgr(true)} title="Search, sort, bulk-edit and export your accounts"><AmI.table /> Manage</button>
      </div>
      <div style={{ padding: "14px 20px 18px" }}>
        <div className="acct-total">
          <span className="acct-total-lab">Total across {accounts.length} account{accounts.length === 1 ? "" : "s"}</span>
          <span className="acct-total-val">{fmtMoney(total, currency, { abbr: true })}</span>
        </div>
        {total > 0 && (
          <div className="alloc-bar" style={{ marginTop: 12 }}>
            {groups.map(({ k, rows }) => {
              const sum = rows.reduce((s, { a }) => s + (a.balance || 0), 0);
              return sum > 0 ? <div key={k.id} className="alloc-seg" style={{ width: (sum / total) * 100 + "%", background: k.hue }} title={k.label + " · " + fmtMoney(sum, currency, { abbr: true })} /> : null;
            })}
          </div>
        )}
        <div className="acct-groups" style={{ marginTop: 14 }}>
          {groups.map(({ k, rows }) => (
            <div className="acct-group" key={k.id}>
              <div className="acct-group-head">
                <span className="acct-group-lab" style={{ color: k.hue }}>{k.label}</span>
                <span className="acct-group-sum">{fmtMoney(rows.reduce((s, { a }) => s + (a.balance || 0), 0), currency, { abbr: true })}</span>
              </div>
              {rows.map(({ a, i }) => (
                <div className="alloc-row sp-row acct-row" key={i}>
                  <div className="alloc-dot" style={{ background: k.hue }} />
                  <div className="alloc-name">
                    {a.url
                      ? <a href={a.url} target="_blank" rel="noreferrer" className="acct-link">{a.name}</a>
                      : <span>{a.name}</span>}
                    <span className="sp-kind">{a.tag || k.label}</span>
                  </div>
                  <span className="acct-edit-wrap">
                    <AmEdit mono right title="Balance — click to edit"
                      display={fmtMoney(a.balance || 0, currency, { abbr: true })}
                      editValue={String(Math.round((a.balance || 0) * cur.rate))}
                      onCommit={(v) => { const n = parseFloat(String(v).replace(/[^\d.-]/g, "")); if (Number.isFinite(n)) patch(i, { balance: Math.round(n / cur.rate) }); }} />
                  </span>
                </div>
              ))}
            </div>
          ))}
          {accounts.length === 0 && (
            <div className="sp-empty">No accounts yet. Open Manage to add your banks, brokerage and pension accounts.</div>
          )}
        </div>
      </div>
      {mgr && createPortal(
        <AccountsManager accounts={accounts} currency={currency} onChange={onChange} onClose={() => setMgr(false)} onToast={onToast} />,
        document.body
      )}
    </div>
  );
}
