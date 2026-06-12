/* Futuristic boards — F1 HUD, F2 Aurora, F3 Orbital */

function GlowChart({ stroke = "#22d3ee" }) {
  return (
    <div style={{ position: "relative", height: 120 }}>
      <svg viewBox="0 0 400 120" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <defs>
          <linearGradient id={"gc-" + stroke.slice(1)} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0,108 C90,102 170,86 250,60 C320,38 360,24 400,10 L400,120 L0,120 Z" fill={"url(#gc-" + stroke.slice(1) + ")"} />
        <path d="M0,108 C90,102 170,86 250,60 C320,38 360,24 400,10" fill="none" stroke={stroke} strokeWidth="5" opacity="0.18" />
        <path d="M0,108 C90,102 170,86 250,60 C320,38 360,24 400,10" fill="none" stroke={stroke} strokeWidth="1.6" />
        <circle cx="400" cy="10" r="3.5" fill={stroke} />
        <circle cx="400" cy="10" r="8" fill="none" stroke={stroke} strokeWidth="1" opacity="0.4" />
      </svg>
    </div>
  );
}

function FuturHUD() {
  return (
    <div className="fu hud">
      <div className="hud-scan"></div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="fu-cap hud-cap">Strategie /// capital interface</span>
        <span className="fu-mono" style={{ fontSize: 9, color: "#3d7a8a" }}>APR.2026 · CZK·EUR · SYNC ●</span>
      </div>
      <div className="hud-panel">
        <span className="hud-tick tl"></span><span className="hud-tick br"></span>
        <span className="fu-cap hud-cap">Net worth</span>
        <div className="hud-big fu-mono" style={{ margin: "4px 0 10px" }}>637 400 Kč</div>
        <div className="hud-readout">
          {[["Surplus", "+17.9k", 1], ["5Y proj", "1.11M"], ["E-fund", "50%"], ["Rate", "17%"]].map(([l, v, g]) => (
            <div key={l}><div className="fu-cap hud-cap">{l}</div><div className={"hud-val fu-mono" + (g ? " g" : "")}>{v}</div></div>
          ))}
        </div>
      </div>
      <div className="hud-panel">
        <span className="hud-tick tl"></span><span className="hud-tick br"></span>
        <span className="fu-cap hud-cap">Projection · balanced 7.0%</span>
        <GlowChart />
      </div>
      <div className="hud-panel" style={{ flex: 1 }}>
        <span className="fu-cap hud-cap">Sequence · 4/7 active</span>
        <div style={{ marginTop: 8 }}>
          {[["01 BUFFER", 100], ["02 MATCH", 100], ["03 DEBT", 100], ["04 E-FUND", 50], ["05 TAX-ADV", 35], ["06 INDEX", 82]].map(([n, p]) => (
            <div className="hud-row" key={n}>
              <span className="fu-mono" style={{ width: 74, fontSize: 9.5, letterSpacing: "0.08em" }}>{n}</span>
              <span className="hud-bar"><span style={{ width: p + "%" }}></span></span>
              <span className="fu-mono" style={{ fontSize: 9.5, width: 30, textAlign: "right" }}>{p}%</span>
            </div>
          ))}
        </div>
      </div>
      <div className="fu-motion">
        <div className="fu-motion-row"><span className="fu-dot"></span><b>scanline</b> drifts down the page; numbers <b>decode-flicker</b> on change</div>
        <div className="fu-motion-row"><span className="fu-dot"></span>chart endpoint <b>pulses</b>; bars charge left→right with glow trail</div>
      </div>
    </div>
  );
}

window.FuturHUD = FuturHUD;
window.GlowChart = GlowChart;
