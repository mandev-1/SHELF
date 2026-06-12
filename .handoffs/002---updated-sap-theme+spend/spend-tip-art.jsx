/* ShELF — "Where the money goes" hover popup explorations.
   A realistic stacked-bar chart (frozen hover on one column) + three popup
   directions + micro-states, presented on a design canvas.
   All styles live in the host <style>. Exports SpendTipCanvas. */

/* ---------- category tokens (fixed hues from the brief) ---------- */
const STP_CATS = {
  housing: { hue: "#6366f1", name: "Housing" },
  groceries: { hue: "#f59e0b", name: "Groceries" },
  eatingout: { hue: "#eab308", name: "Eating out" },
  taxi: { hue: "#d946ef", name: "Taxi & delivery" },
  transport: { hue: "#3b82f6", name: "Transport" },
  home: { hue: "#14b8a6", name: "Home" },
  electronics: { hue: "#06b6d4", name: "Electronics" },
  clothing: { hue: "#2dd4bf", name: "Clothing" },
  fun: { hue: "#ec4899", name: "Fun" },
  health: { hue: "#22c55e", name: "Health" },
  shopping: { hue: "#f97316", name: "Shopping" },
  vending: { hue: "#a78bfa", name: "Vending" },
  cash: { hue: "#84cc16", name: "Cash" },
  fees: { hue: "#ef4444", name: "Fees" },
  other: { hue: "#94a3b8", name: "Other" },
};
const STP_ORDER = ["groceries", "eatingout", "transport", "fun", "shopping", "health", "vending", "taxi", "home", "electronics", "clothing", "cash", "fees", "other"];

const fmtK = (v) => Math.round(v).toLocaleString("en-US").replace(/,/g, " ");

/* ---------- the frozen hover day: May 14 ---------- */
const HOVER_COL = 13;
const HOVER_ITEMS = [
  { label: "Albert", cat: "groceries", amt: 1234.5 },
  { label: "Alza.cz — USB-C hub", cat: "electronics", amt: 890 },
  { label: "Rohlík.cz", cat: "groceries", amt: 642 },
  { label: "PID Lítačka — 30 days", cat: "transport", amt: 550 },
  { label: "Pizza Nuova", cat: "eatingout", amt: 458 },
  { label: "Kino Aero", cat: "fun", amt: 320 },
  { label: "Café Letka", cat: "eatingout", amt: 186 },
  { label: "Vending — office", cat: "vending", amt: 42.5 },
];
const HOVER_TOTAL = HOVER_ITEMS.reduce((s, x) => s + x.amt, 0); // 4 323

function groupItems(items) {
  const by = new Map();
  for (const it of items) {
    if (!by.has(it.cat)) by.set(it.cat, { cat: it.cat, sum: 0, items: [] });
    const g = by.get(it.cat);
    g.sum += it.amt; g.items.push(it);
  }
  return [...by.values()].sort((a, b) => b.sum - a.sum);
}
const HOVER_GROUPS = groupItems(HOVER_ITEMS);

/* ---------- deterministic background columns ---------- */
function rnd(i, j) { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); }
function colSegs(i) {
  if (i === HOVER_COL) {
    const m = new Map();
    for (const it of HOVER_ITEMS) m.set(it.cat, (m.get(it.cat) || 0) + it.amt);
    return [...m.entries()].map(([cat, amt]) => ({ cat, amt }));
  }
  if (rnd(i, 3) < 0.1) return [];
  const total = (350 + rnd(i, 1) * 2400) * (rnd(i, 2) > 0.85 ? 1.35 : 1);
  const n = 2 + Math.floor(rnd(i, 4) * 3);
  const segs = []; let rem = total;
  for (let k = 0; k < n; k++) {
    const cat = STP_ORDER[Math.floor(rnd(i, 5 + k) * STP_ORDER.length)];
    const amt = k === n - 1 ? rem : rem * (0.3 + rnd(i, 9 + k) * 0.4);
    segs.push({ cat, amt }); rem -= amt;
  }
  const m = new Map();
  for (const s of segs) m.set(s.cat, (m.get(s.cat) || 0) + s.amt);
  return [...m.entries()].map(([cat, amt]) => ({ cat, amt }));
}
const COLS = Array.from({ length: 30 }, (_, i) => colSegs(i));
const COL_TOTALS = COLS.map((segs) => segs.reduce((s, x) => s + x.amt, 0));

/* ---------- chart ----------
   mode: "band"      — subtle slot band behind hovered column (direction A)
         "spotlight" — others dimmed + value cap + axis tick (direction B)
         "ring"      — hovered bar ringed, others slightly dimmed (direction C)
         "plain"     — no hover treatment */
