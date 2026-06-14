import { useState, useRef, useMemo, useLayoutEffect } from "react";
import type { ReactNode } from "react";
import type { StrategieState, VfGoal } from "../../../types/grid";
import { VF_MAX_GOALS } from "../../../types/grid";
import { vfReadFinance } from "./vfGoals";
import { vfCloneWithValues, vfRunTransition, type VfTransitionMode } from "./vfTransitions";
import { CampMap } from "./CampMap";
import { GoalScreen } from "./GoalScreen";

interface VisualFlowSurfaceProps {
  goals: VfGoal[];
  onSetGoals: (next: VfGoal[] | ((prev: VfGoal[]) => VfGoal[])) => void;
  strategie: StrategieState;
  currency: string;
  onToast?: (msg: string) => void;
  /** Renders the real node canvas; receives the callback that flips up to camps. */
  renderNodes: (onOpenCamps: () => void) => ReactNode;
}

type Layer = "nodes" | "camps";

/**
 * Two-layer Visual Flow surface: the real node canvas (default) ⇄ the camps
 * goal map ⇄ a goal screen, joined by 3D view transitions. The camps/goal
 * layers read pots/debts from Strategie but never write them.
 */
export function VisualFlowSurface({ goals, onSetGoals, strategie, currency, onToast, renderNodes }: VisualFlowSurfaceProps) {
  const [editId, setEditId] = useState<string | null>(null);
  const [layer, setLayer] = useState<Layer>("nodes");
  const trimmed = goals.slice(0, VF_MAX_GOALS);
  const fin = useMemo(() => vfReadFinance(strategie), [strategie]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const transRef = useRef<{ snap: HTMLElement; h: number; dir: number; mode: VfTransitionMode } | null>(null);

  const goTrans = (apply: () => void, dir: number, mode: VfTransitionMode) => {
    const wrap = wrapRef.current;
    const view = wrap?.querySelector<HTMLElement>(".vf-view");
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!view || reduced || transRef.current || !wrap?.clientWidth) { apply(); return; }
    transRef.current = { snap: vfCloneWithValues(view), h: view.offsetHeight, dir, mode };
    apply();
  };

  useLayoutEffect(() => {
    const t = transRef.current;
    if (!t || !wrapRef.current) return;
    transRef.current = null;
    vfRunTransition(wrapRef.current, t.snap, t.h, t.dir, t.mode);
  }, [editId, layer]);

  const patchGoal = (id: string, p: Partial<VfGoal>) =>
    onSetGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...p } : g)));

  // Asymmetric on purpose: opening/pitching a camp uses the showy flip
  // (slower, lifts toward you, light sheen); the way back keeps the plain flip.
  const openGoal = (id: string) => goTrans(() => setEditId(id), 1, "flipshow");
  const backToMap = () => goTrans(() => setEditId(null), -1, "cardflip");
  const toNodes = () => goTrans(() => setLayer("nodes"), 1, "depthzoom");
  const toCamps = () => goTrans(() => setLayer("camps"), -1, "depthzoom");

  const pitchCamp = () => {
    if (trimmed.length >= VF_MAX_GOALS) return;
    const g: VfGoal = {
      id: `g${crypto.randomUUID()}`, title: "", outcome: "", status: "notstarted",
      progressMode: "subgoals", supplies: null, milestones: [], notes: "",
    };
    goTrans(() => { onSetGoals((prev) => [...prev, g]); setEditId(g.id); }, 1, "flipshow");
  };

  const deleteGoal = (id: string) => {
    goTrans(() => { onSetGoals((prev) => prev.filter((g) => g.id !== id)); setEditId(null); }, -1, "cardflip");
    onToast?.("Camp broken");
  };

  const editing = trimmed.find((g) => g.id === editId) ?? null;

  let view: ReactNode;
  let key: string;
  if (editing) {
    key = "goal";
    view = (
      <GoalScreen
        goal={editing}
        slot={trimmed.indexOf(editing)}
        fin={fin}
        currency={currency}
        onPatch={(p) => patchGoal(editing.id, p)}
        onDelete={() => deleteGoal(editing.id)}
        onBack={backToMap}
      />
    );
  } else if (layer === "nodes") {
    key = "nodes";
    view = renderNodes(toCamps);
  } else {
    key = "map";
    view = (
      <CampMap
        goals={trimmed}
        fin={fin}
        currency={currency}
        onOpenGoal={openGoal}
        onPitch={pitchCamp}
        onFlipToFlow={toNodes}
      />
    );
  }

  return (
    <div className="vf-stage" ref={wrapRef}>
      <div className="vf-view" key={key}>{view}</div>
    </div>
  );
}
