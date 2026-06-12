/* ShELF — Visual Flow of Action.
   A node-graph plane in isolated babel scope (icons prefixed VF, no `styles`).
   Pan/zoom canvas, draggable sector-tinted task cards, marching dashed edges,
   three planes (Main / Grazeland / Bin), and Copy-for-AI. */

const VF = {
  copy: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>,
  plus: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14"/></svg>,
  minus: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" {...p}><path d="M5 12h14"/></svg>,
  fit: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/></svg>,
  x: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" {...p}><path d="M6 6l12 12M18 6L6 18"/></svg>,
};

/* sector rim tints — grounded in ShELF's real SECTOR_HEX tokens */
const VF_SECTORS = {
  fern:    { rim: "rgba(62,124,74,0.62)",   wash: "rgba(62,124,74,0.10)" },
  pacific: { rim: "rgba(95,179,198,0.60)",  wash: "rgba(95,179,198,0.10)" },
  bone:    { rim: "rgba(230,217,195,0.55)", wash: "rgba(230,217,195,0.07)" },
  jet:     { rim: "rgba(120,140,140,0.45)", wash: "rgba(20,30,30,0.30)" },
};

/* ---- node content, laid out in world coordinates ---- */
const VF_MAIN_NODES = [
  { id: "n1",  x: 40,   y: 150, w: 186, t: "this week goals", note: "something like the hopper but for the top-6 goals for THIS DAY ( this week ) ( this month )" },
  { id: "n2",  x: 270,  y: 40,  w: 250, sector: "fern", t: "adding a life-planner into ShELF", note: "this would help you actually plan your life on a macro scale. zoom out + commit to long-term decisions, then snap back to today. the idea is fed by autoskola — you set the master goal and it backfills the rest." },
  { id: "n3",  x: 600,  y: 40,  w: 196, t: "sports strategie pro SHELF" },
  { id: "n4",  x: 110,  y: 300, w: 196, t: "Monthly predictions", note: "set a prediction for where I'll be at the end of the quarter — or some crazy moonshot" },

  { id: "n5",  x: 470,  y: 240, w: 200, sector: "pacific", t: "Autoskola", sub: "skupina b", tag: "nutne", tagClass: "", note: "finish theory, then book the practical exam" },
  { id: "n6",  x: 640,  y: 350, w: 244, sector: "pacific", t: "ScreenMaster — sortified", note: "level 1 — finished\nlevel 2 — in progress\nbuild the overlay so it auto-sorts captures by tag", date: "2024-01-21" },
  { id: "n7",  x: 60,   y: 440, w: 196, t: "3D printing something for toothpaste" },
  { id: "n8",  x: 40,   y: 600, w: 238, t: "3D print: shaving guard + the clipper (beard-trimmer attachments)" },
  { id: "n9",  x: 470,  y: 430, w: 214, sector: "fern", t: "CAP FULLSTACK · SAP Learning", note: "course in progress\npass the unit test" },
  { id: "n10", x: 360,  y: 540, w: 214, snap: true, t: "Demo Kit · SAPUI5 SDK", note: "reference component gallery" },
  { id: "n11", x: 620,  y: 470, w: 208, t: "F1RACP Level 7 · 3D Prague", note: "requires a lot of XP" },
  { id: "n12", x: 640,  y: 590, w: 168, t: "Finish 3D Prague" },

  { id: "n13", x: 760,  y: 560, w: 196, t: "SAP Subproject", note: "part 1: cleanup\npart 2: build the practical\nget it reviewed" },
  { id: "n14", x: 560,  y: 640, w: 224, t: "hyperlube — 3D project", url: "github.com/martin/hyperlube", note: "current: working on the lube path" },
  { id: "n15", x: 560,  y: 770, w: 200, t: "gomoku — 42 project", note: "discovery → build it" },
  { id: "n16", x: 320,  y: 720, w: 222, sector: "bone", t: "Selling Doja CAT tickets", note: "commit to a seat\nlist on resale\nmeet & hand over" },
  { id: "n17", x: 560,  y: 880, w: 210, t: "movie roost · 42 project", note: "scrape + tag the catalogue" },
  { id: "n18", x: 560,  y: 980, w: 222, t: "export system · 42 Project", note: "write the exporter for the shelf backup" },
  { id: "n19", x: 830,  y: 760, w: 200, t: "Mail", note: "someone should get croissants for the birthday" },

  { id: "n20", x: 1200, y: 330, w: 188, t: "PITCH", note: "play with it:\n1 — share without forcing\n2 — let the magic do the work\nkeep it human" },
  { id: "n21", x: 1410, y: 330, w: 178, t: "Restaurant index", note: "rank the spots we keep going back to. score by 4 axes.", date: "2024-01-19" },
  { id: "n22", x: 1610, y: 330, w: 200, sector: "fern", t: "APP IDEA", note: "a central dashboard that pulls every window into one formation, then deals the right deck to the right side depending on context" },
  { id: "n23", x: 1200, y: 480, w: 210, snap: true, t: "Kapil saved stuff — watch later", note: "long backlog of clips" },
  { id: "n24", x: 1610, y: 480, w: 164, t: "Other Projects", sub: "Pet / family" },
  { id: "n25", x: 1410, y: 500, w: 184, sector: "fern", t: "multimegen.de — family", note: "set up the page\npush it live" },
  { id: "n26", x: 1610, y: 560, w: 200, t: "multiverse dev — portfolio", note: "design pass\ncloud application dev — principles\ncopy + ship" },

  { id: "n27", x: 1610, y: 690, w: 162, t: "Debt — SCHO Diplom" },
  { id: "n28", x: 1790, y: 690, w: 130, t: "Debt — VZP" },
  { id: "n29", x: 1410, y: 700, w: 184, t: "Debt — Tobi · asi 6k CZK" },
  { id: "n30", x: 1610, y: 760, w: 120, t: "Debt — GLS" },
  { id: "n31", x: 1760, y: 760, w: 156, t: "Cestrian · Dit blue" },
  { id: "n32", x: 1410, y: 790, w: 184, status: "blocked", t: "Selling Madbuds 2018", date: "2024-01-21" },
  { id: "n33", x: 1610, y: 850, w: 188, snap: true, t: "Selling Pavel — blabla", note: "waiting on his reply" },
  { id: "n34", x: 1880, y: 860, w: 184, sector: "pacific", t: "EXIT", url: "notion.so/exit-plan", note: "the slow, deliberate exit plan" },

  { id: "n35", x: 1880, y: 600, w: 224, t: "Watch Sandra Huller movies", url: "letterboxd.com/sandra-huller", note: "Anatomy of a Fall, Toni Erdmann…" },
  { id: "n36", x: 1430, y: 930, w: 170, t: "watch ROBOTI", url: "youtube.com/watch", date: "2024-02-02" },
  { id: "n37", x: 1180, y: 850, w: 184, status: "abeyed", t: "TVPI plot project", note: "osatdsdsadasfadsf — parked for now" },

  { id: "n38", x: 1280, y: 1080, w: 214, t: "Experiment: cybantic clay model for the cig", note: "better model for the vlat — try in a nicer resin" },
  { id: "n39", x: 1530, y: 1070, w: 206, sector: "fern", t: "something with Bendi", note: "I think this Bendi is renamed and has some HUDdler — climbs to also-quite-something the Bendstory thing predict my interest for it…" },
];

