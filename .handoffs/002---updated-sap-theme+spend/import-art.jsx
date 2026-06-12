/* ShELF — Statement import explorations.
   Four full-modal directions + three micro-moments, on a design canvas.
   Class vocabulary lives in the host <style>. Exports ImportCanvas. */

const R = window.SHELF_ROWS = [
  { d: "01.05", who: "Albert", det: "Nákup", amt: "−1 234,56", cat: "Groceries", hue: "var(--hue-green)" },
  { d: "02.05", who: "PID Lítačka", det: "Kupón 30 dní", amt: "−550,00", cat: "Transport", hue: "var(--hue-blue)" },
  { d: "03.05", who: "Mzda", det: "Výplata", amt: "+42 000,00", cat: "Income", hue: "var(--hue-green)", plus: true },
  { d: "05.05", who: "Netflix", det: "Subscription", amt: "−319,00", cat: "Subs", hue: "var(--hue-purple)" },
  { d: "07.05", who: "Alza.cz", det: "Objednávka 8841", amt: "−2 890,00", cat: "Shopping", hue: "var(--hue-orange)" },
  { d: "09.05", who: "Café Letka", det: "Platba kartou", amt: "−186,00", cat: "Eating out", hue: "var(--hue-rose)" },
];

function Row({ r, ghost }) {
  return (
    <div className={"imp-row" + (ghost ? " imp-row--ghost" : "")}>
      <span className="imp-d">{r.d}</span>
      <span className="imp-who">{r.who}<i>{r.det}</i></span>
      <span className="imp-cat" style={{ "--h": r.hue }}>{r.cat}</span>
      <span className={"imp-amt" + (r.plus ? " up" : "")}>{r.amt}</span>
    </div>
  );
}

function Lock() {
  return <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>;
}
function Up() {
  return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>;
}
function Check() {
  return <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>;
}

