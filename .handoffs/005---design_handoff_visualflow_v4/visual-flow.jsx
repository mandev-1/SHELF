/* ShELF — Visual Flow: "build a campsite down the road".
   Map view: a trail winds from You Are Here toward the horizon; up to six
   campsites (top goals) are pitched along it.
   Goal screen (per goal, full canvas): the SMART goal defined in a box at the
   top, with CASCADING SUBGOALS connected beneath it — each box leads to the
   next, the whole chain leading to the goal (per the napkin sketch).
   Goals persist in localStorage["shelf-goals-v1"]; pot/debt progress is read
   live from the Strategie slice. Exports to window. */

const VF_LS = "shelf-goals-v1";
const VF_MAX = 6;
const VF_START = { x: 7, y: 87 };
const VF_END = { x: 96, y: 8 };
const VF_SLOTS = [
  { x: 21, y: 73 }, { x: 28, y: 55 }, { x: 45, y: 46 },
  { x: 62, y: 41 }, { x: 72, y: 26 }, { x: 87, y: 14 },
];

const VF_STATUS = [
  { id: "notstarted", label: "Not started", hue: "#8b8b95" },
  { id: "ontrack",    label: "On track",    hue: "var(--accent)" },
  { id: "atrisk",     label: "At risk",     hue: "#e0a020" },
  { id: "done",       label: "Reached",     hue: "#34c891" },
];
const vfStatusMeta = (id) => VF_STATUS.find((s) => s.id === id) || VF_STATUS[0];

/* smooth trail through start → slots → horizon (catmull-rom → cubic beziers) */
function vfTrailPath() {
  const pts = [VF_START, ...VF_SLOTS, VF_END];
  let d = "M " + pts[0].x + " " + pts[0].y;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += " C " + (p1.x + (p2.x - p0.x) / 6) + " " + (p1.y + (p2.y - p0.y) / 6) +
         ", " + (p2.x - (p3.x - p1.x) / 6) + " " + (p2.y - (p3.y - p1.y) / 6) +
         ", " + p2.x + " " + p2.y;
  }
  return d;
}

const VF_SEED = {
  goals: [
    {
      id: "g-pm", title: "Become a product manager",
      outcome: "Hired as PM for a B2B product by next summer",
      status: "ontrack", link: null, due: "2027-06",
      milestones: [
        { id: "m1", label: "Ship a side project end-to-end", done: true },
        { id: "m2", label: "Lead one cross-team feature at work", done: true },
        { id: "m3", label: "Do 5 PM-style case interviews", done: false },
        { id: "m4", label: "Apply to 10 PM roles", done: false },
      ],
      notes: "Strength: technical background. Gap: stakeholder storytelling — practice weekly.",
    },
    {
      id: "g-japan", title: "Japan trip — spring",
      outcome: "Three weeks in Japan, fully paid from the pot",
      status: "ontrack", link: { type: "pot", id: "pot-japan" }, due: "2027-04",
      milestones: [
        { id: "m1", label: "Set the budget", done: true },
        { id: "m2", label: "Book flights 6 months out", done: false },
      ],
      notes: "",
    },
    {
      id: "g-cc", title: "Kill the credit card",
      outcome: "Revolving balance at zero, card kept for emergencies only",
      status: "atrisk", link: { type: "debt", id: "dbt-cc" }, due: "2026-12",
      milestones: [
        { id: "m1", label: "Stop new spending on the card", done: true },
        { id: "m2", label: "Overpay every month", done: true },
      ],
      notes: "21.9% APR — first target per avalanche.",
    },
  ],
};

/* live pots + debts from the Strategie slice (read-only) */
function vfReadStrategie() {
  let s = null;
  try {
    const p = JSON.parse(localStorage.getItem("shelf-strategie-v2"));
    if (p && p.positions) s = p;
  } catch (e) { /* fall through */ }
  if (!s) s = window.STRAT_STATE;
  const byMonth = s.statements && Object.keys(s.statements.byMonth || {}).length > 0
    ? s.statements.byMonth : window.DEFAULT_STATEMENTS;
  const debtPaid = {};
  for (const mo of Object.values(byMonth))
    for (const e of mo.expenses)
      if (e.debtId) debtPaid[e.debtId] = (debtPaid[e.debtId] || 0) + e.amt;
  const debts = (s.debts || []).map((d) => ({
    ...d,
    paid: Math.min(d.principal || 0, debtPaid[d.id] || 0),
    remaining: Math.max(0, (d.principal || 0) - (debtPaid[d.id] || 0)),
  }));
  return { pots: s.pots || [], debts };
}

