import { useRef, useState, useEffect, Fragment } from "react";
import { createPortal } from "react-dom";
import {
  niceCeil, project, fmtMoney, monthAbbr, STMT_CATS, CAT_KEYS,
  dayStr, weekOfDate,
} from "./strategie";
import type { CatKey, MonthStatement } from "../../types/grid";

interface SpendItem { id?: string; label: string; cat: CatKey; amt: number; day: string; }

const SPEND_TIP_MAX_ITEMS = 24;
/** Vertical drag (in viewBox units, ~px) past which the marquee latches into a
 *  precise 2D box — selecting an amount band (Y) on top of the day range (X)
 *  rather than whole-height columns. Kept small so any deliberate vertical pull
 *  engages the band; a near-flat sideways swipe stays whole-column. */
const BAND_LOCK_PX = 4;

export interface SpendRangeOpenInfo {
  monthKey: string;
  week: number | null;
  startIso: string;
  endIso: string;
  ids: string[] | null;
}

interface SelState {
  a: number;
  b: number;
  yT: number;
  yB: number;
  fullY: boolean;
}

/** Per-day spending: stacked bars, one stack segment per category. */
export function DailySpendChart({ months, cur, hidden = [], activeKey, onOpenRange }: {
  months: { key: string; stmt: MonthStatement }[];
  cur: string;
  hidden?: CatKey[];
  activeKey?: string;
  onOpenRange?: (info: SpendRangeOpenInfo) => void;
}) {
  const W = 760;
  const H = 330;
  const PAD = { top: 16, right: 20, bottom: 28, left: 52 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;
  const hiddenSet = new Set(hidden);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgElRef = useRef<SVGSVGElement | null>(null);
  const uidRef = useRef(`dsp${Math.random().toString(36).slice(2, 7)}`);
  const [tip, setTip] = useState<{ col: number; cx: number; cy: number; flipX: boolean; flipY: boolean } | null>(null);
  const [sel, setSel] = useState<SelState | null>(null);
  const [focus, setFocus] = useState<{ a: number; b: number } | null>(null);
  const [preset, setPreset] = useState<"1m" | "3m" | "6m" | "all" | "custom">("all");
  const [dragTip, setDragTip] = useState<{ xPct: number; label: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  // `band` latches true once a drag moves vertically past BAND_LOCK_PX, so the
  // selection stays a precise 2D box (X days × Y amount) for the rest of the drag
  // instead of flip-flopping back to full-height columns near a threshold.
  const dragRef = useRef<{ anchor: number; anchorY: number; moved: boolean; band: boolean } | null>(null);
  const trackElRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!tip) return;
    const clear = () => setTip(null);
    window.addEventListener("scroll", clear, true);
    return () => window.removeEventListener("scroll", clear, true);
  }, [tip]);

  const days: Partial<Record<CatKey, number>>[] = [];
  const dayItems: SpendItem[][] = [];
  const dayLabel: string[] = [];
  const monthStarts: { idx: number; key: string; dim: number }[] = [];
  let undated = 0;
  for (const { key, stmt } of months) {
    const [yy, mm] = key.split("-").map(Number);
    const dim = yy && mm ? new Date(yy, mm, 0).getDate() : 31;
    const base = days.length;
    monthStarts.push({ idx: base, key, dim });
    for (let d = 1; d <= dim; d++) {
      days.push({});
      dayItems.push([]);
      dayLabel.push(months.length > 1 ? `${monthAbbr(key)} ${d}` : `${d}.`);
    }
    for (const e of stmt.expenses) {
      if (e.savingsPlanId) continue;
      if (hiddenSet.has(e.cat)) continue;
      const d = e.date?.startsWith(key) ? Number(e.date.slice(8, 10)) : 0;
      if (d >= 1 && d <= dim) {
        days[base + d - 1][e.cat] = (days[base + d - 1][e.cat] ?? 0) + e.amt;
        dayItems[base + d - 1].push({ id: e.id, label: e.label, cat: e.cat, amt: e.amt, day: dayLabel[base + d - 1] });
      } else {
        undated += e.amt;
      }
    }
  }

  const totalDays = days.length;
  const rangeTotal = days.reduce((s, d) => s + CAT_KEYS.reduce((a, k) => a + (d[k] ?? 0), 0), 0);
  if (rangeTotal <= 0 || totalDays === 0) {
    return (
      <div style={{ padding: 20, fontSize: 12, color: "var(--faint)" }}>
        Nothing to show — no dated expenses in this range{hidden.length > 0 ? " (some categories are hidden)" : ""}.
      </div>
    );
  }

  const weekly = months.length >= 6;
  const [y0, m0] = months[0].key.split("-").map(Number);
  const startDate = new Date(y0, (m0 || 1) - 1, 1);
  const offset = weekly ? (startDate.getDay() + 6) % 7 : 0;
  const unit = weekly ? 7 : 1;
  const totalCols = Math.ceil((totalDays + offset) / unit);
  const colIdxOf = (dayIdx: number) => Math.floor((dayIdx + offset) / unit);

  const cols: Partial<Record<CatKey, number>>[] = Array.from({ length: totalCols }, () => ({}));
  days.forEach((d, i) => {
    const c = colIdxOf(i);
    for (const k of CAT_KEYS) {
      const v = d[k] ?? 0;
      if (v > 0) cols[c][k] = (cols[c][k] ?? 0) + v;
    }
  });
  const colTotals = cols.map((d) => CAT_KEYS.reduce((s, k) => s + (d[k] ?? 0), 0));
  const colItems: SpendItem[][] = Array.from({ length: totalCols }, () => []);
  dayItems.forEach((items, i) => { colItems[colIdxOf(i)].push(...items); });
  for (const items of colItems) items.sort((a, b) => b.amt - a.amt);

  const monthKeys = months.map((m) => m.key).join(",");
  const hiddenKey = hidden.join(",");
  useEffect(() => { setSel(null); setFocus(null); setPreset("all"); }, [monthKeys, hiddenKey]);
  useEffect(() => { setSel(null); }, [focus ? `${focus.a}-${focus.b}` : ""]);

  const fA = focus ? Math.max(0, Math.min(focus.a, totalCols - 1)) : 0;
  const fB = focus ? Math.max(fA, Math.min(focus.b, totalCols - 1)) : totalCols - 1;
  const visCount = fB - fA + 1;
  const visTotals = colTotals.slice(fA, fB + 1);
  const yMaxAll = Math.max(...colTotals, 1);
  const trueMax = Math.max(...visTotals, 1);
  let yMax = trueMax;
  const nz = visTotals.filter((v) => v > 0).sort((a, b) => a - b);
  if (nz.length >= 5) {
    const p85 = nz[Math.min(nz.length - 1, Math.floor(nz.length * 0.85))];
    if (trueMax > p85 * 2.4) yMax = niceCeil(p85 * 1.2);
  }
  const axisCapped = trueMax > yMax + 1;
  const avg = visTotals.reduce((a, b) => a + b, 0) / visCount;
  const yOf = (v: number) => PAD.top + ch - (Math.min(v, yMax) / yMax) * ch;
  const slot = cw / visCount;
  const barW = Math.max(1.5, slot * 0.62);
  const xOf = (col: number) => PAD.left + (col - fA) * slot + (slot - barW) / 2;
  const colPosOf = (dayIdx: number) => (dayIdx + offset) / unit;

  const colSegs = cols.map((d) => {
    const segs: Partial<Record<CatKey, [number, number]>> = {};
    let acc = 0;
    for (const k of CAT_KEYS) {
      const v = d[k] ?? 0;
      if (v <= 0) continue;
      const yA = yOf(acc);
      acc += v;
      const yB = yOf(acc);
      segs[k] = [yB, yA];
    }
    return segs;
  });

  const bandHit = (i: number, k: CatKey) => {
    if (!sel || sel.fullY) return true;
    const s = colSegs[i][k];
    return !!s && s[0] <= sel.yB && s[1] >= sel.yT;
  };

  const itemsInSel = (s: SelState) => {
    const out: SpendItem[] = [];
    for (let i = s.a; i <= s.b; i++) {
      for (const it of colItems[i]) {
        if (bandHit(i, it.cat)) out.push(it);
      }
    }
    return out;
  };

  // measure against the SVG plot box (not .dsp-wrap, which also contains the
  // timeline rail below) so the X column and Y amount map to the cursor exactly
  const colAt = (clientX: number) => {
    const rect = svgElRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    const vx = ((clientX - rect.left) / rect.width) * W;
    const col = fA + Math.floor((vx - PAD.left) / slot);
    return col >= fA && col <= fB ? col : null;
  };

  const pyAt = (clientY: number) => {
    const rect = svgElRef.current?.getBoundingClientRect();
    if (!rect || rect.height === 0) return null;
    const vy = ((clientY - rect.top) / rect.height) * H;
    return Math.max(PAD.top, Math.min(PAD.top + ch, vy));
  };

  const onSvgMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const col = colAt(e.clientX);
    if (dragRef.current && (e.buttons & 1) && col !== null) {
      const py = pyAt(e.clientY);
      if (py === null) return;
      const d = dragRef.current;
      const dv = Math.abs(py - d.anchorY);
      if (col !== d.anchor || dv > 4) d.moved = true;
      if (dv > BAND_LOCK_PX) d.band = true; // latch into 2D amount-band mode
      if (d.moved) {
        setSel({
          a: Math.min(d.anchor, col),
          b: Math.max(d.anchor, col),
          yT: Math.min(d.anchorY, py),
          yB: Math.max(d.anchorY, py),
          fullY: !d.band,
        });
      }
    }
    if (col === null) { setTip(null); return; }
    setTip({
      col,
      cx: e.clientX,
      cy: e.clientY,
      flipX: e.clientX > window.innerWidth * 0.62,
      flipY: e.clientY > window.innerHeight * 0.55,
    });
  };

  const openSelection = (s: SelState) => {
    if (!onOpenRange) return;
    const dayA = unit === 1 ? s.a : Math.max(0, s.a * 7 - offset);
    const dayB = unit === 1 ? s.b : Math.min(totalDays - 1, s.b * 7 - offset + 6);
    const locate = (dayIdx: number) => {
      for (let i = monthStarts.length - 1; i >= 0; i--) {
        const ms = monthStarts[i];
        if (dayIdx >= ms.idx) return { key: ms.key, day: dayIdx - ms.idx + 1 };
      }
      return { key: monthStarts[0].key, day: 1 };
    };
    const A = locate(dayA);
    const B = locate(dayB);
    let week: number | null = null;
    if (A.key === B.key) {
      const wA = weekOfDate(A.key, dayStr(A.key, A.day));
      const wB = weekOfDate(B.key, dayStr(B.key, B.day));
      if (wA === wB) week = wA;
    }
    const ids = s.fullY ? null : [...new Set(itemsInSel(s).map((it) => it.id).filter(Boolean))] as string[];
    onOpenRange({
      monthKey: A.key,
      week,
      startIso: dayStr(A.key, A.day),
      endIso: dayStr(B.key, B.day),
      ids: ids?.length ? ids : null,
    });
  };

  const onSvgDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const col = colAt(e.clientX);
    if (col === null) return;
    const py = pyAt(e.clientY);
    if (py === null) return;
    dragRef.current = { anchor: col, anchorY: py, moved: false, band: false };
  };

  const onSvgUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    const col = colAt(e.clientX);
    if (d.moved) return;
    if (sel && col !== null && col >= sel.a && col <= sel.b) { openSelection(sel); return; }
    if (col !== null && sel === null) {
      setSel({ a: col, b: col, fullY: true, yT: PAD.top, yB: PAD.top + ch });
      return;
    }
    setSel(null);
  };

  // ── period-focus timeline ──
  const monthBoundaryCols = monthStarts.map((ms) => colIdxOf(ms.idx));
  const monthColRange = (key: string) => {
    const ms = monthStarts.find((m) => m.key === key);
    if (!ms) return null;
    return { a: colIdxOf(ms.idx), b: Math.min(totalCols - 1, colIdxOf(ms.idx + ms.dim - 1)) };
  };
  const applyPreset = (id: "1m" | "3m" | "6m" | "all") => {
    setPreset(id);
    if (id === "all") { setFocus(null); return; }
    if (id === "1m") {
      const r = (activeKey && monthColRange(activeKey)) || monthColRange(monthStarts[monthStarts.length - 1].key);
      setFocus(r ?? null);
      return;
    }
    const n = id === "3m" ? 3 : 6;
    const ms = monthStarts.slice(-n);
    setFocus(ms.length ? { a: colIdxOf(ms[0].idx), b: totalCols - 1 } : null);
  };
  const snapCol = (c: number) => {
    // magnetise to month boundaries (start cols and range end)
    const targets = [...monthBoundaryCols, totalCols - 1];
    for (const t of targets) if (Math.abs(c - t) === 1) return t;
    return c;
  };

  const brushColAt = (clientX: number) => {
    const r = trackElRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return 0;
    const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    return Math.round(f * (totalCols - 1));
  };

  const onBrushDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const col = brushColAt(e.clientX);
    const nearA = Math.abs(col - fA);
    const nearB = Math.abs(col - fB);
    let mode: "new" | "a" | "b" | "move";
    if (!focus) mode = "new";
    else if (nearA <= 1 && nearA <= nearB) mode = "a";
    else if (nearB <= 1) mode = "b";
    else if (col > fA && col < fB) mode = "move";
    else mode = "new";
    const st = { mode, startCol: col, fA, fB };
    setDragging(true);
    const scrub = (clientX: number, c: number) => {
      const r = trackElRef.current?.getBoundingClientRect();
      if (r) setDragTip({ xPct: Math.max(2, Math.min(98, ((clientX - r.left) / r.width) * 100)), label: colLabel(c) });
    };
    const move = (ev: PointerEvent) => {
      const c = brushColAt(ev.clientX);
      scrub(ev.clientX, c);
      if (st.mode === "new") {
        const a = Math.min(st.startCol, c);
        const b = Math.max(st.startCol, c);
        if (b - a >= 1) { setFocus({ a, b }); setPreset("custom"); }
      } else if (st.mode === "a") {
        setFocus({ a: Math.min(c, st.fB - 1), b: st.fB }); setPreset("custom");
      } else if (st.mode === "b") {
        setFocus({ a: st.fA, b: Math.max(c, st.fA + 1) }); setPreset("custom");
      } else {
        const delta = c - st.startCol;
        const w = st.fB - st.fA;
        let a = st.fA + delta;
        a = Math.max(0, Math.min(a, totalCols - 1 - w));
        setFocus({ a, b: a + w }); setPreset("custom");
      }
    };
    const up = () => {
      setDragging(false);
      setDragTip(null);
      // month-boundary magnetism on release
      setFocus((f) => (f ? { a: snapCol(f.a), b: snapCol(f.b) } : f));
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    move(e.nativeEvent);
  };

  const onBrushWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (totalCols <= 3) return;
    e.preventDefault();
    const c = brushColAt(e.clientX);
    const zoomIn = e.deltaY < 0;
    const a0 = focus ? fA : 0;
    const b0 = focus ? fB : totalCols - 1;
    const w = b0 - a0;
    const step = Math.max(1, Math.round(w * 0.15));
    let a: number, b: number;
    if (zoomIn) {
      if (w <= 2) return;
      const bias = (c - a0) / Math.max(w, 1);
      a = Math.min(c - 1, a0 + Math.round(step * bias));
      b = Math.max(c + 1, b0 - Math.round(step * (1 - bias)));
    } else {
      a = Math.max(0, a0 - step);
      b = Math.min(totalCols - 1, b0 + step);
    }
    if (a === 0 && b === totalCols - 1) { applyPreset("all"); return; }
    setFocus({ a, b: Math.max(b, a + 1) });
    setPreset("custom");
  };

  const onBrushKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!focus) return;
    const step = e.shiftKey ? 7 : 1;
    let d = 0;
    if (e.key === "ArrowLeft") d = -step;
    else if (e.key === "ArrowRight") d = step;
    else if (e.key === "Escape") { applyPreset("all"); return; }
    else return;
    e.preventDefault();
    const w = fB - fA;
    const a = Math.max(0, Math.min(fA + d, totalCols - 1 - w));
    setFocus({ a, b: a + w });
    setPreset("custom");
  };

  const colLabel = (c: number): string => {
    if (!weekly) return dayLabel[c];
    const monday = new Date(y0, (m0 || 1) - 1, 1 + (c * 7 - offset));
    return `wk of ${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  };

  const fmt = (v: number) => fmtMoney(v, cur, { abbr: true });
  const avgY = yOf(avg);
  const yTicks = 5;
  const tickStep = Math.max(1, Math.ceil(visCount / 8));
  const dayTicks: number[] = [];
  for (let c = fA; c <= fB; c += tickStep) dayTicks.push(c);
  if (dayTicks[dayTicks.length - 1] !== fB) dayTicks.push(fB);

  return (
    <div className="dsp-wrap" ref={wrapRef}>
      <svg
        ref={svgElRef}
        className="proj-svg dsp-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        onMouseMove={onSvgMove}
        onMouseLeave={() => setTip(null)}
        onPointerDown={onSvgDown}
        onPointerUp={onSvgUp}
      >
        <g className="proj-grid">
          {Array.from({ length: yTicks + 1 }, (_, i) => {
            const v = (yMax / yTicks) * i;
            return <line key={i} x1={PAD.left} y1={yOf(v)} x2={W - PAD.right} y2={yOf(v)} />;
          })}
        </g>
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const v = (yMax / yTicks) * i;
          return <text key={i} className="proj-ylab" x={PAD.left - 6} y={yOf(v) + 4}>{v > 0 ? fmt(v) : "0"}</text>;
        })}
        {months.length === 1
          ? dayTicks.map((c) => (
              <text key={c} className="proj-xlab" x={xOf(c) + barW / 2} y={H - 4}>{c + 1}</text>
            ))
          : monthStarts.map((ms) => {
              const px = PAD.left + (colPosOf(ms.idx + ms.dim / 2) - fA) * slot;
              if (px < PAD.left - 4 || px > W - PAD.right + 4) return null;
              return (
                <text key={ms.key} className="proj-xlab" x={px} y={H - 4}>
                  {monthAbbr(ms.key)}
                </text>
              );
            })}
        {months.length > 1 && monthStarts.slice(1).map((ms) => {
          const px = PAD.left + (colPosOf(ms.idx) - fA) * slot;
          if (px < PAD.left || px > W - PAD.right) return null;
          return (
            <line
              key={ms.key}
              className="dsp-mline"
              x1={px} y1={PAD.top}
              x2={px} y2={PAD.top + ch}
            />
          );
        })}
        {sel && (
          <rect
            className="dsp-selrect"
            x={PAD.left + (sel.a - fA) * slot + 1}
            y={sel.fullY ? PAD.top - 4 : sel.yT}
            width={(sel.b - sel.a + 1) * slot - 2}
            height={sel.fullY ? ch + 8 : Math.max(4, sel.yB - sel.yT)}
            rx={8}
          />
        )}
        {cols.map((_, i) => {
          if (i < fA || i > fB) return null;
          if (colTotals[i] <= 0) return null;
          const topY = yOf(colTotals[i]);
          const clipId = `${uidRef.current}-${i}`;
          const rad = Math.min(barW / 2, 6);
          const dimmed = sel && (i < sel.a || i > sel.b);
          return (
            <g key={i} clipPath={`url(#${clipId})`} style={dimmed ? { opacity: 0.3 } : undefined}>
              <clipPath id={clipId}>
                <rect x={xOf(i)} y={topY} width={barW} height={Math.max(2, yOf(0) - topY)} rx={rad} ry={rad} />
              </clipPath>
              {CAT_KEYS.map((k) => {
                const s = colSegs[i][k];
                if (!s) return null;
                const miss = sel && !dimmed && !bandHit(i, k);
                return (
                  <rect
                    key={k}
                    className="dsp-rect"
                    x={xOf(i)} y={s[0]}
                    width={barW} height={Math.max(1, s[1] - s[0])}
                    style={miss ? { opacity: 0.18 } : undefined}
                    fill={STMT_CATS[k].hue}
                  />
                );
              })}
            </g>
          );
        })}
        {axisCapped && cols.map((_, i) => {
          if (i < fA || i > fB || colTotals[i] <= yMax) return null;
          const cx = xOf(i) + barW / 2;
          return (
            <g key={`ov${i}`} style={{ pointerEvents: "none" }}>
              <path
                d={`M${cx - 4},${PAD.top + 5} L${cx},${PAD.top + 1} L${cx + 4},${PAD.top + 5}`}
                fill="none" stroke="var(--fg-2)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.65"
              />
            </g>
          );
        })}
        <line className="spend-avgline" x1={PAD.left} y1={avgY} x2={W - PAD.right} y2={avgY} />
        <text className="spend-avglab" x={PAD.left + 4} y={avgY - 5}>{weekly ? "avg/wk" : "avg/day"}</text>
        {axisCapped && (
          <text className="proj-xlab" x={W - PAD.right} y={PAD.top - 4} style={{ fill: "var(--faint)", textAnchor: "end" }}>
            peak {fmt(trueMax)} ↑ (axis capped)
          </text>
        )}
        {undated > 0 && !axisCapped && (
          <text className="proj-xlab" x={W - PAD.right} y={PAD.top - 4} style={{ fill: "var(--faint)", textAnchor: "end" }}>
            +{fmt(undated)} without a date (not shown)
          </text>
        )}
      </svg>
      {totalCols > 3 && (() => {
        const visTotal = visTotals.reduce((a, b) => a + b, 0);
        const visItems = colItems.slice(fA, fB + 1).reduce((a, arr) => a + arr.length, 0);
        return (
          <div className="dsp-brush">
            <div className="dsp-brush-presets" role="group" aria-label="Period presets">
              {([["1m", "1M"], ["3m", "3M"], ["6m", "6M"], ["all", "ALL"]] as const).map(([id, lab]) => (
                <button key={id} type="button" className={`dsp-brush-preset${preset === id ? " on" : ""}`} onClick={() => applyPreset(id)}>{lab}</button>
              ))}
            </div>
            <div
              className={`dsp-brush-track${dragging ? " dragging" : ""}`}
              ref={trackElRef}
              tabIndex={0}
              onKeyDown={onBrushKey}
              onWheel={onBrushWheel}
              onPointerDown={onBrushDown}
              onDoubleClick={() => applyPreset("all")}
              title="Drag to focus · edges resize · middle pans · double-click resets · ←/→ nudge (⇧ = week)"
            >
              <div className="dsp-brush-mini" aria-hidden="true">
                {colTotals.map((t, i) => (
                  <span
                    key={i}
                    className={focus && i >= fA && i <= fB ? "in" : ""}
                    style={{ height: `${Math.max(9, (t / yMaxAll) * 100)}%` }}
                  />
                ))}
              </div>
              {monthStarts.length > 1 && monthStarts.map((ms, i) => {
                const left = (colIdxOf(ms.idx) / totalCols) * 100;
                const center = ((colIdxOf(ms.idx) + Math.min(totalCols - 1, colIdxOf(ms.idx + ms.dim - 1))) / 2 / totalCols) * 100;
                return (
                  <Fragment key={ms.key}>
                    {i > 0 && <span className="dsp-brush-msep" style={{ left: `${left}%` }} />}
                    <span className="dsp-brush-mlab" style={{ left: `${center}%` }}>{monthAbbr(ms.key).split(" ")[0]}</span>
                  </Fragment>
                );
              })}
              {focus && (
                <div
                  className="dsp-brush-win"
                  style={{ left: `${(fA / totalCols) * 100}%`, width: `${(visCount / totalCols) * 100}%` }}
                >
                  <span className="dsp-brush-grip dsp-brush-grip--l" />
                  <span className="dsp-brush-grip dsp-brush-grip--r" />
                </div>
              )}
              {dragTip && (
                <span className="dsp-brush-scrub" style={{ left: `${dragTip.xPct}%` }}>{dragTip.label}</span>
              )}
            </div>
            <div className="dsp-brush-side">
              <span className="dsp-brush-range">
                {colLabel(fA)}{visCount > 1 ? ` – ${colLabel(fB)}` : ""}
              </span>
              <span className="dsp-brush-stats">
                {fmt(visTotal)} · {fmt(avg)}{weekly ? "/wk" : "/d"} · {visItems} item{visItems === 1 ? "" : "s"}
              </span>
              {focus
                ? <button type="button" className="dsp-brush-reset" onClick={() => applyPreset("all")} title="Show the whole range">Reset</button>
                : <span className="dsp-brush-hint">drag · scroll · ←→</span>}
            </div>
          </div>
        );
      })()}
      {tip && colItems[tip.col] && createPortal(
        (() => {
          const inSel = sel && tip.col >= sel.a && tip.col <= sel.b;
          const items = inSel
            ? itemsInSel(sel).sort((a, b) => b.amt - a.amt)
            : colItems[tip.col];
          const total = inSel
            ? items.reduce((s, it) => s + it.amt, 0)
            : colTotals[tip.col];
          const label = inSel
            ? `${sel.a === sel.b ? colLabel(sel.a) : `${colLabel(sel.a)} – ${colLabel(sel.b)}`}${sel.fullY ? "" : " · band"}`
            : colLabel(tip.col);
          const showDay = weekly || inSel;
          return (
            <div
              className="dsp-tip dsp-tip--fixed"
              style={{
                left: tip.cx + 14,
                top: tip.cy + 14,
                transform: `${tip.flipX ? "translateX(calc(-100% - 28px))" : ""}${tip.flipY ? " translateY(calc(-100% - 28px))" : ""}`,
              }}
            >
              <div className="dsp-tip-head">
                <b>{label}</b>
                <span>{fmt(total)}</span>
              </div>
              {items.length === 0 && (
                <div className="dsp-tip-more">
                  Nothing spent {inSel ? "in this range" : weekly ? "this week" : "this day"}.
                </div>
              )}
              {items.slice(0, SPEND_TIP_MAX_ITEMS).map((it, j) => (
                <div key={j} className="dsp-tip-row">
                  <span className="dsp-cat-dot" style={{ background: (STMT_CATS[it.cat] || STMT_CATS.other).hue }} />
                  <span className="dsp-tip-lab">{showDay ? `${it.day} · ` : ""}{it.label || "—"}</span>
                  <span className="dsp-tip-amt">{fmt(it.amt)}</span>
                </div>
              ))}
              {items.length > SPEND_TIP_MAX_ITEMS && (
                <div className="dsp-tip-more">…+{items.length - SPEND_TIP_MAX_ITEMS} more</div>
              )}
              {inSel && onOpenRange && (
                <div className="dsp-tip-hint">Click to open in the statement editor</div>
              )}
              {!inSel && sel === null && (
                <div className="dsp-tip-hint dsp-tip-hint--dim">Drag a box — sideways picks the days, down sets an amount range</div>
              )}
            </div>
          );
        })(),
        document.body,
      )}
    </div>
  );
}

