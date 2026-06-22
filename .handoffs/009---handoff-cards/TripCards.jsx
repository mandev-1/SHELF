// ============================================================================
// Trip cards — "On the road" (ledger) + "Reconcile" (settle up)
// React structure matching the live app. Pair with trip-cards.css.
// Presentational — feed real data. Money strings shown verbatim (format upstream).
// ============================================================================

function Avatar({ hue, initial, size = 28 }) {
  return (
    <span className="tc-av" style={{ backgroundColor: hue, width: size, height: size, fontSize: Math.round(size * 0.42) }}>
      {initial}
    </span>
  );
}

// ── On the road · who paid what ──────────────────────────────────────────────
// Each row wraps into three tiers: [dot · amount] / [label + meta] /
// [split avatars + "split N"  ·  payer avatar + "paid"].
function OnTheRoadCard({ expenses, members, onAddExpense, onEditExpense }) {
  const byId = Object.fromEntries(members.map((m) => [m.id, m]));
  return (
    <section className="tc-card otr">
      <div className="tc-head">
        <div>
          <div className="tc-eyebrow">On the road</div>
          <div className="tc-title">Who paid what</div>
        </div>
        <button className="tc-addbtn" type="button" onClick={onAddExpense}>
          <span className="tc-plus">+</span><span>Add expense</span>
        </button>
      </div>

      <div className="tc-ledger">
        {expenses.map((e) => {
          const payer = byId[e.paidBy];
          const participants = e.participantIds.map((id) => byId[id]);
          return (
            <button key={e.id} className="tc-exp" type="button" onClick={() => onEditExpense(e)}>
              <span className="tc-exp-dot" style={{ background: e.categoryHue }} />
              <span className="tc-exp-amt">{e.amountText}</span>
              <span className="tc-exp-main">
                <span className="tc-exp-label">{e.label}</span>
                <span className="tc-exp-meta">{e.categoryLabel} · {e.dateText}</span>
              </span>
              <span className="tc-exp-split">
                {participants.map((m) => <Avatar key={m.id} hue={m.hue} initial={m.name[0]} size={26} />)}
                <span className="tc-exp-splitlab">split {participants.length}</span>
              </span>
              <span className="tc-exp-paid">
                <Avatar hue={payer.hue} initial={payer.name[0]} size={28} />
                <span className="tc-exp-paidlab">paid</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ── Reconcile · settle up (Kraków photo behind a white scrim, via .rec) ──────
function ReconcileCard({ balances, transactions, members }) {
  const byId = Object.fromEntries(members.map((m) => [m.id, m]));
  const total = Math.max(1, balances.reduce((s, b) => s + Math.abs(b.net), 0));
  const squared = transactions.length === 0;

  return (
    <section className="tc-card rec">
      <div className="tc-head">
        <div>
          <div className="tc-eyebrow">Reconcile</div>
          <div className="tc-title">Settle up</div>
        </div>
      </div>

      <div className="tc-bal-list">
        {balances.map((b) => {
          const m = byId[b.id];
          const pos = b.net > 0.01, neg = b.net < -0.01;
          const w = Math.min(100, Math.round((Math.abs(b.net) / total) * 100 * balances.length));
          return (
            <div key={b.id} className="tc-bal">
              <Avatar hue={m.hue} initial={m.name[0]} size={32} />
              <span className="tc-bal-name">{m.name}</span>
              <span className="tc-bal-track">
                {(pos || neg) && <span className={"tc-bal-fill " + (pos ? "pos" : "neg")} style={{ width: w + "%" }} />}
              </span>
              <span className={"tc-bal-net" + (pos ? " pos" : neg ? " neg" : "")}>{b.netText}</span>
            </div>
          );
        })}
      </div>

      {squared ? (
        <div className="tc-clear">✓ This trip is squared up</div>
      ) : (
        <div className="tc-tx-list">
          {transactions.map((t, i) => (
            <div key={i} className="tc-tx">
              <span className="tc-tx-name">{byId[t.from].name}</span>
              <span className="tc-tx-arrow">→</span>
              <span className="tc-tx-name">{byId[t.to].name}</span>
              <span className="tc-tx-amt">{t.amountText}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// Render order in the open-trip view:  <OnTheRoadCard … />  then  <ReconcileCard … />