/* progress + supply line for a goal, given the live money data */
function vfProgress(g, fin, currency) {
  if (g.link && g.link.type === "pot") {
    const p = fin.pots.find((x) => x.id === g.link.id);
    if (p) {
      const pct = p.target > 0 ? Math.min(100, Math.round((p.saved / p.target) * 100)) : 0;
      return { pct, auto: pct >= 100, line: window.fmtMoney(p.saved, currency, { abbr: true }) + " of " + window.fmtMoney(p.target, currency, { abbr: true }) + " saved", name: p.name };
    }
  }
  if (g.link && g.link.type === "debt") {
    const d = fin.debts.find((x) => x.id === g.link.id);
    if (d) {
      const pct = d.principal > 0 ? Math.min(100, Math.round((d.paid / d.principal) * 100)) : 0;
      return { pct, auto: d.remaining <= 0, line: d.remaining <= 0 ? "paid off" : window.fmtMoney(d.remaining, currency, { abbr: true }) + " still owed", name: d.name };
    }
  }
  const ms = g.milestones || [];
  const done = ms.filter((m) => m.done).length;
  return { pct: ms.length ? Math.round((done / ms.length) * 100) : 0, auto: false, line: done + " of " + ms.length + " subgoals", name: null };
}

/* SMART meter — is this goal set well? */
function vfSmart(g, reached) {
  const ms = g.milestones || [];
  const checks = [
    { k: "S", label: "Specific — Point B named",            ok: !!(g.outcome || "").trim() },
    { k: "M", label: "Measurable — wired to money or \u22652 subgoals", ok: !!g.link || ms.length >= 2 },
    { k: "A", label: "Achievable — clear next subgoal",     ok: reached || ms.some((m) => !m.done) },
    { k: "R", label: "Relevant — journal says why",         ok: !!(g.notes || "").trim() },
    { k: "T", label: "Time-bound — target date set",        ok: !!g.due },
  ];
  return { checks, score: checks.filter((c) => c.ok).length };
}

/* ---------- cylindrical shift — map ⇄ goal screen transition ----------
   The outgoing view is sliced into vertical slats that roll away around a
   virtual cylinder (staggered wave), while the incoming view's slats unroll
   into place from the opposite side; a light sheen sweeps the curve and the
   camera dips slightly. Pure WAAPI on throwaway clones — React state swaps
   instantly underneath, hidden until the roll completes. */
function vfCloneWithValues(el) {
  const clone = el.cloneNode(true);
  const src = el.querySelectorAll("input, textarea, select");
  const dst = clone.querySelectorAll("input, textarea, select");
  src.forEach((s, i) => {
    const d = dst[i];
    if (!d) return;
    if (s.tagName === "TEXTAREA") d.textContent = s.value;
    else if (s.tagName === "SELECT") {
      const oi = s.selectedIndex;
      Array.from(d.options).forEach((o, j) => { if (j === oi) o.setAttribute("selected", ""); else o.removeAttribute("selected"); });
    } else {
      d.setAttribute("value", s.value);
      if (s.checked) d.setAttribute("checked", ""); else d.removeAttribute("checked");
    }
  });
  return clone;
}

