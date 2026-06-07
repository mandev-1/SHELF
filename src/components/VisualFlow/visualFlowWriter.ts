import type {
  VisualFlowData,
  VisualFlowEdge,
  VisualFlowNodeSize,
} from "../../types/grid";

/**
 * Plane identifier. `main`, `grazeland`, `bin` are the built-ins; custom planes
 * carry their UUID in the suffix. Used as the parameter to {@link writePlane}
 * so the writer never has to decide which plane to write — the caller does.
 */
export type PlaneId = "main" | "grazeland" | "bin" | `custom-${string}`;

export type PlanePatch = {
  positions: Record<string, { x: number; y: number }>;
  edges: VisualFlowEdge[];
  /** Ignored for the main plane. */
  sizes?: Record<string, VisualFlowNodeSize>;
};

/**
 * Apply a per-plane patch and return a new VisualFlowData. The plane is a
 * parameter — there is no "wrong plane" path reachable from this function, so
 * the historical bug where every non-main write landed in `grazeland*` cannot
 * recur unless the caller passes the wrong `plane` literal.
 *
 * Pure: does not mutate `prev`.
 */
export function writePlane(
  prev: VisualFlowData,
  plane: PlaneId,
  patch: PlanePatch,
): VisualFlowData {
  if (plane === "main") {
    return {
      ...prev,
      nodePositions: patch.positions,
      edges: patch.edges,
    };
  }

  if (plane === "grazeland") {
    const next: VisualFlowData = {
      ...prev,
      grazelandNodePositions: patch.positions,
      grazelandEdges: patch.edges,
    };
    if (patch.sizes && Object.keys(patch.sizes).length > 0) {
      next.grazelandNodeSizes = patch.sizes;
    } else {
      delete next.grazelandNodeSizes;
    }
    return next;
  }

  if (plane === "bin") {
    const next: VisualFlowData = {
      ...prev,
      binNodePositions: patch.positions,
      binEdges: patch.edges,
    };
    if (patch.sizes && Object.keys(patch.sizes).length > 0) {
      next.binNodeSizes = patch.sizes;
    } else {
      delete next.binNodeSizes;
    }
    return next;
  }

  return {
    ...prev,
    customPlaneNodePositions: {
      ...(prev.customPlaneNodePositions ?? {}),
      [plane]: patch.positions,
    },
    customPlaneEdges: {
      ...(prev.customPlaneEdges ?? {}),
      [plane]: patch.edges,
    },
    ...(patch.sizes && Object.keys(patch.sizes).length > 0
      ? {
          customPlaneNodeSizes: {
            ...(prev.customPlaneNodeSizes ?? {}),
            [plane]: patch.sizes,
          },
        }
      : {}),
  };
}

/** Existing per-plane sizes for the given plane, or undefined for main. */
export function getPlaneSizes(
  vf: VisualFlowData,
  plane: PlaneId,
): Record<string, VisualFlowNodeSize> | undefined {
  if (plane === "main") return undefined;
  if (plane === "grazeland") return vf.grazelandNodeSizes;
  if (plane === "bin") return vf.binNodeSizes;
  return vf.customPlaneNodeSizes?.[plane];
}