/* ---------- A · Ledger split: paste left, live preview right ---------- */
function VariantA() {
  return (
    <div className="imp-stage">
      <div className="imp-modal">
        <div className="imp-head">
          <div>
            <div className="imp-eyebrow"><Up /> Import</div>
            <h3 className="imp-title">Bring in a bank statement</h3>
            <p className="imp-sub">Paste or drop an export. Parsed on your device — nothing leaves this tab.</p>
          </div>
          <div className="imp-chips">
            <span className="chip chip--ok"><Check /> 24 recognized</span>
            <span className="chip">2 duplicates</span>
            <span className="chip chip--warn">1 skipped</span>
          </div>
        </div>
        <div className="imp-split">
          <div className="imp-paste">
            <div className="imp-paste-bar">
              <span className="ext">.csv</span><span className="ext">.txt</span><span className="ext">.pdf</span>
              <span className="imp-local"><Lock /> stays local</span>
            </div>
            <div className="imp-code">
              <div><b>Datum;Protistrana;Detaily;Částka;Měna</b></div>
              {R.map((r, i) => (
                <div key={i}><span className="tk-d">{r.d}.2026;</span><span className="tk-w">{r.who};{r.det};</span><span className={"tk-a" + (r.plus ? " up" : "")}>{r.amt};CZK</span></div>
              ))}
              <div className="tk-cursor">▍</div>
            </div>
          </div>
          <div className="imp-preview">
            <div className="imp-prev-head">Live preview <span>May 2026</span></div>
            <div className="imp-rows">
              {R.map((r, i) => <Row key={i} r={r} />)}
              <Row r={{ d: "11.05", who: "Rohlík.cz", det: "parsing…", amt: "−1 0", cat: "…", hue: "var(--hue-zinc)" }} ghost />
            </div>
            <div className="imp-tally">
              <span>In <b className="up">+42 000</b></span>
              <span>Out <b>−5 179</b></span>
              <span>Net <b className="up">+36 821</b></span>
            </div>
          </div>
        </div>
        <div className="imp-foot">
          <span className="imp-local"><Lock /> 100% local · reversible after import</span>
          <div className="imp-acts">
            <button className="b-ghost">Cancel</button>
            <button className="b-go"><Up /> Import 24 rows</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- B · The altar: one luminous drop zone ---------- */
function VariantB() {
  return (
    <div className="imp-stage imp-stage--glow">
      <div className="alt-wrap">
        <div className="imp-eyebrow" style={{ justifyContent: "center" }}><Up /> Import</div>
        <div className="alt-zone">
          <span className="alt-tick alt-tick--tl"></span><span className="alt-tick alt-tick--tr"></span>
          <span className="alt-tick alt-tick--bl"></span><span className="alt-tick alt-tick--br"></span>
          <div className="alt-orb"><Up /></div>
          <h2 className="alt-title">Drop your statement</h2>
          <p className="alt-sub">or paste anywhere — <kbd>⌘</kbd><kbd>V</kbd></p>
          <div className="alt-exts">
            <span className="ext">.csv</span><span className="ext">.txt</span><span className="ext">.pdf</span>
          </div>
        </div>
        <div className="alt-trust">
          <span><Lock /> parsed on device</span><i>·</i>
          <span>nothing uploaded</span><i>·</i>
          <span>undo any import</span>
        </div>
      </div>
      <div className="alt-noise" aria-hidden="true">
        {["−1 234,56", "CZK", "03.05.2026", "+42 000,00", "Datum;Částka", "−319,00", "Mzda", "·", "−550,00", "Protistrana"].map((t, i) => (
          <span key={i} className={"alt-n alt-n--" + i}>{t}</span>
        ))}
      </div>
    </div>
  );
}

/* ---------- C · The scanner: statement feeding through a scanline ---------- */
function VariantC() {
  const pucks = [
    { cat: "Groceries", amt: "−8 412", hue: "var(--hue-green)", n: 9 },
    { cat: "Transport", amt: "−1 100", hue: "var(--hue-blue)", n: 3 },
    { cat: "Subs", amt: "−957", hue: "var(--hue-purple)", n: 4 },
    { cat: "Eating out", amt: "−2 304", hue: "var(--hue-rose)", n: 6 },
    { cat: "Income", amt: "+42 000", hue: "var(--hue-green)", n: 1, plus: true },
  ];
  return (
    <div className="imp-stage">
      <div className="scan-wrap">
        <div className="imp-eyebrow"><Up /> Import · parsing</div>
        <div className="scan-paper">
          <div className="scan-paper-head">VÝPIS Z ÚČTU <span>05 / 2026</span></div>
          {R.slice(0, 4).map((r, i) => (
            <div className="scan-line" key={i}><span>{r.d}</span><span>{r.who}</span><span className={r.plus ? "up" : ""}>{r.amt}</span></div>
          ))}
          <div className="scan-line scan-line--fade"><span>09.05</span><span>Café Letka</span><span>−186,00</span></div>
        </div>
        <div className="scan-slit">
          <div className="scan-beam"></div>
        </div>
        <div className="scan-progress">
          <div className="scan-progress-bar"><span style={{ width: "61%" }}></span></div>
          <span className="scan-progress-lab">Parsing on device… <b>61%</b> · 14 of 23 rows</span>
        </div>
        <div className="scan-pucks">
          {pucks.map((p, i) => (
            <div className="puck-cat" key={i} style={{ "--h": p.hue, animationDelay: (i * 0.08) + "s" }}>
              <span className="puck-cat-dot"></span>
              <span className="puck-cat-name">{p.cat}</span>
              <span className={"puck-cat-amt" + (p.plus ? " up" : "")}>{p.amt}</span>
              <span className="puck-cat-n">{p.n}</span>
            </div>
          ))}
        </div>
        <div className="imp-foot imp-foot--bare">
          <span className="imp-local"><Lock /> nothing leaves this tab</span>
          <div className="imp-acts">
            <button className="b-ghost">Cancel</button>
            <button className="b-go b-go--wait">Import when done</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- D · Stepped wizard: Paste → Review → Import ---------- */
function VariantD() {
  return (
    <div className="imp-stage">
      <div className="imp-modal imp-modal--wiz">
        <div className="wiz-rail">
          <div className="imp-eyebrow"><Up /> Import</div>
          <div className="wiz-steps">
            <div className="wiz-step wiz-step--done"><span className="wiz-dot"><Check /></span><div><b>Paste</b><i>23 lines read</i></div></div>
            <div className="wiz-step wiz-step--on"><span className="wiz-dot">2</span><div><b>Review</b><i>fix categories</i></div></div>
            <div className="wiz-step"><span className="wiz-dot">3</span><div><b>Import</b><i>into May 2026</i></div></div>
          </div>
          <div className="wiz-note"><Lock /> Parsed locally. You can undo the whole batch afterwards.</div>
        </div>
        <div className="wiz-main">
          <h3 className="imp-title">Review 23 rows</h3>
          <p className="imp-sub">Tap a category to change it. Confident guesses are pre-filled.</p>
          <div className="imp-rows imp-rows--card">
            {R.map((r, i) => <Row key={i} r={r} />)}
            <div className="imp-row imp-row--warn">
              <span className="imp-d">!</span>
              <span className="imp-who">Unrecognized line <i>"#REF;;–"</i></span>
              <span className="imp-cat" style={{ "--h": "var(--hue-orange)" }}>skipped</span>
              <span className="imp-amt">—</span>
            </div>
          </div>
          <div className="imp-foot imp-foot--bare">
            <button className="b-ghost">Back</button>
            <button className="b-go"><Up /> Import into May</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- micro-moments ---------- */
function MomentDrag() {
  return (
    <div className="imp-stage imp-stage--moment">
      <div className="alt-zone alt-zone--hot">
        <div className="alt-orb alt-orb--hot"><Up /></div>
        <h3 className="alt-title" style={{ fontSize: 20 }}>Release to parse</h3>
        <p className="alt-sub">vypis-05-2026.csv · 14 KB</p>
      </div>
    </div>
  );
}
function MomentParsing() {
  return (
    <div className="imp-stage imp-stage--moment">
      <div className="mom-card">
        <div className="scan-progress-bar"><span className="shimmer" style={{ width: "38%" }}></span></div>
        <div className="mom-skel">
          {[68, 84, 57, 76].map((w, i) => (
            <div className="mom-skel-row" key={i}><span style={{ width: 34 }}></span><span style={{ width: w + "%" }}></span><span style={{ width: 52 }}></span></div>
          ))}
        </div>
        <span className="imp-local" style={{ alignSelf: "center" }}>reading 23 rows…</span>
      </div>
    </div>
  );
}
function MomentDone() {
  return (
    <div className="imp-stage imp-stage--moment">
      <div className="mom-done">
        <div className="alt-orb alt-orb--done"><Check /></div>
        <b>24 rows added to May</b>
        <span>Net +36 821 CZK · <u>Undo</u></span>
      </div>
    </div>
  );
}

/* ---------- canvas ---------- */
function ImportCanvas() {
  return (
    <DesignCanvas>
      <DCSection id="modals" title="Bring in a bank statement" subtitle="Four directions for the import surface — ShELF dark, emerald accent">
        <DCArtboard id="a-ledger" label="A · Ledger split — paste + live preview" width={1080} height={680}><VariantA /></DCArtboard>
        <DCArtboard id="b-altar" label="B · The altar — one luminous drop zone" width={1080} height={680}><VariantB /></DCArtboard>
        <DCArtboard id="c-scanner" label="C · The scanner — parsing as theater" width={1080} height={680}><VariantC /></DCArtboard>
        <DCArtboard id="d-wizard" label="D · Stepped — Paste → Review → Import" width={1080} height={680}><VariantD /></DCArtboard>
      </DCSection>
      <DCSection id="moments" title="Micro-moments" subtitle="States any direction can borrow">
        <DCArtboard id="m-drag" label="Drag-over" width={420} height={300}><MomentDrag /></DCArtboard>
        <DCArtboard id="m-parse" label="Parsing" width={420} height={300}><MomentParsing /></DCArtboard>
        <DCArtboard id="m-done" label="Success + undo" width={420} height={300}><MomentDone /></DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

Object.assign(window, { ImportCanvas });