function vfRunCylinder(wrap, outSnap, outH, dir) {
  const view = wrap.querySelector(".vf-view");
  if (!view) return;
  const W = wrap.clientWidth;
  if (!W) return;
  const newH = view.offsetHeight;
  const H = Math.max(outH, newH);
  const inSnap = vfCloneWithValues(view);
  wrap.classList.add("vf-cyl-hide");

  const overlay = document.createElement("div");
  overlay.className = "vf-cyl";
  overlay.style.height = H + "px";
  const cam = document.createElement("div");
  cam.className = "vf-cyl-cam";
  overlay.appendChild(cam);

  const N = 12, sw = W / N;
  const EASE = "cubic-bezier(0.55, 0.05, 0.45, 0.95)";
  const anims = [];
  const wave = (i) => (dir === 1 ? i : N - 1 - i) * 26;

  const slats = (snap, h, isIn) => {
    for (let i = 0; i < N; i++) {
      const slat = document.createElement("div");
      slat.className = "vf-cyl-slat";
      slat.style.cssText = "left:" + (i * sw) + "px;width:" + (sw + 0.5) + "px;height:" + h + "px;";
      const inner = snap.cloneNode(true);
      inner.style.cssText += ";position:absolute;left:" + (-i * sw) + "px;top:0;width:" + W + "px;margin:0;";
      slat.appendChild(inner);
      cam.appendChild(slat);
      const flat = { transform: "translateX(0px) translateZ(0px) rotateY(0deg)", opacity: 1, filter: "blur(0px) brightness(1)" };
      const rolled = (sign) => ({
        transform: "translateX(" + (sign * 54) + "px) translateZ(150px) rotateY(" + (sign * 102) + "deg)",
        opacity: 0, filter: "blur(7px) brightness(1.35)",
      });
      anims.push(slat.animate(
        isIn ? [rolled(dir), flat] : [flat, rolled(-dir)],
        { duration: isIn ? 620 : 560, delay: wave(i) + (isIn ? 150 : 0), easing: EASE, fill: "both" }
      ));
    }
  };
  slats(inSnap, newH, true);   // appended first → sits beneath
  slats(outSnap, outH, false);

  const sheen = document.createElement("div");
  sheen.className = "vf-cyl-sheen";
  overlay.appendChild(sheen);
  anims.push(sheen.animate(
    [{ transform: "translateX(" + (-dir * 100) + "%)" }, { transform: "translateX(" + (dir * 100) + "%)" }],
    { duration: 780, easing: "ease-in-out", fill: "both" }
  ));
  anims.push(cam.animate(
    [{ transform: "rotateX(0deg) scale(1)" }, { transform: "rotateX(5deg) scale(0.962)", offset: 0.45 }, { transform: "rotateX(0deg) scale(1)" }],
    { duration: 880, easing: "ease-in-out" }
  ));

  wrap.appendChild(overlay);
  Promise.all(anims.map((a) => a.finished)).catch(() => {}).finally(() => {
    overlay.remove();
    wrap.classList.remove("vf-cyl-hide");
  });
}

/* ---------- depth zoom — parent ⇄ child (iOS folder / Material container).
   Going deeper (dir 1): the outgoing layer pushes toward you, blurs and fades
   while the incoming layer rises from ~0.9 into focus beneath it. Going back
   (dir -1): the child shrinks back down into the parent. The most legible of
   the transitions and the one whose motion matches the metaphor — camps sit on
   top of the flow, goals sit inside the camps. */
function vfRunDepthZoom(wrap, outSnap, outH, dir) {
  const view = wrap.querySelector(".vf-view");
  if (!view) return;
  const W = wrap.clientWidth;
  if (!W) return;
  const H = Math.max(outH, view.offsetHeight);

  const overlay = document.createElement("div");
  overlay.className = "vf-zoom";
  overlay.style.height = H + "px";
  const out = outSnap.cloneNode(true);
  out.style.cssText += ";position:absolute;left:0;top:0;width:" + W + "px;margin:0;";
  overlay.appendChild(out);
  wrap.appendChild(overlay);

  const EASE = "cubic-bezier(0.33, 0, 0.2, 1)";
  const dur = 560;
  const outTo = dir === 1 ? 1.12 : 0.9;
  const inFrom = dir === 1 ? 0.9 : 1.12;
  const anims = [
    out.animate(
      [{ transform: "scale(1)", opacity: 1, filter: "blur(0px)" },
       { transform: "scale(" + outTo + ")", opacity: 0, filter: "blur(8px)" }],
      { duration: dur, easing: EASE, fill: "both" }
    ),
    view.animate(
      [{ transform: "scale(" + inFrom + ")", opacity: 0, filter: "blur(8px)" },
       { transform: "scale(1.012)", opacity: 1, filter: "blur(0px)", offset: 0.82 },
       { transform: "scale(1)", opacity: 1, filter: "blur(0px)" }],
      { duration: dur + 80, delay: 70, easing: EASE, fill: "both" }
    ),
  ];

  Promise.all(anims.map((a) => a.finished)).catch(() => {}).finally(() => {
    overlay.remove();
    view.style.transform = ""; view.style.opacity = ""; view.style.filter = "";
  });
}

/* ---------- single card flip — the whole canvas turns once on its Y axis,
   outgoing view on the front face, incoming on the back. dir sets spin
   direction. A mid-flip scale dip adds depth. Same 3D family as the cylinder
   but one rotation instead of twelve — reads instantly as "turning it over",
   and carries the meaning that the camps are the back side of the flow. ---------- */
