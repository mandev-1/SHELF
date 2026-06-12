/* Maturity options — three composition directions as static boards */

function ChartGhost({ flat }) {
  return (
    <div className="mo-chart">
      <svg viewBox="0 0 400 110" preserveAspectRatio="none">
        <path d="M0,100 C80,96 150,84 230,62 C300,44 350,28 400,12 L400,110 L0,110 Z" fill="rgba(52,211,153,0.10)" />
        <path d="M0,100 C80,96 150,84 230,62 C300,44 350,28 400,12" fill="none" stroke="#34d399" strokeWidth="1.6" />
        <path d="M0,102 C90,100 180,94 270,86 C330,80 370,76 400,72" fill="none" stroke="rgba(52,211,153,0.45)" strokeWidth="1.2" strokeDasharray="4 3" />
        {!flat && <circle cx="400" cy="12" r="3" fill="#0d0f12" stroke="#34d399" strokeWidth="1.6" />}
      </svg>
    </div>
  );
}

function OptionA() {
  const rows = [
    ["Groceries", 62, "−Kč2.2k"], ["Shopping", 48, "−Kč1.6k"], ["Eating out", 35, "+Kč1.1k"],
  ];
  return (
    <div className="mo">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="mo-cap">Strategie</span>
        <span className="mo-mono mo-faint" style={{ fontSize: 10 }}>Apr 2026 · CZK</span>
      </div>
      <div className="moa-statbar" style={{ marginTop: 10 }}>
        {[["Net worth", "637k Kč", ""], ["Surplus /mo", "+17.9k", "acc"], ["5Y proj.", "1.11M Kč", ""], ["E-fund", "3.0 / 6 mo", ""]].map(([l, v, c]) => (
          <div className="moa-stat" key={l}>
            <span className="mo-cap">{l}</span>
            <span className={"moa-val mo-mono" + (c ? " mo-acc" : "")}>{v}</span>
          </div>
        ))}
      </div>
      <ChartGhost />
      <div style={{ marginTop: 12 }}>
        <span className="mo-cap">Movers · vs March</span>
        {rows.map(([n, w, d]) => (
          <div className="moa-row" key={n}>
            <span style={{ width: 76 }} className="mo-dim">{n}</span>
            <span style={{ flex: 1, height: 3, background: "#1a1e24", borderRadius: 2 }}>
              <span style={{ display: "block", width: w + "%", height: "100%", background: d[0] === "+" ? "#f87171" : "#34d399", borderRadius: 2 }}></span>
            </span>
            <span className={"mo-mono " + (d[0] === "+" ? "mo-red" : "mo-acc")} style={{ fontSize: 11 }}>{d}</span>
          </div>
        ))}
      </div>
      <div className="mo-motion">
        <div className="mo-motion-row"><span className="mo-dot"></span><b>120ms</b> snap — rows/values, no easing theatrics</div>
        <div className="mo-motion-row"><span className="mo-dot"></span>numbers tick up via <b>countup on mount</b>, once</div>
        <div className="mo-motion-row"><span className="mo-dot"></span>hover = background shift only, <b>no scale</b></div>
      </div>
    </div>
  );
}

window.OptionA = OptionA;
window.MoChartGhost = ChartGhost;
