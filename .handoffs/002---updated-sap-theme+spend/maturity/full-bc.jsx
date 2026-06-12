/* Full-page boards: Option B (Editorial) and C (Cockpit) */

function FullB() {
  return (
    <div className="mo" style={{ padding: "22px 26px", gap: 14 }}>
      <div>
        <span className="mo-cap">Net worth · April 2026</span>
        <div className="mob-big mo-mono" style={{ marginTop: 8 }}>637 400 Kč</div>
        <div className="mob-sub"><span className="mob-delta mo-acc">▲ 17 900 Kč</span><span className="mo-faint"> this month · on pace for </span><span className="mo-mono" style={{ color: "#c7ccd4" }}>1.11M Kč</span><span className="mo-faint"> by 2031</span></div>
      </div>
      <div className="mob-band"><window.MoChartGhost flat /><div style={{ display: "flex", gap: 14, marginTop: 10 }}>{["Conservative", "Balanced", "Aggressive"].map((s, i) => <span key={s} className="mf-chip" style={i === 1 ? { color: "#34d399", borderColor: "rgba(52,211,153,.4)" } : null}>{s}</span>)}</div></div>
      <div className="mob-grid">
        <div className="mob-cell"><div className="mo-cap">This month's spending</div><div style={{ fontSize: 14, fontWeight: 600, margin: "6px 0 8px" }}>79 665 Kč</div><window.MfWeeks /></div>
        <div className="mob-cell"><div className="mo-cap">The method · step 4 of 7</div><div style={{ marginTop: 6 }}><window.MfSteps /></div></div>
        <div className="mob-cell"><div className="mo-cap">Where it goes</div><div style={{ marginTop: 8 }}><window.MfCatTable compact /></div></div>
        <div className="mob-cell">
          <div className="mo-cap">Pots &amp; programs</div>
          <div style={{ marginTop: 6 }}>
            {window.MF.pots.map(([n, p, eta]) => (
              <div className="mf-table-row" key={n}><span className="mo-dim" style={{ width: 86 }}>{n}</span><span className="mf-bar"><span style={{ width: p + "%", background: "#34d399" }}></span></span><span className="mo-mono mo-faint" style={{ fontSize: 9.5 }}>{eta}</span></div>
            ))}
            <div className="mf-table-row"><span className="mo-dim" style={{ flex: 1 }}>To programs</span><span className="mo-mono" style={{ fontSize: 10.5 }}>8.2k Kč /mo</span></div>
          </div>
        </div>
      </div>
      <div className="mo-motion">
        <div className="mo-motion-row"><span className="mo-dot"></span><b>one number first</b> — everything else is a quiet 2×2; cards stagger in 40ms apart</div>
        <div className="mo-motion-row"><span className="mo-dot"></span>hero <b>spring-settles</b>; chart draws once; section reveals on scroll (12px rise)</div>
      </div>
    </div>
  );
}

function FullC() {
  return (
    <div className="mo moc" style={{ padding: 0 }}>
      <div className="moc-rail">
        <span className="mo-cap" style={{ padding: "0 9px" }}>Strategie</span>
        {[["Overview", "637k Kč", 1], ["Statement", "Apr · 30 rows"], ["Spending", "79.7k Kč"], ["Programs", "16.4k Kč"], ["Pots", "3 active"], ["Method", "step 4 of 7"], ["Pillars", "2 warn"]].map(([n, s, on]) => (
          <div className={"moc-rail-item" + (on ? " on" : "")} key={n}><span style={{ fontSize: 12, fontWeight: 600 }}>{n}</span><span className="mo-mono mo-faint" style={{ fontSize: 10 }}>{s}</span></div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div className="moc-sticky">
          {[["Surplus", "+17.9k", 1], ["Spend wk", "21.9k"], ["5Y", "1.11M"], ["E-fund", "50%"]].map(([l, v, a]) => (
            <div className="moc-chip" key={l}><div className="mo-cap">{l}</div><div className={"mo-mono " + (a ? "mo-acc" : "")} style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{v}</div></div>
          ))}
        </div>
        <div className="moc-main" style={{ gap: 8 }}>
          <div className="moc-panel"><span className="mo-cap">Compounding · balanced 7%</span><window.MoChartGhost /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div className="moc-panel"><span className="mo-cap">Spending by week</span><div style={{ marginTop: 6 }}><window.MfWeeks /></div></div>
            <div className="moc-panel"><span className="mo-cap">Categories</span><div style={{ marginTop: 6 }}><window.MfCatTable compact /></div></div>
          </div>
          <div className="moc-panel"><span className="mo-cap">Method · step 4 of 7</span><div style={{ marginTop: 6 }}><window.MfSteps /></div></div>
          <div className="mo-motion" style={{ padding: "8px 2px 4px" }}>
            <div className="mo-motion-row"><span className="mo-dot"></span>rail = <b>scrollspy</b>; clicking crossfades the section in place (180ms)</div>
            <div className="mo-motion-row"><span className="mo-dot"></span>sticky chips <b>morph</b> into panel headers as you pass them</div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { FullB, FullC });