function SpendChart({ mode = "band", hoverCol = HOVER_COL, width = 1000, height = 320 }) {
  const W = 760, H = 300;
  const PAD = { top: 18, right: 14, bottom: 24, left: 46 };
  const cw = W - PAD.left - PAD.right, ch = H - PAD.top - PAD.bottom;
  const yMax = Math.max(...COL_TOTALS, 1);
  const yOf = (v) => PAD.top + ch - (v / yMax) * ch;
  const slot = cw / 30;
  const barW = slot * 0.62;
  const xOf = (c) => PAD.left + c * slot + (slot - barW) / 2;
  const avg = COL_TOTALS.reduce((s, v) => s + v, 0) / 30;
  const dimOthers = mode === "spotlight" ? 0.28 : mode === "ring" ? 0.55 : 1;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);

  return (
    <svg className="stp-svg" viewBox={"0 0 " + W + " " + H} preserveAspectRatio="none" style={{ width, height }}>
      {ticks.map((v, i) => (
        <line key={i} className="stp-grid" x1={PAD.left} y1={yOf(v)} x2={W - PAD.right} y2={yOf(v)} />
      ))}
      {ticks.map((v, i) => (
        <text key={i} className="stp-ylab" x={PAD.left - 6} y={yOf(v) + 3.5}>{v > 0 ? fmtK(v / 1000 * 1000 / 1000) + "k" : "0"}</text>
      ))}
      {[1, 5, 10, 15, 20, 25, 30].map((d) => (
        <text key={d} className="stp-xlab" x={xOf(d - 1) + barW / 2} y={H - 4}>{d}</text>
      ))}
      {(mode === "band" || mode === "spotlight") && (
        <rect className="stp-band" x={PAD.left + hoverCol * slot} y={PAD.top - 6} width={slot} height={ch + 6} rx={4} />
      )}
      {COLS.map((segs, i) => {
        if (segs.length === 0) return null;
        let acc = 0;
        const hot = i === hoverCol;
        return (
          <g key={i} opacity={hot ? 1 : dimOthers}>
            {segs.map((s, j) => {
              const yA = yOf(acc); acc += s.amt; const yB = yOf(acc);
              return <rect key={j} x={xOf(i)} y={yB} width={barW} height={Math.max(1, yA - yB)} rx={1.5}
                fill={STP_CATS[s.cat].hue} opacity={hot ? 1 : 0.9} />;
            })}
            {hot && mode === "ring" && (
              <rect x={xOf(i) - 2} y={yOf(acc) - 2} width={barW + 4} height={yOf(0) - yOf(acc) + 4} rx={3.5}
                fill="none" stroke="var(--fg)" strokeOpacity="0.55" strokeWidth="1.2" />
            )}
            {hot && mode === "spotlight" && (
              <g>
                <text className="stp-cap" x={xOf(i) + barW / 2} y={yOf(acc) - 7}>{fmtK(COL_TOTALS[i])}</text>
                <line className="stp-tick" x1={xOf(i) + barW / 2} y1={yOf(0)} x2={xOf(i) + barW / 2} y2={yOf(0) + 5} />
              </g>
            )}
          </g>
        );
      })}
      <line className="stp-avg" x1={PAD.left} y1={yOf(avg)} x2={W - PAD.right} y2={yOf(avg)} />
      <text className="stp-avglab" x={PAD.left + 4} y={yOf(avg) - 5}>avg/day</text>
    </svg>
  );
}

/* ---------- shared card frame (mimics the Strategie card) ---------- */
function ChartCard({ children, chart, hint }) {
  return (
    <div className="stp-card">
      <div className="stp-card-head">
        <div>
          <div className="stp-eyebrow">Spending</div>
          <h3 className="stp-title">Where the money goes</h3>
        </div>
        <span className="stp-hint">{hint || "hover a day for the breakdown"}</span>
      </div>
      <div className="stp-chart-zone">
        {chart}
        {children}
      </div>
    </div>
  );
}

/* ---------- popup building blocks ---------- */
function SplitStrip({ groups, total }) {
  return (
    <div className="stp-split">
      {groups.map((g) => (
        <span key={g.cat} style={{ width: (g.sum / total * 100) + "%", background: STP_CATS[g.cat].hue }}></span>
      ))}
    </div>
  );
}

