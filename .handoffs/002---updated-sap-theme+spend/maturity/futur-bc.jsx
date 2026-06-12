/* Futuristic boards — F2 Aurora glass, F3 Orbital */

function FuturAurora() {
  return (
    <div className="fu aur">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <span className="fu-cap aur-cap">Net worth · April</span>
          <div className="aur-hero fu-mono" style={{ marginTop: 6 }}>637 400 Kč</div>
        </div>
        <span className="aur-pill on">▲ 17 900 Kč /mo</span>
      </div>
      <div className="aur-glass">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span className="fu-cap aur-cap">Compounding</span>
          <div style={{ display: "flex", gap: 6 }}>
            <span className="aur-pill">4%</span><span className="aur-pill on">7%</span><span className="aur-pill">10%</span>
          </div>
        </div>
        <window.GlowChart stroke="#6ee7b7" />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "rgba(232,244,242,0.5)", marginTop: 6 }}>
          <span>now</span><span className="fu-mono" style={{ color: "#b8ffe3" }}>1.11M Kč · 2031</span>
        </div>
      </div>
      <div className="aur-grid2">
        <div className="aur-glass">
          <span className="fu-cap aur-cap">Spending · 79.7k</span>
          <div style={{ marginTop: 8 }}>
            {[["Wk 1", 100], ["Wk 2", 41], ["Wk 3", 28], ["Wk 4", 25]].map(([w, p]) => (
              <div className="aur-row" key={w}><span style={{ width: 30 }}>{w}</span><span className="aur-bar"><span style={{ width: p + "%" }}></span></span></div>
            ))}
          </div>
        </div>
        <div className="aur-glass">
          <span className="fu-cap aur-cap">Method · 4/7</span>
          <div style={{ marginTop: 8 }}>
            {[["E-fund", 50], ["Tax-adv", 35], ["Index", 82]].map(([n, p]) => (
              <div className="aur-row" key={n}><span style={{ width: 52 }}>{n}</span><span className="aur-bar"><span style={{ width: p + "%" }}></span></span><span className="fu-mono" style={{ fontSize: 9.5 }}>{p}%</span></div>
            ))}
          </div>
        </div>
        <div className="aur-glass">
          <span className="fu-cap aur-cap">Pots</span>
          <div style={{ marginTop: 8 }}>
            {[["Desk", 54, "Aug ’26"], ["Japan", 35, "Feb ’27"], ["Laptop", 43, "Jan ’27"]].map(([n, p, e]) => (
              <div className="aur-row" key={n}><span style={{ width: 44 }}>{n}</span><span className="aur-bar"><span style={{ width: p + "%" }}></span></span><span className="fu-mono" style={{ fontSize: 9 }}>{e}</span></div>
            ))}
          </div>
        </div>
        <div className="aur-glass">
          <span className="fu-cap aur-cap">Programs</span>
          <div style={{ marginTop: 8 }}>
            {[["Building ČS", "4.7k"], ["DIP účet", "3.5k"]].map(([n, v]) => (
              <div className="aur-row" key={n}><span style={{ flex: 1 }}>{n}</span><span className="fu-mono" style={{ color: "#b8ffe3", fontSize: 10.5 }}>{v} /mo</span></div>
            ))}
            <div className="aur-row"><span style={{ flex: 1 }}>Total</span><span className="fu-mono" style={{ fontSize: 10.5 }}>16.4k Kč</span></div>
          </div>
        </div>
      </div>
      <div className="fu-motion">
        <div className="fu-motion-row"><span className="fu-dot" style={{ background: "#6ee7b7", boxShadow: "0 0 6px #6ee7b7" }}></span>aurora mesh <b>drifts</b> slowly behind glass; cards <b>lift on hover</b> with spring</div>
        <div className="fu-motion-row"><span className="fu-dot" style={{ background: "#6ee7b7", boxShadow: "0 0 6px #6ee7b7" }}></span>hero gradient <b>shimmers once</b> on load; pills morph with layout animation</div>
      </div>
    </div>
  );
}

function FuturOrbital() {
  const nodes = [
    [50, 14, "#34d399", "E-fund", "50%"],
    [88, 38, "#22d3ee", "Index ETF", "9k"],
    [82, 76, "#a78bfa", "DIP", "3.5k"],
    [16, 70, "#f59e0b", "Desk pot", "54%"],
    [8, 34, "#f472b6", "Japan", "35%"],
    [30, 88, "#6595ee", "Building ČS", "4.7k"],
  ];
  return (
    <div className="fu orb">
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span className="fu-cap" style={{ color: "#5d8ba0" }}>Strategie · system view</span>
        <span className="fu-mono" style={{ fontSize: 9, color: "#5d8ba0" }}>APR 2026</span>
      </div>
      <div className="orb-stage">
        {[180, 270, 350].map((d) => <div className="orb-ring" key={d} style={{ width: d, height: d }}></div>)}
        <div className="orb-core">
          <div>
            <div className="fu-cap" style={{ color: "#6fae8f" }}>Net worth</div>
            <div className="fu-mono" style={{ fontSize: 17, fontWeight: 650, color: "#d1fae5", textShadow: "0 0 16px rgba(52,211,153,0.5)" }}>637.4k</div>
            <div className="fu-mono" style={{ fontSize: 9, color: "#4ade80" }}>+17.9k /mo</div>
          </div>
        </div>
        {nodes.map(([x, y, c, n, v]) => (
          <div className="orb-node" key={n} style={{ left: x + "%", top: y + "%", color: c }}>
            <span className="orb-dot"></span>
            <span className="orb-lab"><b>{n}</b> · {v}</span>
          </div>
        ))}
      </div>
      <div className="orb-foot">
        {[["Trajectory", "1.11M · 2031"], ["Spend Apr", "79.7k"], ["Sequence", "step 4 / 7"]].map(([l, v]) => (
          <div className="orb-chip" key={l}><div className="fu-cap" style={{ color: "#5d8ba0" }}>{l}</div><div className="fu-mono" style={{ fontSize: 12.5, color: "#d9f3ff", marginTop: 2 }}>{v}</div></div>
        ))}
      </div>
      <div className="fu-motion">
        <div className="fu-motion-row"><span className="fu-dot"></span>orbits <b>rotate</b> ~90s/rev; nodes <b>pulse</b> when their value changes</div>
        <div className="fu-motion-row"><span className="fu-dot"></span>click a node → camera <b>zooms</b> into its detail panel; core breathes</div>
      </div>
    </div>
  );
}

Object.assign(window, { FuturAurora, FuturOrbital });
