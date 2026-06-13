import { useState } from "react";
import type { VfGoal } from "../../../types/grid";

/** Cascading subgoals: boxes zig-zag downward, connected by dashed SVG wires —
 *  each one leads to the next, the chain leading to the goal above. */
export function GoalCascade({ goal, onPatch }: { goal: VfGoal; onPatch: (p: Partial<VfGoal>) => void }) {
  const [text, setText] = useState("");
  const ms = goal.milestones ?? [];
  const ROW = 92;
  const X = [4, 30, 10, 34, 6, 28, 16, 36, 8, 30];
  const n = ms.length;
  const H = (n + 1) * ROW + 6;
  const ax = (i: number) => X[i % X.length] + 2.5;
  const ay = (i: number) => i * ROW + 30;

  let d = `M 9 -30 C 9 2, ${ax(0)} ${ay(0) - 48}, ${ax(0)} ${ay(0)}`;
  for (let i = 0; i < n; i++) {
    const x1 = ax(i), y1 = ay(i), x2 = ax(i + 1), y2 = ay(i + 1);
    d += ` M ${x1} ${y1} C ${x1} ${y1 + 44}, ${x2} ${y2 - 44}, ${x2} ${y2}`;
  }

  const patchWp = (id: string, p: Partial<VfGoal["milestones"][number]>) =>
    onPatch({ milestones: ms.map((m) => (m.id === id ? { ...m, ...p } : m)) });
  const rmWp = (id: string) => onPatch({ milestones: ms.filter((m) => m.id !== id) });
  const addWp = () => {
    const label = text.trim();
    if (!label) return;
    onPatch({ milestones: [...ms, { id: `wp${crypto.randomUUID()}`, label, done: false }] });
    setText("");
  };

  return (
    <div className="gs-cascade" style={{ height: `${H}px` }}>
      <svg className="gs-wires" viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <path d={d} vectorEffect="non-scaling-stroke" />
      </svg>
      {ms.map((m, i) => (
        <div
          key={m.id}
          className={"gs-node" + (m.done ? " done" : "")}
          style={{ left: `${X[i % X.length]}%`, top: `${i * ROW}px` }}
        >
          <span className="gs-node-idx">{i + 1}</span>
          <input
            type="checkbox" checked={m.done}
            onChange={(e) => patchWp(m.id, { done: e.target.checked })}
            title={m.done ? "Reached" : "Mark reached"}
          />
          <input
            className="gs-node-label" value={m.label} placeholder="Subgoal…"
            onChange={(e) => patchWp(m.id, { label: e.target.value })}
          />
          <button className="gs-node-rm" onClick={() => rmWp(m.id)} aria-label="Remove subgoal">×</button>
        </div>
      ))}
      <div className="gs-node gs-node--add" style={{ left: `${X[n % X.length]}%`, top: `${n * ROW}px` }}>
        <input
          className="gs-node-label"
          placeholder={n === 0 ? "Break the goal down — first subgoal…" : "Cascade further — add a subgoal…"}
          value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addWp(); }}
        />
        <button className="ghost-btn" onClick={addWp} disabled={!text.trim()}>Add</button>
      </div>
    </div>
  );
}