export function ProjectionChart({
  principal, monthly, scenarioRate, horizon,
}: {
  principal: number; monthly: number; scenarioRate: number; horizon: number;
}) {
  const W = 760; const H = 300;
  const PAD = { top: 20, right: 20, bottom: 36, left: 60 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;

  const pts = project(principal, monthly, scenarioRate, horizon);
  if (!pts.length) return null;

  const maxBal = pts[pts.length - 1].bal;
  const yMax = niceCeil(maxBal);

  const xOf = (m: number) => PAD.left + ((m - 1) / Math.max(horizon - 1, 1)) * cw;
  const yOf = (v: number) => PAD.top + ch - (v / yMax) * ch;

  const areaTotal: string[] = [];
  const lineTotal: string[] = [];
  const areaContrib: string[] = [];
  const lineContrib: string[] = [];

  pts.forEach((p, i) => {
    const x = xOf(p.m);
    const yBal = yOf(p.bal);
    const yCon = yOf(p.contrib);
    if (i === 0) {
      areaTotal.push(`M${x},${yOf(0)}`);
      areaContrib.push(`M${x},${yOf(0)}`);
    }
    areaTotal.push(`L${x},${yBal}`);
    lineTotal.push(i === 0 ? `M${x},${yBal}` : `L${x},${yBal}`);
    areaContrib.push(`L${x},${yCon}`);
    lineContrib.push(i === 0 ? `M${x},${yCon}` : `L${x},${yCon}`);
  });
  const lastX = xOf(pts[pts.length - 1].m);
  areaTotal.push(`L${lastX},${yOf(0)}Z`);
  areaContrib.push(`L${lastX},${yOf(0)}Z`);

  const yTicks = 5;
  const xTickCount = Math.min(horizon, 7);

  return (
    <svg className="proj-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <g className="proj-grid">
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const v = (yMax / yTicks) * i;
          const y = yOf(v);
          return <line key={i} x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} />;
        })}
      </g>
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const v = (yMax / yTicks) * i;
        return (
          <text key={i} className="proj-ylab" x={PAD.left - 6} y={yOf(v) + 4}>
            {v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
          </text>
        );
      })}
      {Array.from({ length: xTickCount }, (_, i) => {
        const m = Math.round(1 + (i / Math.max(xTickCount - 1, 1)) * (horizon - 1));
        return (
          <text key={i} className="proj-xlab" x={xOf(m)} y={H - 6}>
            {`Yr ${Math.round(m / 12)}`}
          </text>
        );
      })}
      <path className="proj-area-total" d={areaTotal.join(" ")} />
      <path className="proj-area-contrib" d={areaContrib.join(" ")} />
      <path className="proj-line-contrib" d={lineContrib.join(" ")} />
      <path className="proj-line-total" d={lineTotal.join(" ")} />
      <circle className="proj-dot" cx={xOf(pts[pts.length - 1].m)} cy={yOf(pts[pts.length - 1].bal)} r={4} />
    </svg>
  );
}