/* ---------- A · Grouped ledger ---------- */
function PopupGrouped({ groups = HOVER_GROUPS, total = HOVER_TOTAL, day = "May 14", weekday = "Wednesday", caret = "left", more = 0, style }) {
  return (
    <div className={"stp-tip stp-tip--a stp-caret--" + caret} style={style}>
      <div className="stp-tip-head">
        <div className="stp-tip-day"><b>{day}</b><i>{weekday}</i></div>
        <span className="stp-tip-total">{fmtK(total)} <u>CZK</u></span>
      </div>
      <SplitStrip groups={groups} total={total} />
      <div className="stp-groups">
        {groups.map((g) => (
          <div className="stp-group" key={g.cat}>
            <div className="stp-group-head">
              <span className="stp-dot" style={{ background: STP_CATS[g.cat].hue }}></span>
              <span className="stp-group-name">{STP_CATS[g.cat].name}</span>
              <span className="stp-group-sum">{fmtK(g.sum)}</span>
            </div>
            {g.items.map((it, i) => (
              <div className="stp-row" key={i}>
                <span className="stp-row-lab">{it.label}</span>
                <span className="stp-row-amt">{fmtK(it.amt)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      {more > 0 && <div className="stp-more">…+{more} more</div>}
      <div className="stp-foot">{groups.reduce((s, g) => s + g.items.length, 0) + more} expenses · grouped by category</div>
    </div>
  );
}

/* ---------- B · Spotlight spine ---------- */
function PopupSpine({ items = HOVER_ITEMS, total = HOVER_TOTAL, day = "May 14", share = "9% of May", caret = "left", style }) {
  return (
    <div className={"stp-tip stp-tip--b stp-caret--" + caret} style={style}>
      <div className="stp-tip-head stp-tip-head--b">
        <b>{day}</b>
        <span className="stp-share">{share}</span>
        <span className="stp-tip-total">{fmtK(total)} <u>CZK</u></span>
      </div>
      {items.map((it, i) => (
        <div className="stp-row stp-row--b" key={i}>
          <span className="stp-bar" style={{ background: STP_CATS[it.cat].hue }}></span>
          <span className="stp-row-lab">{it.label}</span>
          <span className="stp-row-cat" style={{ color: STP_CATS[it.cat].hue }}>{STP_CATS[it.cat].name}</span>
          <span className="stp-row-amt">{fmtK(it.amt)}</span>
        </div>
      ))}
      <div className="stp-foot">{items.length} expenses · biggest first</div>
    </div>
  );
}

/* ---------- C · Receipt with share bars ---------- */
function PopupReceipt({ items = HOVER_ITEMS, total = HOVER_TOTAL, day = "May 14", style }) {
  return (
    <div className="stp-tip stp-tip--c" style={style}>
      <div className="stp-tip-head">
        <div className="stp-tip-day"><b>{day}</b><i>{items.length} expenses</i></div>
        <span className="stp-tip-total">{fmtK(total)} <u>CZK</u></span>
      </div>
      {items.map((it, i) => (
        <div className="stp-row stp-row--c" key={i} style={{ "--share": (it.amt / total * 100) + "%", "--h": STP_CATS[it.cat].hue }}>
          <span className="stp-rank">{i + 1}</span>
          <span className="stp-dot" style={{ background: STP_CATS[it.cat].hue }}></span>
          <span className="stp-row-lab">{it.label}</span>
          <span className="stp-row-amt">{fmtK(it.amt)}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- micro-state data ---------- */
const SHORT_ITEMS = [
  { label: "Lidl", cat: "groceries", amt: 487 },
  { label: "DM drogerie", cat: "home", amt: 219 },
  { label: "Bolt", cat: "taxi", amt: 142 },
];
const LONG_ITEMS = [
  ["Ikea — shelf brackets", "home", 1240], ["Albert", "groceries", 986], ["Datart — kettle", "electronics", 899],
  ["Restaurace Mlýnec", "eatingout", 745], ["Zara", "clothing", 699], ["Lékárna Dr.Max", "health", 412],
  ["Billa", "groceries", 387], ["Wolt", "taxi", 345], ["Kino Světozor", "fun", 320], ["Tesco", "groceries", 298],
  ["Slevomat — sauna", "fun", 290], ["Bageterie Boulevard", "eatingout", 189], ["PID jízdenka", "transport", 120],
  ["Relay", "shopping", 96], ["Coffee 2 go", "eatingout", 89], ["Automat", "vending", 45], ["Poplatek za výběr", "fees", 35],
  ["Žabka", "groceries", 74], ["Tram lístek", "transport", 30], ["Kaufland", "groceries", 521],
].map(([label, cat, amt]) => ({ label, cat, amt }));
const LONG_GROUPS = groupItems(LONG_ITEMS);
const LONG_TOTAL = LONG_ITEMS.reduce((s, x) => s + x.amt, 0);
const WEEK_ITEMS = [
  { label: "May 12 · Tesco", cat: "groceries", amt: 1102 },
  { label: "May 14 · Alza.cz", cat: "electronics", amt: 890 },
  { label: "May 15 · Pizza Nuova", cat: "eatingout", amt: 458 },
  { label: "May 12 · PID Lítačka", cat: "transport", amt: 550 },
  { label: "May 16 · Kino Aero", cat: "fun", amt: 320 },
  { label: "May 13 · Café Letka", cat: "eatingout", amt: 186 },
].sort((a, b) => b.amt - a.amt);
const WEEK_TOTAL = WEEK_ITEMS.reduce((s, x) => s + x.amt, 0);

/* ---------- micro-state frames ---------- */
function Moment({ children, label }) {
  return (
    <div className="stp-moment">
      {children}
      {label && <span className="stp-moment-lab">{label}</span>}
    </div>
  );
}

/* mini chart sliver for the edge-flip state */
function FlipMoment() {
  return (
    <div className="stp-moment stp-moment--flip">
      <SpendChart mode="band" hoverCol={28} width={760} height={300} />
      <PopupGrouped
        groups={groupItems(SHORT_ITEMS)} total={SHORT_ITEMS.reduce((s, x) => s + x.amt, 0)}
        day="May 29" weekday="Friday" caret="right"
        style={{ position: "absolute", right: 96, top: 60, width: 248 }} />
      <span className="stp-cursor" style={{ right: 64, top: 132 }}></span>
    </div>
  );
}

/* ---------- canvas ---------- */
function SpendTipCanvas() {
  return (
    <DesignCanvas>
      <DCSection id="directions" title="Where the money goes — hover popup" subtitle="Three directions · frozen hover on May 14 · 4 323 CZK across 8 expenses">
        <DCArtboard id="a-grouped" label="A · Grouped ledger — category subtotals + split strip" width={1080} height={620}>
          <div className="stp-stage">
            <ChartCard chart={<SpendChart mode="band" width={1028} height={330} />}>
              <PopupGrouped style={{ position: "absolute", left: 556, top: 64, width: 296 }} />
              <span className="stp-cursor" style={{ left: 532, top: 148 }}></span>
            </ChartCard>
          </div>
        </DCArtboard>
        <DCArtboard id="b-spotlight" label="B · Spotlight — column lit, rest dimmed, caret spine" width={1080} height={620}>
          <div className="stp-stage">
            <ChartCard chart={<SpendChart mode="spotlight" width={1028} height={330} />} hint="hovering May 14">
              <PopupSpine style={{ position: "absolute", left: 556, top: 78, width: 312 }} caret="left" />
              <span className="stp-cursor" style={{ left: 532, top: 162 }}></span>
            </ChartCard>
          </div>
        </DCArtboard>
        <DCArtboard id="c-receipt" label="C · Receipt — ranked rows with share bars" width={1080} height={620}>
          <div className="stp-stage">
            <ChartCard chart={<SpendChart mode="ring" width={1028} height={330} />}>
              <PopupReceipt style={{ position: "absolute", left: 556, top: 70, width: 300 }} />
              <span className="stp-cursor" style={{ left: 532, top: 154 }}></span>
            </ChartCard>
          </div>
        </DCArtboard>
      </DCSection>
      <DCSection id="states" title="Micro-states" subtitle="Direction A vocabulary · each state any direction must survive">
        <DCArtboard id="m-short" label="Short list — 3 items" width={400} height={330}>
          <Moment><PopupGrouped groups={groupItems(SHORT_ITEMS)} total={SHORT_ITEMS.reduce((s, x) => s + x.amt, 0)} day="May 3" weekday="Sunday" caret="none" style={{ width: 264 }} /></Moment>
        </DCArtboard>
        <DCArtboard id="m-long" label="Long list — 20 items, capped" width={400} height={760}>
          <Moment><PopupGrouped groups={LONG_GROUPS} total={LONG_TOTAL} day="May 24" weekday="Saturday" caret="none" more={4} style={{ width: 312 }} /></Moment>
        </DCArtboard>
        <DCArtboard id="m-flip" label="Edge flip — popup left of cursor, caret mirrored" width={760} height={420}>
          <FlipMoment />
        </DCArtboard>
        <DCArtboard id="m-week" label="Weekly mode — day prefixes" width={400} height={420}>
          <Moment><PopupSpine items={WEEK_ITEMS} total={WEEK_TOTAL} day="wk of May 11" share="14% of range" caret="none" style={{ width: 312 }} /></Moment>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

Object.assign(window, { SpendTipCanvas });
