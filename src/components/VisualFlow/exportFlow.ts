import type { SaleItem, ShelfPillarTodoItem, VisualFlowData, VisualFlowEdge } from "../../types/grid";

/**
 * Render the Visual Flow as a single markdown document optimised for pasting
 * into an LLM ("consolidate these todos for me", "find duplicates", etc.).
 *
 * The format is human-readable on purpose: a short intro paragraph that orients
 * the model, then per-plane sections with task lists + an explicit relationships
 * block using arrow notation. Stable short IDs let the model reference tasks
 * unambiguously.
 */

export interface FlowExportInput {
  pillarTodos: ShelfPillarTodoItem[];
  grazelandItems: ShelfPillarTodoItem[];
  binItems: ShelfPillarTodoItem[];
  saleItems: SaleItem[];
  visualFlow: VisualFlowData;
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

function renderSaleItems(items: SaleItem[]): string {
  if (items.length === 0) return "_(none)_\n";
  return items
    .map((s) => {
      const status = s.status === "sold" ? "✓ sold" : s.status === "reserved" ? "⏳ reserved" : "🟢 listed";
      const price = `${s.price.toLocaleString("cs-CZ")} ${s.unit}`;
      const meta: string[] = [`status: ${status}`, `price: ${price}`];
      if (s.where) meta.push(`where: ${s.where}`);
      if (s.soldAt) meta.push(`sold: ${s.soldAt.slice(0, 10)}`);
      return `- **${s.name}** — ${meta.join(" · ")}`;
    })
    .join("\n");
}

export function exportFlowAsMarkdown(input: FlowExportInput): string {
  const { pillarTodos, grazelandItems, binItems, saleItems, visualFlow } = input;
  const pillarIx = indexById(pillarTodos);
  const grazeIx = indexById(grazelandItems);
  const binIx = indexById(binItems);

  const totalTasks = pillarTodos.length + grazelandItems.length + binItems.length;
  const totalEdges =
    (visualFlow.edges?.length ?? 0) +
    (visualFlow.grazelandEdges?.length ?? 0) +
    (visualFlow.binEdges?.length ?? 0);
  const liveSales = saleItems.filter((s) => s.status !== "sold").length;
  const soldSales = saleItems.length - liveSales;

  const sectorEntries = Object.entries(visualFlow.sectorColors ?? {});

  const header =
    `# ShELF Todo Network — Export for AI Consolidation\n\n` +
    `This is a structured snapshot of my todos and their relationships, exported from ShELF (a personal task/bookmark tool). I'd like you to **consolidate this**: find duplicates, suggest merges, group by theme, surface stale items, and propose a cleaner structure. Each task has a stable short ID (e.g. \`#abc12345\`) — use those when you reference items.\n\n` +
    `**Snapshot:** ${totalTasks} task${totalTasks === 1 ? "" : "s"} across 3 planes, ${totalEdges} relationship${totalEdges === 1 ? "" : "s"}` +
    (saleItems.length > 0 ? `, ${liveSales} active listing${liveSales === 1 ? "" : "s"} + ${soldSales} sold` : "") + `.\n\n` +
    `**Arrow notation in the relationship lists:**\n` +
    `- \`A → B\` — directed link (A leads to / depends on / produces B)\n` +
    `- \`A ↔ B\` — bidirectional / mutual\n` +
    `- \`A ⤳ B\` — weak / muted link (less load-bearing)\n` +
    `- \`A — B\` — undirected\n\n` +
    `**Planes:**\n` +
    `- **Pillar** — active todos shown in the sidebar; this is the working list.\n` +
    `- **Grazeland** — parking lot for ideas not yet committed to.\n` +
    `- **Bin** — archived / discarded items, kept for reference.\n`;

  const sectorBlock =
    sectorEntries.length > 0
      ? `\n## Sectors / Epics\n\n` +
        sectorEntries.map(([name, color]) => `- **${name}** (color: ${color})`).join("\n") +
        `\n`
      : "";

  const sections = [
    `\n---\n\n## Pillar — Active Tasks\n\n### Tasks\n\n${renderTasks(pillarTodos)}\n\n### Relationships\n\n${renderRelationships(visualFlow.edges, pillarIx)}\n`,
    `\n---\n\n## Grazeland — Parking Lot\n\n### Tasks\n\n${renderTasks(grazelandItems)}\n\n### Relationships\n\n${renderRelationships(visualFlow.grazelandEdges, grazeIx)}\n`,
    `\n---\n\n## Bin — Archive\n\n### Tasks\n\n${renderTasks(binItems)}\n\n### Relationships\n\n${renderRelationships(visualFlow.binEdges, binIx)}\n`,
  ].join("");

  const sellingSection = saleItems.length > 0
    ? `\n---\n\n## Selling Inventory\n\n${renderSaleItems(saleItems)}\n`
    : "";

  return header + sectorBlock + sections + sellingSection;
}
