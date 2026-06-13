import type { SectorColorKey, ShelfPillarTodoItem, VisualFlowEdge, VfGoal } from "../../types/grid";
import type { PlaneId } from "./visualFlowWriter";

/**
 * Render a single Visual Flow plane as a markdown document optimised for
 * pasting into an LLM ("consolidate these todos for me", "find duplicates",
 * etc.). Scope is the currently-viewed plane only — what the user sees is what
 * the model gets.
 */

const BUILT_IN_PLANE_META: Record<
  "main" | "grazeland" | "bin",
  { display: string; description: string }
> = {
  main: {
    display: "Pillar",
    description: "active todos shown in the sidebar; the working list.",
  },
  grazeland: {
    display: "Grazeland",
    description: "parking lot for ideas not yet committed to.",
  },
  bin: {
    display: "Bin",
    description: "archived / discarded items, kept for reference.",
  },
};

export interface FlowExportInput {
  plane: PlaneId;
  /** User-set name for custom planes; ignored for main/grazeland/bin. */
  planeName?: string;
  items: ShelfPillarTodoItem[];
  edges?: VisualFlowEdge[];
  sectorColors?: Record<string, SectorColorKey>;
  /** Visual Flow goals layer ("camps") — global, rendered once when present. */
  vfGoals?: VfGoal[];
}

const VF_STATUS_LABEL: Record<VfGoal["status"], string> = {
  notstarted: "Not started",
  ontrack: "On track",
  atrisk: "At risk",
  done: "Reached",
};

function renderGoals(goals: VfGoal[]): string {
  if (!goals.length) return "";
  const blocks = goals.map((g) => {
    const done = g.milestones.filter((m) => m.done).length;
    const lines = [
      `### ${g.title || "(untitled goal)"} — ${VF_STATUS_LABEL[g.status]}`,
      g.outcome ? `- **Point B:** ${g.outcome}` : null,
      g.due ? `- **By when:** ${g.due}` : null,
      g.link ? `- **Wired to:** ${g.link.type} \`${g.link.id}\`` : null,
      g.milestones.length ? `- **Subgoals (${done}/${g.milestones.length}):**` : null,
      ...g.milestones.map((m) => `  - [${m.done ? "x" : " "}] ${m.label || "(untitled)"}`),
      g.notes.trim() ? `- **Journal:** ${g.notes.trim()}` : null,
    ].filter(Boolean);
    return lines.join("\n");
  });
  return `\n---\n\n## Goals (Visual Flow camps)\n\n${blocks.join("\n\n")}\n`;
}

/** Compact ID — first 8 chars of the UUID for human-readable references. */
function shortId(id: string): string {
  return id.slice(0, 8);
}

function titleOf(t: ShelfPillarTodoItem): string {
  return t.text?.trim() || "(untitled)";
}

function describeEdge(e: VisualFlowEdge): string {
  if (e.doubled) return "↔";
  if (e.muted) return "⤳";
  return e.arrow !== false ? "→" : "—";
}

function renderTasks(items: ShelfPillarTodoItem[]): string {
  if (items.length === 0) return "_(none)_\n";
  return items
    .map((t) => {
      const id = shortId(t.id);
      const check = t.done ? "x" : " ";
      const meta: string[] = [];
      if (t.tag) meta.push(`tag: ${t.tag}`);
      if (t.sectorName) meta.push(`sector: ${t.sectorName}`);
      if (t.date) meta.push(`date: ${t.date}`);
      if (t.blockStatus) meta.push(`status: ${t.blockStatus}`);
      if (t.focused) meta.push("focused");
      if (t.potentialValue) meta.push(`PV: ${t.potentialValue}`);
      const metaLine = meta.length > 0 ? `  · ${meta.join(" · ")}` : "";
      const lines: string[] = [`- [${check}] **#${id}** — ${titleOf(t)}${metaLine}`];
      if (t.subtitle?.trim()) lines.push(`  - subtitle: ${t.subtitle.trim()}`);
      if (t.url?.trim()) lines.push(`  - url: ${t.url.trim()}`);
      if (t.note?.trim()) {
        const noteOneLine = t.note.trim().replace(/\s+/g, " ");
        lines.push(`  - note: ${noteOneLine}`);
      }
      return lines.join("\n");
    })
    .join("\n");
}