function vfRunCardFlip(wrap, outSnap, outH, dir) {
  const view = wrap.querySelector(".vf-view");
  if (!view) return;
  const W = wrap.clientWidth;
  if (!W) return;
  const H = Math.max(outH, view.offsetHeight);
  const inSnap = vfCloneWithValues(view);
  wrap.classList.add("vf-cyl-hide");

  const overlay = document.createElement("div");
  overlay.className = "vf-flip3d";
  overlay.style.height = H + "px";
  const cam = document.createElement("div");
  cam.className = "vf-flip3d-cam";
  const card = document.createElement("div");
  card.className = "vf-flip3d-card";
  cam.appendChild(card);
  overlay.appendChild(cam);

  const face = (snap, back) => {
    const f = document.createElement("div");
    f.className = "vf-flip3d-face" + (back ? " vf-flip3d-back" : "");
    const inner = snap.cloneNode(true);
    inner.style.cssText += ";position:absolute;left:0;top:0;width:" + W + "px;margin:0;";
    f.appendChild(inner);
    card.appendChild(f);
  };
  face(outSnap, false);
  face(inSnap, true);
  wrap.appendChild(overlay);

  const end = dir === 1 ? -180 : 180;
  const S = end < 0 ? -1 : 1;       // direction of travel
  const antic = -S * 4;             // wind-up: a hair the opposite way
  const overshoot = end + S * 5;    // glide just past, then settle back
  const dur = 940;
  const anims = [
    card.animate(
      [
        { transform: "rotateY(0deg) rotateX(0deg) translateZ(0px)", offset: 0, easing: "cubic-bezier(0.34, 0, 0.4, 1)" },
        { transform: "rotateY(" + antic + "deg) rotateX(1.6deg) translateZ(-12px)", offset: 0.12, easing: "cubic-bezier(0.4, 0, 0.25, 1)" },
        { transform: "rotateY(" + (end * 0.5) + "deg) rotateX(0deg) translateZ(-64px)", offset: 0.52, easing: "cubic-bezier(0.4, 0, 0.3, 1)" },
        { transform: "rotateY(" + overshoot + "deg) rotateX(-1.1deg) translateZ(-10px)", offset: 0.88, easing: "cubic-bezier(0.33, 1.1, 0.62, 1)" },
        { transform: "rotateY(" + end + "deg) rotateX(0deg) translateZ(0px)", offset: 1 },
      ],
      { duration: dur, fill: "both" }
    ),
    cam.animate(
      [
        { transform: "scale(1) rotateX(0deg)" },
        { transform: "scale(0.952) rotateX(2deg)", offset: 0.5 },
        { transform: "scale(1) rotateX(0deg)" },
      ],
      { duration: dur, easing: "ease-in-out", fill: "both" }
    ),
  ];

  Promise.all(anims.map((a) => a.finished)).catch(() => {}).finally(() => {
    overlay.remove();
    wrap.classList.remove("vf-cyl-hide");
  });
}

/* active transition per move. camps ⇄ camp detail = "cardflip" (turn the camp
   over); camps ⇄ node flow = "depthzoom" (descend into the layer beneath).
   "cylinder" kept as the showpiece. */
const VF_TRANSITION = "depthzoom";
function vfRunTransition(wrap, outSnap, outH, dir, mode) {
  const m = mode || VF_TRANSITION;
  if (m === "cylinder") return vfRunCylinder(wrap, outSnap, outH, dir);
  if (m === "cardflip") return vfRunCardFlip(wrap, outSnap, outH, dir);
  return vfRunDepthZoom(wrap, outSnap, outH, dir);
}

function VfTent({ hue, lit }) {
  return (
    <svg className="camp-tent" viewBox="0 0 40 30" aria-hidden="true">
      <polygon points="20,2 38,28 2,28" fill="var(--surface)" stroke={hue} strokeWidth="2.4" strokeLinejoin="round" />
      <polygon points="20,10 27,28 13,28" fill={hue} opacity={lit ? 0.9 : 0.35} />
    </svg>
  );
}

/* ---------- cascading subgoals (per the sketch: boxes zig-zag downward,
   each connected to the next, the chain leading to the goal above) ---------- */
