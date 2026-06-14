import { useState } from "react";
import type { Debt, DebtKind, DebtStrategy } from "../../types/grid";
import { DEBT_KINDS } from "../../types/grid";
import { CURRENCIES, fmtMoney, monthAbbr, stepMonth, debtHue, debtMonthsLeft } from "./strategie";
import { IcoPencil, IcoPlus } from "./icons";

interface DebtCardProps {
  debts: Debt[];
  /** Σ amount of every row tagged with this debt, all months. */
  paidTotal: Record<string, number>;
  /** Σ amount tagged with this debt in the active month. */
  paidMonth: Record<string, number>;
  strategy: DebtStrategy;
  activeKey: string;
  currency: string;
  onChange: (next: Debt[]) => void;
  onStrategy: (v: DebtStrategy) => void;
  onToast?: (msg: string) => void;
}

export function DebtCard({
  debts, paidTotal, paidMonth, strategy, activeKey, currency, onChange, onStrategy, onToast,
}: DebtCardProps) {
  const cur = CURRENCIES[currency] ?? CURRENCIES.USD;
  const [editId, setEditId] = useState<string | null>(null);
  // raw display-currency buffers for the inline editor: while a field is being
  // typed the model is NOT touched (so a mid-edit empty/small value can't yank
  // the debt to "cleared"); the parsed value commits on blur / Enter.
  const [balBuf, setBalBuf] = useState("");
  const [payBuf, setPayBuf] = useState("");
  const [nName, setNName] = useState("");
  const [nKind, setNKind] = useState<DebtKind>("consumer");
  const [nBal, setNBal] = useState("");

  const shown = (base: number) => Math.round((base || 0) * cur.rate);
  // float (no round-trip rounding) so small CZK/HUF amounts don't collapse to 0
  const toBase = (v: number) => v / cur.rate;
  const fmt = (b: number) => fmtMoney(b, currency, { abbr: true });

  const rows = debts.map((d) => {
    const paid = paidTotal[d.id] || 0;
    const remaining = Math.max(0, (d.principal || 0) - paid);
    const pct = d.principal > 0 ? Math.min(100, Math.round((paid / d.principal) * 100)) : 0;
    const pay = d.payment || paidMonth[d.id] || 0;
    const mLeft = debtMonthsLeft(remaining, pay, d.rate);
    const payoff = mLeft != null && isFinite(mLeft) && mLeft > 0
      ? monthAbbr(stepMonth(activeKey, mLeft)) : null;
    return { d, paid, remaining, pct, mLeft, payoff };
  });

  const open = rows.filter((r) => r.remaining > 0);
  const cleared = rows.filter((r) => r.remaining <= 0);
  const sorted = [...open].sort((a, b) => strategy === "snowball"
    ? a.remaining - b.remaining
    : (b.d.rate || 0) - (a.d.rate || 0));
  const totalOpen = open.reduce((s, r) => s + r.remaining, 0);
  const monthPaid = debts.reduce((s, d) => s + (paidMonth[d.id] || 0), 0);
  const firstReason = strategy === "snowball" ? "smallest balance" : "highest APR";

  const patch = (id: string, p: Partial<Debt>) =>
    onChange(debts.map((d) => (d.id === id ? { ...d, ...p } : d)));
  const remove = (id: string) => {
    const d = debts.find((x) => x.id === id);
    if (d && window.confirm(`Remove "${d.name}"? Statement rows keep their amounts but lose the link to this debt.`))
      onChange(debts.filter((x) => x.id !== id));
  };
  const add = () => {
    const name = nName.trim();
    const bal = parseInt(nBal.replace(/[^\d]/g, ""), 10);
    if (!name || isNaN(bal) || bal <= 0) return;
    onChange([...debts, { id: `dbt-${crypto.randomUUID()}`, name, kind: nKind, principal: toBase(bal), rate: 0, payment: 0 }]);
    setNName(""); setNBal("");
    onToast?.(`Added debt: ${name}`);
  };

  return (
    <div className="card span-4">
      <div className="card-head">
        <div>
          <div className="card-eyebrow">Liabilities</div>
          <div className="card-title">Open debt</div>
        </div>
        <div className="seg">
          {([["avalanche", "Avalanche"], ["snowball", "Snowball"]] as const).map(([id, lab]) => (
            <button
              key={id}
              className={`seg-btn${strategy === id ? " on" : ""}`}
              title={id === "avalanche" ? "Pay highest APR first — least interest overall" : "Pay smallest balance first — quick wins"}
              onClick={() => onStrategy(id)}
            >
              {lab}
            </button>
          ))}
        </div>
      </div>
      <div className="debt-body">
        <div className="debt-sum">
          <div className="debt-sum-val">{fmt(totalOpen)}</div>
          <div className="debt-sum-cap">
            open across {open.length} debt{open.length === 1 ? "" : "s"}
            {monthPaid > 0 ? ` · ${fmt(monthPaid)} paid this month` : ""}
          </div>
        </div>
        <div className="debt-list">
          {sorted.map((r, i) => {
            const d = r.d;
            const hue = debtHue(d);
            const kindLab = DEBT_KINDS.find((k) => k.id === d.kind)?.label ?? d.kind;
            const editing = editId === d.id;
            return (
              <div key={d.id} className="debt">
                <div className="debt-top">
                  <span className="alloc-dot" style={{ background: hue }} />
                  <div
                    className="debt-name"
                    title="Double-click to rename"
                    onDoubleClick={() => {
                      const name = (window.prompt(`Rename "${d.name}"`, d.name) || "").trim();
                      if (name && name !== d.name) patch(d.id, { name });
                    }}
                  >
                    <span>{d.name}</span>
                    <span className="sp-kind">{kindLab}</span>
                  </div>
                  {i === 0 && sorted.length > 1 && (
                    <span className="debt-first-tag" title={`Suggested next target — ${firstReason}`}>pay first</span>
                  )}
                  <span className="debt-amt">{fmt(r.remaining)}</span>
                  <button
                    type="button"
                    className={`debt-edit-btn${editing ? " on" : ""}`}
                    title="Edit balance, APR, payment"
                    aria-label={`Edit ${d.name}`}
                    onClick={() => {
                      if (editing) { setEditId(null); return; }
                      setBalBuf(shown(r.remaining) ? String(shown(r.remaining)) : "");
                      setPayBuf(d.payment ? String(shown(d.payment)) : "");
                      setEditId(d.id);
                    }}
                  >
                    <IcoPencil />
                  </button>
                </div>
                <div className="pot-bar debt-bar"><span style={{ width: `${r.pct}%`, background: hue }} /></div>
                <div className="debt-foot">
                  <span>{r.pct}% paid{d.rate > 0 ? ` · ${d.rate}% APR` : " · interest-free"}</span>
                  <span>
                    {r.mLeft === Infinity ? "payment below interest"
                      : r.mLeft == null ? "no payment set"
                      : r.payoff ? `~${r.mLeft} mo · ${r.payoff}` : ""}
                  </span>
                </div>
                {(paidMonth[d.id] || 0) > 0 && (
                  <div className="debt-paidmo">−{fmt(paidMonth[d.id])} this month, from your statement</div>
                )}
                {editing && (
                  <div className="debt-editor">
                    <label>Balance
                      <input
                        type="text" inputMode="numeric"
                        value={balBuf}
                        onChange={(e) => setBalBuf(e.target.value.replace(/[^\d]/g, ""))}
                        onBlur={() => {
                          // empty = no change (so clearing-to-retype can't mark the debt cleared)
                          if (balBuf === "") { setBalBuf(shown(r.remaining) ? String(shown(r.remaining)) : ""); return; }
                          const n = parseInt(balBuf, 10);
                          patch(d.id, { principal: (isNaN(n) ? 0 : toBase(n)) + r.paid });
                        }}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      />
                    </label>
                    <label>APR %
                      <input
                        type="number" step="0.1" min="0" value={d.rate || 0}
                        onChange={(e) => patch(d.id, { rate: Math.max(0, Number(e.target.value) || 0) })}
                      />
                    </label>
                    <label>Per month
                      <input
                        type="text" inputMode="numeric"
                        value={payBuf}
                        placeholder={paidMonth[d.id] ? shown(paidMonth[d.id]).toLocaleString(cur.locale) : "0"}
                        onChange={(e) => setPayBuf(e.target.value.replace(/[^\d]/g, ""))}
                        onBlur={() => {
                          const n = parseInt(payBuf, 10);
                          patch(d.id, { payment: payBuf === "" || isNaN(n) ? 0 : toBase(n) });
                        }}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      />
                    </label>
                    <label>Kind
                      <select value={d.kind} onChange={(e) => patch(d.id, { kind: e.target.value as DebtKind })}>
                        {DEBT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
                      </select>
                    </label>
                    <button className="sp-del debt-del" title={`Remove ${d.name}`} onClick={() => remove(d.id)}>×</button>
                  </div>
                )}
              </div>
            );
          })}
          {cleared.length > 0 && (
            <div className="debt-cleared">
              {cleared.map((r) => (
                <div key={r.d.id} className="debt-cleared-row">
                  <span className="alloc-dot" style={{ background: debtHue(r.d), opacity: 0.4 }} />
                  <span className="debt-cleared-name">{r.d.name}</span>
                  <span className="debt-cleared-tag">cleared</span>
                </div>
              ))}
            </div>
          )}
          {open.length === 0 && cleared.length === 0 && (
            <div className="sp-empty">
              No debts tracked. Add one below, then tag statement rows
              (in the import or the statement editor) as payments — balances
              pay down automatically.
            </div>
          )}
        </div>
        <div className="sp-add">
          <input
            className="sp-add-name" placeholder="e.g. Car loan — Škoda" value={nName}
            onChange={(e) => setNName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          />
          <select className="se-cat sp-add-kind" value={nKind} onChange={(e) => setNKind(e.target.value as DebtKind)}>
            {DEBT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
          <input
            className="debt-add-bal" type="text" inputMode="numeric" placeholder="Balance" value={nBal}
            onChange={(e) => setNBal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          />
          <button className="ghost-btn" onClick={add} disabled={!nName.trim() || !nBal.trim()}><IcoPlus /> Add</button>
        </div>
      </div>
    </div>
  );
}