function renderRelationships(
  edges: VisualFlowEdge[] | undefined,
  byId: Map<string, ShelfPillarTodoItem>
): string {
  const list = edges ?? [];
  if (list.length === 0) return "_(none)_\n";
  return list
    .map((e) => {
      const src = byId.get(e.source);
      const dst = byId.get(e.target);
      const arrow = describeEdge(e);
      const srcLabel = src ? `#${shortId(src.id)} (${titleOf(src)})` : `#${shortId(e.source)} (unknown)`;
      const dstLabel = dst ? `#${shortId(dst.id)} (${titleOf(dst)})` : `#${shortId(e.target)} (unknown)`;
      const flags: string[] = [];
      if (e.muted) flags.push("weak");
      const tag = flags.length > 0 ? `  *[${flags.join(", ")}]*` : "";
      return `- ${srcLabel} ${arrow} ${dstLabel}${tag}`;
    })
    .join("\n");
}

function indexById(items: ShelfPillarTodoItem[]): Map<string, ShelfPillarTodoItem> {
  const m = new Map<string, ShelfPillarTodoItem>();
  for (const t of items) m.set(t.id, t);
  return m;
}

export function exportFlowAsMarkdown(input: FlowExportInput): string {
  const { plane, items, edges, sectorColors } = input;
  const isBuiltIn = plane === "main" || plane === "grazeland" || plane === "bin";
  const builtInMeta = isBuiltIn ? BUILT_IN_PLANE_META[plane] : null;
  const planeDisplay = builtInMeta?.display ?? input.planeName?.trim() ?? "Custom plane";
  const planeDescription =
    builtInMeta?.description ?? `user-created plane "${planeDisplay}".`;

  const byId = indexById(items);
  const totalTasks = items.length;
  const totalEdges = edges?.length ?? 0;

  // Only sectors that actually appear in this plane's items.
  const namesInPlane = new Set<string>();
  for (const t of items) {
    const s = t.sectorName?.trim();
    if (s) namesInPlane.add(s);
  }
  const sectorEntries = Object.entries(sectorColors ?? {}).filter(([name]) =>
    namesInPlane.has(name)
  );

  const header =
    `# ShELF — ${planeDisplay} Plane — Export for AI Consolidation\n\n` +
    `This is a structured snapshot of the **${planeDisplay}** plane, exported from ShELF (a personal task/bookmark tool). I'd like you to **consolidate this**: find duplicates, suggest merges, group by theme, surface stale items, and propose a cleaner structure. Each task has a stable short ID (e.g. \`#abc12345\`) — use those when you reference items.\n\n` +
    `**Snapshot:** ${totalTasks} task${totalTasks === 1 ? "" : "s"}, ${totalEdges} relationship${totalEdges === 1 ? "" : "s"} on this plane.\n\n` +
    `**About this plane:** ${planeDescription}\n\n` +
    `**Arrow notation in the relationship list:**\n` +
    `- \`A → B\` — directed link (A leads to / depends on / produces B)\n` +
    `- \`A ↔ B\` — bidirectional / mutual\n` +
    `- \`A ⤳ B\` — weak / muted link (less load-bearing)\n` +
    `- \`A — B\` — undirected\n`;

  const sectorBlock =
    sectorEntries.length > 0
      ? `\n## Sectors / Epics on this plane\n\n` +
        sectorEntries.map(([name, color]) => `- **${name}** (color: ${color})`).join("\n") +
        `\n`
      : "";

  const taskSection =
    `\n---\n\n## ${planeDisplay} — Tasks\n\n${renderTasks(items)}\n\n### Relationships\n\n${renderRelationships(edges, byId)}\n`;

  const goalsSection = renderGoals(input.vfGoals ?? []);

  return header + sectorBlock + taskSection + goalsSection;
}