function GoalCascade({ goal, onPatch }) {
  const { useState } = React;
  const [text, setText] = useState("");
  const ms = goal.milestones || [];
  const ROW = 92;
  const X = [4, 30, 10, 34, 6, 28, 16, 36, 8, 30];
  const n = ms.length;
  const H = (n + 1) * ROW + 6;
  const ax = (i) => X[i % X.length] + 2.5;
  const ay = (i) => i * ROW + 30;

  let d = "M 9 -30 C 9 2, " + ax(0) + " " + (ay(0) - 48) + ", " + ax(0) + " " + ay(0);
  for (let i = 0; i < n; i++) {
    const x1 = ax(i), y1 = ay(i), x2 = ax(i + 1), y2 = ay(i + 1);
    d += " M " + x1 + " " + y1 + " C " + x1 + " " + (y1 + 44) + ", " + x2 + " " + (y2 - 44) + ", " + x2 + " " + y2;
  }

  const patchWp = (id, p) => onPatch({ milestones: ms.map((m) => (m.id === id ? { ...m, ...p } : m)) });
  const rmWp = (id) => onPatch({ milestones: ms.filter((m) => m.id !== id) });
  const addWp = () => {
    const label = text.trim();
    if (!label) return;
    onPatch({ milestones: [...ms, { id: "wp" + Date.now(), label, done: false }] });
    setText("");
  };

  return (
    <div className="gs-cascade" style={{ height: H + "px" }}>
      <svg className="gs-wires" viewBox={"0 0 100 " + H} preserveAspectRatio="none" aria-hidden="true">
        <path d={d} vectorEffect="non-scaling-stroke" />
      </svg>
      {ms.map((m, i) => (
        <div key={m.id} className={"gs-node" + (m.done ? " done" : "")}
          style={{ left: X[i % X.length] + "%", top: i * ROW + "px" }}>
          <span className="gs-node-idx">{i + 1}</span>
          <input type="checkbox" checked={m.done} onChange={(e) => patchWp(m.id, { done: e.target.checked })}
            title={m.done ? "Reached" : "Mark reached"} />
          <input className="gs-node-label" value={m.label} placeholder="Subgoal…"
            onChange={(e) => patchWp(m.id, { label: e.target.value })} />
          <button className="gs-node-rm" onClick={() => rmWp(m.id)} aria-label="Remove subgoal">×</button>
        </div>
      ))}
      <div className="gs-node gs-node--add" style={{ left: X[n % X.length] + "%", top: n * ROW + "px" }}>
        <input className="gs-node-label" placeholder={n === 0 ? "Break the goal down — first subgoal…" : "Cascade further — add a subgoal…"}
          value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addWp(); }} />
        <button className="ghost-btn" onClick={addWp} disabled={!text.trim()}>Add</button>
      </div>
    </div>
  );
}

