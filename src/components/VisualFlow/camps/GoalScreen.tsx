import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { VfGoal } from "../../../types/grid";
import { VF_MAX_GOALS } from "../../../types/grid";
import { VF_STATUS, vfProgress, vfSmart, type VfFinance } from "./vfGoals";
import { GoalCascade } from "./GoalCascade";

interface GoalScreenProps {
  goal: VfGoal;
  slot: number;
  fin: VfFinance;
  currency: string;
  onPatch: (p: Partial<VfGoal>) => void;
  onDelete: () => void;
  onBack: () => void;
}

/** One goal's own full-screen view: SMART goal box at the top, cascading
 *  subgoals beneath, supplies + field journal in the right rail. */
export function GoalScreen({ goal, slot, fin, currency, onPatch, onDelete, onBack }: GoalScreenProps) {
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onBack(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onBack]);

  useEffect(() => {
    if (!goal.title && titleRef.current) titleRef.current.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prog = vfProgress(goal, fin, currency);
  const reached = goal.status === "done" || prog.auto;
  const smart = vfSmart(goal, reached);

  return (
    <div className="gs" data-screen-label={`Goal — ${goal.title || "untitled"}`}>
      <div className="gs-top">
        <button className="ghost-btn" onClick={onBack}>← Back to the map</button>
        <span className="gs-crumb">Campsite {slot + 1} of {VF_MAX_GOALS}</span>
        <button
          className="vfg-break"
          onClick={() => {
            if (window.confirm(`Break camp? "${goal.title || "Untitled goal"}" will be removed from the map.`)) onDelete();
          }}
        >
          Break camp
        </button>
      </div>

      {/* the SMART goal box at the top */}
      <div className="card gs-goal">
        <div className="gs-goal-row">
          <div className="gs-goal-main">
            <div className="vfg-eyebrow">The goal — defined at the top</div>
            <input
              ref={titleRef} className="vfg-title gs-title" placeholder="Name the destination…"
              value={goal.title} onChange={(e) => onPatch({ title: e.target.value })}
            />
            <input
              className="vfg-input" placeholder="Point B — what does arriving look like?"
              value={goal.outcome || ""} onChange={(e) => onPatch({ outcome: e.target.value })}
            />
          </div>
          <div className="gs-goal-side">
            <div className="vfg-status">
              {VF_STATUS.map((s) => (
                <button
                  key={s.id}
                  className={"vfg-st" + (goal.status === s.id ? " on" : "")}
                  style={{ ["--st-hue" as string]: s.hue } as CSSProperties}
                  onClick={() => onPatch({ status: s.id })}
                >
                  <span className="vfg-st-dot" />{s.label}
                </button>
              ))}
            </div>
            <label className="gs-due">
              <span className="vfg-lab">By when</span>
              <input
                type="month" className="vfg-input" value={goal.due || ""}
                onChange={(e) => onPatch({ due: e.target.value || undefined })}
              />
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
            <select
              className="se-cat vfg-link"
              value={goal.link ? `${goal.link.type}:${goal.link.id}` : ""}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) onPatch({ link: null });
                else {
                  const i = v.indexOf(":");
                  const type = v.slice(0, i);
                  if (type === "pot" || type === "debt") onPatch({ link: { type, id: v.slice(i + 1) } });
                }
              }}
            >
              <option value="">No link</option>
              {fin.pots.length > 0 && (
                <optgroup label="Savings pots">
                  {fin.pots.map((p) => <option key={p.id} value={`pot:${p.id}`}>◌ {p.name}</option>)}
                </optgroup>
              )}
              {fin.debts.length > 0 && (
                <optgroup label="Debts (payoff = arrival)">
                  {fin.debts.map((d) => <option key={d.id} value={`debt:${d.id}`}>↓ {d.name}</option>)}
                </optgroup>
              )}
            </select>
            <div className="vfg-prog">
              <div className="vfg-prog-bar"><span style={{ width: `${prog.pct}%` }} /></div>
              <div className="vfg-prog-foot"><span>{prog.pct}%</span><span>{prog.line}</span></div>
            </div>
          </div>
          <div className="vfg-sec">
            <div className="vfg-lab">Field journal — why it matters, risks</div>
            <textarea
              className="vfg-notes" rows={5} placeholder="Notes to your future self…"
              value={goal.notes || ""} onChange={(e) => onPatch({ notes: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
