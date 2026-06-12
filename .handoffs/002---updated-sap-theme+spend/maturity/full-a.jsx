/* Full-page boards: shared data + Option A (Ledger) */
const MF = {
  cats: [["Housing", 30550, "#6366f1"], ["Groceries", 12220, "#f59e0b"], ["Shopping", 8930, "#f97316"], ["Eating out", 6110, "#eab308"], ["Home", 5170, "#14b8a6"], ["Transport", 4230, "#3b82f6"], ["Other", 4700, "#94a3b8"], ["Health", 3525, "#22c55e"]],
  weeks: [["Wk 1", 40300, 100], ["Wk 2", 16400, 41], ["Wk 3", 11200, 28], ["Wk 4", 10200, 25], ["Wk 5", 840, 3]],
  steps: [["Starter buffer", "done"], ["Capture free money", "done"], ["Kill high-interest debt", "done"], ["Full emergency fund", "50%"], ["Tax-advantaged investing", "35%"], ["Broad index investing", "ongoing"], ["Goal & taxable", "queued"]],
  pots: [["Standing desk", 54, "Aug ’26"], ["Japan trip · spring", 35, "Feb ’27"], ["New laptop", 43, "Jan ’27"]],
};

function MfCatTable({ compact }) {
  const max = MF.cats[0][1];
  return (
    <div>
      {MF.cats.slice(0, compact ? 6 : 8).map(([n, v, h]) => (
        <div className="mf-table-row" key={n}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: h, flexShrink: 0 }}></span>
          <span className="mo-dim" style={{ width: 72 }}>{n}</span>
          <span className="mf-bar"><span style={{ width: (v / max) * 100 + "%", background: h, opacity: 0.7 }}></span></span>
          <span className="mo-mono" style={{ fontSize: 10.5, color: "#c7ccd4" }}>{(v / 1000).toFixed(1)}k</span>
        </div>
      ))}
    </div>
  );
}

function MfWeeks() {
  return (
    <div>
      {MF.weeks.map(([w, amt, pct]) => (
        <div className="mf-weekrow" key={w}>
          <span className="mo-faint" style={{ width: 30 }}>{w}</span>
          <span className="mf-weektrack">
            {MF.cats.slice(0, 5).map(([n, v, h], i) => (
              <span key={n} style={{ width: (pct * (0.32 - i * 0.05)) + "%", background: h, opacity: 0.85 }}></span>
            ))}
          </span>
          <span className="mo-mono mo-faint" style={{ width: 42, textAlign: "right" }}>{(amt / 1000).toFixed(1)}k</span>
        </div>
      ))}
    </div>
  );
}

function MfSteps({ bare }) {
  return (
    <div>
      {MF.steps.map(([n, s], i) => (
        <div className="mf-step" key={n}>
          <span className={"mf-stepnum" + (s === "done" ? " done" : "")}>{s === "done" ? "✓" : i + 1}</span>
          <span style={{ flex: 1, color: s === "queued" ? "#5b626c" : "#c7ccd4" }}>{n}</span>
          {/%/.test(s) && <span className="mf-bar" style={{ maxWidth: 70 }}><span style={{ width: s, background: "#34d399" }}></span></span>}
          <span className="mo-mono mo-faint" style={{ fontSize: 9.5, width: 46, textAlign: "right" }}>{s}</span>
        </div>
      ))}
    </div>
  );
}

function FullA() {
  return (
    <div className="mo mfx">
      <div className="mf-sect" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="mo-cap">Strategie</span>
        <span className="mo-mono mo-faint" style={{ fontSize: 10 }}>Apr 2026 · CZK ↔ EUR</span>
      </div>
      <div className="mf-sect" style={{ padding: "0 22px" }}>
        <div className="moa-statbar" style={{ border: 0 }}>
          {[["Net worth", "637k Kč"], ["Surplus /mo", "+17.9k", 1], ["5Y proj.", "1.11M Kč"], ["E-fund", "3.0/6 mo"], ["Save rate", "17%"]].map(([l, v, a]) => (
            <div className="moa-stat" key={l}><span className="mo-cap">{l}</span><span className={"moa-val mo-mono" + (a ? " mo-acc" : "")}>{v}</span></div>
          ))}
        </div>
      </div>
      <div className="mf-sect"><window.MoChartGhost /></div>
      <div className="mf-2col" style={{ borderBottom: "1px solid #15181d" }}>
        <div>
          <div className="mf-h"><span className="mo-cap">Spending by week</span><span className="mo-mono mo-faint" style={{ fontSize: 9.5 }}>avg 15.9k</span></div>
          <MfWeeks />
          <div className="mf-h" style={{ marginTop: 14 }}><span className="mo-cap">Categories</span></div>
          <MfCatTable />
        </div>
        <div>
          <div className="mf-h"><span className="mo-cap">Method</span><span className="mo-mono mo-faint" style={{ fontSize: 9.5 }}>step 4 of 7</span></div>
          <MfSteps />
          <div className="mf-h" style={{ marginTop: 14 }}><span className="mo-cap">vs March</span></div>
          {[["Net", "+1.1k", 1], ["Income", "−1.3k"], ["Expenses", "−2.3k", 1]].map(([l, v, g]) => (
            <div className="mf-table-row" key={l}><span className="mo-dim" style={{ flex: 1 }}>{l}</span><span className={"mo-mono " + (g ? "mo-acc" : "mo-red")} style={{ fontSize: 11 }}>{v}</span></div>
          ))}
        </div>
      </div>
      <div className="mf-2col">
        <div>
          <div className="mf-h"><span className="mo-cap">Programs · 16.4k Kč</span></div>
          {[["Building savings ČS", "4.7k", "#6595ee"], ["DIP — investiční účet", "3.5k", "#34c891"]].map(([n, v, h]) => (
            <div className="mf-table-row" key={n}><span style={{ width: 7, height: 7, borderRadius: "50%", background: h }}></span><span className="mo-dim" style={{ flex: 1 }}>{n}</span><span className="mo-mono" style={{ fontSize: 10.5 }}>{v} /mo</span></div>
          ))}
        </div>
        <div>
          <div className="mf-h"><span className="mo-cap">Pots</span></div>
          {MF.pots.map(([n, p, eta]) => (
            <div className="mf-table-row" key={n}><span className="mo-dim" style={{ width: 86 }}>{n}</span><span className="mf-bar"><span style={{ width: p + "%", background: "#34d399" }}></span></span><span className="mo-mono mo-faint" style={{ fontSize: 9.5 }}>{eta}</span></div>
          ))}
        </div>
      </div>
      <div className="mo-motion" style={{ padding: "12px 22px 16px" }}>
        <div className="mo-motion-row"><span className="mo-dot"></span>whole page is <b>one document</b> — hairlines, zero card chrome, 2-col below the fold</div>
        <div className="mo-motion-row"><span className="mo-dot"></span>motion: 120ms snaps; sections <b>don't animate in</b>, they're just there</div>
      </div>
    </div>
  );
}

Object.assign(window, { MF, MfCatTable, MfWeeks, MfSteps, FullA });