/* ---------- one goal's own screen ---------- */
function GoalScreen({ goal, slot, fin, currency, onPatch, onDelete, onBack }) {
  const { useEffect, useRef } = React;
  const titleRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onBack(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onBack]);

  useEffect(() => {
    if (!goal.title && titleRef.current) titleRef.current.focus();
  }, []);

  const prog = vfProgress(goal, fin, currency);
  const reached = goal.status === "done" || prog.auto;
  const smart = vfSmart(goal, reached);

  return (
    <div className="gs" data-screen-label={"Goal — " + (goal.title || "untitled")}>
      <div className="gs-top">
        <button className="ghost-btn" onClick={onBack}>← Back to the map</button>
        <span className="gs-crumb">Campsite {slot + 1} of {VF_MAX}</span>
        <button className="vfg-break" onClick={() => {
          if (window.confirm('Break camp? "' + (goal.title || "Untitled goal") + '" will be removed from the map.')) onDelete();
        }}>Break camp</button>
      </div>

      {/* the SMART goal box at the top */}
      <div className="card gs-goal">
        <div className="gs-goal-row">
          <div className="gs-goal-main">
            <div className="vfg-eyebrow">The goal — defined at the top</div>
            <input ref={titleRef} className="vfg-title gs-title" placeholder="Name the destination…"
              value={goal.title} onChange={(e) => onPatch({ title: e.target.value })} />
            <input className="vfg-input" placeholder="Point B — what does arriving look like?"
              value={goal.outcome || ""} onChange={(e) => onPatch({ outcome: e.target.value })} />
          </div>
          <div className="gs-goal-side">
            <div className="vfg-status">
              {VF_STATUS.map((s) => (
                <button key={s.id} className={"vfg-st" + (goal.status === s.id ? " on" : "")}
                  style={{ "--st-hue": s.hue }} onClick={() => onPatch({ status: s.id })}>
                  <span className="vfg-st-dot"></span>{s.label}
                </button>
              ))}
            </div>
            <label className="gs-due">
              <span className="vfg-lab">By when</span>
              <input type="month" className="vfg-input" value={goal.due || ""}
                onChange={(e) => onPatch({ due: e.target.value || undefined })} />
            </label>
          </div>
        </div>
        <div className="gs-smart" title="Is this goal set well?">
          <span className="gs-smart-score">SMART · {smart.score}/5</span>
          {smart.checks.map((c) => (
            <span key={c.k} className={"gs-smart-chip" + (c.ok ? " ok" : "")} title={c.label}>
              <b>{c.k}</b>{c.label.split(" — ")[1]}
            </span>
          ))}
        </div>
        {prog.auto && goal.status !== "done" && (
          <div className="vfg-auto">Supplies say you've arrived — mark it reached?</div>
        )}
      </div>

      <div className="gs-body">
        <div className="gs-cascade-wrap">
          <div className="vfg-lab">Cascading subgoals — each one leads to the next, the chain leads to the goal</div>
          <GoalCascade goal={goal} onPatch={onPatch} />
        </div>
        <div className="gs-side">
          <div className="vfg-sec">
            <div className="vfg-lab">Supplies — wire it to real money</div>
            <select className="se-cat vfg-link" value={goal.link ? goal.link.type + ":" + goal.link.id : ""}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) onPatch({ link: null });
                else { const i = v.indexOf(":"); onPatch({ link: { type: v.slice(0, i), id: v.slice(i + 1) } }); }
              }}>
              <option value="">No link</option>
              {fin.pots.length > 0 && (
                <optgroup label="Savings pots">
                  {fin.pots.map((p) => <option key={p.id} value={"pot:" + p.id}>◌ {p.name}</option>)}
                </optgroup>
              )}
              {fin.debts.length > 0 && (
                <optgroup label="Debts (payoff = arrival)">
                  {fin.debts.map((d) => <option key={d.id} value={"debt:" + d.id}>↓ {d.name}</option>)}
                </optgroup>
              )}
            </select>
            <div className="vfg-prog">
              <div className="vfg-prog-bar"><span style={{ width: prog.pct + "%" }}></span></div>
              <div className="vfg-prog-foot"><span>{prog.pct}%</span><span>{prog.line}</span></div>
            </div>
          </div>
          <div className="vfg-sec">
            <div className="vfg-lab">Field journal — why it matters, risks</div>
            <textarea className="vfg-notes" rows="5" placeholder="Notes to your future self…"
              value={goal.notes || ""} onChange={(e) => onPatch({ notes: e.target.value })}></textarea>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- the nodes flow — minimal stand-in for the real Visual Flow canvas.
   The camps map flips into this (and back) via the cylinder. ---------- */
const NF_PLANES = ["Main canvas", "Grazeland", "Bin", "Drone [FPV]", "Buneka [IDEA]"];
const NF_NODES = [
  { id: "n1", x: 2,  y: 10, kind: "light", title: "SCRUM MASTER · certified", items: [{ t: "book the exam", d: true }, { t: "mock test ≥85%", d: false }], tags: ["certified"] },
  { id: "n2", x: 23, y: 2,  kind: "light", title: "PITCH", body: "Play with it — intonation, timing, confidence. If it barks like a dog… you built a dog!", tags: ["pitch"] },
  { id: "n3", x: 47, y: 7,  kind: "dark",  eyebrow: "BLEEDING EDGE", title: "Restaurant index", items: [{ t: "repurpose the IBM RAG ipynb", d: false }, { t: "scrape prague restaurants", d: false }, { t: "get MVP going", d: false }], tags: ["dream project"], date: "2026-05-29" },
  { id: "n4", x: 26, y: 52, kind: "light", title: "SAP Sideproject", items: [{ t: "Fiori part (theory)", d: false }, { t: "Fiori part — practical", d: false }], tags: ["work"] },
  { id: "n5", x: 52, y: 58, kind: "blocked", title: "Koupit malou mycku na nadobi", items: [{ t: "find model", d: false }, { t: "check out second hand", d: false }], tags: ["Equipment"], stamp: "BLOCKED" },
  { id: "n6", x: 75, y: 28, kind: "light", title: "zuzaprague.de · family", items: [{ t: "pick up the code in CROSS", d: false }, { t: "new design", d: false }, { t: "n8n for article writing", d: false }], tags: ["support"] },
  { id: "n7", x: 76, y: 76, kind: "dark", eyebrow: "BLEEDING EDGE", title: "N8N pilot projekt", body: "docker — test how I can use it", tags: [] },
];
const NF_WIRES = [
  "M 12 24 C 18 38, 22 46, 30 56",
  "M 36 16 C 42 14, 44 13, 50 14",
  "M 62 24 C 70 26, 72 28, 78 32",
  "M 84 48 C 86 58, 84 68, 82 76",
  "M 44 64 C 48 64, 50 64, 55 66",
];

