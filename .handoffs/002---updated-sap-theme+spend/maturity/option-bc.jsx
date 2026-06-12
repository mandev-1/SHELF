/* Options B (Editorial) and C (Cockpit) */

function OptionB() {
  return (
    <div className="mo">
      <div className="mob-hero">
        <span className="mo-cap">Net worth · April 2026</span>
        <div className="mob-big mo-mono" style={{ marginTop: 8 }}>637 400 Kč</div>
        <div className="mob-sub">
          <span className="mob-delta mo-acc">▲ 17 900 Kč</span>
          <span className="mo-faint"> this month · on pace for </span>
          <span className="mo-mono" style={{ color: "#c7ccd4" }}>1.11M Kč</span>
          <span className="mo-faint"> by 2031</span>
        </div>
      </div>
      <window.MoChartGhost />
      <div className="mob-grid" style={{ marginTop: 12 }}>
        {[
          ["Emergency fund", "3.0 of 6 months", "50%"],
          ["Savings rate", "17% of income", "▲ 2pt"],
          ["To programs", "8 200 Kč /mo", "2 plans"],
          ["Next pot", "Standing desk", "Aug ’26"],
        ].map(([t, v, d]) => (
          <div className="mob-cell" key={t}>
            <div className="mo-cap">{t}</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{v}</div>
            <div className="mo-faint" style={{ fontSize: 10.5, marginTop: 2 }}>{d}</div>
          </div>
        ))}
      </div>
      <div className="mo-motion">
        <div className="mo-motion-row"><span className="mo-dot"></span><b>spring(280, 26)</b> — hero number settles like a dial</div>
        <div className="mo-motion-row"><span className="mo-dot"></span>cards stagger in <b>40ms apart</b>, fade + 6px rise</div>
        <div className="mo-motion-row"><span className="mo-dot"></span>chart line <b>draws once</b> over 600ms on first view</div>
      </div>
    </div>
  );
}

function OptionC() {
  return (
    <div className="mo moc" style={{ padding: 0 }}>
      <div className="moc-rail">
        <span className="mo-cap" style={{ padding: "0 9px" }}>Strategie</span>
        {[["Overview", "637k Kč", true], ["Statement", "Apr · 30 rows", false], ["Programs", "16.4k Kč", false], ["Pots", "3 active", false], ["Method", "step 4 of 7", false]].map(([n, s, on]) => (
          <div className={"moc-rail-item" + (on ? " on" : "")} key={n}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{n}</span>
            <span className="mo-mono mo-faint" style={{ fontSize: 10 }}>{s}</span>
          </div>
        ))}
      </div>
      <div className="moc-main">
        <div className="moc-band">
          {[["Surplus", "+17.9k", true], ["Spend wk", "21.9k", false], ["5Y", "1.11M", false]].map(([l, v, a]) => (
            <div className="moc-chip" key={l}>
              <div className="mo-cap">{l}</div>
              <div className={"mo-mono " + (a ? "mo-acc" : "")} style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>
        <div className="moc-panel">
          <span className="mo-cap">Compounding · balanced 7%</span>
          <window.MoChartGhost />
        </div>
        <div className="mo-motion" style={{ padding: "10px 2px 0" }}>
          <div className="mo-motion-row"><span className="mo-dot"></span>rail sections <b>crossfade 180ms</b>, content slides 12px</div>
          <div className="mo-motion-row"><span className="mo-dot"></span>chips share a <b>layoutId</b> — KPI morphs into panel header</div>
          <div className="mo-motion-row"><span className="mo-dot"></span>scroll = rail KPIs <b>update live</b> (scrollspy)</div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { OptionB, OptionC });
