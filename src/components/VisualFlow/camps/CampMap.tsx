import { useMemo } from "react";
import type { CSSProperties } from "react";
import type { VfGoal } from "../../../types/grid";
import { VF_MAX_GOALS } from "../../../types/grid";
import {
  VF_START, VF_END, VF_SLOTS, vfTrailPath, vfStatusMeta, vfProgress, vfSmart, type VfFinance,
} from "./vfGoals";
import { VfTent } from "./VfTent";

interface CampMapProps {
  goals: VfGoal[];
  fin: VfFinance;
  currency: string;
  onOpenGoal: (id: string) => void;
  onPitch: () => void;
  onFlipToFlow: () => void;
}

/** The camps map: a winding trail from "You are here" to "point B", with up to
 *  six campsites (top goals) pitched along it. */
export function CampMap({ goals, fin, currency, onOpenGoal, onPitch, onFlipToFlow }: CampMapProps) {
  const trail = useMemo(() => vfTrailPath(), []);

  return (
    <div className="vf" data-screen-label="Visual Flow — campsite roadmap">
      <svg className="vf-trail-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path className="vf-trail-under" d={trail} vectorEffect="non-scaling-stroke" />
        <path className="vf-trail" d={trail} vectorEffect="non-scaling-stroke" />
      </svg>

      <div className="vf-head">
        <div className="vf-eyebrow">Visual Flow · build a campsite down the road</div>
        <div className="vf-title-row">
          <h2 className="vf-title">Your six camps</h2>
          <span className="vf-count">{goals.length} of {VF_MAX_GOALS} pitched</span>
        </div>
        <p className="vf-hint">You're on the way somewhere. Pitch a camp down the river — it'll be waiting when you get there. Click a tent to open its goal screen.</p>
        <button className="ghost-btn vf-flip" onClick={onFlipToFlow} title="Flip down into the node canvas">⟲ Flip to the flow</button>
      </div>

      <div className="vf-you" style={{ left: `${VF_START.x}%`, top: `${VF_START.y}%` }}>
        <span className="vf-you-dot" />
        <span className="vf-you-lab">You are here</span>
      </div>
      <div className="vf-horizon" style={{ left: `${VF_END.x}%`, top: `${VF_END.y}%` }}>point B</div>

      {["soon", "this year", "down the river"].map((lab, i) => {
        const anchors = [VF_SLOTS[0], VF_SLOTS[2], VF_SLOTS[4]];
        return (
          <span key={lab} className="vf-dist" style={{ left: `${anchors[i].x + 4}%`, top: `${anchors[i].y + 7}%` }}>{lab}</span>
        );
      })}

      {VF_SLOTS.map((pos, i) => {
        const g = goals[i];
        if (!g) {
          return (
            <button
              key={`empty${i}`} className="camp-add" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              onClick={onPitch} title="Pitch a camp — define a new goal"
            >
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
          <button
            key={g.id}
            className={"camp camp--" + (reached ? "done" : g.status)}
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            onClick={() => onOpenGoal(g.id)}
            title={`${g.outcome || "No Point B yet"} · SMART ${smart.score}/5`}
          >
            <span className="camp-marker">
              <VfTent hue={st.hue} lit={!reached && g.status !== "notstarted"} />
              <span
                className={"camp-fire" + (reached ? " camp-fire--done" : "")}
                style={{ ["--st-hue" as string]: st.hue } as CSSProperties}
              >
                {reached ? "✓" : ""}
              </span>
            </span>
            <span className="camp-label">
              <span className="camp-name">{g.title || "Untitled goal"}</span>
              <span className="camp-bar"><span style={{ width: `${prog.pct}%`, background: st.hue }} /></span>
              <span className="camp-sub">{reached ? "camp reached" : `${st.label.toLowerCase()} · ${prog.pct}%`}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