function NodesFlow({ onFlip }) {
  return (
    <div className="nf" data-screen-label="Visual Flow — node canvas">
      <div className="nf-bar">
        <div className="nf-bar-title">Visual Flow of Action</div>
        <button className="ghost-btn" type="button">Copy for AI</button>
        <div className="nf-search">Search nodes…</div>
        <button className="ghost-btn nf-camps" onClick={onFlip} title="Flip back to the campsite layer">⛺ Camps</button>
      </div>
      <div className="nf-canvas">
        <svg className="nf-wires" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {NF_WIRES.map((d, i) => <path key={i} d={d} vectorEffect="non-scaling-stroke" />)}
        </svg>
        {NF_NODES.map((n) => (
          <div key={n.id} className={"nf-node nf-node--" + n.kind} style={{ left: n.x + "%", top: n.y + "%" }}>
            {n.eyebrow && <div className="nf-eyebrow">{n.eyebrow}</div>}
            <div className="nf-title">{n.title}</div>
            {n.body && <div className="nf-body">{n.body}</div>}
            {n.items && (
              <div className="nf-items">
                {n.items.map((it, i) => (
                  <label key={i} className="nf-item">
                    <input type="checkbox" defaultChecked={it.d} />
                    <span>{it.t}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="nf-foot">
              {n.tags.map((t) => <span key={t} className="nf-tag">{t}</span>)}
              {n.date && <span className="nf-date">{n.date}</span>}
              {n.stamp && <span className="nf-stamp">{n.stamp}</span>}
            </div>
            <span className="nf-port nf-port--l"></span>
            <span className="nf-port nf-port--r"></span>
          </div>
        ))}
      </div>
      <div className="nf-planes">
        {NF_PLANES.map((p, i) => (
          <button key={p} className={"nf-plane" + (i === 0 ? " on" : "")} type="button">{p}</button>
        ))}
        <button className="nf-plane nf-plane--add" type="button">+</button>
      </div>
    </div>
  );
}

/* ---------- the map ---------- */
function VisualFlow({ currency, onToast }) {
  const { useState, useEffect, useMemo, useRef, useLayoutEffect } = React;

  const [store, setStore] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem(VF_LS));
      if (s && Array.isArray(s.goals)) return s;
    } catch (e) { /* fall through */ }
    return VF_SEED;
  });
  useEffect(() => {
    try { localStorage.setItem(VF_LS, JSON.stringify(store)); } catch (e) { /* ignore */ }
  }, [store]);

  const [editId, setEditId] = useState(null);
  const [layer, setLayer] = useState("nodes"); // "nodes" (the flow, default) | "camps" (goal layer)
  const goals = store.goals.slice(0, VF_MAX);
  const fin = useMemo(() => vfReadStrategie(), [store, editId]);

  // cylindrical shift between the map and a goal screen
  const wrapRef = useRef(null);
  const transRef = useRef(null);
  const goTrans = (apply, dir, mode) => {
    const wrap = wrapRef.current;
    const view = wrap && wrap.querySelector(".vf-view");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!view || reduced || transRef.current || !wrap.clientWidth) { apply(); return; }
    transRef.current = { snap: vfCloneWithValues(view), h: view.offsetHeight, dir, mode };
    apply();
  };
  useLayoutEffect(() => {
    const t = transRef.current;
    if (!t) return;
    transRef.current = null;
    vfRunTransition(wrapRef.current, t.snap, t.h, t.dir, t.mode);
  }, [editId, layer]);

  const setGoals = (goalsNext) => setStore((s) => ({ ...s, goals: goalsNext }));
  const patchGoal = (id, p) => setGoals(goals.map((g) => (g.id === id ? { ...g, ...p } : g)));
  const openGoal = (id) => goTrans(() => setEditId(id), 1, "cardflip");
  const backToMap = () => goTrans(() => setEditId(null), -1, "cardflip");
  const toNodes = () => goTrans(() => setLayer("nodes"), 1, "depthzoom");
  const toCamps = () => goTrans(() => setLayer("camps"), -1, "depthzoom");
  const pitchCamp = () => {
    if (goals.length >= VF_MAX) return;
    const g = { id: "g" + Date.now(), title: "", outcome: "", status: "notstarted", link: null, milestones: [], notes: "" };
    goTrans(() => { setGoals([...goals, g]); setEditId(g.id); }, 1, "cardflip");
  };
  const deleteGoal = (id) => {
    goTrans(() => { setGoals(goals.filter((g) => g.id !== id)); setEditId(null); }, -1, "cardflip");
    onToast && onToast("Camp broken");
  };

  const editing = goals.find((g) => g.id === editId) || null;
  const trail = useMemo(() => vfTrailPath(), []);

  if (editing) {
    return (
      <div className="vf-stage" ref={wrapRef}>
        <div className="vf-view" key="goal">
          <GoalScreen
            goal={editing}
            slot={goals.indexOf(editing)}
            fin={fin}
            currency={currency}
            onPatch={(p) => patchGoal(editing.id, p)}
            onDelete={() => deleteGoal(editing.id)}
            onBack={backToMap}
          />
        </div>
      </div>
    );
  }

  if (layer === "nodes" && !editing) {
    return (
      <div className="vf-stage" ref={wrapRef}>
        <div className="vf-view" key="nodes">
          <NodesFlow onFlip={toCamps} />
        </div>
      </div>
    );
  }

  return (
    <div className="vf-stage" ref={wrapRef}>
    <div className="vf-view" key="map">
    <div className="vf" data-screen-label="Visual Flow — campsite roadmap">
      <svg className="vf-trail-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path className="vf-trail-under" d={trail} vectorEffect="non-scaling-stroke" />
        <path className="vf-trail" d={trail} vectorEffect="non-scaling-stroke" />
      </svg>

      <div className="vf-head">
        <div className="vf-eyebrow">Visual Flow · build a campsite down the road</div>
        <div className="vf-title-row">
          <h2 className="vf-title">Your six camps</h2>
          <span className="vf-count">{goals.length} of {VF_MAX} pitched</span>
        </div>
        <p className="vf-hint">You're on the way somewhere. Pitch a camp down the river — it'll be waiting when you get there. Click a tent to open its goal screen.</p>
        <button className="ghost-btn vf-flip" onClick={toNodes} title="Flip down into the node canvas">⟲ Flip to the flow</button>
      </div>

      <div className="vf-you" style={{ left: VF_START.x + "%", top: VF_START.y + "%" }}>
        <span className="vf-you-dot"></span>
        <span className="vf-you-lab">You are here</span>
      </div>
      <div className="vf-horizon" style={{ left: VF_END.x + "%", top: VF_END.y + "%" }}>point B</div>

      {["soon", "this year", "down the river"].map((lab, i) => {
        const anchors = [VF_SLOTS[0], VF_SLOTS[2], VF_SLOTS[4]];
        return (
          <span key={lab} className="vf-dist" style={{ left: (anchors[i].x + 4) + "%", top: (anchors[i].y + 7) + "%" }}>{lab}</span>
        );
      })}

      {VF_SLOTS.map((pos, i) => {
        const g = goals[i];
        if (!g) {
          return (
            <button key={"empty" + i} className="camp-add" style={{ left: pos.x + "%", top: pos.y + "%" }}
              onClick={pitchCamp} title="Pitch a camp — define a new goal">

              <span className="camp-add-ring">+</span>
              <span className="camp-add-lab">pitch a camp</span>
            </button>
          );
        }
        const prog = vfProgress(g, fin, currency);
        const reached = g.status === "done" || prog.auto;
        const st = vfStatusMeta(reached ? "done" : g.status);
        const smart = vfSmart(g, reached);
        return (
          <button key={g.id} className={"camp camp--" + (reached ? "done" : g.status)} style={{ left: pos.x + "%", top: pos.y + "%" }}
            onClick={() => openGoal(g.id)}
            title={(g.outcome || "No Point B yet") + " · SMART " + smart.score + "/5"}>
            <span className="camp-marker">
              <VfTent hue={st.hue} lit={!reached && g.status !== "notstarted"} />
              <span className={"camp-fire" + (reached ? " camp-fire--done" : "")} style={{ "--st-hue": st.hue }}>
                {reached ? "✓" : ""}
              </span>
            </span>
            <span className="camp-label">
              <span className="camp-name">{g.title || "Untitled goal"}</span>
              <span className="camp-bar"><span style={{ width: prog.pct + "%", background: st.hue }}></span></span>
              <span className="camp-sub">{reached ? "camp reached" : st.label.toLowerCase() + " · " + prog.pct + "%"}</span>
            </span>
          </button>
        );
      })}
    </div>
    </div>
    </div>
  );
}

Object.assign(window, { VisualFlow });