const VF_MAIN_EDGES = [
  ["n5","n6"], ["n6","n12"], ["n11","n12"], ["n12","n13"], ["n9","n13"],
  ["n13","n14"], ["n14","n15"], ["n14","n17"], ["n13","n26"], ["n2","n6"],
  ["n24","n26"], ["n25","n26"], ["n21","n22"], ["n20","n21"], ["n29","n32"],
  ["n32","n33"], ["n27","n31"], ["n26","n27"], ["n16","n15"], ["n13","n19"],
];

const VF_GRAZE_NODES = [
  { id: "g1", x: 120, y: 120, w: 220, t: "screensaver that draws my week", note: "let it graze here until it's worth real time" },
  { id: "g2", x: 420, y: 220, w: 200, t: "learn to develop film at home" },
  { id: "g3", x: 200, y: 320, w: 230, t: "tiny synth from a breadboard", note: "someday-maybe — no pressure" },
  { id: "g4", x: 520, y: 380, w: 190, t: "repaint the old longboard" },
];

const VF_BIN_NODES = [
  { id: "b1", x: 140, y: 140, w: 230, status: "abeyed", t: "crypto side-hustle", note: "WHY: not worth the attention right now" },
  { id: "b2", x: 440, y: 240, w: 210, status: "abeyed", t: "rewrite shelf in Rust", note: "WHY: premature — the React app is fine" },
  { id: "b3", x: 240, y: 360, w: 220, status: "abeyed", t: "daily vlog channel", note: "WHY: doesn't fit this season" },
];

const VF_PLANES = {
  main:      { nodes: VF_MAIN_NODES, edges: VF_MAIN_EDGES, label: "Main canvas" },
  grazeland: { nodes: VF_GRAZE_NODES, edges: [], label: "Grazeland plane" },
  bin:       { nodes: VF_BIN_NODES, edges: [], label: "Bin plane" },
};

/* ---- bezier helpers ---- */
function vfBez(t, p0, p1, p2, p3) {
  const u = 1 - t, u2 = u * u, u3 = u2 * u, t2 = t * t, t3 = t2 * t;
  return [
    u3 * p0[0] + 3 * u2 * t * p1[0] + 3 * u * t2 * p2[0] + t3 * p3[0],
    u3 * p0[1] + 3 * u2 * t * p1[1] + 3 * u * t2 * p2[1] + t3 * p3[1],
  ];
}
function vfTan(t, p0, p1, p2, p3) {
  const u = 1 - t;
  return [
    3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]),
    3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]),
  ];
}

function VisualFlow({ onToast }) {
  const { useState, useRef, useEffect, useLayoutEffect, useCallback } = React;

  /* ---- sheets: each one is its own canvas (Excel-style tabs) ---- */
  const [sheets, setSheets] = useState([
    { id: "main", name: "Main canvas" },
    { id: "grazeland", name: "Grazeland", accent: "graze" },
    { id: "bin", name: "Bin", accent: "bin" },
  ]);
  const [activeSheet, setActiveSheet] = useState("main");
  const [editing, setEditing] = useState(null);   // id of sheet being renamed
  const sheetSeq = useRef(1);

  const [nodesBySheet, setNodesBySheet] = useState(() => ({
    main: VF_MAIN_NODES.map((n) => ({ ...n })),
    grazeland: VF_GRAZE_NODES.map((n) => ({ ...n })),
    bin: VF_BIN_NODES.map((n) => ({ ...n })),
  }));
  const [edgesBySheet, setEdgesBySheet] = useState(() => ({
    main: VF_MAIN_EDGES.map((e) => [...e]), grazeland: [], bin: [],
  }));
  const [view, setView] = useState({ tx: 0, ty: 0, k: 0.7 });
  const [sel, setSel] = useState(null);
  const [heights, setHeights] = useState({});

  const stageRef = useRef(null);
  const nodeEls = useRef({});
  const drag = useRef(null);       // node drag
  const pan = useRef(null);        // background pan
  const didFit = useRef(false);

  const sheet = sheets.find((s) => s.id === activeSheet) || sheets[0];
  const nodes = nodesBySheet[activeSheet] || [];
  const edges = edgesBySheet[activeSheet] || [];

  /* ---- sheet ops ---- */
  const addSheet = () => {
    const id = "sheet-" + Date.now();
    sheetSeq.current += 1;
    setSheets((s) => [...s, { id, name: "Sheet " + sheetSeq.current }]);
    setNodesBySheet((m) => ({ ...m, [id]: [] }));
    setEdgesBySheet((m) => ({ ...m, [id]: [] }));
    setActiveSheet(id); setSel(null); setEditing(id);
  };
  const renameSheet = (id, name) =>
    setSheets((s) => s.map((x) => (x.id === id ? { ...x, name: name.trim() || x.name } : x)));
  const deleteSheet = (id) => {
    setSheets((s) => {
      const rest = s.filter((x) => x.id !== id);
      if (id === activeSheet) setActiveSheet(rest[0]?.id || "main");
      return rest;
    });
  };

  /* measure node heights for edge anchoring */
  useLayoutEffect(() => {
    const next = {};
    let changed = false;
    nodes.forEach((n) => {
      const el = nodeEls.current[n.id];
      if (el) { next[n.id] = el.offsetHeight; if (heights[n.id] !== el.offsetHeight) changed = true; }
    });
    if (changed || Object.keys(next).length !== Object.keys(heights).length) setHeights(next);
  }); // run every render; cheap, settles after first paint

  const fitView = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || !nodes.length) return;
    const r = stage.getBoundingClientRect();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach((n) => {
      const h = heights[n.id] || 70;
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + h);
    });
    const pad = 80;
    const bw = maxX - minX + pad * 2, bh = maxY - minY + pad * 2;
    const k = Math.min(r.width / bw, r.height / bh, 1.1);
    const tx = (r.width - bw * k) / 2 - (minX - pad) * k;
    const ty = (r.height - bh * k) / 2 - (minY - pad) * k;
    setView({ tx, ty, k });
  }, [nodes, heights]);

  /* fit once after first measure, and whenever the sheet changes */
  useEffect(() => { didFit.current = false; }, [activeSheet]);
  useEffect(() => {
    if (!didFit.current && Object.keys(heights).length >= nodes.length && nodes.length) {
      didFit.current = true; fitView();
    }
  }, [heights, nodes.length, fitView]);

  /* ---- zoom on wheel, toward cursor ---- */
  const onWheel = (e) => {
    e.preventDefault();
    const r = stageRef.current.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    setView((v) => {
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const k = Math.max(0.25, Math.min(2, v.k * factor));
      const wx = (mx - v.tx) / v.k, wy = (my - v.ty) / v.k;
      return { k, tx: mx - wx * k, ty: my - wy * k };
    });
  };

  /* ---- background pan ---- */
  const onStagePointerDown = (e) => {
    if (e.target.closest(".vf-node")) return;
    setSel(null);
    pan.current = { sx: e.clientX, sy: e.clientY, tx: view.tx, ty: view.ty };
    stageRef.current.classList.add("is-panning");
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onStagePointerMove = (e) => {
    if (drag.current) {
      const { id, sx, sy, nx, ny } = drag.current;
      const dx = (e.clientX - sx) / view.k, dy = (e.clientY - sy) / view.k;
      setNodesBySheet((p) => ({
        ...p,
        [activeSheet]: p[activeSheet].map((n) => (n.id === id ? { ...n, x: nx + dx, y: ny + dy } : n)),
      }));
      return;
    }
    if (pan.current) {
      setView((v) => ({ ...v, tx: pan.current.tx + (e.clientX - pan.current.sx), ty: pan.current.ty + (e.clientY - pan.current.sy) }));
    }
  };
  const onStagePointerUp = (e) => {
    pan.current = null; drag.current = null;
    stageRef.current.classList.remove("is-panning");
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) {}
  };

  const onNodePointerDown = (e, n) => {
    e.stopPropagation();
    setSel(n.id);
    drag.current = { id: n.id, sx: e.clientX, sy: e.clientY, nx: n.x, ny: n.y };
    stageRef.current.setPointerCapture(e.pointerId);
  };

  const zoomBtn = (dir) => setView((v) => {
    const r = stageRef.current.getBoundingClientRect();
    const mx = r.width / 2, my = r.height / 2;
    const k = Math.max(0.25, Math.min(2, v.k * (dir > 0 ? 1.2 : 1 / 1.2)));
    const wx = (mx - v.tx) / v.k, wy = (my - v.ty) / v.k;
    return { k, tx: mx - wx * k, ty: my - wy * k };
  });

  /* ---- edge geometry ---- */
  const center = (n) => [n.x + n.w / 2, n.y + (heights[n.id] || 70) / 2];
  const anchor = (n, side) => {
    const h = heights[n.id] || 70;
    if (side === "l") return [n.x, n.y + h / 2];
    if (side === "r") return [n.x + n.w, n.y + h / 2];
    if (side === "t") return [n.x + n.w / 2, n.y];
    return [n.x + n.w / 2, n.y + h];
  };
  const nodeById = {}; nodes.forEach((n) => (nodeById[n.id] = n));

  const edgePaths = edges.map(([a, b], i) => {
    const na = nodeById[a], nb = nodeById[b];
    if (!na || !nb) return null;
    const ca = center(na), cb = center(nb);
    const dx = cb[0] - ca[0], dy = cb[1] - ca[1];
    let sSide, tSide;
    if (Math.abs(dx) >= Math.abs(dy)) { sSide = dx > 0 ? "r" : "l"; tSide = dx > 0 ? "l" : "r"; }
    else { sSide = dy > 0 ? "b" : "t"; tSide = dy > 0 ? "t" : "b"; }
    const p0 = anchor(na, sSide), p3 = anchor(nb, tSide);
    const off = Math.max(50, Math.min(180, Math.hypot(p3[0] - p0[0], p3[1] - p0[1]) * 0.42));
    const nrm = (s) => (s === "r" ? [off, 0] : s === "l" ? [-off, 0] : s === "b" ? [0, off] : [0, -off]);
    const o0 = nrm(sSide), o3 = nrm(tSide);
    const p1 = [p0[0] + o0[0], p0[1] + o0[1]];
    const p2 = [p3[0] + o3[0], p3[1] + o3[1]];
    const d = `M ${p0[0]} ${p0[1]} C ${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]} ${p3[0]} ${p3[1]}`;
    const arrows = [0.42, 0.74].map((t) => {
      const [x, y] = vfBez(t, p0, p1, p2, p3);
      const [tx, ty] = vfTan(t, p0, p1, p2, p3);
      return { x, y, a: (Math.atan2(ty, tx) * 180) / Math.PI };
    });
    const hot = sel && (sel === a || sel === b);
    const dim = sel && !hot;
    return { key: i, d, arrows, hot, dim };
  }).filter(Boolean);

  /* world extent for the svg canvas */
  let wMax = 800, hMax = 600;
  nodes.forEach((n) => { wMax = Math.max(wMax, n.x + n.w + 200); hMax = Math.max(hMax, n.y + (heights[n.id] || 70) + 200); });

  const connected = new Set();
  if (sel) edges.forEach(([a, b]) => { if (a === sel || b === sel) { connected.add(a); connected.add(b); } });

  const copyForAI = () => {
    const lines = ["# Visual Flow of Action — " + sheet.name, ""];
    nodes.forEach((n) => {
      lines.push(`- **${n.t}**${n.sub ? " · " + n.sub : ""}${n.status ? ` _(${n.status})_` : ""}`);
      if (n.note) lines.push("  " + n.note.replace(/\n/g, " / "));
      if (n.date) lines.push("  due " + n.date);
    });
    if (edges.length) {
      lines.push("", "## Flow");
      edges.forEach(([a, b]) => lines.push(`- ${nodeById[a]?.t} → ${nodeById[b]?.t}`));
    }
    try { navigator.clipboard.writeText(lines.join("\n")); } catch (_) {}
    onToast && onToast("Flow copied for AI — " + nodes.length + " nodes");
  };

  const stageMod = sheet.accent === "graze" ? "vf-stage--graze" : sheet.accent === "bin" ? "vf-stage--bin" : "";

  return (
    <div className="vf">
      <div className="vf-head">
        <div className="vf-head-l">
          <h2 className="vf-title">Visual Flow of Action</h2>
          <button className="vf-copy" onClick={copyForAI}><VF.copy /> Copy for AI</button>
        </div>
      </div>

      <div
        ref={stageRef}
        className={"vf-stage " + stageMod}
        style={{ "--dots-x": view.tx + "px", "--dots-y": view.ty + "px" }}
        onWheel={onWheel}
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerUp={onStagePointerUp}
        onPointerCancel={onStagePointerUp}
      >
        <div className="vf-hint"><b>Drag</b> the canvas to pan · <b>scroll</b> to zoom · drag a card to move it</div>
        <div className="vf-count"><b>{nodes.length}</b> {nodes.length === 1 ? "item" : "items"}</div>

        <div className="vf-world" style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.k})` }}>
          <svg className="vf-edges" width={wMax} height={hMax} viewBox={`0 0 ${wMax} ${hMax}`}>
            {edgePaths.map((e) => (
              <g key={e.key}>
                <path className={"vf-edge-path" + (e.hot ? " hot" : "") + (e.dim ? " dim" : "")} d={e.d} />
                {!e.dim && e.arrows.map((ar, j) => (
                  <path key={j} className={"vf-arrow" + (e.hot ? " hot" : "")} d="M -4 -4 L 5 0 L -4 4 Z"
                    transform={`translate(${ar.x} ${ar.y}) rotate(${ar.a})`} />
                ))}
              </g>
            ))}
          </svg>

          {nodes.map((n) => {
            const sx = n.sector ? VF_SECTORS[n.sector] : null;
            const dim = sel && sel !== n.id && !connected.has(n.id);
            const cls = "vf-node"
              + (n.status === "blocked" ? " vf-node--blocked" : "")
              + (n.status === "abeyed" ? " vf-node--abeyed" : "")
              + (sel === n.id ? " is-selected" : "")
              + (dim ? " dim" : "");
            const style = { left: n.x, top: n.y, width: n.w };
            if (sx) { style.borderColor = sx.rim; style.background = `linear-gradient(165deg, ${sx.wash}, rgba(0,0,0,0.42))`; }
            return (
              <div key={n.id} ref={(el) => (nodeEls.current[n.id] = el)} className={cls} style={style}
                onPointerDown={(e) => onNodePointerDown(e, n)}>
                <span className="vf-handle l"></span><span className="vf-handle r"></span>
                <span className="vf-handle t"></span><span className="vf-handle b"></span>
                {n.sector && <div className="vf-sector">{n.sector}</div>}
                <div className="vf-node-title">{n.t}{n.sub ? <span className="vf-node-sub"> · {n.sub}</span> : null}</div>
                {n.note && <div className="vf-node-note">{n.note}</div>}
                {n.url && <a className="vf-link" href={"https://" + n.url} target="_blank" rel="noreferrer" onPointerDown={(e) => e.stopPropagation()}>{n.url}</a>}
                {n.tag && <span className={"vf-tag" + (n.tagClass === "blue" ? " vf-tag--blue" : "")}>{n.tag}</span>}
                {n.date && <div className={"vf-date" + (n.status === "blocked" ? "" : " ok")}>{n.date}</div>}
              </div>
            );
          })}
        </div>

        {nodes.length === 0 && (
          <div className="vf-empty"><div className="big">Blank sheet</div>This canvas is empty — drop tasks here to map them out.</div>
        )}

        <div className="vf-controls">
          <button className="vf-ctl" onClick={() => zoomBtn(1)} title="Zoom in"><VF.plus /></button>
          <div className="vf-zoom-val">{Math.round(view.k * 100)}%</div>
          <button className="vf-ctl" onClick={() => zoomBtn(-1)} title="Zoom out"><VF.minus /></button>
          <button className="vf-ctl" onClick={fitView} title="Fit to view"><VF.fit /></button>
        </div>
      </div>

      {/* Excel-style sheet tabs */}
      <div className="vf-sheets">
        {sheets.map((s) => {
          const on = s.id === activeSheet;
          const acc = s.accent === "graze" ? " graze" : s.accent === "bin" ? " bin" : "";
          return (
            <div key={s.id}
              className={"vf-sheet-tab" + (on ? " on" : "") + acc}
              onClick={() => { setActiveSheet(s.id); setSel(null); }}
              onDoubleClick={() => setEditing(s.id)}
              title="Double-click to rename">
              {editing === s.id ? (
                <input className="vf-sheet-input" autoFocus defaultValue={s.name}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => { renameSheet(s.id, e.target.value); setEditing(null); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { renameSheet(s.id, e.target.value); setEditing(null); }
                    if (e.key === "Escape") setEditing(null);
                  }} />
              ) : (
                <span className="vf-sheet-name">{s.name}</span>
              )}
              {sheets.length > 1 && editing !== s.id && (
                <button className="vf-sheet-x" title="Delete sheet"
                  onClick={(e) => { e.stopPropagation(); deleteSheet(s.id); }}><VF.x /></button>
              )}
            </div>
          );
        })}
        <button className="vf-sheet-add" onClick={addSheet} title="New sheet"><VF.plus /></button>
      </div>
    </div>
  );
}

Object.assign(window, { VisualFlow });
