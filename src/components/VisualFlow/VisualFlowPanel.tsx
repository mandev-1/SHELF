import React, { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  Handle,
  NodeResizeControl,
  ConnectionMode,
  Position,
  BaseEdge,
  getBezierPath,
  SelectionMode,
  Background,
  BackgroundVariant,
  ViewportPortal,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  type EdgeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./doing-now.css";
import { DoingNow, useDoingPipeline, type DoingTask, type DoingPipelineState } from "./DoingNow";
import "./blockers.css";
import { BlockerNode, BlockerDraft, nfBlockerStatus, nfToDatetimeLocal, nfClock, type BlockerDraftState } from "./Blockers";
import "./doing-task-editor.css";
import { DoingTaskEditor } from "./DoingTaskEditor";
import "./connection-picker.css";
import { ConnectionPicker } from "./ConnectionPicker";
import { Input } from "@heroui/react";
import {
  SECTOR_COLOR_OPTIONS,
  SECTOR_HEX,
  createGrazelandHandleVisibility,
  type SectorColorKey,
  type ShelfGrazelandHandleSlot,
  type ShelfGrazelandHandleVisibility,
  type ShelfPillarTodoItem,
  type ShelfTodoBlockStatus,
  type ShelfTodoHandleConfig,
  type Blocker,
  type VisualFlowData,
  type VisualFlowEdge,
  type VisualFlowNodeSize,
  type VfGoal,
  resolveVisualFlowSectorColor,
} from "../../types/grid";
import { NoteContent, linkifyText } from "../NoteContent";
import { applyTodoUpdate, stampNewTodo } from "../../utils/todoAudit";
import { continueNoteListOnEnter } from "../../utils/noteLists";
import { exportFlowAsMarkdown } from "./exportFlow";
import { writePlane, getPlaneSizes, type PlaneId } from "./visualFlowWriter";

const NODE_INITIAL_WIDTH = 260;
const NODE_RESIZE_MIN_WIDTH = 5;
const NODE_MAX_WIDTH = 360;
const NODE_MIN_HEIGHT = 64;
const SPACING = 24;

const TAG_PALETTES: { bg: string; palette: string }[] = [
  { bg: "bg-violet-700/18", palette: "visual-flow-tag--violet" },
  { bg: "bg-fuchsia-700/18", palette: "visual-flow-tag--fuchsia" },
  { bg: "bg-purple-700/18", palette: "visual-flow-tag--purple" },
  { bg: "bg-indigo-700/18", palette: "visual-flow-tag--indigo" },
  { bg: "bg-slate-800/25", palette: "visual-flow-tag--navy" },
  { bg: "bg-blue-600/22", palette: "visual-flow-tag--royal-blue" },
  { bg: "bg-emerald-700/22", palette: "visual-flow-tag--royal-green" },
];

function tagColorClasses(tag: string) {
  const hash = tag.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const { bg, palette } = TAG_PALETTES[hash % TAG_PALETTES.length];
  return `visual-flow-tag ${bg} ${palette}`;
}

type TodoFlowNodeData = {
  text: string;
  note?: string;
  tag?: string;
  subtitle?: string;
  blockStatus?: ShelfTodoBlockStatus;
  date?: string;
  showTodoDates?: boolean;
  handleConfig?: ShelfTodoHandleConfig;
  grazelandHandleVisibility?: ShelfGrazelandHandleVisibility;
  sectorName?: string;
  sectorColor?: SectorColorKey;
  onNoteChange?: (newNote: string) => void;
  /** True while “mark completed” exit animation runs */
  completing?: boolean;
  /** Grazeland plane — subtle distinct styling */
  grazelandPlane?: boolean;
  onResizeEnd?: (newSize: VisualFlowNodeSize) => void;
};

function rgbFromSectorHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function subscribeShelfTheme(onStoreChange: () => void) {
  const el = document.documentElement;
  const mo = new MutationObserver(onStoreChange);
  mo.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

function getShelfThemeSnapshot() {
  return document.documentElement.getAttribute("data-theme") ?? "night";
}

/** Reads `data-theme` so flow nodes update when switching day / SAP / night. */
function useShelfDocumentTheme() {
  return useSyncExternalStore(subscribeShelfTheme, getShelfThemeSnapshot, () => "night");
}

/**
 * Sector styling: night = dark card + rim + wash; day = warm paper + strong sector-colored border & wash;
 * SAP = very low-key background tint + subtle SAP-blue rim (sector reads as fill).
 */
/** Sector colors that render as a solid dark/colored fill and need light text. */
const DARK_FILL_SECTORS = new Set<SectorColorKey>(["king-blue"]);

/**
 * Build the sector "chrome" for a node. Returns BOTH the direct CSS properties
 * (used as-is on the dark theme) AND matching `--sec-*` custom properties — on
 * day / sap themes the base `.shelf-top6-card` rule forces a paper background
 * with `!important`, so a companion `.shelf-flow-node--tinted` rule re-applies
 * the tint from these vars. Text inversion for dark fills is driven by
 * `.shelf-flow-node--darkfill` reading `--sec-text`.
 */
function sectorNodeChromeStyleForTheme(colorKey: SectorColorKey, theme: string): React.CSSProperties {
  const hex = SECTOR_HEX[colorKey];
  const [r, g, b] = rgbFromSectorHex(hex);
  const avg = (r + g + b) / 3;

  const build = (
    border: string,
    backgroundColor: string,
    backgroundImage: string | undefined,
    boxShadow: string,
    text?: string
  ): React.CSSProperties => {
    const style: Record<string, string> = {
      border,
      backgroundColor,
      boxShadow,
      "--sec-bg": backgroundColor,
      "--sec-bg-img": backgroundImage ?? "none",
      "--sec-border": border,
      "--sec-shadow": boxShadow,
    };
    if (backgroundImage) style.backgroundImage = backgroundImage;
    if (text) style["--sec-text"] = text;
    return style as React.CSSProperties;
  };

  // King blue — blueprint look: solid blue fill + white text, identical on every
  // theme so it always reads as a deliberate "blueprint" card.
  if (colorKey === "king-blue") {
    return build(
      "1.5px solid rgba(120, 160, 255, 0.9)",
      "#1d4ed8",
      `linear-gradient(165deg, rgba(96,140,255,0.55) 0%, rgba(29,78,216,0.96) 45%, #163fb0 100%)`,
      "inset 0 1px 0 rgba(255,255,255,0.2), 0 3px 16px rgba(23,58,160,0.5)",
      "#f4f7ff"
    );
  }

  if (theme === "day") {
    const br = Math.round(r * 0.38 + 118 * 0.62);
    const bgMix = Math.round(g * 0.38 + 112 * 0.62);
    const bb = Math.round(b * 0.38 + 106 * 0.62);
    const borderA = avg > 210 ? 0.58 : avg > 135 ? 0.52 : 0.48;
    return build(
      `2px solid rgba(${br},${bgMix},${bb}, ${borderA})`,
      "rgba(255, 252, 247, 0.97)",
      `linear-gradient(168deg, rgba(${r},${g},${b}, 0.38) 0%, rgba(${r},${g},${b}, 0.16) 42%, rgba(255, 252, 247, 0.72) 100%)`,
      "inset 0 1px 0 rgba(255, 255, 255, 0.85), 0 1px 2px rgba(28, 25, 23, 0.07)"
    );
  }

  if (theme === "sap") {
    // Jet black sector: match token #1f2a2a — dark card, SAP-blue rim.
    if (colorKey === "jet-black") {
      const deep = `rgb(${Math.max(8, r - 14)}, ${Math.max(10, g - 10)}, ${Math.max(10, b - 10)})`;
      return build(
        "1px solid rgba(0, 112, 242, 0.5)",
        deep,
        `linear-gradient(165deg, rgba(${Math.min(255, r + 28)}, ${Math.min(255, g + 32)}, ${Math.min(255, b + 34)}, 0.2) 0%, rgba(${r}, ${g}, ${b}, 0.88) 42%, ${deep} 100%)`,
        "inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 2px 10px rgba(0, 0, 0, 0.4)",
        "#f4f4f5"
      );
    }
    // Light SAP canvas: paper base + a clearly visible tint wash AND a tint-colored
    // rim (previously every tint shared the same SAP-blue border → no distinction).
    const topA = avg > 200 ? 0.34 : avg > 115 ? 0.3 : avg > 55 ? 0.26 : 0.22;
    const midA = topA * 0.5;
    const rb = Math.round(r * 0.62);
    const rg = Math.round(g * 0.62);
    const rbb = Math.round(b * 0.62);
    return build(
      `1.5px solid rgba(${rb},${rg},${rbb}, 0.6)`,
      "rgb(244, 247, 252)",
      `linear-gradient(165deg, rgba(${r},${g},${b}, ${topA}) 0%, rgba(${r},${g},${b}, ${midA}) 42%, rgba(236, 242, 249, 0.97) 70%, rgb(244, 247, 252) 100%)`,
      `inset 0 1px 0 rgba(255, 255, 255, 0.75), 0 0 0 1px rgba(${r},${g},${b},0.18)`
    );
  }

  // Dark / default theme. Tint shows as a clear colored rim + soft outer glow,
  // over a dark backdrop so the light node text stays readable. The vivid
  // neon/acid blues get a stronger ring so they read as "modern" accents.
  const vivid = colorKey === "neon-blue" || colorKey === "acid-blue";
  const lineA = vivid ? 0.85 : colorKey === "alice-blue" || colorKey === "bone" ? 0.6 : 0.55;
  const glowA = vivid ? 0.55 : 0.32;
  const ringA = vivid ? 0.3 : 0.16;
  return build(
    `1.5px solid rgba(${r},${g},${b},${lineA})`,
    "rgba(0, 0, 0, 0.42)",
    `linear-gradient(165deg, rgba(${r},${g},${b}, ${vivid ? 0.2 : 0.15}) 0%, rgba(${r},${g},${b}, 0.05) 55%, transparent 100%)`,
    `inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 0 0 1px rgba(${r},${g},${b},${ringA}), 0 0 20px -4px rgba(${r},${g},${b},${glowA})`
  );
}

export type VisualFlowPlane = "main" | "grazeland" | "bin" | (string & {});

type SpecialVisualFlowPlane = "grazeland" | "bin";

const SPECIAL_VISUAL_FLOW_PLANES: SpecialVisualFlowPlane[] = ["grazeland", "bin"];

// Short, locale-aware timestamp for the audit (created / updated) display.
function formatAuditTs(ts: number): string {
  try {
    const d = new Date(ts);
    return (
      d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
      " " +
      d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    );
  } catch {
    return "";
  }
}

// Theme-adaptive palette for custom sheet tabs. Values are CSS hue tokens so the
// tab color tracks the active theme; `null` clears back to the default accent.
const CUSTOM_PLANE_COLORS: { key: string; value: string }[] = [
  { key: "blue", value: "var(--hue-blue)" },
  { key: "green", value: "var(--hue-green)" },
  { key: "purple", value: "var(--hue-purple)" },
  { key: "orange", value: "var(--hue-orange)" },
  { key: "rose", value: "var(--hue-rose)" },
  { key: "zinc", value: "var(--hue-zinc)" },
];

const SPECIAL_VISUAL_FLOW_PLANE_META: Record<SpecialVisualFlowPlane, {
  tabLabel: string;
  tabClass: string;
  canvasClass: string;
  emptyState: string;
}> = {
  grazeland: {
    tabLabel: "Grazeland plane",
    tabClass: "bg-amber-500/20 text-amber-100",
    canvasClass: "border-amber-200/20 bg-amber-950/10",
    emptyState: "Right-click on the canvas to add an item. Grazeland items stay on this plane only.",
  },
  bin: {
    tabLabel: "Bin plane",
    tabClass: "bg-sky-500/20 text-sky-100",
    canvasClass: "border-sky-200/20 bg-sky-950/10",
    emptyState: "Right-click on the canvas to add an item. Bin items stay on this plane only.",
  },
};

function getVisualFlowPlaneLogLabel(plane: VisualFlowPlane, customName?: string): string {
  if (plane === "grazeland") return "Visual Flow Grazeland";
  if (plane === "bin") return "Visual Flow Bin";
  if (plane !== "main" && customName) return `Visual Flow ${customName}`;
  return "Visual Flow";
}

function getVisualFlowPlaneCountLabel(plane: VisualFlowPlane, count: number): string {
  if (plane === "main") return count === 1 ? "task" : "tasks";
  return count === 1 ? "item" : "items";
}

/** Label + dot color for a plane, used by the "Doing now" drawer (handoff 010). */
function doingPlaneMeta(
  planeKey: string,
  customPlanes: { id: string; name: string; color?: string }[],
): { label: string; color: string } {
  if (planeKey === "main") return { label: "Main canvas", color: "var(--accent)" };
  if (planeKey === "grazeland") return { label: "Grazeland", color: "#f59e0b" };
  if (planeKey === "bin") return { label: "Bin", color: "#38bdf8" };
  const cp = customPlanes.find((c) => c.id === planeKey);
  return { label: cp?.name ?? planeKey, color: cp?.color || "var(--accent)" };
}

const VISUAL_FLOW_PLANE_LS_KEY = "shelf-visual-flow-plane";

const EDIT_CARD_EXIT_MS = 400;
/** Time for node exit animation before todo is removed from the map and list */
const COMPLETE_EXIT_MS = 720;

const BLOCK_STATUS_OPTIONS: { value: ShelfTodoBlockStatus; label: string }[] = [
  { value: "ready", label: "Ready" },
  { value: "blocked", label: "Blocked" },
  { value: "abeyed", label: "Abeyed" },
];

/** Handle layouts shown in the node menu dropdown (everything except hidden). */
const HANDLE_MENU_LAYOUT_OPTIONS: { value: Exclude<ShelfTodoHandleConfig, "hidden">; label: string }[] = [
  { value: "omni", label: "Omni" },
  { value: "horizontal", label: "Horizontal" },
  { value: "vertical", label: "Vertical" },
  { value: "top", label: "Top only" },
  { value: "bottom", label: "Bottom only" },
  { value: "left", label: "Left only" },
  { value: "right", label: "Right only" },
];

const GRAZELAND_HANDLE_DEFINITIONS: {
  key: ShelfGrazelandHandleSlot;
  label: string;
  handleId: string;
  type: "target" | "source";
  position: Position;
  className: string;
}[] = [
  { key: "top1", label: "Top 1", handleId: "target-top", type: "target", position: Position.Top, className: "!left-[30%] !top-2 -translate-x-1/2" },
  { key: "top2", label: "Top 2", handleId: "source-top", type: "source", position: Position.Top, className: "!left-[70%] !top-2 -translate-x-1/2" },
  { key: "right1", label: "Right 1", handleId: "target-right", type: "target", position: Position.Right, className: "!right-2 !top-[30%] -translate-y-1/2" },
  { key: "right2", label: "Right 2", handleId: "source-right", type: "source", position: Position.Right, className: "!right-2 !top-[70%] -translate-y-1/2" },
  { key: "bottom1", label: "Bottom 1", handleId: "target-bottom", type: "target", position: Position.Bottom, className: "!left-[30%] !bottom-2 -translate-x-1/2" },
  { key: "bottom2", label: "Bottom 2", handleId: "source-bottom", type: "source", position: Position.Bottom, className: "!left-[70%] !bottom-2 -translate-x-1/2" },
  { key: "left1", label: "Left 1", handleId: "target-left", type: "target", position: Position.Left, className: "!left-2 !top-[30%] -translate-y-1/2" },
  { key: "left2", label: "Left 2", handleId: "source-left", type: "source", position: Position.Left, className: "!left-2 !top-[70%] -translate-y-1/2" },
];

function NodeEditCard({
  todo,
  showTodoDates = false,
  editLabel = "Edit task",
  titlePlaceholder = "Task title",
  showBinInfoFields = false,
  existingSectorNames = [],
  sectorColorMap,
  onSave,
  onClose,
  onClosingStart,
}: {
  todo: ShelfPillarTodoItem;
  showTodoDates?: boolean;
  editLabel?: string;
  titlePlaceholder?: string;
  showBinInfoFields?: boolean;
  /** Distinct sector names already used on Visual Flow (for combobox hints). */
  existingSectorNames?: string[];
  sectorColorMap?: Record<string, SectorColorKey>;
  onSave: (updates: Partial<ShelfPillarTodoItem>) => void;
  onClose: () => void;
  onClosingStart?: () => void;
}) {
  const [text, setText] = useState(todo.text);
  const [note, setNote] = useState(todo.note ?? "");
  const [potentialValue, setPotentialValue] = useState(todo.potentialValue ?? "");
  const [tag, setTag] = useState(todo.tag ?? "");
  const [subtitle, setSubtitle] = useState(todo.subtitle ?? "");
  const [blockStatus, setBlockStatus] = useState<ShelfTodoBlockStatus | "">(todo.blockStatus ?? "");
  const [date, setDate] = useState(todo.date ?? "");
  const [sectorName, setSectorName] = useState(todo.sectorName ?? "");
  const [sectorColor, setSectorColor] = useState<SectorColorKey | "">(
    () => resolveVisualFlowSectorColor(todo, sectorColorMap) ?? ""
  );
  const [isClosing, setIsClosing] = useState(false);
  const [escapePrompted, setEscapePrompted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const sectorInputId = useId();
  const sectorDatalistId = useId();

  const requestClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    onClosingStart?.();
    window.setTimeout(() => onClose(), EDIT_CARD_EXIT_MS);
  }, [isClosing, onClose, onClosingStart]);

  const save = useCallback(() => {
    onSave({
      text,
      note: note || undefined,
      potentialValue: potentialValue || undefined,
      tag: tag || undefined,
      subtitle: subtitle || undefined,
      blockStatus: blockStatus || undefined,
      date: date.trim() || undefined,
      sectorName: sectorName.trim() || undefined,
      sectorColor: sectorColor === "" ? undefined : sectorColor,
    });
    requestClose();
  }, [text, note, potentialValue, tag, subtitle, blockStatus, date, sectorName, sectorColor, onSave, requestClose]);

  const handleNoteKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    continueNoteListOnEnter(e, setNote);
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      const target = e.target;
      if (ref.current && target instanceof HTMLElement && !ref.current.contains(target))
        requestClose();
    };
    const id = setTimeout(() => document.addEventListener("click", close), 100);
    return () => {
      clearTimeout(id);
      document.removeEventListener("click", close);
    };
  }, [requestClose]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        save();
        return;
      }
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (escapePrompted) {
        requestClose();
      } else {
        setEscapePrompted(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [escapePrompted, requestClose, save]);

  useEffect(() => {
    if (!escapePrompted) return;
    const reset = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key === "Escape") return;
      setEscapePrompted(false);
    };
    document.addEventListener("click", reset);
    document.addEventListener("keydown", reset);
    return () => {
      document.removeEventListener("click", reset);
      document.removeEventListener("keydown", reset);
    };
  }, [escapePrompted]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shelf-flow-edit-dialog-title"
      className={`shelf-flow-edit-card shelf-note-popover w-full max-w-lg rounded-xl border border-emerald-400/20 bg-zinc-900 p-4 shadow-2xl ${isClosing ? "shelf-flow-edit-card--exit" : ""}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span id="shelf-flow-edit-dialog-title" className="text-[10px] font-medium text-zinc-500">
          {editLabel}
        </span>
        {escapePrompted && (
          <span className="text-[10px] text-amber-400/90">Press Esc again to close</span>
        )}
      </div>
      <div className="max-h-[min(60vh,480px)] overflow-y-auto space-y-2">
        <Input
          variant="secondary"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={titlePlaceholder}
          className="text-xs"
          autoFocus
        />
        <Input
          variant="secondary"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="Subtitle (optional)"
          className="text-xs"
        />
        <Input
          variant="secondary"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="Tag (optional)"
          className="text-xs"
        />
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-zinc-500">
            {showBinInfoFields ? "WHY" : "Note (optional)"}
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={handleNoteKeyDown}
            placeholder={showBinInfoFields ? "Why does this belong in the bin?" : "Note (optional)"}
            className="shelf-note-popover-textarea min-h-[7.5rem] max-h-64 w-full resize-y rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none"
            rows={5}
          />
        </div>
        {showBinInfoFields && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-zinc-500">POTENTIAL VALUE (PV)</label>
            <textarea
              value={potentialValue}
              onChange={(e) => setPotentialValue(e.target.value)}
              placeholder="Potential upside or value"
              className="shelf-note-popover-textarea min-h-[60px] max-h-64 w-full resize-y rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none"
              rows={2}
            />
          </div>
        )}
        {showTodoDates && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-zinc-500">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-200 focus:outline-none font-mono"
            />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor={sectorInputId} className="text-[10px] font-medium text-zinc-500">
            Sector name (optional)
          </label>
          <input
            id={sectorInputId}
            type="text"
            list={sectorDatalistId}
            value={sectorName}
            onChange={(e) => setSectorName(e.target.value)}
            placeholder="Type or choose a suggestion"
            autoComplete="off"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-400/35"
          />
          <datalist id={sectorDatalistId}>
            {existingSectorNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <p className="text-[9px] leading-snug text-zinc-600">
            Names already in use on Visual Flow show as you type; type anything else to use a new sector name.
          </p>
          <select
            value={sectorColor}
            onChange={(e) => setSectorColor((e.target.value || "") as SectorColorKey | "")}
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-200 focus:outline-none"
            aria-label="Border or glow color"
          >
            <option value="">Default (no sector tint)</option>
            {SECTOR_COLOR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-[9px] leading-snug text-zinc-600">
            On the main canvas, this follows the sector frame. On Grazeland, this works as a per-node border / glow color.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-zinc-500">Status</label>
          <select
            value={blockStatus}
            onChange={(e) => setBlockStatus((e.target.value || "") as ShelfTodoBlockStatus | "")}
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-200 focus:outline-none"
          >
            <option value="">—</option>
            {BLOCK_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-2 flex shrink-0 gap-2">
        <button
          type="button"
          onClick={save}
          className="rounded-lg bg-emerald-500/25 px-2 py-1.5 text-xs font-medium text-emerald-100"
        >
          Save
        </button>
        <button
          type="button"
          onClick={requestClose}
          className="rounded-lg px-2 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function nodeStatusClass(blockStatus?: ShelfTodoBlockStatus): string {
  if (blockStatus === "abeyed") return "shelf-flow-node--abeyed";
  if (blockStatus === "blocked") return "shelf-flow-node--blocked";
  return "shelf-flow-node--ready";
}

const HANDLE_CLASS_BASE =
  "shelf-flow-handle !z-10 !h-2.5 !w-2.5 !rounded-full !border-2 !border-emerald-400/60 !bg-emerald-500/80";

/** Size/position only — use with inline fill/border for day + sector (Tailwind `!` colors block overrides). */
const HANDLE_CLASS_NEUTRAL = "shelf-flow-handle !z-10 !h-2.5 !w-2.5 !rounded-full !border-2";

/** Connection dots match sector rim on day theme (global day rules retint emerald handles otherwise). */
function sectorHandleStyleDay(colorKey: SectorColorKey): React.CSSProperties {
  const [r, g, b] = rgbFromSectorHex(SECTOR_HEX[colorKey]);
  const avg = (r + g + b) / 3;
  const hr = avg > 210 ? Math.round(r * 0.5 + 95 * 0.5) : Math.round(r * 0.92 + 18);
  const hg = avg > 210 ? Math.round(g * 0.5 + 90 * 0.5) : Math.round(g * 0.92 + 18);
  const hb = avg > 210 ? Math.round(b * 0.5 + 85 * 0.5) : Math.round(b * 0.92 + 16);
  return {
    borderColor: `rgba(${hr}, ${hg}, ${hb}, 0.95)`,
    backgroundColor: `rgba(${hr}, ${hg}, ${hb}, 0.92)`,
    boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.35)",
  };
}

function FlowHandles({
  config,
  grazelandHandleVisibility,
  daySectorHandleStyle,
}: {
  config: ShelfTodoHandleConfig;
  grazelandHandleVisibility?: ShelfGrazelandHandleVisibility;
  /** When set (day + sector), fills/border come from sector — not default emerald. */
  daySectorHandleStyle?: React.CSSProperties;
}) {
  const handleClass = daySectorHandleStyle ? HANDLE_CLASS_NEUTRAL : HANDLE_CLASS_BASE;
  const handleStyle = daySectorHandleStyle;
  if (grazelandHandleVisibility) {
    return (
      <>
        {GRAZELAND_HANDLE_DEFINITIONS.map((definition) =>
          grazelandHandleVisibility[definition.key] ? (
            <Handle
              key={definition.key}
              style={handleStyle}
              type={definition.type}
              id={definition.handleId}
              position={definition.position}
              className={`${handleClass} ${definition.className}`}
            />
          ) : null
        )}
      </>
    );
  }
  if (config === "hidden") return null;
  if (config === "horizontal") {
    return (
      <>
        <Handle
          style={handleStyle}
          type="target"
          id="target-left"
          position={Position.Left}
          className={`${handleClass} !left-2 !top-1/2 -translate-y-1/2`}
        />
        <Handle
          style={handleStyle}
          type="source"
          id="source-right"
          position={Position.Right}
          className={`${handleClass} !right-2 !top-1/2 -translate-y-1/2`}
        />
      </>
    );
  }
  if (config === "omni") {
    return (
      <>
        <Handle
          style={handleStyle}
          type="target"
          id="target-top"
          position={Position.Top}
          className={`${handleClass} !left-[30%] !top-2 -translate-x-1/2`}
        />
        <Handle
          style={handleStyle}
          type="source"
          id="source-top"
          position={Position.Top}
          className={`${handleClass} !left-[70%] !top-2 -translate-x-1/2`}
        />
        <Handle
          style={handleStyle}
          type="target"
          id="target-bottom"
          position={Position.Bottom}
          className={`${handleClass} !left-[30%] !bottom-2 -translate-x-1/2`}
        />
        <Handle
          style={handleStyle}
          type="source"
          id="source-bottom"
          position={Position.Bottom}
          className={`${handleClass} !left-[70%] !bottom-2 -translate-x-1/2`}
        />
        <Handle
          style={handleStyle}
          type="target"
          id="target-left"
          position={Position.Left}
          className={`${handleClass} !left-2 !top-[30%] -translate-y-1/2`}
        />
        <Handle
          style={handleStyle}
          type="source"
          id="source-left"
          position={Position.Left}
          className={`${handleClass} !left-2 !top-[70%] -translate-y-1/2`}
        />
        <Handle
          style={handleStyle}
          type="target"
          id="target-right"
          position={Position.Right}
          className={`${handleClass} !right-2 !top-[30%] -translate-y-1/2`}
        />
        <Handle
          style={handleStyle}
          type="source"
          id="source-right"
          position={Position.Right}
          className={`${handleClass} !right-2 !top-[70%] -translate-y-1/2`}
        />
      </>
    );
  }
  if (config === "vertical") {
    return (
      <>
        <Handle
          style={handleStyle}
          type="target"
          id="target-top"
          position={Position.Top}
          className={`${handleClass} !left-1/2 !top-2 -translate-x-1/2`}
        />
        <Handle
          style={handleStyle}
          type="source"
          id="source-bottom"
          position={Position.Bottom}
          className={`${handleClass} !left-1/2 !bottom-2 -translate-x-1/2`}
        />
      </>
    );
  }
  if (config === "top") {
    return (
      <Handle
        style={handleStyle}
        type="target"
        id="target-top"
        position={Position.Top}
        className={`${handleClass} !left-1/2 !top-2 -translate-x-1/2`}
      />
    );
  }
  if (config === "bottom") {
    return (
      <>
        <Handle
          style={handleStyle}
          type="target"
          id="target-bottom"
          position={Position.Bottom}
          className={`${handleClass} !left-[30%] !bottom-2 -translate-x-1/2`}
        />
        <Handle
          style={handleStyle}
          type="source"
          id="source-bottom"
          position={Position.Bottom}
          className={`${handleClass} !left-[70%] !bottom-2 -translate-x-1/2`}
        />
      </>
    );
  }
  if (config === "left") {
    return (
      <>
        <Handle
          style={handleStyle}
          type="target"
          id="target-left"
          position={Position.Left}
          className={`${handleClass} !left-2 !top-1/3 -translate-y-1/2`}
        />
        <Handle
          style={handleStyle}
          type="source"
          id="source-left"
          position={Position.Left}
          className={`${handleClass} !left-2 !top-2/3 -translate-y-1/2`}
        />
      </>
    );
  }
  if (config === "right") {
    return (
      <>
        <Handle
          style={handleStyle}
          type="target"
          id="target-right"
          position={Position.Right}
          className={`${handleClass} !right-2 !top-1/3 -translate-y-1/2`}
        />
        <Handle
          style={handleStyle}
          type="source"
          id="source-right"
          position={Position.Right}
          className={`${handleClass} !right-2 !top-2/3 -translate-y-1/2`}
        />
      </>
    );
  }
  return null;
}

function TodoFlowNode(props: NodeProps) {
  const {
    text,
    note,
    tag,
    subtitle,
    blockStatus,
    date,
    showTodoDates,
    handleConfig,
    grazelandHandleVisibility,
    grazelandPlane,
    sectorName,
    sectorColor,
    onResizeEnd,
  } = (props.data ?? {}) as TodoFlowNodeData;
  const uiTheme = useShelfDocumentTheme();
  const statusClass = nodeStatusClass(blockStatus);
  const config = handleConfig ?? (grazelandPlane ? "omni" : "horizontal");
  const resolvedGrazelandHandleVisibility = grazelandPlane
    ? grazelandHandleVisibility ?? createGrazelandHandleVisibility()
    : undefined;
  const isSelected = props.selected === true;
  const showDate = showTodoDates && date && blockStatus !== "blocked";
  const sectorStyle = sectorColor ? sectorNodeChromeStyleForTheme(sectorColor, uiTheme) : undefined;
  const baseBgClass = sectorColor ? "" : "bg-black/35";
  const sapJetBlackSector = uiTheme === "sap" && sectorColor === "jet-black";
  const tintedSector = !!sectorColor;
  const darkFillSector = !!sectorColor && DARK_FILL_SECTORS.has(sectorColor);
  const daySectorHandleStyle =
    uiTheme === "day" && sectorColor ? sectorHandleStyleDay(sectorColor) : undefined;
  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className={`shelf-flow-node shelf-top6-card group flex h-full w-full min-h-[4rem] flex-col gap-1.5 ${baseBgClass} px-1 py-2.5 shadow-sm ${statusClass} ${isSelected ? "shelf-flow-node--selected" : ""} ${grazelandPlane ? "shelf-flow-node--grazeland ring-1 ring-amber-200/25" : ""} ${sapJetBlackSector ? "shelf-flow-node--sector-jet-black-sap" : ""} ${tintedSector ? "shelf-flow-node--tinted" : ""} ${darkFillSector ? "shelf-flow-node--darkfill" : ""}`}
      style={sectorStyle}
    >
      {grazelandPlane && onResizeEnd && (
        <NodeResizeControl
          position="bottom-right"
          minWidth={NODE_RESIZE_MIN_WIDTH}
          minHeight={NODE_MIN_HEIGHT}
          className="nodrag nopan z-20 h-3 w-3 cursor-se-resize rounded-sm border border-amber-200/80 bg-amber-300/90 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
          onResizeEnd={(_, params) => {
            onResizeEnd({
              width: Math.max(NODE_RESIZE_MIN_WIDTH, Math.round(params.width)),
              height: Math.max(NODE_MIN_HEIGHT, Math.round(params.height)),
            });
          }}
        />
      )}
      <FlowHandles
        config={config}
        grazelandHandleVisibility={resolvedGrazelandHandleVisibility}
        daySectorHandleStyle={daySectorHandleStyle}
      />
      <div className="min-w-0 flex-1 overflow-visible px-2 pr-3 pl-3">
        {sectorName && (
          <div className="mb-0.5 text-[9px] font-medium uppercase tracking-wide text-zinc-500/90 truncate" title={sectorName}>
            {sectorName}
          </div>
        )}
        <div className="font-semibold leading-snug text-white group-hover:text-emerald-100 break-words whitespace-pre-wrap">
          {(subtitle ? `${text} · ${subtitle}` : text).split("\n").map((line, i) => (
            <React.Fragment key={i}>
              {i > 0 ? <br /> : null}
              {linkifyText(line)}
            </React.Fragment>
          ))}
        </div>
        {note && (
          <div className="shelf-flow-node-note mt-0.5 text-[11px] leading-relaxed">
            <NoteContent content={note} onNoteChange={(props.data as TodoFlowNodeData).onNoteChange} linkify />
          </div>
        )}
        {tag && (
          <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-medium ${tagColorClasses(tag)}`}>
            {tag}
          </span>
        )}
        {showDate && (
          <div className="shelf-flow-node-date mt-1.5">
            {date}
          </div>
        )}
      </div>
    </div>
  );
}

const nodeTypes = { todoFlow: TodoFlowNode } as const;

function computeNodeWidth(todo: ShelfPillarTodoItem): number {
  const title = todo.subtitle ? `${todo.text} · ${todo.subtitle}` : todo.text;
  const longestTitleLine = Math.max(
    1,
    ...title.split("\n").map((l) => l.length)
  );
  /* Fit title + subtitle; note wraps within node width */
  return Math.max(
    NODE_INITIAL_WIDTH,
    Math.min(NODE_MAX_WIDTH, longestTitleLine * 9 + 100)
  );
}

function normalizeNodeSize(size?: VisualFlowNodeSize): VisualFlowNodeSize | undefined {
  if (!size) return undefined;
  const next: VisualFlowNodeSize = {};
  if (typeof size.width === "number" && Number.isFinite(size.width)) {
    next.width = Math.max(NODE_RESIZE_MIN_WIDTH, Math.round(size.width));
  }
  if (typeof size.height === "number" && Number.isFinite(size.height)) {
    next.height = Math.max(NODE_MIN_HEIGHT, Math.round(size.height));
  }
  return next.width !== undefined || next.height !== undefined ? next : undefined;
}

function pruneNodeSizes(
  nodeIds: Set<string>,
  sizes?: Record<string, VisualFlowNodeSize>
): Record<string, VisualFlowNodeSize> | undefined {
  if (!sizes) return undefined;
  const next: Record<string, VisualFlowNodeSize> = {};
  for (const [id, size] of Object.entries(sizes)) {
    if (!nodeIds.has(id)) continue;
    const normalized = normalizeNodeSize(size);
    if (normalized) next[id] = normalized;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function buildInitialNodes(
  todos: ShelfPillarTodoItem[],
  storedPositions?: Record<string, { x: number; y: number }>,
  storedSizes?: Record<string, VisualFlowNodeSize>,
  onEditTodo?: (id: string, updates: Partial<ShelfPillarTodoItem>) => void,
  onResizeEnd?: (id: string, newSize: VisualFlowNodeSize) => void,
  showTodoDates?: boolean,
  grazelandPlane?: boolean,
  sectorColorMap?: Record<string, SectorColorKey>
): Node[] {
  return todos.map((todo, i) => {
    const pos = storedPositions?.[todo.id];
    const storedSize = normalizeNodeSize(storedSizes?.[todo.id]);
    const width = storedSize?.width ?? computeNodeWidth(todo);
    const resolvedSector =
      grazelandPlane && todo.sectorColor
        ? todo.sectorColor
        : resolveVisualFlowSectorColor(todo, sectorColorMap);
    return {
      id: todo.id,
      type: "todoFlow",
      position: pos ?? { x: 20, y: 20 + i * (NODE_MIN_HEIGHT + SPACING) },
      data: {
        text: todo.text,
        note: todo.note,
        tag: todo.tag,
        subtitle: todo.subtitle,
        blockStatus: todo.blockStatus,
        date: todo.date,
        showTodoDates: !!showTodoDates,
        handleConfig: todo.handleConfig ?? (grazelandPlane ? "omni" : "horizontal"),
        grazelandHandleVisibility:
          grazelandPlane ? todo.grazelandHandleVisibility ?? createGrazelandHandleVisibility() : undefined,
        grazelandPlane: !!grazelandPlane,
        sectorName: todo.sectorName,
        sectorColor: resolvedSector,
        onNoteChange:
          onEditTodo && todo.note
            ? (newNote: string) => onEditTodo(todo.id, { note: newNote })
            : undefined,
        onResizeEnd:
          grazelandPlane && onResizeEnd
            ? (newSize: VisualFlowNodeSize) => onResizeEnd(todo.id, newSize)
            : undefined,
      },
      style: {
        width,
        minHeight: NODE_MIN_HEIGHT,
        ...(storedSize?.height !== undefined ? { height: storedSize.height } : {}),
        ["--node-width" as string]: `${width}px`,
      },
    };
  });
}

const EDGE_STYLE = {
  stroke: "#0070f2",
  strokeWidth: 2.5,
  strokeDasharray: "9 11",
  strokeLinecap: "round",
} as const;

const EDGE_INTERACTION_WIDTH = 28;
const PARALLEL_OFFSET = 4;
const ARROW_COUNT = 4;

/** Focus drawer layout — adjust these to tune the open animation */
const FOCUS_DRAWER_WIDTH = "20.5rem";         /* Width of the drawer panel */
const FOCUS_DRAWER_CARD_MARGIN = "7rem";     /* Margin-right on the card (section) containing the canvas */
const FOCUS_DRAWER_CANVAS_TRANSLATE = "-13rem"; /* translateX on the canvas — how far it slides left */
const FOCUS_DRAWER_SLIDE_MS = 520;            /* Keep ≥ the CSS slide duration so content unmounts only after the slide-out finishes */
const ARROW_LENGTH = 8;
const ARROW_WIDTH = 5

/** Sample cubic Bézier B(t) at t, returns [x, y]. */
function cubicBezierPoint(t: number, p0: number[], p1: number[], p2: number[], p3: number[]): [number, number] {
  const u = 1 - t;
  const u3 = u * u * u;
  const u2 = u * u;
  const t2 = t * t;
  const t3 = t * t * t;
  return [
    u3 * p0[0] + 3 * u2 * t * p1[0] + 3 * u * t2 * p2[0] + t3 * p3[0],
    u3 * p0[1] + 3 * u2 * t * p1[1] + 3 * u * t2 * p2[1] + t3 * p3[1],
  ];
}

/** Derivative of cubic Bézier at t, gives tangent direction. */
function cubicBezierTangent(t: number, p0: number[], p1: number[], p2: number[], p3: number[]): [number, number] {
  const u = 1 - t;
  return [
    3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]),
    3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]),
  ];
}

/** Parse "M x0 y0 C x1 y1 x2 y2 x3 y3" and return control points, or null. */
function parseBezierPath(d: string): [number[], number[], number[], number[]] | null {
  const nums = d.match(/-?[\d.]+/g);
  if (!nums || nums.length < 10) return null;
  const [x0, y0, x1, y1, x2, y2, x3, y3] = nums.slice(0, 8).map(Number);
  return [
    [x0, y0], [x1, y1], [x2, y2], [x3, y3],
  ];
}

/** Return positions and tangent directions along the Bézier for placing arrows. */
function getArrowPlacements(d: string, count: number): [number, number, number][] | null {
  const pts = parseBezierPath(d);
  if (!pts) return null;
  const [p0, p1, p2, p3] = pts;
  const out: [number, number, number][] = [];
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    const [x, y] = cubicBezierPoint(t, p0, p1, p2, p3);
    const [dx, dy] = cubicBezierTangent(t, p0, p1, p2, p3);
    out.push([x, y, Math.atan2(dy, dx)]);
  }
  return out;
}

/** Create two parallel paths offset perpendicular to the curve. Returns [path1, path2] or null if parsing fails. */
function createParallelPaths(d: string, offset: number): [string, string] | null {
  const pts = parseBezierPath(d);
  if (!pts) return null;
  const [p0, p1, p2, p3] = pts;
  const samples = 24;
  const out1: [number, number][] = [];
  const out2: [number, number][] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const [x, y] = cubicBezierPoint(t, p0, p1, p2, p3);
    const [dx, dy] = cubicBezierTangent(t, p0, p1, p2, p3);
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    out1.push([x + offset * nx, y + offset * ny]);
    out2.push([x - offset * nx, y - offset * ny]);
  }
  const toPath = (points: [number, number][]) =>
    points.reduce((acc, [x, y], i) => (i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`), "");
  return [toPath(out1), toPath(out2)];
}

function TodoFlowEdge(props: EdgeProps) {
  const {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = EDGE_STYLE,
    data,
    markerStart,
    markerEnd,
    interactionWidth = EDGE_INTERACTION_WIDTH,
    selected,
  } = props;
  const arrow = data?.arrow ?? false;
  const doubled = data?.doubled ?? false;
  const muted = data?.muted ?? false;

  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition: sourcePosition ?? Position.Bottom,
    targetPosition: targetPosition ?? Position.Top,
  });

  const effectiveMarkerEnd = arrow ? undefined : markerEnd;

  const SELECTED_STROKE = "#ef4444";
  const pathStyle = {
    ...(style as object),
    fill: "none",
    ...(muted && {
      stroke: "#6b7280",
      opacity: 0.5,
    } as React.CSSProperties),
    ...(selected && {
      stroke: SELECTED_STROKE,
      strokeWidth: 2.6,
      opacity: 1,
    } as React.CSSProperties),
  };

  const parallelPaths = doubled ? createParallelPaths(path, PARALLEL_OFFSET) : null;
  const arrowPlacements = arrow ? getArrowPlacements(path, ARROW_COUNT) : null;
  const arrowColor = selected
    ? SELECTED_STROKE
    : muted
      ? "#6b7280"
      : (style as { stroke?: string })?.stroke ?? EDGE_STYLE.stroke;

  const renderArrows = () => {
    if (!arrowPlacements) return null;
    return (
      <g>
        {arrowPlacements.map(([x, y, angle], i) => {
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          const tipX = x + ARROW_LENGTH * cos;
          const tipY = y + ARROW_LENGTH * sin;
          const baseX = x - ARROW_LENGTH * cos;
          const baseY = y - ARROW_LENGTH * sin;
          const leftX = baseX + ARROW_WIDTH * sin;
          const leftY = baseY - ARROW_WIDTH * cos;
          const rightX = baseX - ARROW_WIDTH * sin;
          const rightY = baseY + ARROW_WIDTH * cos;
          return (
            <polygon
              key={i}
              points={`${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`}
              fill={arrowColor}
            />
          );
        })}
      </g>
    );
  };

  return (
    <g>
      {doubled && parallelPaths ? (
        <>
          <path
            d={parallelPaths[0]}
            style={{ ...pathStyle, strokeLinejoin: "round" } as React.CSSProperties}
            className="react-flow__edge-path"
          />
          <path
            d={parallelPaths[1]}
            style={{ ...pathStyle, strokeLinejoin: "round" } as React.CSSProperties}
            className="react-flow__edge-path"
          />
          <BaseEdge
            path={path}
            markerEnd={effectiveMarkerEnd}
            markerStart={markerStart}
            style={{ ...pathStyle, stroke: "transparent", strokeWidth: interactionWidth } as React.CSSProperties}
            interactionWidth={interactionWidth}
          />
        </>
      ) : doubled ? (
        <>
          <g transform="translate(-6, 0)">
            <path d={path} style={pathStyle} className="react-flow__edge-path" />
          </g>
          <g transform="translate(6, 0)">
            <path d={path} style={pathStyle} className="react-flow__edge-path" />
          </g>
          <BaseEdge
            path={path}
            markerEnd={effectiveMarkerEnd}
            markerStart={markerStart}
            style={{ ...pathStyle, stroke: "transparent", strokeWidth: interactionWidth } as React.CSSProperties}
            interactionWidth={interactionWidth}
          />
        </>
      ) : (
        <BaseEdge
          path={path}
          markerEnd={effectiveMarkerEnd}
          markerStart={markerStart}
          style={pathStyle}
          interactionWidth={interactionWidth}
        />
      )}
      {renderArrows()}
    </g>
  );
}

const edgeTypes = { todoFlow: TodoFlowEdge };

function buildInitialEdges(
  todos: ShelfPillarTodoItem[],
  storedEdges?: VisualFlowEdge[]
): Edge[] {
  const todoIds = new Set(todos.map((t) => t.id));
  const edges = storedEdges ?? [];
  return edges
    .filter((e) => todoIds.has(e.source) && todoIds.has(e.target))
    .map((e, i) => ({
      id: `e-${e.source}-${e.target}-${i}`,
      source: e.source,
      target: e.target,
      ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
      ...(e.targetHandle ? { targetHandle: e.targetHandle } : {}),
      type: "todoFlow",
      style: EDGE_STYLE,
      interactionWidth: EDGE_INTERACTION_WIDTH,
      data: {
        arrow: e.arrow,
        doubled: e.doubled,
        muted: e.muted,
      },
    }));
}

const MAX_PILLAR_TODO_PINS = 6;

function VisualFlowPanelInner({
  todos,
  grazelandItems = [],
  binItems = [],
  showTodoDates = false,
  showFocusDrawer = true,
  visualFlow,
  onUpdateVisualFlow,
  focusDesynced = false,
  showCanvasBlockers = true,
  setPillarTodoPins,
  onEditTodo,
  onDeleteTodo,
  onAddTodo,
  onEditGrazelandItem,
  onDeleteGrazelandItem,
  onAddGrazelandItem,
  onEditBinItem,
  onDeleteBinItem,
  onAddBinItem,
  onTaskCompleted,
  onTodoLog,
  onOpenCamps,
  vfGoals,
  fullPage = false,
}: {
  todos: ShelfPillarTodoItem[];
  grazelandItems?: ShelfPillarTodoItem[];
  binItems?: ShelfPillarTodoItem[];
  showTodoDates?: boolean;
  /** Whether the Focused-tasks drawer (+ its handle) is shown. Toggled in settings. */
  showFocusDrawer?: boolean;
  visualFlow: VisualFlowData;
  /**
   * Single write path for visualFlow. Always functional-updater — reads React's
   * latest state in `prev` so two updates in the same tick can't clobber each other.
   */
  onUpdateVisualFlow: (updater: (prev: VisualFlowData) => VisualFlowData) => void;
  focusDesynced?: boolean;
  /** Settings toggle — when false, blockers render only in the Doing-now drawer, not as canvas nodes. */
  showCanvasBlockers?: boolean;
  setPillarTodoPins?: (next: string[] | ((prev: string[]) => string[])) => void;
  onEditTodo?: (id: string, updates: Partial<ShelfPillarTodoItem>) => void;
  onDeleteTodo?: (id: string) => void;
  onAddTodo?: (todo: ShelfPillarTodoItem) => void;
  onEditGrazelandItem?: (id: string, updates: Partial<ShelfPillarTodoItem>) => void;
  onDeleteGrazelandItem?: (id: string) => void;
  onAddGrazelandItem?: (todo: ShelfPillarTodoItem) => void;
  onEditBinItem?: (id: string, updates: Partial<ShelfPillarTodoItem>) => void;
  onDeleteBinItem?: (id: string) => void;
  onAddBinItem?: (todo: ShelfPillarTodoItem) => void;
  onTaskCompleted?: () => void;
  onTodoLog?: (entry: string) => void;
  /** Flip up to the camps (goals) layer; renders a "⛺ Camps" toolbar button when set. */
  onOpenCamps?: () => void;
  /** Goals included in the "Copy for AI" markdown export when present. */
  vfGoals?: VfGoal[];
  fullPage?: boolean;
}) {
  const { screenToFlowPosition, getNodes, getViewport, setViewport, setCenter, fitView } = useReactFlow();
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [nodeMenu, setNodeMenu] = useState<{ nodeIds: string[]; x: number; y: number } | null>(null);
  const [edgeMenu, setEdgeMenu] = useState<{ edgeId: string; x: number; y: number } | null>(null);
  const [paneMenu, setPaneMenu] = useState<{ x: number; y: number } | null>(null);
  const [sectorManagerOpen, setSectorManagerOpen] = useState(false);
  const [editNodeId, setEditNodeId] = useState<string | null>(null);
  // Nodes created via the "new task/item" flow that haven't been saved yet. If the
  // edit modal is cancelled (or Escaped) while the node is still in this set, it's
  // a blank default node and gets discarded rather than left on the canvas. Saving
  // clears the id from the set (see the modal's onSave/onClose).
  const freshNodeIdsRef = useRef<Set<string>>(new Set());
  // Which focus-card note is being edited inline (todo id), if any.
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  // Right-click menu for a focused-task card in the drawer.
  const [focusItemMenu, setFocusItemMenu] = useState<{ planeId: VisualFlowPlane; id: string; text: string; x: number; y: number } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerFrozen, setDrawerFrozen] = useState(false);
  const [drawerPinned, setDrawerPinned] = useState(false);
  // On screens wider than 1920px the focus drawer is permanently docked open.
  const [dockedAlways, setDockedAlways] = useState(false);
  const pendingPanRef = useRef<string | null>(null);
  const [drawerMenu, setDrawerMenu] = useState<{ x: number; y: number } | null>(null);
  const [exportToast, setExportToast] = useState<string | null>(null);
  const exportToastTimerRef = useRef<number | null>(null);
  const [newPlaneDialog, setNewPlaneDialog] = useState<{ open: boolean; value: string }>({ open: false, value: "" });
  const newPlaneInputRef = useRef<HTMLInputElement>(null);
  const [deletePlanePending, setDeletePlanePending] = useState<string | null>(null);
  const [renamingPlaneId, setRenamingPlaneId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [draggingPlaneId, setDraggingPlaneId] = useState<string | null>(null);
  const [planeDropHint, setPlaneDropHint] = useState<{ id: string; place: "before" | "after" } | null>(null);

  // Undo stack for visualFlow snapshots. Covers position/edge changes on every
  // plane, custom-plane item add/delete/edit, sector colors, plane registry
  // edits, and viewport changes — anything that flows through onUpdateVisualFlow.
  // Does NOT cover item add/edit on main/grazeland/bin planes (those mutations
  // go through pillarTodos / grazelandItems / binItems, outside this object).
  const undoStackRef = useRef<VisualFlowData[]>([]);
  const prevVisualFlowRef = useRef<VisualFlowData>(visualFlow);
  const undoMountedRef = useRef(false);
  const skipNextUndoSnapshotRef = useRef(false);
  const UNDO_LIMIT = 50;

  useEffect(() => {
    // Skip the initial hydration so the first user action isn't an undo of "load".
    if (!undoMountedRef.current) {
      undoMountedRef.current = true;
      prevVisualFlowRef.current = visualFlow;
      return;
    }
    // Skip snapshots produced by an undo apply — otherwise Ctrl+Z would just
    // pingpong between the two most-recent states.
    if (skipNextUndoSnapshotRef.current) {
      skipNextUndoSnapshotRef.current = false;
      prevVisualFlowRef.current = visualFlow;
      return;
    }
    if (prevVisualFlowRef.current !== visualFlow) {
      undoStackRef.current.push(prevVisualFlowRef.current);
      if (undoStackRef.current.length > UNDO_LIMIT) undoStackRef.current.shift();
      prevVisualFlowRef.current = visualFlow;
    }
  }, [visualFlow]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z" || e.shiftKey) return;
      // Defer to the input/textarea's own undo when text is being edited.
      const a = document.activeElement;
      if (a instanceof HTMLElement) {
        const tag = a.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || a.isContentEditable) return;
      }
      const prev = undoStackRef.current.pop();
      if (!prev) return;
      e.preventDefault();
      skipNextUndoSnapshotRef.current = true;
      onUpdateVisualFlow(() => prev);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onUpdateVisualFlow]);

  useEffect(() => {
    return () => {
      if (exportToastTimerRef.current !== null) window.clearTimeout(exportToastTimerRef.current);
    };
  }, []);
  const drawerCloseTimeoutRef = useRef<number | null>(null);
  const stickOutUntilRef = useRef<number | null>(null);
  const drawerMenuRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const edgeMenuRef = useRef<HTMLDivElement>(null);
  const paneMenuRef = useRef<HTMLDivElement>(null);
  const hasInteracted = useRef(false);
  const completingIdsRef = useRef<Set<string>>(new Set());

  const [plane, setPlaneState] = useState<VisualFlowPlane>(() => {
    try {
      const v = window.localStorage.getItem(VISUAL_FLOW_PLANE_LS_KEY);
      if (!v) return "main";
      return v;
    } catch {
      return "main";
    }
  });

  const isCustomPlane = plane !== "main" && plane !== "grazeland" && plane !== "bin";
  const planeMeta = plane === "main" ? null : SPECIAL_VISUAL_FLOW_PLANE_META[plane as SpecialVisualFlowPlane] ?? null;

  const customPlaneItems = isCustomPlane ? (visualFlow.customPlaneItems?.[plane] ?? []) : [];

  const currentPlaneEdit = isCustomPlane
    ? (id: string, updates: Partial<ShelfPillarTodoItem>) => {
        onUpdateVisualFlow((prev) => ({
          ...prev,
          customPlaneItems: {
            ...(prev.customPlaneItems ?? {}),
            [plane]: (prev.customPlaneItems?.[plane] ?? []).map((t) => t.id === id ? applyTodoUpdate(t, updates) : t),
          },
        }));
      }
    : plane === "main" ? onEditTodo : plane === "grazeland" ? onEditGrazelandItem : onEditBinItem;

  const currentPlaneDelete = isCustomPlane
    ? (id: string) => {
        onUpdateVisualFlow((prev) => ({
          ...prev,
          customPlaneItems: {
            ...(prev.customPlaneItems ?? {}),
            [plane]: (prev.customPlaneItems?.[plane] ?? []).filter((t) => t.id !== id),
          },
        }));
      }
    : plane === "main" ? onDeleteTodo : plane === "grazeland" ? onDeleteGrazelandItem : onDeleteBinItem;

  const currentPlaneAdd = isCustomPlane
    ? (todo: ShelfPillarTodoItem) => {
        onUpdateVisualFlow((prev) => ({
          ...prev,
          customPlaneItems: {
            ...(prev.customPlaneItems ?? {}),
            [plane]: [...(prev.customPlaneItems?.[plane] ?? []), todo],
          },
        }));
      }
    : plane === "main" ? onAddTodo : plane === "grazeland" ? onAddGrazelandItem : onAddBinItem;

  const canvasItems = isCustomPlane
    ? customPlaneItems
    : plane === "main" ? todos : plane === "grazeland" ? grazelandItems : binItems;

  // Search: when the user types a query in the top-right input, dim nodes that
  // don't match any of their text fields. Empty query = no filter applied.
  const searchMatchingIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const hit = new Set<string>();
    for (const t of canvasItems) {
      const haystack = [
        t.text, t.note, t.subtitle, t.tag, t.url, t.sectorName, t.potentialValue, t.date,
      ].filter(Boolean).join(" ").toLowerCase();
      if (haystack.includes(q)) hit.add(t.id);
    }
    return hit;
  }, [searchQuery, canvasItems]);

  // matched items in canvas order — surfaced in the search results panel
  const searchResults = useMemo(
    () => (searchMatchingIds ? canvasItems.filter((t) => searchMatchingIds.has(t.id)) : []),
    [searchMatchingIds, canvasItems],
  );

  // jump the viewport to a node (search result click) and focus it
  const panToNode = useCallback((id: string) => {
    const node = getNodes().find((n) => n.id === id);
    if (!node) return;
    const w = node.measured?.width ?? 280;
    const h = node.measured?.height ?? 120;
    setFocusedNodeId(id);
    setCenter(node.position.x + w / 2, node.position.y + h / 2, { zoom: getViewport().zoom, duration: 460 });
  }, [getNodes, getViewport, setCenter]);
  const allVisualFlowSectorNames = useMemo(() => {
    const set = new Set<string>();
    for (const t of todos) {
      const s = t.sectorName?.trim();
      if (s) set.add(s);
    }
    for (const t of grazelandItems) {
      const s = t.sectorName?.trim();
      if (s) set.add(s);
    }
    for (const t of binItems) {
      const s = t.sectorName?.trim();
      if (s) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [todos, grazelandItems, binItems]);
  const sectorGroups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const t of canvasItems) {
      const s = t.sectorName?.trim();
      if (!s) continue;
      if (!map.has(s)) map.set(s, []);
      map.get(s)!.push(t.id);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [canvasItems]);
  const storedNodePositions = isCustomPlane
    ? (visualFlow.customPlaneNodePositions?.[plane])
    : plane === "main"
      ? visualFlow.nodePositions
      : plane === "grazeland"
        ? visualFlow.grazelandNodePositions
        : visualFlow.binNodePositions;
  const storedNodeSizes = isCustomPlane
    ? (visualFlow.customPlaneNodeSizes?.[plane])
    : plane === "main"
      ? undefined
      : plane === "grazeland"
        ? visualFlow.grazelandNodeSizes
        : visualFlow.binNodeSizes;
  const storedFlowEdges = isCustomPlane
    ? (visualFlow.customPlaneEdges?.[plane])
    : plane === "main"
      ? visualFlow.edges
      : plane === "grazeland"
        ? visualFlow.grazelandEdges
        : visualFlow.binEdges;

  const handleExportForAI = useCallback(async () => {
    const planeName = isCustomPlane
      ? visualFlow.customPlanes?.find((p) => p.id === plane)?.name
      : undefined;
    const md = exportFlowAsMarkdown({
      plane: plane as PlaneId,
      planeName,
      items: canvasItems,
      edges: storedFlowEdges,
      sectorColors: visualFlow.sectorColors,
      vfGoals,
    });
    try {
      await navigator.clipboard.writeText(md);
      setExportToast("Copied to clipboard");
    } catch {
      // Fallback: trigger a download so the user still gets the data
      const blob = new Blob([md], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shelf-flow-${plane}-${new Date().toISOString().slice(0, 10)}.md`;
      a.click();
      URL.revokeObjectURL(url);
      setExportToast("Downloaded (clipboard unavailable)");
    }
    if (exportToastTimerRef.current !== null) window.clearTimeout(exportToastTimerRef.current);
    exportToastTimerRef.current = window.setTimeout(() => {
      setExportToast(null);
      exportToastTimerRef.current = null;
    }, 1900);
  }, [canvasItems, isCustomPlane, plane, storedFlowEdges, visualFlow.customPlanes, visualFlow.sectorColors, vfGoals]);

  const flushCanvasToVisualFlow = useCallback(
    (targetPlane: VisualFlowPlane, nodeList: Node[], edgeList: Edge[]) => {
      const nodeIds = new Set(nodeList.map((node) => String(node.id)));
      const positions = Object.fromEntries(
        nodeList.filter((n) => n.position).map((n) => [n.id, { x: n.position!.x, y: n.position!.y }])
      );
      const edgeData = edgeList.map((e) => {
        const d = e.data as { arrow?: boolean; doubled?: boolean; muted?: boolean } | undefined;
        return {
          source: e.source,
          target: e.target,
          ...(d?.arrow && { arrow: true }),
          ...(d?.doubled && { doubled: true }),
          ...(d?.muted && { muted: true }),
        };
      });
      onUpdateVisualFlow((prev) => {
        const planeId = targetPlane as PlaneId;
        const sizes = pruneNodeSizes(nodeIds, getPlaneSizes(prev, planeId));
        return writePlane(prev, planeId, { positions, edges: edgeData, sizes });
      });
    },
    [onUpdateVisualFlow]
  );

  const handleEditCanvasItemWithLog = useCallback(
    (id: string, updates: Partial<ShelfPillarTodoItem>) => {
      const todo = canvasItems.find((t) => t.id === id);
      const logLabel = getVisualFlowPlaneLogLabel(plane);
      if (todo && onTodoLog && !(updates.done === true && Object.keys(updates).length === 1)) {
        const lines: string[] = [];
        if (updates.text !== undefined && updates.text !== todo.text) {
          lines.push(`Title: ${todo.text || "(empty)"} → ${updates.text || "(empty)"}`);
        }
        if (updates.note !== undefined && updates.note !== (todo.note ?? "")) {
          const oldNote = todo.note ?? "";
          const newNote = updates.note ?? "";
          lines.push(`${plane === "bin" ? "WHY" : "Description"}: ${oldNote || "(empty)"} → ${newNote || "(empty)"}`);
        }
        if (updates.potentialValue !== undefined && updates.potentialValue !== (todo.potentialValue ?? "")) {
          const oldPv = todo.potentialValue ?? "";
          const newPv = updates.potentialValue ?? "";
          lines.push(`Potential value (PV): ${oldPv || "(empty)"} → ${newPv || "(empty)"}`);
        }
        if (updates.subtitle !== undefined && updates.subtitle !== (todo.subtitle ?? "")) {
          lines.push(`Subtitle: ${todo.subtitle || "(empty)"} → ${updates.subtitle || "(empty)"}`);
        }
        if (updates.tag !== undefined && updates.tag !== (todo.tag ?? "")) {
          lines.push(`Tag: ${todo.tag || "(empty)"} → ${updates.tag || "(empty)"}`);
        }
        if (updates.blockStatus !== undefined && String(updates.blockStatus) !== String(todo.blockStatus ?? "")) {
          lines.push(`Status: ${todo.blockStatus || "—"} → ${updates.blockStatus || "—"}`);
        }
        if (updates.date !== undefined && String(updates.date || "") !== String(todo.date ?? "")) {
          lines.push(`Date: ${todo.date || "—"} → ${updates.date || "—"}`);
        }
        if (updates.sectorName !== undefined && updates.sectorName !== (todo.sectorName ?? "")) {
          lines.push(`Sector: ${todo.sectorName || "—"} → ${updates.sectorName || "—"}`);
        }
        if (
          updates.sectorColor !== undefined &&
          String(updates.sectorColor ?? "") !== String(todo.sectorColor ?? "")
        ) {
          lines.push(`Sector color: ${todo.sectorColor || "default"} → ${updates.sectorColor || "default"}`);
        }
        if (lines.length) {
          const kind = plane === "main" ? "task" : "item";
          onTodoLog(`${logLabel}: updated ${kind} "${todo.text}":\n${lines.join("\n")}`);
        }
      }
      currentPlaneEdit?.(id, updates);
    },
    [canvasItems, currentPlaneEdit, onTodoLog, plane]
  );

  const handleSpecialPlaneNodeResizeEnd = useCallback(
    (id: string, size: VisualFlowNodeSize) => {
      if (plane === "main") return;
      const nextSize = normalizeNodeSize(size);
      if (!nextSize) return;
      const prevSize = isCustomPlane
        ? visualFlow.customPlaneNodeSizes?.[plane]?.[id]
        : plane === "grazeland" ? visualFlow.grazelandNodeSizes?.[id] : visualFlow.binNodeSizes?.[id];
      if (prevSize?.width === nextSize.width && prevSize?.height === nextSize.height) return;
      hasInteracted.current = true;
      if (isCustomPlane) {
        onUpdateVisualFlow((prev) => ({
          ...prev,
          customPlaneNodeSizes: {
            ...(prev.customPlaneNodeSizes ?? {}),
            [plane]: { ...(prev.customPlaneNodeSizes?.[plane] ?? {}), [id]: nextSize },
          },
        }));
      } else if (plane === "grazeland") {
        onUpdateVisualFlow((prev) => ({
          ...prev,
          grazelandNodeSizes: { ...(prev.grazelandNodeSizes ?? {}), [id]: nextSize },
        }));
      } else {
        onUpdateVisualFlow((prev) => ({
          ...prev,
          binNodeSizes: { ...(prev.binNodeSizes ?? {}), [id]: nextSize },
        }));
      }
      const item = canvasItems.find((t) => t.id === id);
      if (item) {
        const logLabel = getVisualFlowPlaneLogLabel(plane);
        onTodoLog?.(
          `${logLabel}: resized item "${item.text}" to ${nextSize.width ?? NODE_RESIZE_MIN_WIDTH}x${nextSize.height ?? NODE_MIN_HEIGHT}`
        );
      }
    },
    [canvasItems, isCustomPlane, onTodoLog, onUpdateVisualFlow, plane, visualFlow]
  );

  const initialNodes = useMemo(
    () =>
      buildInitialNodes(
        canvasItems,
        storedNodePositions,
        storedNodeSizes,
        handleEditCanvasItemWithLog,
        plane === "main" ? undefined : handleSpecialPlaneNodeResizeEnd,
        showTodoDates,
        plane !== "main",
        visualFlow.sectorColors
      ),
    [
      canvasItems,
      storedNodePositions,
      storedNodeSizes,
      handleEditCanvasItemWithLog,
      handleSpecialPlaneNodeResizeEnd,
      showTodoDates,
      plane,
      visualFlow.sectorColors,
    ]
  );
  const initialEdges = useMemo(
    () => buildInitialEdges(canvasItems, storedFlowEdges),
    [canvasItems, storedFlowEdges]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const lastSyncedCanvasKeyRef = useRef<string | null>(null);
  const canvasSyncKey = useMemo(
    () =>
      JSON.stringify({
        plane,
        items: canvasItems,
        positions: storedNodePositions ?? null,
        sizes: storedNodeSizes ?? null,
        edges: storedFlowEdges ?? null,
        showTodoDates,
        sectorColors: visualFlow.sectorColors ?? null,
      }),
    [canvasItems, plane, showTodoDates, storedFlowEdges, storedNodePositions, storedNodeSizes, visualFlow.sectorColors]
  );

  const switchPlane = useCallback(
    (next: VisualFlowPlane) => {
      if (next === plane) return;
      // Save current viewport before leaving — pre-queued so the flush below sees it via prev.
      const vp = getViewport();
      onUpdateVisualFlow((prev) => ({
        ...prev,
        planeViewports: { ...(prev.planeViewports ?? {}), [plane]: vp },
      }));
      flushCanvasToVisualFlow(plane, nodes, edges);
      try {
        window.localStorage.setItem(VISUAL_FLOW_PLANE_LS_KEY, next);
      } catch {
        /* ignore */
      }
      setPlaneState(next);
    },
    [flushCanvasToVisualFlow, getViewport, nodes, edges, plane, onUpdateVisualFlow]
  );

  // ── Blockers (handoff 011): time-block nodes that live ON the main canvas AND
  // feed the Doing-now pipeline. visualFlow.blockers holds {id,label,due,dur,x,y};
  // the id also sits in visualFlow.doingNow.pipeline so it shows in Up Next and
  // jumps to the active slot when it fires. A 15s clock drives the phases.
  const [blockerNow, setBlockerNow] = useState(() => Date.now());
  const [blockerDraft, setBlockerDraft] = useState<BlockerDraftState | null>(null);
  const [blockerMenu, setBlockerMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [blockerDrag, setBlockerDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  // Right-click menu on the Doing-now drawer (currently just "Add blocker").
  const [doingMenu, setDoingMenu] = useState<{ x: number; y: number } | null>(null);
  const firedBlockersRef = useRef<Record<string, boolean>>({});
  // Full-screen "Edit task" editor opened from a Doing-now task item (by plane + id).
  const [taskEditor, setTaskEditor] = useState<{ id: string; plane: string } | null>(null);

  // Create a blocker at flow position (fx,fy) AND enqueue it into Doing-now (opens the drawer).
  const addBlocker = useCallback(
    (fx: number, fy: number, label: string, dueMs: number, dur: number) => {
      const id = `blk-${Date.now().toString(36)}`;
      onUpdateVisualFlow((prev) => {
        const pipe = prev.doingNow?.pipeline ?? [];
        const nextPipe = pipe.includes(id) || pipe.length >= 7 ? pipe : [...pipe, id];
        return {
          ...prev,
          blockers: [...(prev.blockers ?? []), { id, label: label || "Blocker", due: dueMs, dur: dur || 30, x: fx, y: fy }],
          doingNow: { pipeline: nextPipe, open: true },
        };
      });
    },
    [onUpdateVisualFlow]
  );
  const updateBlocker = useCallback(
    (id: string, patch: Partial<Blocker>) => {
      onUpdateVisualFlow((prev) => ({ ...prev, blockers: (prev.blockers ?? []).map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
    },
    [onUpdateVisualFlow]
  );
  // Clear a blocker from BOTH the canvas and the Doing-now pipeline.
  const removeBlocker = useCallback(
    (id: string) => {
      onUpdateVisualFlow((prev) => ({
        ...prev,
        blockers: (prev.blockers ?? []).filter((b) => b.id !== id),
        doingNow: { pipeline: (prev.doingNow?.pipeline ?? []).filter((x) => x !== id), open: prev.doingNow?.open ?? false },
      }));
    },
    [onUpdateVisualFlow]
  );
  // Drag a canvas blocker: screen→flow each move; commit once on release.
  const onBlockerPointerDown = useCallback(
    (e: React.PointerEvent, b: Blocker) => {
      if ((e.target as Element).closest("button")) return; // let the Clear button work
      e.stopPropagation();
      const start = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const dx = start.x - (b.x ?? 0);
      const dy = start.y - (b.y ?? 0);
      let last = { x: b.x ?? 0, y: b.y ?? 0 };
      setBlockerDrag({ id: b.id, x: last.x, y: last.y });
      const move = (ev: PointerEvent) => {
        const f = screenToFlowPosition({ x: ev.clientX, y: ev.clientY });
        last = { x: f.x - dx, y: f.y - dy };
        setBlockerDrag({ id: b.id, x: last.x, y: last.y });
      };
      const up = () => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        updateBlocker(b.id, { x: last.x, y: last.y });
        setBlockerDrag(null);
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
    },
    [screenToFlowPosition, updateBlocker]
  );

  // Reuse the toolbar's export-toast slot to surface the "blocking now" alert.
  const flashToast = useCallback((msg: string) => {
    setExportToast(msg);
    if (exportToastTimerRef.current !== null) window.clearTimeout(exportToastTimerRef.current);
    exportToastTimerRef.current = window.setTimeout(() => {
      setExportToast(null);
      exportToastTimerRef.current = null;
    }, 3200);
  }, []);

  // Ticking clock for blocker phases (every 15s) — runs on every plane.
  useEffect(() => {
    const t = window.setInterval(() => setBlockerNow(Date.now()), 15000);
    return () => window.clearInterval(t);
  }, []);

  // ── "Doing now" pipeline (handoff 010 + 011 blockers) ───────────────────────
  // Ordered id list in visualFlow.doingNow.pipeline (backup-covered). Ids resolve
  // to either a task (across any plane) or a blocker. Index 0 is the active slot.
  const doingState: DoingPipelineState = useMemo(() => {
    const d = visualFlow.doingNow;
    return { pipeline: Array.isArray(d?.pipeline) ? d!.pipeline : [], open: !!d?.open };
  }, [visualFlow.doingNow]);

  // Persist pipeline changes AND prune any blockers that just left the queue —
  // keeps visualFlow.blockers ⊆ pipeline so removed blockers don't dangle.
  const setDoingState = useCallback(
    (next: DoingPipelineState) => {
      onUpdateVisualFlow((prev) => {
        const ids = new Set(next.pipeline);
        return {
          ...prev,
          doingNow: { pipeline: next.pipeline, open: next.open },
          blockers: (prev.blockers ?? []).filter((b) => ids.has(b.id)),
        };
      });
    },
    [onUpdateVisualFlow]
  );

  const resolveDoingItem = useCallback(
    (id: string): DoingTask | null => {
      const blk = (visualFlow.blockers ?? []).find((b) => b.id === id);
      if (blk) {
        const st = nfBlockerStatus(blk.due, blk.dur, blockerNow);
        return { kind: "blocker", id: blk.id, title: blk.label, phase: st.phase, statusText: st.text, startText: nfClock(blk.due) };
      }
      const customPlanes = visualFlow.customPlanes ?? [];
      const search: [string, ShelfPillarTodoItem[]][] = [
        ["main", todos],
        ["grazeland", grazelandItems],
        ["bin", binItems],
        ...Object.entries(visualFlow.customPlaneItems ?? {}),
      ];
      for (const [pk, items] of search) {
        const t = items.find((x) => x.id === id);
        if (t) {
          const meta = doingPlaneMeta(pk, customPlanes);
          return {
            kind: "task",
            id: t.id,
            plane: pk,
            planeLabel: meta.label,
            planeColor: meta.color,
            title: t.text,
            subtitle: t.subtitle,
            note: t.note,
            tag: t.tag,
            done: t.done,
          };
        }
      }
      return null;
    },
    [visualFlow.blockers, blockerNow, todos, grazelandItems, binItems, visualFlow.customPlaneItems, visualFlow.customPlanes]
  );

  // "✓ Done & next" / "✓ Clear" — for a task, complete it on its plane; for a
  // blocker, nothing extra (setDoingState prunes it when it leaves the pipeline).
  const completeDoingItem = useCallback(
    (id: string) => {
      if ((visualFlow.blockers ?? []).some((b) => b.id === id)) return;
      const customItems = visualFlow.customPlaneItems ?? {};
      let planeKey: string | null = null;
      let item: ShelfPillarTodoItem | undefined;
      if ((item = todos.find((t) => t.id === id))) planeKey = "main";
      else if ((item = grazelandItems.find((t) => t.id === id))) planeKey = "grazeland";
      else if ((item = binItems.find((t) => t.id === id))) planeKey = "bin";
      else {
        for (const [pk, items] of Object.entries(customItems)) {
          const f = items.find((t) => t.id === id);
          if (f) {
            planeKey = pk;
            item = f;
            break;
          }
        }
      }
      if (!planeKey || !item) return;
      if (planeKey === "main") onDeleteTodo?.(id);
      else if (planeKey === "grazeland") onDeleteGrazelandItem?.(id);
      else if (planeKey === "bin") onDeleteBinItem?.(id);
      else {
        const pk = planeKey;
        onUpdateVisualFlow((prev) => ({
          ...prev,
          customPlaneItems: {
            ...(prev.customPlaneItems ?? {}),
            [pk]: (prev.customPlaneItems?.[pk] ?? []).filter((t) => t.id !== id),
          },
        }));
      }
      onTaskCompleted?.();
      const customName =
        planeKey !== "main" && planeKey !== "grazeland" && planeKey !== "bin"
          ? (visualFlow.customPlanes ?? []).find((c) => c.id === planeKey)?.name
          : undefined;
      onTodoLog?.(
        `${getVisualFlowPlaneLogLabel(planeKey as VisualFlowPlane, customName)}: completed ${getVisualFlowPlaneCountLabel(planeKey as VisualFlowPlane, 1)} ${item.text}`
      );
    },
    [visualFlow.blockers, todos, grazelandItems, binItems, visualFlow.customPlaneItems, visualFlow.customPlanes, onDeleteTodo, onDeleteGrazelandItem, onDeleteBinItem, onUpdateVisualFlow, onTaskCompleted, onTodoLog]
  );

  // "Edit" — a task opens the full-screen Doing-now task editor; a blocker opens
  // the blocker editor popover.
  const editDoingItem = useCallback(
    (item: DoingTask) => {
      if (item.kind === "blocker") {
        const b = (visualFlow.blockers ?? []).find((x) => x.id === item.id);
        if (!b) return;
        setBlockerDraft({ x: Math.round(window.innerWidth / 2 - 135), y: 140, label: b.label, due: nfToDatetimeLocal(b.due), dur: b.dur, edit: b.id });
        return;
      }
      setTaskEditor({ id: item.id, plane: item.plane ?? "main" });
    },
    [visualFlow.blockers]
  );

  const doingPipeline = useDoingPipeline({
    state: doingState,
    onChange: setDoingState,
    resolve: resolveDoingItem,
    onComplete: completeDoingItem,
    onEdit: editDoingItem,
  });

  // When a blocker crosses into its active window, jump it to the active slot
  // (handoff 011) + toast, once; re-arm while pending.
  const promoteDoing = doingPipeline.promote;
  const inDoing = doingPipeline.inPipeline;
  useEffect(() => {
    (visualFlow.blockers ?? []).forEach((b) => {
      const st = nfBlockerStatus(b.due, b.dur, blockerNow);
      if (st.phase === "active" && !firedBlockersRef.current[b.id]) {
        firedBlockersRef.current[b.id] = true;
        if (inDoing(b.id)) promoteDoing(b.id);
        flashToast(`⛔ Blocking now — ${b.label}`);
        onTodoLog?.(`Visual Flow: blocker started "${b.label}"`);
      }
      if (st.phase === "pending") firedBlockersRef.current[b.id] = false;
    });
  }, [blockerNow, visualFlow.blockers, promoteDoing, inDoing, flashToast, onTodoLog]);

  const commitBlocker = useCallback(() => {
    if (!blockerDraft || !blockerDraft.due) return;
    const dueMs = new Date(blockerDraft.due).getTime();
    if (isNaN(dueMs)) return;
    const label = (blockerDraft.label || "").trim() || "Blocker";
    if (blockerDraft.edit) {
      updateBlocker(blockerDraft.edit, { label, due: dueMs, dur: blockerDraft.dur });
      firedBlockersRef.current[blockerDraft.edit] = false; // re-arm after a time change
    } else {
      addBlocker(blockerDraft.fx ?? 0, blockerDraft.fy ?? 0, label, dueMs, blockerDraft.dur);
    }
    setBlockerDraft(null);
  }, [blockerDraft, addBlocker, updateBlocker]);

  // Restore saved viewport when switching planes; fall back to fitView if none stored
  useEffect(() => {
    const saved = visualFlow.planeViewports?.[plane];
    if (saved) {
      setViewport(saved, { duration: 0 });
    } else {
      requestAnimationFrame(() => fitView({ padding: 0.2 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plane]);

  // Keep a ref to edges so the dim effect can read them without listing them as a dep
  // (listing edges would cause setEdges → edges change → re-run → infinite loop)
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  // Dim nodes/edges not connected to the focused node OR not matching the search.
  // A node is dimmed if either constraint says so; an edge is dimmed if either
  // endpoint is dimmed. Both constraints can be active simultaneously.
  useEffect(() => {
    const currentEdges = edgesRef.current;

    // Pre-compute focus-reachable set once per run (used for both nodes and edges).
    const reachable = focusedNodeId ? new Set([focusedNodeId]) : null;
    if (focusedNodeId && reachable) {
      const queue = [focusedNodeId];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const e of currentEdges) {
          if (e.source === cur && !reachable.has(e.target)) { reachable.add(e.target); queue.push(e.target); }
          if (e.target === cur && !reachable.has(e.source)) { reachable.add(e.source); queue.push(e.source); }
        }
      }
    }

    const isNodeDim = (id: string) =>
      (reachable !== null && !reachable.has(id)) ||
      (searchMatchingIds !== null && !searchMatchingIds.has(id));

    setNodes((ns) => ns.map((n) => {
      const base = (n.className ?? "").replace(/\bvf-node-dim\b/g, "").trim();
      const dim = isNodeDim(n.id);
      const next = dim ? (base ? base + " vf-node-dim" : "vf-node-dim") : base;
      return n.className === next ? n : { ...n, className: next };
    }));
    setEdges((es) => es.map((e) => {
      const base = (e.className ?? "").replace(/\bvf-edge-dim\b/g, "").trim();
      const dim = isNodeDim(e.source) || isNodeDim(e.target);
      const next = dim ? (base ? base + " vf-edge-dim" : "vf-edge-dim") : base;
      return e.className === next ? e : { ...e, className: next };
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedNodeId, searchMatchingIds]);

  useEffect(() => {
    if (lastSyncedCanvasKeyRef.current === canvasSyncKey) return;
    lastSyncedCanvasKeyRef.current = canvasSyncKey;
    setNodes((current) => {
      const fresh = buildInitialNodes(
        canvasItems,
        storedNodePositions,
        storedNodeSizes,
        handleEditCanvasItemWithLog,
        plane === "main" ? undefined : handleSpecialPlaneNodeResizeEnd,
        showTodoDates,
        plane !== "main",
        visualFlow.sectorColors
      );
      return fresh.map((n) => {
        const existing = current.find((c) => c.id === n.id);
        if (!existing) return n;
        const isExiting =
          existing.className?.includes("shelf-flow-node-exiting") ||
          Boolean((existing.data as TodoFlowNodeData | undefined)?.completing);
        if (isExiting) {
          return {
            ...n,
            className: existing.className,
            data: { ...(n.data as object), completing: true },
            selected: existing.selected,
          };
        }
        return existing.selected !== undefined ? { ...n, selected: existing.selected } : n;
      });
    });
    setEdges(buildInitialEdges(canvasItems, storedFlowEdges));
  }, [
    canvasItems,
    storedNodePositions,
    storedNodeSizes,
    storedFlowEdges,
    handleEditCanvasItemWithLog,
    handleSpecialPlaneNodeResizeEnd,
    showTodoDates,
    plane,
    visualFlow.sectorColors,
    canvasSyncKey,
    setNodes,
    setEdges,
  ]);

  const onConnect = useCallback(
    (params: Connection) => {
      hasInteracted.current = true;
      // Fan-out: if a multi-selection is active and the user drags a connection
      // that touches the selection on exactly one side, create the same edge
      // against every selected node on that side. Drags entirely within or
      // entirely outside the selection fall through to a single edge.
      const selectedIds = getNodes()
        .filter((n) => n.selected)
        .map((n) => String(n.id));
      const selSet = new Set(selectedIds);
      const sourceSelected = !!params.source && selSet.has(params.source);
      const targetSelected = !!params.target && selSet.has(params.target);
      const fanOut =
        selectedIds.length > 1 &&
        ((targetSelected && !sourceSelected) || (sourceSelected && !targetSelected));

      setEdges((eds) => {
        let next = eds;
        if (fanOut) {
          // Iterate over every selected node and create one connection per node
          // on the side that touched the selection.
          for (const id of selectedIds) {
            const p: Connection = targetSelected
              ? { ...params, target: id }
              : { ...params, source: id };
            if (!p.source || !p.target || p.source === p.target) continue;
            const exists = next.some(
              (e) =>
                e.source === p.source &&
                e.target === p.target &&
                (e.sourceHandle ?? null) === (p.sourceHandle ?? null) &&
                (e.targetHandle ?? null) === (p.targetHandle ?? null)
            );
            if (exists) continue;
            next = addEdge(p, next);
          }
        } else {
          next = addEdge(params, eds);
        }
        return next.map((e) =>
          e.type !== "todoFlow"
            ? { ...e, type: "todoFlow", data: { ...(e.data as object), arrow: false, doubled: false, muted: false } }
            : e
        );
      });
    },
    [getNodes, setEdges]
  );

  const persist = useCallback(
    (positionsOverride?: Record<string, { x: number; y: number }>) => {
      if (!hasInteracted.current) return;
      const nodeIds = new Set(nodes.map((node) => String(node.id)));
      const positions =
        positionsOverride ??
        Object.fromEntries(nodes.filter((n) => n.position).map((n) => [n.id, { x: n.position!.x, y: n.position!.y }]));
      const edgeList = edges.map((e) => {
        const d = e.data as { arrow?: boolean; doubled?: boolean; muted?: boolean } | undefined;
        return {
          source: e.source,
          target: e.target,
          ...(d?.arrow && { arrow: true }),
          ...(d?.doubled && { doubled: true }),
          ...(d?.muted && { muted: true }),
        };
      });
      onUpdateVisualFlow((prev) => {
        const planeId = plane as PlaneId;
        const sizes = pruneNodeSizes(nodeIds, getPlaneSizes(prev, planeId));
        return writePlane(prev, planeId, { positions, edges: edgeList, sizes });
      });
    },
    [nodes, edges, onUpdateVisualFlow, plane]
  );

  useEffect(() => {
    if (nodes.length === 0 && edges.length === 0) return;
    const t = window.setTimeout(() => persist(), 100);
    return () => window.clearTimeout(t);
  }, [nodes, edges, persist]);

  const onNodeDragStop = useCallback(
    () => {
      hasInteracted.current = true;
      persist();
    },
    [persist]
  );

  const onNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: Node) => {
      e.preventDefault();
      setEdgeMenu(null);
      setPaneMenu(null);
      const clickedId = String(node.id);
      // Read selection from the flow store so we always see the current multi-selection
      // (avoids stale React state and matches React Flow’s selection at event time).
      const selectedIds = getNodes()
        .filter((n) => n.selected)
        .map((n) => String(n.id));
      const nodeIds =
        selectedIds.length > 1 && selectedIds.includes(clickedId) ? selectedIds : [clickedId];
      setNodeMenu({ nodeIds, x: e.clientX, y: e.clientY });
    },
    [getNodes]
  );

  /** Right-clicks on the multi-select rectangle hit this, not the node — without it the browser menu shows. */
  const onSelectionContextMenu = useCallback((e: React.MouseEvent, selectedNodes: Node[]) => {
    e.preventDefault();
    setEdgeMenu(null);
    setPaneMenu(null);
    const ids = selectedNodes.map((n) => String(n.id));
    if (ids.length === 0) return;
    setNodeMenu({ nodeIds: ids, x: e.clientX, y: e.clientY });
  }, []);

  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      setEdgeMenu(null);
      hasInteracted.current = true;
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    },
    [setEdges]
  );

  const handleEdgeToggleArrow = useCallback(
    (edgeId: string) => {
      setEdges((eds) =>
        eds.map((e) =>
          e.id === edgeId
            ? { ...e, data: { ...(e.data as object), arrow: !(e.data as { arrow?: boolean })?.arrow } }
            : e
        )
      );
      hasInteracted.current = true;
      setEdgeMenu(null);
    },
    [setEdges]
  );

  const handleDeleteSelectedEdges = useCallback(() => {
    setEdgeMenu(null);
    setPaneMenu(null);
    hasInteracted.current = true;
    setEdges((eds) => eds.filter((e) => !e.selected));
  }, [setEdges]);

  const selectedEdgeCount = edges.reduce((n, e) => (e.selected ? n + 1 : n), 0);


  const handleEdgeToggleDoubled = useCallback(
    (edgeId: string) => {
      setEdges((eds) =>
        eds.map((e) =>
          e.id === edgeId
            ? { ...e, data: { ...(e.data as object), doubled: !(e.data as { doubled?: boolean })?.doubled } }
            : e
        )
      );
      hasInteracted.current = true;
      setEdgeMenu(null);
    },
    [setEdges]
  );

  const handleEdgeToggleMuted = useCallback(
    (edgeId: string) => {
      setEdges((eds) =>
        eds.map((e) =>
          e.id === edgeId
            ? { ...e, data: { ...(e.data as object), muted: !(e.data as { muted?: boolean })?.muted } }
            : e
        )
      );
      hasInteracted.current = true;
      setEdgeMenu(null);
    },
    [setEdges]
  );

  useEffect(() => {
    if (!nodeMenu) return;
    const close = (e: MouseEvent) => {
      if (e.button !== 0) return; // left-button only — leave right-click reopens to onContextMenu
      const target = e.target;
      // `Element` (not `HTMLElement`) so clicks on the React Flow SVG layer
      // (edges, background dots, handles) also dismiss the menu.
      if (menuRef.current && target instanceof Element && !menuRef.current.contains(target))
        setNodeMenu(null);
    };
    // mousedown rather than click so drags (which never produce a `click`) also dismiss the menu.
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [nodeMenu]);

  useEffect(() => {
    if (!paneMenu) return;
    const close = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target;
      if (
        paneMenuRef.current &&
        target instanceof Element &&
        !paneMenuRef.current.contains(target)
      )
        setPaneMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [paneMenu]);

  useEffect(() => {
    if (!sectorManagerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSectorManagerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sectorManagerOpen]);

  useEffect(() => {
    if (!edgeMenu) return;
    const close = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target;
      if (
        edgeMenuRef.current &&
        target instanceof Element &&
        !edgeMenuRef.current.contains(target)
      )
        setEdgeMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [edgeMenu]);

  useEffect(() => {
    if (!nodeMenu && !paneMenu && !edgeMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setNodeMenu(null);
      setPaneMenu(null);
      setEdgeMenu(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [nodeMenu, paneMenu, edgeMenu]);

  // Cmd/Ctrl+A — select all nodes + edges on the current plane.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "a" || e.shiftKey) return;
      const a = document.activeElement;
      if (a instanceof HTMLElement) {
        const tag = a.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || a.isContentEditable) return;
      }
      e.preventDefault();
      hasInteracted.current = true;
      setNodes((ns) => ns.map((n) => (n.selected ? n : { ...n, selected: true })));
      setEdges((es) => es.map((ed) => (ed.selected ? ed : { ...ed, selected: true })));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setNodes, setEdges]);

  useEffect(() => {
    if (!drawerMenu) return;
    const close = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target;
      if (
        drawerMenuRef.current &&
        target instanceof Element &&
        !drawerMenuRef.current.contains(target)
      )
        setDrawerMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [drawerMenu]);

  const onPaneContextMenu = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      // Right-clicking a blocker (or a menu/draft) opens that element's own menu —
      // don't also open the canvas "add" menu (handoff 011 guard).
      if (e.target instanceof Element && e.target.closest(".nf-blocker, .nf-menu, .nf-blocker-draft")) return;
      e.preventDefault();
      setEdgeMenu(null);
      const selectedIds = getNodes()
        .filter((n) => n.selected)
        .map((n) => String(n.id));
      // Right-click empty canvas while several nodes are selected: same bulk menu as on a node
      if (selectedIds.length > 1) {
        setPaneMenu(null);
        setNodeMenu({ nodeIds: selectedIds, x: e.clientX, y: e.clientY });
        return;
      }
      const canAdd = currentPlaneAdd;
      if (canAdd) {
        setNodeMenu(null);
        setPaneMenu({ x: e.clientX, y: e.clientY });
      }
    },
    [currentPlaneAdd, getNodes, plane]
  );

  const handleCreateTask = useCallback(() => {
    if (!paneMenu) return;
    const flowPos = screenToFlowPosition({ x: paneMenu.x, y: paneMenu.y });
    const width = NODE_INITIAL_WIDTH;
    const height = NODE_MIN_HEIGHT;
    const pos = { x: flowPos.x - width / 2, y: flowPos.y - height / 2 };
    if (plane === "main") {
      if (!currentPlaneAdd) return;
      const newTodo: ShelfPillarTodoItem = stampNewTodo({
        id: crypto.randomUUID(),
        text: "New task",
        done: false,
      });
      currentPlaneAdd(newTodo);
      onUpdateVisualFlow((prev) => ({
        ...prev,
        nodePositions: { ...(prev.nodePositions ?? {}), [newTodo.id]: pos },
      }));
      setPaneMenu(null);
      freshNodeIdsRef.current.add(newTodo.id);
      setEditNodeId(newTodo.id);
      onTodoLog?.(`Visual Flow: added new task "${newTodo.text}"`);
      return;
    }
    if (!currentPlaneAdd) return;
    const newItem: ShelfPillarTodoItem = stampNewTodo({
      id: crypto.randomUUID(),
      text: "New item",
      done: false,
      grazelandHandleVisibility: createGrazelandHandleVisibility(false),
    });
    if (isCustomPlane) {
      // Atomic: item + position in one updater so the writes can't clobber each other.
      onUpdateVisualFlow((prev) => ({
        ...prev,
        customPlaneItems: {
          ...(prev.customPlaneItems ?? {}),
          [plane]: [...(prev.customPlaneItems?.[plane] ?? []), newItem],
        },
        customPlaneNodePositions: {
          ...(prev.customPlaneNodePositions ?? {}),
          [plane]: { ...(prev.customPlaneNodePositions?.[plane] ?? {}), [newItem.id]: pos },
        },
      }));
    } else {
      currentPlaneAdd(newItem);
      if (plane === "grazeland") {
        onUpdateVisualFlow((prev) => ({
          ...prev,
          grazelandNodePositions: { ...(prev.grazelandNodePositions ?? {}), [newItem.id]: pos },
        }));
      } else {
        onUpdateVisualFlow((prev) => ({
          ...prev,
          binNodePositions: { ...(prev.binNodePositions ?? {}), [newItem.id]: pos },
        }));
      }
    }
    setPaneMenu(null);
    freshNodeIdsRef.current.add(newItem.id);
    setEditNodeId(newItem.id);
    onTodoLog?.(`${getVisualFlowPlaneLogLabel(plane)}: added new item "${newItem.text}"`);
  }, [
    currentPlaneAdd,
    isCustomPlane,
    onTodoLog,
    onUpdateVisualFlow,
    paneMenu,
    plane,
    screenToFlowPosition,
  ]);

  const handleOpenSectorManager = useCallback(() => {
    setPaneMenu(null);
    setSectorManagerOpen(true);
  }, []);

  const commitNewPlane = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = "custom-" + crypto.randomUUID();
    // Flush current canvas state, then add the new plane. Both use the functional
    // updater so the second sees the first's result via `prev` — no clobber.
    flushCanvasToVisualFlow(plane, nodes, edges);
    onUpdateVisualFlow((prev) => ({
      ...prev,
      customPlanes: [...(prev.customPlanes ?? []), { id, name: trimmed }],
    }));
    try { window.localStorage.setItem(VISUAL_FLOW_PLANE_LS_KEY, id); } catch { /* ignore */ }
    setPlaneState(id);
  }, [flushCanvasToVisualFlow, nodes, edges, onUpdateVisualFlow, plane]);

  const commitDeletePlane = useCallback((id: string) => {
    if (plane === id) {
      try { window.localStorage.setItem(VISUAL_FLOW_PLANE_LS_KEY, "main"); } catch { /* ignore */ }
      setPlaneState("main");
    }
    onUpdateVisualFlow((prev) => {
      const next: VisualFlowData = {
        ...prev,
        customPlanes: (prev.customPlanes ?? []).filter((p) => p.id !== id),
        customPlaneItems: Object.fromEntries(
          Object.entries(prev.customPlaneItems ?? {}).filter(([k]) => k !== id)
        ),
        customPlaneNodePositions: Object.fromEntries(
          Object.entries(prev.customPlaneNodePositions ?? {}).filter(([k]) => k !== id)
        ),
        customPlaneEdges: Object.fromEntries(
          Object.entries(prev.customPlaneEdges ?? {}).filter(([k]) => k !== id)
        ),
        customPlaneNodeSizes: Object.fromEntries(
          Object.entries(prev.customPlaneNodeSizes ?? {}).filter(([k]) => k !== id)
        ),
      };
      // Drop the deleted plane's viewport entry too — previously orphaned.
      if (prev.planeViewports && id in prev.planeViewports) {
        next.planeViewports = Object.fromEntries(
          Object.entries(prev.planeViewports).filter(([k]) => k !== id)
        );
      }
      return next;
    });
  }, [onUpdateVisualFlow, plane]);

  const commitRenamePlane = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onUpdateVisualFlow((prev) => ({
      ...prev,
      customPlanes: (prev.customPlanes ?? []).map((p) => p.id === id ? { ...p, name: trimmed } : p),
    }));
  }, [onUpdateVisualFlow]);

  const commitPlaneColor = useCallback((id: string, color: string | null) => {
    onUpdateVisualFlow((prev) => ({
      ...prev,
      customPlanes: (prev.customPlanes ?? []).map((p) =>
        p.id === id ? { ...p, color: color ?? undefined } : p
      ),
    }));
  }, [onUpdateVisualFlow]);

  // Reorder a custom plane relative to a target plane. Only touches the
  // customPlanes array — the fixed Main/Grazeland/Bin tabs are never involved.
  const commitReorderPlane = useCallback((draggedId: string, targetId: string, place: "before" | "after") => {
    if (draggedId === targetId) return;
    onUpdateVisualFlow((prev) => {
      const planes = [...(prev.customPlanes ?? [])];
      const from = planes.findIndex((p) => p.id === draggedId);
      if (from === -1) return prev;
      const [moved] = planes.splice(from, 1);
      let to = planes.findIndex((p) => p.id === targetId);
      if (to === -1) return prev;
      if (place === "after") to += 1;
      planes.splice(to, 0, moved);
      return { ...prev, customPlanes: planes };
    });
  }, [onUpdateVisualFlow]);

  // Create a new sub-task already connected to a parent node.
  // Plane-aware: writes to the right positions map + edges list for whichever
  // plane the user is currently on.
  const handleAddConnectedSubtask = useCallback(
    (parentId: string) => {
      if (!currentPlaneAdd) return;
      const isGrazeland = plane === "grazeland";
      const isBin = plane === "bin";
      const isSpecialPlane = isGrazeland || isBin || isCustomPlane;

      // Look up parent position in this plane
      const positions =
        plane === "main"
          ? visualFlow.nodePositions
          : isGrazeland
            ? visualFlow.grazelandNodePositions
            : isBin
              ? visualFlow.binNodePositions
              : visualFlow.customPlaneNodePositions?.[plane];
      const parentPos = positions?.[parentId];

      const dx = NODE_INITIAL_WIDTH + 80;
      const dy = 40;
      const newPos = parentPos
        ? { x: parentPos.x + dx, y: parentPos.y + dy }
        : { x: 0, y: 0 };

      // For non-main planes: new node gets left1 visible (target handle)
      const newNodeHandles: Partial<ShelfPillarTodoItem> = isSpecialPlane
        ? { grazelandHandleVisibility: { ...createGrazelandHandleVisibility(false), left1: true } }
        : {};

      const baseTodo: ShelfPillarTodoItem = stampNewTodo({
        id: crypto.randomUUID(),
        text: plane === "main" ? "New sub-task" : "New item",
        done: false,
        ...newNodeHandles,
      });

      // On special planes, connect source-right (right2) → target-left (left1); handleId values, not slot keys
      const newEdge: VisualFlowEdge = isSpecialPlane
        ? { source: parentId, target: baseTodo.id, arrow: true, sourceHandle: "source-right", targetHandle: "target-left" }
        : { source: parentId, target: baseTodo.id, arrow: true };

      // Build the new child RF node for immediate imperative update
      const newChildNode: Node = {
        id: baseTodo.id,
        type: "todoFlow",
        position: newPos,
        data: {
          text: baseTodo.text,
          done: baseTodo.done,
          handleConfig: isSpecialPlane ? "omni" : "horizontal",
          grazelandHandleVisibility: isSpecialPlane
            ? { ...createGrazelandHandleVisibility(false), left1: true }
            : undefined,
          grazelandPlane: isSpecialPlane,
          showTodoDates: false,
        },
        style: { width: NODE_INITIAL_WIDTH, minHeight: NODE_MIN_HEIGHT, ["--node-width" as string]: `${NODE_INITIAL_WIDTH}px` },
      };

      // Build the RF edge for immediate imperative update
      const newRFEdge: Edge = {
        id: `e-${newEdge.source}-${newEdge.target}-new`,
        source: newEdge.source,
        target: newEdge.target,
        ...(newEdge.sourceHandle ? { sourceHandle: newEdge.sourceHandle } : {}),
        ...(newEdge.targetHandle ? { targetHandle: newEdge.targetHandle } : {}),
        type: "todoFlow",
        style: EDGE_STYLE,
        interactionWidth: EDGE_INTERACTION_WIDTH,
        data: { arrow: true },
      };

      if (plane === "main") {
        currentPlaneAdd(baseTodo);
        onUpdateVisualFlow((prev) => ({
          ...prev,
          nodePositions: { ...(prev.nodePositions ?? {}), [baseTodo.id]: newPos },
          edges: [...(prev.edges ?? []), newEdge],
        }));
      } else if (isGrazeland) {
        const parentItem = canvasItems.find((t) => t.id === parentId);
        const parentHv = parentItem?.grazelandHandleVisibility ?? createGrazelandHandleVisibility(false);
        const newParentHv = parentHv.right2 ? parentHv : { ...parentHv, right2: true };
        if (!parentHv.right2) currentPlaneEdit?.(parentId, { grazelandHandleVisibility: newParentHv });
        currentPlaneAdd(baseTodo);
        onUpdateVisualFlow((prev) => ({
          ...prev,
          grazelandNodePositions: { ...(prev.grazelandNodePositions ?? {}), [baseTodo.id]: newPos },
          grazelandEdges: [...(prev.grazelandEdges ?? []), newEdge],
        }));
        setNodes((ns) => ns.map((n) => n.id === parentId
          ? { ...n, data: { ...(n.data as object), grazelandHandleVisibility: newParentHv } }
          : n
        ));
      } else if (isBin) {
        const parentItem = canvasItems.find((t) => t.id === parentId);
        const parentHv = parentItem?.grazelandHandleVisibility ?? createGrazelandHandleVisibility(false);
        const newParentHv = parentHv.right2 ? parentHv : { ...parentHv, right2: true };
        if (!parentHv.right2) currentPlaneEdit?.(parentId, { grazelandHandleVisibility: newParentHv });
        currentPlaneAdd(baseTodo);
        onUpdateVisualFlow((prev) => ({
          ...prev,
          binNodePositions: { ...(prev.binNodePositions ?? {}), [baseTodo.id]: newPos },
          binEdges: [...(prev.binEdges ?? []), newEdge],
        }));
        setNodes((ns) => ns.map((n) => n.id === parentId
          ? { ...n, data: { ...(n.data as object), grazelandHandleVisibility: newParentHv } }
          : n
        ));
      } else {
        // Custom plane: one atomic write — items + positions + edges + parent handle fix all together.
        // Read parent state from prev so a concurrent edit can't be lost.
        const parentItem = customPlaneItems.find((t) => t.id === parentId);
        const parentHv = parentItem?.grazelandHandleVisibility ?? createGrazelandHandleVisibility(false);
        const newParentHv = parentItem ? (parentHv.right2 ? parentHv : { ...parentHv, right2: true }) : null;
        onUpdateVisualFlow((prev) => {
          const updatedItems = (prev.customPlaneItems?.[plane] ?? []).map((t) => {
            if (t.id !== parentId || !newParentHv) return t;
            return { ...t, grazelandHandleVisibility: newParentHv };
          });
          return {
            ...prev,
            customPlaneItems: {
              ...(prev.customPlaneItems ?? {}),
              [plane]: [...updatedItems, baseTodo],
            },
            customPlaneNodePositions: {
              ...(prev.customPlaneNodePositions ?? {}),
              [plane]: { ...(prev.customPlaneNodePositions?.[plane] ?? {}), [baseTodo.id]: newPos },
            },
            customPlaneEdges: {
              ...(prev.customPlaneEdges ?? {}),
              [plane]: [...(prev.customPlaneEdges?.[plane] ?? []), newEdge],
            },
          };
        });
        if (newParentHv) {
          setNodes((ns) => ns.map((n) => n.id === parentId
            ? { ...n, data: { ...(n.data as object), grazelandHandleVisibility: newParentHv } }
            : n
          ));
        }
      }

      // Immediately add child node and edge to RF canvas (data writes above persist to storage via canvasSyncKey)
      setNodes((ns) => [...ns, newChildNode]);
      setEdges((es) => [...es, newRFEdge]);

      setNodeMenu(null);
      freshNodeIdsRef.current.add(baseTodo.id);
      setEditNodeId(baseTodo.id);
      onTodoLog?.(
        `${getVisualFlowPlaneLogLabel(plane)}: added connected sub-task to "${
          canvasItems.find((t) => t.id === parentId)?.text ?? parentId
        }"`
      );
    },
    [currentPlaneAdd, currentPlaneEdit, customPlaneItems, isCustomPlane, plane, onUpdateVisualFlow, onTodoLog, canvasItems, setNodes, setEdges]
  );

  // Move or duplicate the highlighted node(s) onto another plane (sheet).
  // Carries each node's text/fields, its live position + size, and any edges
  // internal to the selection (both endpoints moving). Item arrays for the
  // built-in planes live outside `visualFlow` (pillarTodos / grazelandItems /
  // binItems), so those go through onAdd*/onDelete*; everything inside
  // `visualFlow` (positions, edges, sizes, and custom-plane items) lands in ONE
  // functional onUpdateVisualFlow write to dodge the stale-closure clobber.
  const relocateItemsToPlane = useCallback(
    (ids: string[], target: VisualFlowPlane, mode: "move" | "duplicate") => {
      if (!ids.length || target === plane) return;
      const liveNodes = getNodes();
      const picked = ids
        .map((id) => {
          const item = canvasItems.find((t) => t.id === id);
          if (!item) return null;
          const live = liveNodes.find((n) => n.id === id);
          const p = live?.position ?? storedNodePositions?.[id] ?? { x: 0, y: 0 };
          return { item, pos: { x: p.x, y: p.y }, size: storedNodeSizes?.[id] };
        })
        .filter((x): x is { item: ShelfPillarTodoItem; pos: { x: number; y: number }; size: VisualFlowNodeSize | undefined } => Boolean(x));
      if (!picked.length) return;

      const movingIds = new Set(picked.map((p) => p.item.id));
      const internalEdges = (storedFlowEdges ?? []).filter(
        (e) => movingIds.has(e.source) && movingIds.has(e.target)
      );

      // Duplicate gets fresh ids (the original stays put); move keeps ids.
      const idMap = new Map<string, string>();
      for (const p of picked) idMap.set(p.item.id, mode === "duplicate" ? crypto.randomUUID() : p.item.id);
      const remap = (id: string) => idMap.get(id) ?? id;

      const newItems = picked.map((p) => ({ ...p.item, id: remap(p.item.id) }));
      const newPositions: Record<string, { x: number; y: number }> = {};
      const newSizes: Record<string, VisualFlowNodeSize> = {};
      for (const p of picked) {
        const nid = remap(p.item.id);
        newPositions[nid] = { ...p.pos };
        if (p.size) newSizes[nid] = p.size;
      }
      const newEdges: VisualFlowEdge[] = internalEdges.map((e) => ({
        ...e,
        source: remap(e.source),
        target: remap(e.target),
      }));
      const hasSizes = Object.keys(newSizes).length > 0;

      // 1) Target item-store add (built-in planes only; custom items ride the vf write).
      if (target === "main") newItems.forEach((it) => onAddTodo?.(it));
      else if (target === "grazeland") newItems.forEach((it) => onAddGrazelandItem?.(it));
      else if (target === "bin") newItems.forEach((it) => onAddBinItem?.(it));

      // 2) Source item-store removal on move (built-in planes only).
      if (mode === "move" && !isCustomPlane) {
        if (plane === "main") ids.forEach((id) => onDeleteTodo?.(id));
        else if (plane === "grazeland") ids.forEach((id) => onDeleteGrazelandItem?.(id));
        else if (plane === "bin") ids.forEach((id) => onDeleteBinItem?.(id));
      }

      // 3) One atomic visualFlow write — target positions/edges/sizes (+ custom items),
      //    then source removal of the same on a move.
      onUpdateVisualFlow((prev) => {
        const next: VisualFlowData = { ...prev };

        if (target === "main") {
          next.nodePositions = { ...(prev.nodePositions ?? {}), ...newPositions };
          next.edges = [...(prev.edges ?? []), ...newEdges];
        } else if (target === "grazeland") {
          next.grazelandNodePositions = { ...(prev.grazelandNodePositions ?? {}), ...newPositions };
          next.grazelandEdges = [...(prev.grazelandEdges ?? []), ...newEdges];
          if (hasSizes) next.grazelandNodeSizes = { ...(prev.grazelandNodeSizes ?? {}), ...newSizes };
        } else if (target === "bin") {
          next.binNodePositions = { ...(prev.binNodePositions ?? {}), ...newPositions };
          next.binEdges = [...(prev.binEdges ?? []), ...newEdges];
          if (hasSizes) next.binNodeSizes = { ...(prev.binNodeSizes ?? {}), ...newSizes };
        } else {
          next.customPlaneItems = {
            ...(prev.customPlaneItems ?? {}),
            [target]: [...(prev.customPlaneItems?.[target] ?? []), ...newItems],
          };
          next.customPlaneNodePositions = {
            ...(prev.customPlaneNodePositions ?? {}),
            [target]: { ...(prev.customPlaneNodePositions?.[target] ?? {}), ...newPositions },
          };
          next.customPlaneEdges = {
            ...(prev.customPlaneEdges ?? {}),
            [target]: [...(prev.customPlaneEdges?.[target] ?? []), ...newEdges],
          };
          if (hasSizes) {
            next.customPlaneNodeSizes = {
              ...(prev.customPlaneNodeSizes ?? {}),
              [target]: { ...(prev.customPlaneNodeSizes?.[target] ?? {}), ...newSizes },
            };
          }
        }

        if (mode === "move") {
          const rm = movingIds;
          const stripPos = (m?: Record<string, { x: number; y: number }>) =>
            m ? Object.fromEntries(Object.entries(m).filter(([k]) => !rm.has(k))) : m;
          const stripSize = (m?: Record<string, VisualFlowNodeSize>) =>
            m ? Object.fromEntries(Object.entries(m).filter(([k]) => !rm.has(k))) : m;
          const stripEdges = (es?: VisualFlowEdge[]) =>
            es ? es.filter((e) => !rm.has(e.source) && !rm.has(e.target)) : es;

          if (plane === "main") {
            next.nodePositions = stripPos(next.nodePositions);
            next.edges = stripEdges(next.edges);
          } else if (plane === "grazeland") {
            next.grazelandNodePositions = stripPos(next.grazelandNodePositions);
            next.grazelandEdges = stripEdges(next.grazelandEdges);
            next.grazelandNodeSizes = stripSize(next.grazelandNodeSizes);
          } else if (plane === "bin") {
            next.binNodePositions = stripPos(next.binNodePositions);
            next.binEdges = stripEdges(next.binEdges);
            next.binNodeSizes = stripSize(next.binNodeSizes);
          } else {
            next.customPlaneItems = {
              ...(next.customPlaneItems ?? {}),
              [plane]: (next.customPlaneItems?.[plane] ?? []).filter((t) => !rm.has(t.id)),
            };
            next.customPlaneNodePositions = {
              ...(next.customPlaneNodePositions ?? {}),
              [plane]: stripPos(next.customPlaneNodePositions?.[plane]) ?? {},
            };
            next.customPlaneEdges = {
              ...(next.customPlaneEdges ?? {}),
              [plane]: stripEdges(next.customPlaneEdges?.[plane]) ?? [],
            };
            const curSizes = next.customPlaneNodeSizes?.[plane];
            if (curSizes) {
              next.customPlaneNodeSizes = {
                ...(next.customPlaneNodeSizes ?? {}),
                [plane]: stripSize(curSizes)!,
              };
            }
          }
        }

        return next;
      });

      setNodeMenu(null);
      const targetName =
        target === "main" ? "Main"
          : target === "grazeland" ? "Grazeland"
            : target === "bin" ? "Bin"
              : visualFlow.customPlanes?.find((pl) => pl.id === target)?.name ?? "sheet";
      onTodoLog?.(
        `${getVisualFlowPlaneLogLabel(plane)}: ${mode === "move" ? "moved" : "duplicated"} ${picked.length} ${picked.length === 1 ? "item" : "items"} to ${targetName}`
      );
      setExportToast(`${mode === "move" ? "Moved" : "Duplicated"} ${picked.length} ${picked.length === 1 ? "item" : "items"} to ${targetName}`);
      if (exportToastTimerRef.current !== null) window.clearTimeout(exportToastTimerRef.current);
      exportToastTimerRef.current = window.setTimeout(() => {
        setExportToast(null);
        exportToastTimerRef.current = null;
      }, 2200);
    },
    [
      plane, isCustomPlane, canvasItems, storedNodePositions, storedNodeSizes, storedFlowEdges,
      getNodes, onAddTodo, onAddGrazelandItem, onAddBinItem, onDeleteTodo, onDeleteGrazelandItem,
      onDeleteBinItem, onUpdateVisualFlow, onTodoLog, visualFlow.customPlanes,
    ]
  );

  const applySectorColorByName = useCallback(
    (sectorName: string, color: SectorColorKey | undefined) => {
      const trimmed = sectorName.trim();
      if (!trimmed) return;
      hasInteracted.current = true;
      onUpdateVisualFlow((prev) => {
        const nextMap = { ...(prev.sectorColors ?? {}) };
        if (color) nextMap[trimmed] = color;
        else delete nextMap[trimmed];
        return { ...prev, sectorColors: nextMap };
      });
      const patch = color ? { sectorColor: color } : { sectorColor: undefined };
      for (const t of todos) {
        if (t.sectorName?.trim() !== trimmed) continue;
        onEditTodo?.(t.id, patch);
      }
      for (const t of grazelandItems) {
        if (t.sectorName?.trim() !== trimmed) continue;
        onEditGrazelandItem?.(t.id, patch);
      }
      for (const t of binItems) {
        if (t.sectorName?.trim() !== trimmed) continue;
        onEditBinItem?.(t.id, patch);
      }
      onTodoLog?.(
        color
          ? `Visual Flow: sector "${trimmed}" frame color → ${color} (all matching canvas entries)`
          : `Visual Flow: cleared sector "${trimmed}" frame color (all matching canvas entries)`
      );
    },
    [binItems, grazelandItems, onEditBinItem, onEditGrazelandItem, onEditTodo, onTodoLog, onUpdateVisualFlow, todos]
  );

  const handleRenameSectorGroup = useCallback(
    (oldName: string, ids: string[]) => {
      const next = window.prompt(`Rename sector`, oldName);
      if (next === null) return;
      const trimmed = next.trim();
      hasInteracted.current = true;
      onUpdateVisualFlow((prev) => {
        const nextSc = { ...(prev.sectorColors ?? {}) };
        if (nextSc[oldName] !== undefined) {
          const c = nextSc[oldName];
          delete nextSc[oldName];
          if (trimmed) nextSc[trimmed] = c;
        }
        return { ...prev, sectorColors: nextSc };
      });
      ids.forEach((id) => {
        currentPlaneEdit?.(id, { sectorName: trimmed || undefined });
      });
      const label = getVisualFlowPlaneLogLabel(plane);
      const n = ids.length;
      const u = getVisualFlowPlaneCountLabel(plane, n);
      onTodoLog?.(`${label}: renamed sector "${oldName}" → "${trimmed || "—"}" (${n} ${u})`);
    },
    [currentPlaneEdit, onTodoLog, onUpdateVisualFlow, plane]
  );

  const handleClearSectorGroup = useCallback(
    (name: string, ids: string[]) => {
      if (
        !window.confirm(
          `Remove sector "${name}" from ${ids.length} ${plane === "main" ? "tasks" : "items"}?`
        )
      )
        return;
      hasInteracted.current = true;
      ids.forEach((id) => {
        currentPlaneEdit?.(id, { sectorName: undefined, sectorColor: undefined });
      });
      const willRemainElsewhere = [...todos, ...grazelandItems, ...binItems].some(
        (t) => t.sectorName?.trim() === name && !ids.includes(t.id)
      );
      onUpdateVisualFlow((prev) => {
        const nextSc = { ...(prev.sectorColors ?? {}) };
        if (!willRemainElsewhere) delete nextSc[name];
        return { ...prev, sectorColors: nextSc };
      });
      const label = getVisualFlowPlaneLogLabel(plane);
      onTodoLog?.(`${label}: removed sector "${name}" from ${ids.length} ${getVisualFlowPlaneCountLabel(plane, ids.length)}`);
      setSectorManagerOpen(false);
    },
    [binItems, currentPlaneEdit, grazelandItems, onTodoLog, onUpdateVisualFlow, plane, todos]
  );

  const handleEdit = useCallback(
    (id: string) => {
      setNodeMenu(null);
      setEditNodeId(id);
    },
    []
  );

  const handleDelete = useCallback(
    (id: string) => {
      const todo = canvasItems.find((t) => t.id === id);
      const noun = plane === "main" ? "task" : "item";
      const label = todo?.text ? `"${todo.text}"` : `this ${noun}`;
      if (!window.confirm(`Remove ${label}? This will clear it from your list.`)) return;
      if (!window.confirm(`Are you sure? This cannot be undone.`)) return;
      setNodeMenu(null);
      setEditNodeId(null);
      currentPlaneDelete?.(id);
      if (todo) {
        onTodoLog?.(`${getVisualFlowPlaneLogLabel(plane)}: removed ${noun} "${todo.text}"`);
      }
      hasInteracted.current = true;
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      setNodes((ns) => ns.filter((n) => n.id !== id));
    },
    [canvasItems, currentPlaneDelete, onTodoLog, plane, setEdges, setNodes]
  );

  /** Single-confirm bulk delete used by the Backspace/Delete keyboard shortcut. */
  const handleBackspaceDelete = useCallback(
    (ids: string[]) => {
      if (ids.length === 0 || !currentPlaneDelete) return;
      const noun = plane === "main" ? "task" : "item";
      const label =
        ids.length === 1
          ? (() => {
              const t = canvasItems.find((c) => c.id === ids[0]);
              return t?.text ? `"${t.text}"` : `this ${noun}`;
            })()
          : `${ids.length} ${noun}${ids.length === 1 ? "" : "s"}`;
      if (!window.confirm(`Remove ${label}? This cannot be undone.`)) return;
      setNodeMenu(null);
      setEditNodeId(null);
      hasInteracted.current = true;
      for (const id of ids) {
        const t = canvasItems.find((c) => c.id === id);
        currentPlaneDelete(id);
        if (t) {
          onTodoLog?.(`${getVisualFlowPlaneLogLabel(plane)}: removed ${noun} "${t.text}"`);
        }
      }
      const idSet = new Set(ids);
      setEdges((eds) => eds.filter((e) => !idSet.has(e.source) && !idSet.has(e.target)));
      setNodes((ns) => ns.filter((n) => !idSet.has(n.id)));
    },
    [canvasItems, currentPlaneDelete, onTodoLog, plane, setEdges, setNodes]
  );

  // Backspace / Delete on selected nodes — confirmation then delete. Skips when
  // focus is in an editable field so native input erase still works.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      const a = document.activeElement;
      if (a instanceof HTMLElement) {
        const tag = a.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || a.isContentEditable) return;
      }
      const ids = getNodes()
        .filter((n) => n.selected)
        .map((n) => String(n.id));
      if (ids.length === 0) return;
      e.preventDefault();
      handleBackspaceDelete(ids);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [getNodes, handleBackspaceDelete]);

  const handleMarkCompleted = useCallback(
    (id: string) => {
      const canComplete = currentPlaneDelete;
      if (!canComplete || completingIdsRef.current.has(id)) return;
      const todo = canvasItems.find((t) => t.id === id);
      if (!todo) return;
      completingIdsRef.current.add(id);
      setNodeMenu(null);
      setEditNodeId(null);
      hasInteracted.current = true;
      setNodes((ns) =>
        ns.map((n) =>
          n.id === id
            ? {
                ...n,
                className: "shelf-flow-node-exiting",
                data: { ...(n.data as object), completing: true },
              }
            : n
        )
      );
      window.setTimeout(() => {
        completingIdsRef.current.delete(id);
        currentPlaneDelete?.(id);
        onTaskCompleted?.();
        onTodoLog?.(`${getVisualFlowPlaneLogLabel(plane)}: completed ${getVisualFlowPlaneCountLabel(plane, 1)} ${todo.text}`);
        setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
        setNodes((ns) => ns.filter((n) => n.id !== id));
      }, COMPLETE_EXIT_MS);
    },
    [
      canvasItems,
      currentPlaneDelete,
      onTaskCompleted,
      onTodoLog,
      plane,
      setEdges,
      setNodes,
    ]
  );

  const handleBulkMarkCompleted = useCallback(
    (ids: string[]) => {
      const canComplete = currentPlaneDelete;
      if (!canComplete || ids.length === 0) return;
      const valid = ids.filter((id) => {
        const t = canvasItems.find((x) => x.id === id);
        return t && !t.done && !completingIdsRef.current.has(id);
      });
      if (valid.length === 0) return;
      valid.forEach((id) => completingIdsRef.current.add(id));
      setNodeMenu(null);
      setEditNodeId(null);
      hasInteracted.current = true;
      setNodes((ns) =>
        ns.map((n) =>
          valid.includes(n.id)
            ? {
                ...n,
                className: "shelf-flow-node-exiting",
                data: { ...(n.data as object), completing: true },
              }
            : n
        )
      );
      window.setTimeout(() => {
        valid.forEach((id) => completingIdsRef.current.delete(id));
        valid.forEach((id) => {
          currentPlaneDelete?.(id);
        });
        onTaskCompleted?.();
        onTodoLog?.(`${getVisualFlowPlaneLogLabel(plane)}: completed ${valid.length} ${getVisualFlowPlaneCountLabel(plane, valid.length)} (bulk)`);
        setEdges((eds) =>
          eds.filter((e) => !valid.includes(e.source) && !valid.includes(e.target))
        );
        setNodes((ns) => ns.filter((n) => !valid.includes(n.id)));
      }, COMPLETE_EXIT_MS);
    },
    [
      canvasItems,
      currentPlaneDelete,
      onTaskCompleted,
      onTodoLog,
      plane,
      setEdges,
      setNodes,
    ]
  );

  const handleBulkSetBlockStatus = useCallback(
    (ids: string[], status: ShelfTodoBlockStatus) => {
      const canEdit = currentPlaneEdit;
      if (!canEdit || ids.length === 0) return;
      setNodeMenu(null);
      hasInteracted.current = true;
      ids.forEach((id) => {
        currentPlaneEdit?.(id, { blockStatus: status });
      });
      const n = ids.length;
      const unit = getVisualFlowPlaneCountLabel(plane, n);
      onTodoLog?.(`${getVisualFlowPlaneLogLabel(plane)}: set status to ${status} for ${n} ${unit}`);
    },
    [currentPlaneEdit, onTodoLog, plane]
  );

  const handleBulkSetSector = useCallback(
    (ids: string[], sectorName: string | undefined) => {
      const canEdit = currentPlaneEdit;
      if (!canEdit || ids.length === 0) return;
      setNodeMenu(null);
      hasInteracted.current = true;
      const trimmed = sectorName?.trim() ?? "";
      const patch: Partial<ShelfPillarTodoItem> = trimmed
        ? {
            sectorName: trimmed,
            sectorColor: visualFlow.sectorColors?.[trimmed],
          }
        : { sectorName: undefined, sectorColor: undefined };
      ids.forEach((id) => {
        currentPlaneEdit?.(id, patch);
      });
      const n = ids.length;
      const unit = getVisualFlowPlaneCountLabel(plane, n);
      onTodoLog?.(`${getVisualFlowPlaneLogLabel(plane)}: set sector to ${trimmed || "(none)"} for ${n} ${unit}`);
    },
    [currentPlaneEdit, onTodoLog, plane, visualFlow.sectorColors]
  );

  const handleBulkSetTint = useCallback(
    (ids: string[], color: SectorColorKey | undefined) => {
      if (!currentPlaneEdit || ids.length === 0) return;
      setNodeMenu(null);
      hasInteracted.current = true;
      ids.forEach((id) => {
        currentPlaneEdit?.(id, { sectorColor: color });
      });
      const n = ids.length;
      const unit = getVisualFlowPlaneCountLabel(plane, n);
      onTodoLog?.(`${getVisualFlowPlaneLogLabel(plane)}: set tint to ${color ?? "(none)"} for ${n} ${unit}`);
    },
    [currentPlaneEdit, onTodoLog, plane]
  );

  const handleToggleFocus = useCallback(
    (id: string) => {
      // Works on every plane — the node menu always targets the current canvas,
      // so currentPlaneEdit writes focus to the right items array (which is
      // persisted and included in the backup export).
      const todo = canvasItems.find((t) => t.id === id);
      if (!todo) return;
      const nextFocused = !todo.focused;
      currentPlaneEdit?.(id, { focused: nextFocused });
      // Pillar pins mirror only the main canvas' focused todos.
      if (plane === "main" && !focusDesynced && setPillarTodoPins) {
        const nextFocusedIds = todos
          .map((t) => (t.id === id ? { ...t, focused: nextFocused } : t))
          .filter((t) => t.focused)
          .map((t) => t.id)
          .slice(0, MAX_PILLAR_TODO_PINS);
        setPillarTodoPins(nextFocusedIds);
      }
      setNodeMenu(null);
    },
    [canvasItems, currentPlaneEdit, plane, todos, focusDesynced, setPillarTodoPins]
  );

  const scheduleDrawerClose = useCallback(() => {
    if (drawerFrozen || drawerMenu || dockedAlways) return;
    const now = Date.now();
    if (stickOutUntilRef.current && now < stickOutUntilRef.current) return;
    if (drawerCloseTimeoutRef.current !== null) window.clearTimeout(drawerCloseTimeoutRef.current);
    // Gentler linger so the drawer doesn't snap shut on a small mouse slip.
    const delay = drawerPinned ? 5000 : 450;
    drawerCloseTimeoutRef.current = window.setTimeout(() => {
      setDrawerOpen(false);
      setDrawerPinned(false);
      stickOutUntilRef.current = null;
      drawerCloseTimeoutRef.current = null;
    }, delay);
  }, [drawerPinned, drawerFrozen, drawerMenu, dockedAlways]);

  const cancelDrawerClose = useCallback(() => {
    if (drawerCloseTimeoutRef.current !== null) {
      window.clearTimeout(drawerCloseTimeoutRef.current);
      drawerCloseTimeoutRef.current = null;
    }
  }, []);

  const handleDrawerTriggerEnter = useCallback(() => {
    cancelDrawerClose();
    setDrawerOpen(true);
  }, [cancelDrawerClose]);

  const handleDrawerTriggerLeave = useCallback(() => {
    scheduleDrawerClose();
  }, [scheduleDrawerClose]);

  const handleDrawerEnter = useCallback(() => {
    cancelDrawerClose();
    setDrawerOpen(true);
  }, [cancelDrawerClose]);

  const handleDrawerLeave = useCallback(() => {
    scheduleDrawerClose();
  }, [scheduleDrawerClose]);

  const handleDrawerClick = useCallback(() => {
    stickOutUntilRef.current = Date.now() + 10000;
    cancelDrawerClose();
  }, [cancelDrawerClose]);

  const handleDrawerClose = useCallback(() => {
    setDrawerOpen(false);
    setDrawerPinned(false);
    setDrawerFrozen(false);
    setDrawerMenu(null);
    stickOutUntilRef.current = null;
    cancelDrawerClose();
  }, [cancelDrawerClose]);

  const handleDrawerToggleFreeze = useCallback(() => {
    const nextFrozen = !drawerFrozen;
    setDrawerFrozen(nextFrozen);
    setDrawerOpen(nextFrozen);
    setDrawerPinned(nextFrozen);
    setDrawerMenu(null);
    cancelDrawerClose();
  }, [cancelDrawerClose, drawerFrozen]);

  useEffect(() => {
    return () => {
      if (drawerCloseTimeoutRef.current !== null) window.clearTimeout(drawerCloseTimeoutRef.current);
    };
  }, []);

  // Dock the focus drawer permanently on wide screens (> 1920px) so it lives in
  // the spare right-hand space instead of behind the hover handle.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 1921px)");
    const update = () => setDockedAlways(mq.matches && showFocusDrawer);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [showFocusDrawer]);

  // After a cross-plane jump, pan to the target node once it has mounted on the
  // newly-active plane. Guarded by the ref so it only fires for a pending jump.
  useEffect(() => {
    if (!pendingPanRef.current) return;
    const id = pendingPanRef.current;
    const raf = requestAnimationFrame(() => {
      if (getNodes().some((n) => n.id === id)) {
        panToNode(id);
        pendingPanRef.current = null;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [nodes, plane, getNodes, panToNode]);

  const drawerVisible = showFocusDrawer && (drawerOpen || dockedAlways);

  // Decouple the (potentially heavy) content mount from the slide so the panel
  // glides in smoothly instead of stuttering while React mounts the task list:
  //   • on open  → mount content first, then start the slide two frames later
  //     (so the freshly-mounted DOM is painted before the transform animates).
  //   • on close → slide out first, unmount only after the transition finishes.
  // `drawerSlideIn` drives the translate (panel + canvas + handle); `drawerMounted`
  // gates the content.
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [drawerSlideIn, setDrawerSlideIn] = useState(false);
  useEffect(() => {
    if (drawerVisible) {
      setDrawerMounted(true);
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setDrawerSlideIn(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    setDrawerSlideIn(false);
    const t = window.setTimeout(() => setDrawerMounted(false), FOCUS_DRAWER_SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [drawerVisible]);

  // ---- Focus drawer: cross-plane task helpers ----
  // Edit / delete an item on any plane (not just the active one).
  const editItemInPlane = useCallback(
    (planeId: VisualFlowPlane, id: string, updates: Partial<ShelfPillarTodoItem>) => {
      if (planeId === "main") return onEditTodo?.(id, updates);
      if (planeId === "grazeland") return onEditGrazelandItem?.(id, updates);
      if (planeId === "bin") return onEditBinItem?.(id, updates);
      onUpdateVisualFlow((prev) => ({
        ...prev,
        customPlaneItems: {
          ...(prev.customPlaneItems ?? {}),
          [planeId]: (prev.customPlaneItems?.[planeId] ?? []).map((t) =>
            t.id === id ? applyTodoUpdate(t, updates) : t
          ),
        },
      }));
    },
    [onEditTodo, onEditGrazelandItem, onEditBinItem, onUpdateVisualFlow]
  );

  const deleteItemInPlane = useCallback(
    (planeId: VisualFlowPlane, id: string) => {
      if (planeId === "main") return onDeleteTodo?.(id);
      if (planeId === "grazeland") return onDeleteGrazelandItem?.(id);
      if (planeId === "bin") return onDeleteBinItem?.(id);
      onUpdateVisualFlow((prev) => ({
        ...prev,
        customPlaneItems: {
          ...(prev.customPlaneItems ?? {}),
          [planeId]: (prev.customPlaneItems?.[planeId] ?? []).filter((t) => t.id !== id),
        },
      }));
    },
    [onDeleteTodo, onDeleteGrazelandItem, onDeleteBinItem, onUpdateVisualFlow]
  );

  // Complete a focused task. On the active plane reuse the animated removal;
  // off-plane just remove it (no mounted node to animate) and log it.
  const completeFocusedTask = useCallback(
    (planeId: VisualFlowPlane, id: string, text: string) => {
      if (planeId === plane) {
        handleMarkCompleted(id);
        return;
      }
      deleteItemInPlane(planeId, id);
      onTaskCompleted?.();
      onTodoLog?.(`${getVisualFlowPlaneLogLabel(planeId)}: completed ${getVisualFlowPlaneCountLabel(planeId, 1)} ${text}`);
    },
    [plane, handleMarkCompleted, deleteItemInPlane, onTaskCompleted, onTodoLog]
  );

  // Switch to a task's plane (if needed) and center the canvas on its node.
  const jumpToTask = useCallback(
    (planeId: VisualFlowPlane, id: string) => {
      if (planeId === plane) {
        panToNode(id);
        return;
      }
      pendingPanRef.current = id;
      switchPlane(planeId);
    },
    [plane, panToNode, switchPlane]
  );

  const toggleFocusExpanded = useCallback(
    (id: string) => {
      onUpdateVisualFlow((prev) => {
        const set = new Set(prev.focusExpandedIds ?? []);
        if (set.has(id)) set.delete(id);
        else set.add(id);
        return { ...prev, focusExpandedIds: Array.from(set) };
      });
    },
    [onUpdateVisualFlow]
  );

  const toggleFocusGroup = useCallback(
    (planeId: string) => {
      onUpdateVisualFlow((prev) => {
        const set = new Set(prev.focusCollapsedGroups ?? []);
        if (set.has(planeId)) set.delete(planeId);
        else set.add(planeId);
        return { ...prev, focusCollapsedGroups: Array.from(set) };
      });
    },
    [onUpdateVisualFlow]
  );

  // Focused tasks aggregated across every plane, grouped by plane (empty groups dropped).
  const focusGroups = useMemo(() => {
    const groups: { id: VisualFlowPlane; label: string; color?: string; items: ShelfPillarTodoItem[] }[] = [
      { id: "main", label: "Main canvas", color: undefined, items: todos },
      { id: "grazeland", label: "Grazeland", color: "var(--hue-orange)", items: grazelandItems },
      { id: "bin", label: "Bin", color: "var(--hue-blue)", items: binItems },
      ...(visualFlow.customPlanes ?? []).map((cp) => ({
        id: cp.id as VisualFlowPlane,
        label: cp.name,
        color: cp.color,
        items: visualFlow.customPlaneItems?.[cp.id] ?? [],
      })),
    ];
    return groups
      .map((g) => ({ ...g, items: g.items.filter((t) => t.focused) }))
      .filter((g) => g.items.length > 0);
  }, [todos, grazelandItems, binItems, visualFlow.customPlanes, visualFlow.customPlaneItems]);

  const focusExpandedSet = useMemo(() => new Set(visualFlow.focusExpandedIds ?? []), [visualFlow.focusExpandedIds]);
  const focusCollapsedGroupSet = useMemo(() => new Set(visualFlow.focusCollapsedGroups ?? []), [visualFlow.focusCollapsedGroups]);

  const containerClass = fullPage
    ? "min-w-0 rounded-2xl border border-white/10 bg-zinc-900/50 flex flex-col h-[calc(100vh-9rem)] overflow-hidden"
    : "mt-3 min-w-0 rounded-2xl border border-white/10 bg-black/20 p-3";

  const onEdgeContextMenuHandler = useCallback(
    (e: React.MouseEvent, edge: Edge) => {
      e.preventDefault();
      setNodeMenu(null);
      setPaneMenu(null);
      setEdgeMenu({ edgeId: edge.id, x: e.clientX, y: e.clientY });
    },
    []
  );

  return (
    <div
      className={`shelf-error-dashboard ${containerClass}`}
      style={{ paddingRight: dockedAlways ? "21.75rem" : undefined }}
    >
      {/* Toolbar row: title · Copy-for-AI · (margin-left:auto) search · ⛺ Camps.
          Plane switching lives in the bottom sheet tabs (.shelf-vf-sheets), so the
          top plane switcher was removed to keep this row to the four reference items. */}
      <div className="nf-bar shrink-0">
        <h1 className="nf-bar-title">Visual Flow of Action</h1>
        <button
          type="button"
          className="ghost-btn"
          onClick={handleExportForAI}
          title="Copy a structured markdown of the current plane's tasks + relationships to the clipboard, ready to paste into an AI for consolidation"
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy for AI
          {exportToast && (
            <span className="ml-1 text-[10.5px] text-[var(--accent-bright)]">· {exportToast}</span>
          )}
        </button>
        <div className="vf-search">
            <svg className="vf-search-ico" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && searchQuery) {
                  e.stopPropagation();
                  setSearchQuery("");
                }
              }}
              placeholder="Search nodes…"
              aria-label="Search nodes on this canvas"
              className="vf-search-in"
            />
            {searchQuery && (
              <button
                type="button"
                className="vf-search-x"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                title="Clear (Esc)"
              >
                ×
              </button>
            )}
            {searchMatchingIds && (
              <span className="vf-search-n" aria-live="polite">{searchMatchingIds.size}</span>
            )}
            {searchQuery.trim() && (
              <div className="vf-search-results" role="listbox" aria-label="Search results">
                <div className="vf-search-results-head">
                  {searchResults.length > 0
                    ? `${searchResults.length} match${searchResults.length === 1 ? "" : "es"} for “${searchQuery.trim()}”`
                    : `No matches for “${searchQuery.trim()}”`}
                </div>
                {searchResults.length > 0 && (
                  <div className="vf-search-results-list">
                    {searchResults.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        role="option"
                        aria-selected={focusedNodeId === t.id}
                        className={`vf-search-result${focusedNodeId === t.id ? " on" : ""}`}
                        onClick={() => panToNode(t.id)}
                        title="Jump to this node"
                      >
                        <span className="vf-search-result-title">{t.text?.trim() || "Untitled"}</span>
                        {(t.tag || t.sectorName) && (
                          <span className="vf-search-result-meta">{t.tag || t.sectorName}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        {onOpenCamps && (
          <button
            type="button"
            className="ghost-btn nf-camps"
            onClick={onOpenCamps}
            title="Flip up to the campsite layer — your top goals down the road"
          >
            ⛺ Camps
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 px-6 pt-6 pb-0 overflow-x-hidden flex flex-col">
          <section
            className="flex flex-col flex-1 min-h-0 min-w-0 shelf-flow-canvas-transition"
            style={{ marginRight: drawerSlideIn && !dockedAlways ? FOCUS_DRAWER_CARD_MARGIN : 0 }}
          >
            <div
              className={`relative overflow-hidden flex-1 min-h-[280px] rounded-xl border visual-flow-canvas shelf-flow-canvas-transition${
                plane === "grazeland" ? " visual-flow-canvas--graze" : plane === "bin" ? " visual-flow-canvas--bin" : ""
              }${dockedAlways ? " visual-flow-canvas--docked" : ""} ${plane === "main" ? "border-white/10" : planeMeta?.canvasClass ?? "border-white/10"}`}
              style={{ transform: drawerSlideIn && !dockedAlways ? `translateX(${FOCUS_DRAWER_CANVAS_TRANSLATE})` : "translateX(0)" }}
            >
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                connectionMode={plane === "main" ? ConnectionMode.Strict : ConnectionMode.Loose}
                connectionLineStyle={{
                  stroke: "#0070f2",
                  strokeWidth: 2.5,
                  strokeDasharray: "9 11",
                  strokeLinecap: "round",
                }}
                onNodesChange={(ch) => {
                  hasInteracted.current = true;
                  onNodesChange(ch);
                }}
                onEdgesChange={(ch) => {
                  hasInteracted.current = true;
                  onEdgesChange(ch);
                }}
                onConnect={onConnect}
                onNodeClick={(_, node) => setFocusedNodeId((prev) => prev === node.id ? null : node.id)}
                onPaneClick={() => setFocusedNodeId(null)}
                onNodeDragStop={onNodeDragStop}
                onNodeContextMenu={onNodeContextMenu}
                onSelectionContextMenu={onSelectionContextMenu}
                onPaneContextMenu={onPaneContextMenu}
                onEdgeContextMenu={onEdgeContextMenuHandler}
                onEdgeClick={() => {}}
                selectionKeyCode={["Control", "Meta"]}
                multiSelectionKeyCode={["Shift"]}
                selectionMode={SelectionMode.Partial}
                deleteKeyCode={null}
                onMoveEnd={(_, vp) => {
                  onUpdateVisualFlow((prev) => ({
                    ...prev,
                    planeViewports: { ...(prev.planeViewports ?? {}), [plane]: vp },
                  }));
                }}
                defaultEdgeOptions={{
                  type: "todoFlow",
                  style: EDGE_STYLE,
                  interactionWidth: EDGE_INTERACTION_WIDTH,
                  data: { arrow: false, doubled: false },
                }}
                className="visual-flow-react-flow"
                proOptions={{ hideAttribution: true }}
                minZoom={0.2}
                maxZoom={2}
              >
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={26}
                  size={1}
                  className="shelf-vf-dots"
                />
                {plane === "main" && showCanvasBlockers && (
                  <ViewportPortal>
                    {(visualFlow.blockers ?? []).map((b) => {
                      const pos = blockerDrag && blockerDrag.id === b.id ? blockerDrag : { x: b.x ?? 0, y: b.y ?? 0 };
                      return (
                        <BlockerNode
                          key={b.id}
                          blocker={{ ...b, x: pos.x, y: pos.y }}
                          now={blockerNow}
                          dragging={blockerDrag?.id === b.id}
                          onPointerDown={(e) => onBlockerPointerDown(e, b)}
                          onEdit={(e) => setBlockerMenu({ id: b.id, x: e.clientX, y: e.clientY })}
                          onClear={() => removeBlocker(b.id)}
                        />
                      );
                    })}
                  </ViewportPortal>
                )}
              </ReactFlow>
              {canvasItems.length === 0 && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4">
                  <p className="text-sm text-zinc-400">
                    {plane === "main"
                      ? "Right-click on the canvas to create a task, or add todos in the Pillar."
                      : planeMeta?.emptyState}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Drag nodes to arrange. Ctrl+drag to select several. Right-click a selected node or the canvas with
                    multiple nodes selected for bulk status and actions.
                  </p>
                </div>
              )}
              <DoingNow
                {...doingPipeline.drawerProps}
                onContextMenu={(e) => { e.preventDefault(); setDoingMenu({ x: e.clientX, y: e.clientY }); }}
              />
              {/* "Edit task" editor — overlays only the canvas (opened from a Doing-now task) */}
              {taskEditor && (() => {
                const pk = taskEditor.plane;
                const list =
                  pk === "main" ? todos
                  : pk === "grazeland" ? grazelandItems
                  : pk === "bin" ? binItems
                  : (visualFlow.customPlaneItems?.[pk] ?? []);
                const t = list.find((x) => x.id === taskEditor.id);
                if (!t) return null;
                const meta = doingPlaneMeta(pk, visualFlow.customPlanes ?? []);
                return (
                  <DoingTaskEditor
                    task={t}
                    planeLabel={meta.label}
                    planeColor={meta.color}
                    onSave={(updates) => editItemInPlane(pk as VisualFlowPlane, taskEditor.id, updates)}
                    onJump={() => {
                      const id = taskEditor.id;
                      setTaskEditor(null);
                      if (pk !== plane) {
                        switchPlane(pk);
                        window.setTimeout(() => panToNode(id), 220);
                      } else {
                        panToNode(id);
                      }
                    }}
                    onClose={() => setTaskEditor(null)}
                  />
                );
              })()}
            </div>

            {/* Sheet tabs — Excel-style, outside/below the canvas */}
            <div className="shelf-vf-sheets" role="tablist" aria-label="Canvas sheet">
              <button
                type="button"
                role="tab"
                aria-selected={plane === "main"}
                className={`shelf-vf-sheet-tab${plane === "main" ? " on" : ""}`}
                onClick={() => switchPlane("main")}
              >
                <span className="shelf-vf-sheet-name">Main canvas</span>
              </button>
              {SPECIAL_VISUAL_FLOW_PLANES.map((sp) => (
                <button
                  key={sp}
                  type="button"
                  role="tab"
                  aria-selected={plane === sp}
                  className={`shelf-vf-sheet-tab${plane === sp ? " on " + sp : ""}`}
                  onClick={() => switchPlane(sp)}
                >
                  <span className="shelf-vf-sheet-name">
                    {sp === "grazeland" ? "Grazeland" : "Bin"}
                  </span>
                </button>
              ))}
              {(visualFlow.customPlanes ?? []).map((cp) => (
                <div
                  key={cp.id}
                  role="tab"
                  aria-selected={plane === cp.id}
                  data-colored={cp.color ? "" : undefined}
                  data-dragging={draggingPlaneId === cp.id ? "" : undefined}
                  data-drop-before={planeDropHint?.id === cp.id && planeDropHint.place === "before" ? "" : undefined}
                  data-drop-after={planeDropHint?.id === cp.id && planeDropHint.place === "after" ? "" : undefined}
                  style={cp.color ? ({ "--plane-hue": cp.color } as React.CSSProperties) : undefined}
                  className={`shelf-vf-sheet-tab shelf-vf-sheet-tab--custom${plane === cp.id ? " on" : ""}`}
                  draggable={renamingPlaneId !== cp.id}
                  onClick={() => { if (renamingPlaneId !== cp.id) switchPlane(cp.id); }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setRenamingPlaneId(cp.id);
                    setRenameValue(cp.name);
                  }}
                  onDragStart={(e) => {
                    setDraggingPlaneId(cp.id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("application/x-shelf-plane", cp.id);
                  }}
                  onDragOver={(e) => {
                    if (!draggingPlaneId || draggingPlaneId === cp.id) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    const place: "before" | "after" = e.clientX < rect.left + rect.width / 2 ? "before" : "after";
                    setPlaneDropHint({ id: cp.id, place });
                  }}
                  onDragLeave={(e) => {
                    const related = e.relatedTarget as globalThis.Node | null;
                    if (related && e.currentTarget.contains(related)) return;
                    setPlaneDropHint((h) => (h?.id === cp.id ? null : h));
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggingPlaneId && draggingPlaneId !== cp.id) {
                      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                      const place: "before" | "after" = e.clientX < rect.left + rect.width / 2 ? "before" : "after";
                      commitReorderPlane(draggingPlaneId, cp.id, place);
                    }
                    setDraggingPlaneId(null);
                    setPlaneDropHint(null);
                  }}
                  onDragEnd={() => {
                    setDraggingPlaneId(null);
                    setPlaneDropHint(null);
                  }}
                >
                  {cp.color && <span className="shelf-vf-sheet-dot" aria-hidden />}
                  {renamingPlaneId === cp.id ? (
                    <>
                      <input
                        className="shelf-vf-sheet-rename-input"
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            commitRenamePlane(cp.id, renameValue);
                            setRenamingPlaneId(null);
                          } else if (e.key === "Escape") {
                            setRenamingPlaneId(null);
                          }
                        }}
                        onBlur={() => {
                          commitRenamePlane(cp.id, renameValue);
                          setRenamingPlaneId(null);
                        }}
                      />
                      <div
                        className="shelf-vf-sheet-palette"
                        // keep focus on the input so its onBlur commit isn't fired
                        // before the swatch click lands
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {CUSTOM_PLANE_COLORS.map((c) => (
                          <button
                            key={c.key}
                            type="button"
                            className={`shelf-vf-swatch${cp.color === c.value ? " on" : ""}`}
                            style={{ background: c.value }}
                            title={c.key}
                            aria-label={`Color ${c.key}`}
                            onClick={() => commitPlaneColor(cp.id, cp.color === c.value ? null : c.value)}
                          />
                        ))}
                        {cp.color && (
                          <button
                            type="button"
                            className="shelf-vf-swatch shelf-vf-swatch--clear"
                            title="Clear color"
                            aria-label="Clear color"
                            onClick={() => commitPlaneColor(cp.id, null)}
                          />
                        )}
                      </div>
                    </>
                  ) : (
                    <span className="shelf-vf-sheet-name">{cp.name}</span>
                  )}
                  <button
                    type="button"
                    className="shelf-vf-sheet-del"
                    title="Delete sheet"
                    onClick={(e) => { e.stopPropagation(); setDeletePlanePending(cp.id); }}
                    tabIndex={-1}
                  >
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="shelf-vf-sheet-add"
                title="Add new plane"
                onClick={() => setNewPlaneDialog({ open: true, value: "" })}
                aria-label="Add sheet"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
              </button>
            </div>

            {/* New plane dialog */}
            {newPlaneDialog.open && (
              <div
                className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40"
                onClick={() => setNewPlaneDialog({ open: false, value: "" })}
              >
                <div
                  className="shelf-note-popover w-64 rounded-xl border border-white/10 bg-zinc-900 p-4 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">New plane</div>
                  <input
                    ref={newPlaneInputRef}
                    autoFocus
                    className="fld w-full mb-3"
                    placeholder="Plane name…"
                    value={newPlaneDialog.value}
                    onChange={(e) => setNewPlaneDialog((d) => ({ ...d, value: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { commitNewPlane(newPlaneDialog.value); setNewPlaneDialog({ open: false, value: "" }); }
                      if (e.key === "Escape") setNewPlaneDialog({ open: false, value: "" });
                    }}
                  />
                  <div className="flex gap-2 justify-end">
                    <button type="button" className="btn-ghost text-sm px-3 py-1.5" onClick={() => setNewPlaneDialog({ open: false, value: "" })}>Cancel</button>
                    <button
                      type="button"
                      className="btn-buy text-sm px-3 py-1.5"
                      disabled={!newPlaneDialog.value.trim()}
                      onClick={() => { commitNewPlane(newPlaneDialog.value); setNewPlaneDialog({ open: false, value: "" }); }}
                    >Create</button>
                  </div>
                </div>
              </div>
            )}

            {/* Delete plane confirmation */}
            {deletePlanePending && (() => {
              const cp = (visualFlow.customPlanes ?? []).find((p) => p.id === deletePlanePending);
              if (!cp) return null;
              return (
                <div
                  className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50"
                  onClick={() => setDeletePlanePending(null)}
                >
                  <div
                    className="shelf-note-popover w-72 rounded-xl border border-white/10 bg-zinc-900 p-5 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="mb-1 text-sm font-semibold text-zinc-100">Delete plane "{cp.name}"?</div>
                    <div className="mb-4 text-xs text-zinc-400">All items on this plane will be permanently removed.</div>
                    <div className="flex gap-2 justify-end">
                      <button type="button" className="btn-ghost text-sm px-3 py-1.5" onClick={() => setDeletePlanePending(null)}>Cancel</button>
                      <button
                        type="button"
                        className="text-sm px-3 py-1.5 rounded-lg font-semibold bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 transition-colors"
                        onClick={() => { commitDeletePlane(deletePlanePending); setDeletePlanePending(null); }}
                      >Delete</button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {nodeMenu && (() => {
              const ids = nodeMenu.nodeIds;
              const canEdit = currentPlaneEdit;
              const canDelete = currentPlaneDelete;
              const noun = plane === "main" ? "tasks" : "items";
              const menuW = 200;
              const left = Math.max(8, Math.min(nodeMenu.x, window.innerWidth - menuW));

              // Other planes (sheets) this selection can be sent to.
              const relocateTargets: { id: VisualFlowPlane; label: string }[] = [
                ...(plane !== "main" ? [{ id: "main" as VisualFlowPlane, label: "Main" }] : []),
                ...(plane !== "grazeland" ? [{ id: "grazeland" as VisualFlowPlane, label: "Grazeland" }] : []),
                ...(plane !== "bin" ? [{ id: "bin" as VisualFlowPlane, label: "Bin" }] : []),
                ...(visualFlow.customPlanes ?? [])
                  .filter((pl) => pl.id !== plane)
                  .map((pl) => ({ id: pl.id as VisualFlowPlane, label: pl.name })),
              ];
              const relocateBlock = relocateTargets.length > 0 && (
                <>
                  <div className="my-1 border-t border-white/10" />
                  <div className="px-3 py-2">
                    <label className="mb-1 block text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                      Move to sheet
                    </label>
                    <select
                      value=""
                      onChange={(e) => {
                        e.stopPropagation();
                        if (e.target.value) relocateItemsToPlane(ids, e.target.value, "move");
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-zinc-200 focus:outline-none"
                      aria-label="Move selection to another sheet"
                    >
                      <option value="" disabled>Choose sheet…</option>
                      {relocateTargets.map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                    <label className="mb-1 mt-2 block text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                      Duplicate to sheet
                    </label>
                    <select
                      value=""
                      onChange={(e) => {
                        e.stopPropagation();
                        if (e.target.value) relocateItemsToPlane(ids, e.target.value, "duplicate");
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-zinc-200 focus:outline-none"
                      aria-label="Duplicate selection to another sheet"
                    >
                      <option value="" disabled>Choose sheet…</option>
                      {relocateTargets.map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </>
              );

              if (ids.length > 1) {
                const present = ids
                  .map((id) => canvasItems.find((t) => t.id === id))
                  .filter((t): t is ShelfPillarTodoItem => Boolean(t));
                if (present.length === 0 || (!canEdit && !canDelete)) return null;
                const anyUndone = present.some((t) => !t.done);
                const margin = 8;
                const top = Math.max(margin, Math.min(nodeMenu.y, window.innerHeight - 200));
                const maxHeight = window.innerHeight - top - margin;
                return (
                  <div
                    ref={menuRef}
                    className="shelf-note-popover fixed z-[200] min-w-[180px] max-w-[220px] rounded-xl border border-emerald-400/20 bg-zinc-900 py-1 shadow-xl"
                    style={{ left, top, maxHeight, overflowY: "auto" }}
                  >
                    <div className="px-3 py-1.5 text-[10px] font-medium text-zinc-500">
                      {ids.length} {noun} selected
                    </div>
                    {canEdit && anyUndone && (
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm text-emerald-400 hover:bg-white/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBulkMarkCompleted(ids);
                        }}
                      >
                        Mark all completed ✓
                      </button>
                    )}
                    {canEdit && (() => {
                      const blockStatuses = present.map((t) => t.blockStatus ?? "ready");
                      const uniform =
                        blockStatuses.length > 0 &&
                        blockStatuses.every((s) => s === blockStatuses[0]);
                      const statusSelectValue = uniform ? blockStatuses[0]! : "";
                      return (
                        <>
                          <div className="my-1 border-t border-white/10" />
                          <div className="px-3 py-2">
                            <label className="mb-1 block text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                              Set status for all
                            </label>
                            <select
                              value={statusSelectValue}
                              onChange={(e) => {
                                e.stopPropagation();
                                const v = e.target.value as ShelfTodoBlockStatus;
                                if (!v) return;
                                handleBulkSetBlockStatus(ids, v);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-zinc-200 focus:outline-none"
                              aria-label="Set block status for all selected"
                            >
                              {!uniform && (
                                <option value="" disabled>
                                  Mixed — pick status
                                </option>
                              )}
                              {BLOCK_STATUS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </>
                      );
                    })()}
                    {canEdit && (() => {
                      const sectorLabels = present.map((t) => t.sectorName?.trim() ?? "");
                      const uniformSector =
                        sectorLabels.length > 0 && sectorLabels.every((s) => s === sectorLabels[0]);
                      const sectorSelectValue = uniformSector ? sectorLabels[0]! : "__mixed__";
                      const sectorOptions = Array.from(
                        new Set([...allVisualFlowSectorNames, ...sectorLabels.filter(Boolean)])
                      ).sort((a, b) => a.localeCompare(b));
                      return (
                        <>
                          <div className="my-1 border-t border-white/10" />
                          <div className="px-3 py-2">
                            <label className="mb-1 block text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                              Set sector for all
                            </label>
                            <select
                              value={sectorSelectValue}
                              onChange={(e) => {
                                e.stopPropagation();
                                const v = e.target.value;
                                if (v === "__mixed__") return;
                                handleBulkSetSector(ids, v === "" ? undefined : v);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-zinc-200 focus:outline-none"
                              aria-label="Set sector for all selected"
                            >
                              {!uniformSector && (
                                <option value="__mixed__" disabled>
                                  Mixed — pick sector
                                </option>
                              )}
                              <option value="">No sector</option>
                              {sectorOptions.map((name) => (
                                <option key={name} value={name}>
                                  {name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </>
                      );
                    })()}
                    {canEdit && (() => {
                      const tints = present.map((t) => t.sectorColor ?? "");
                      const uniformTint = tints.length > 0 && tints.every((s) => s === tints[0]);
                      const tintSelectValue = uniformTint ? tints[0]! : "__mixed__";
                      return (
                        <>
                          <div className="my-1 border-t border-white/10" />
                          <div className="px-3 py-2">
                            <label className="mb-1 block text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                              Set tint for all
                            </label>
                            <select
                              value={tintSelectValue}
                              onChange={(e) => {
                                e.stopPropagation();
                                const v = e.target.value;
                                if (v === "__mixed__") return;
                                handleBulkSetTint(ids, v === "" ? undefined : (v as SectorColorKey));
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-zinc-200 focus:outline-none"
                              aria-label="Set tint for all selected"
                            >
                              {!uniformTint && (
                                <option value="__mixed__" disabled>
                                  Mixed — pick tint
                                </option>
                              )}
                              <option value="">No tint</option>
                              {SECTOR_COLOR_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </>
                      );
                    })()}
                    {relocateBlock}
                  </div>
                );
              }

              const todo = canvasItems.find((t) => t.id === ids[0]);
              if (!todo || (!canEdit && !canDelete)) return null;
              const isGrazelandPlane = plane !== "main";
              const currentHandle = (
                todo.handleConfig ?? (isGrazelandPlane ? "omni" : "horizontal")
              ) as ShelfTodoHandleConfig;
              const currentGrazelandHandleVisibility = isGrazelandPlane
                ? todo.grazelandHandleVisibility ?? createGrazelandHandleVisibility()
                : undefined;
              const setHandle = (config: ShelfTodoHandleConfig) => {
                currentPlaneEdit?.(ids[0], { handleConfig: config });
                setNodeMenu(null);
              };
              const toggleGrazelandHandleVisibility = (key: ShelfGrazelandHandleSlot, checked: boolean) => {
                if (!currentGrazelandHandleVisibility) return;
                currentPlaneEdit?.(ids[0], {
                  grazelandHandleVisibility: {
                    ...currentGrazelandHandleVisibility,
                    [key]: checked,
                  },
                });
              };
              // Fit the menu within the viewport: clamp the top so it starts at
              // least ~200px above the bottom, then cap its height + scroll (it can
              // run ~900px tall once the connection picker is shown).
              const margin = 8;
              const top = Math.max(margin, Math.min(nodeMenu.y, window.innerHeight - 200));
              const maxHeight = window.innerHeight - top - margin;
              const layoutSelectValue = currentHandle === "hidden" ? "" : currentHandle;
              // shared checkbox glyph for the Mark-completed / Focused / In-Doing-now cluster
              const checkboxGlyph = (on: boolean) => (
                <span className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? "border-emerald-400 bg-emerald-500/30" : "border-zinc-500 bg-transparent"}`}>
                  {on && (
                    <svg className="h-2.5 w-2.5 text-emerald-400" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l3 3 5-6" /></svg>
                  )}
                </span>
              );
              return (
                <div
                  ref={menuRef}
                  className="shelf-note-popover fixed z-[200] min-w-[140px] rounded-xl border border-emerald-400/20 bg-zinc-900 py-1 shadow-xl"
                  style={{ left, top, maxHeight, overflowY: "auto" }}
                >
                  {canEdit && (
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(ids[0]);
                      }}
                    >
                      {plane === "main" ? "Edit task…" : "Edit item…"}
                    </button>
                  )}
                  {canEdit && (
                    <>
                      <div className="my-1 border-t border-white/10" />
                      <div className="px-3 py-2">
                        <label className="mb-1 block text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                          Status
                        </label>
                        <select
                          value={todo.blockStatus ?? "ready"}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleBulkSetBlockStatus([ids[0]], e.target.value as ShelfTodoBlockStatus);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-zinc-200 focus:outline-none"
                          aria-label="Task block status"
                        >
                          {BLOCK_STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10 flex items-center gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (todo.done) {
                          currentPlaneEdit?.(ids[0], { done: false });
                          setNodeMenu(null);
                        } else {
                          handleMarkCompleted(ids[0]);
                        }
                      }}
                      title={todo.done ? "Mark as not completed" : "Complete this task"}
                    >
                      {checkboxGlyph(!!todo.done)}
                      Mark completed
                    </button>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10 flex items-center gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFocus(ids[0]);
                      }}
                    >
                      {checkboxGlyph(!!todo.focused)}
                      Focused
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!doingPipeline.inPipeline(ids[0]) && doingPipeline.isFull}
                    className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (doingPipeline.inPipeline(ids[0])) doingPipeline.remove(ids[0]);
                      else doingPipeline.add(ids[0]);
                      setNodeMenu(null);
                    }}
                    title={doingPipeline.inPipeline(ids[0]) ? "Remove from the Doing now pipeline" : doingPipeline.isFull ? "Doing now is full (max 7)" : "Add to the Doing now pipeline"}
                  >
                    {checkboxGlyph(doingPipeline.inPipeline(ids[0]))}
                    In &quot;Doing now&quot;
                  </button>
                  {currentPlaneAdd && (
                    <>
                      <div className="my-1 border-t border-white/10" />
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm font-medium text-emerald-300 hover:bg-emerald-400/10 flex items-center gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddConnectedSubtask(ids[0]);
                        }}
                        title="Create a new node already connected to this one"
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add connected sub-task
                      </button>
                    </>
                  )}
                  {relocateBlock}
                  {canEdit && (
                    <>
                      <div className="my-1 border-t border-white/10" />
                      <div className="px-3 py-2">
                        <label className="mb-1 block text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                          Connection points
                        </label>
                        {isGrazelandPlane ? (
                          <ConnectionPicker
                            active={currentGrazelandHandleVisibility}
                            onToggle={(slot, next) => toggleGrazelandHandleVisibility(slot, next)}
                          />
                        ) : (
                          <>
                            <button
                              type="button"
                              className={`w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/10 ${currentHandle === "hidden" ? "text-emerald-400" : "text-zinc-200"}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setHandle("hidden");
                              }}
                            >
                              Hidden
                            </button>
                            <label className="mb-1 mt-2 block text-[10px] font-medium text-zinc-500">
                              Sides &amp; direction
                            </label>
                            <select
                              value={layoutSelectValue}
                              onChange={(e) => {
                                e.stopPropagation();
                                const v = e.target.value as Exclude<ShelfTodoHandleConfig, "hidden">;
                                if (!v) return;
                                setHandle(v);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-zinc-200 focus:outline-none"
                              aria-label="Connection layout when visible"
                            >
                              {currentHandle === "hidden" && (
                                <option value="" disabled>
                                  Select layout…
                                </option>
                              )}
                              {HANDLE_MENU_LAYOUT_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </>
                        )}
                      </div>
                    </>
                  )}
                  {canDelete && (
                    <>
                      <div className="my-1 border-t border-white/10" />
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm text-red-400/90 hover:bg-white/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(ids[0]);
                        }}
                      >
                        {plane === "main" ? "Delete task" : "Delete item"}
                      </button>
                    </>
                  )}
                </div>
              );
            })()}

            {edgeMenu && (() => {
              const edge = edges.find((e) => e.id === edgeMenu.edgeId);
              if (!edge) return null;
              const d = edge.data as { arrow?: boolean; doubled?: boolean; muted?: boolean } | undefined;
              const menuW = 160;
              const menuH = 140;
              const left = Math.max(8, Math.min(edgeMenu.x, window.innerWidth - menuW));
              const top = Math.max(8, Math.min(edgeMenu.y, window.innerHeight - menuH));
              return (
                <div
                  ref={edgeMenuRef}
                  className="shelf-note-popover fixed z-[200] min-w-[140px] rounded-xl border border-emerald-400/20 bg-zinc-900 py-1 shadow-xl"
                  style={{ left, top }}
                >
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdgeToggleArrow(edgeMenu.edgeId);
                    }}
                  >
                    {d?.arrow ? "Remove arrow →" : "Add arrow →"}
                  </button>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdgeToggleDoubled(edgeMenu.edgeId);
                    }}
                  >
                    {d?.doubled ? "Single line" : "Double line"}
                  </button>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdgeToggleMuted(edgeMenu.edgeId);
                    }}
                  >
                    {d?.muted ? "Unmute tone" : "Mute tone"}
                  </button>
                  <div className="my-1 border-t border-white/10" />
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-red-400/90 hover:bg-white/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteEdge(edgeMenu.edgeId);
                    }}
                  >
                    Delete connection
                  </button>
                  {selectedEdgeCount > 1 && (
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-red-400/90 hover:bg-white/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSelectedEdges();
                      }}
                    >
                      Delete {selectedEdgeCount} selected connections
                    </button>
                  )}
                </div>
              );
            })()}

            {paneMenu && (currentPlaneAdd || selectedEdgeCount > 0) && (() => {
              const menuW = 220;
              const menuH = selectedEdgeCount > 0 ? 152 : 108;
              const left = Math.max(8, Math.min(paneMenu.x, window.innerWidth - menuW));
              const top = Math.max(8, Math.min(paneMenu.y, window.innerHeight - menuH));
              return (
              <div
                ref={paneMenuRef}
                className="shelf-note-popover fixed z-[200] min-w-[200px] rounded-xl border border-emerald-400/20 bg-zinc-900 py-1 shadow-xl"
                style={{ left, top }}
              >
                {currentPlaneAdd && (
                  <>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateTask();
                      }}
                    >
                      {plane === "main" ? "Create new task" : "Create new item"}
                    </button>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenSectorManager();
                      }}
                    >
                      Manage sectors
                    </button>
                  </>
                )}
                {selectedEdgeCount > 0 && (
                  <>
                    {currentPlaneAdd && <div className="my-1 border-t border-white/10" />}
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-red-400/90 hover:bg-white/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSelectedEdges();
                      }}
                    >
                      Delete {selectedEdgeCount} selected connection{selectedEdgeCount === 1 ? "" : "s"}
                    </button>
                  </>
                )}
              </div>
            );
            })()}

            {/* Doing-now drawer right-click menu (add a blocker) */}
            {doingMenu && (
              <>
                <div className="nf-menu-scrim" onMouseDown={() => setDoingMenu(null)} onContextMenu={(e) => { e.preventDefault(); setDoingMenu(null); }} />
                <div
                  className="nf-menu"
                  style={{ left: Math.min(doingMenu.x, window.innerWidth - 190), top: Math.min(doingMenu.y, window.innerHeight - 70) }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="nf-menu-item"
                    onClick={() => {
                      // Drop the new blocker at the centre of the visible canvas.
                      const flow = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
                      // Default the start to the NEAREST full hour (e.g. 11:39 → 12:00).
                      const d = new Date();
                      d.setMinutes(d.getMinutes() >= 30 ? 60 : 0, 0, 0);
                      setBlockerDraft({ x: doingMenu.x, y: doingMenu.y, fx: flow.x, fy: flow.y, label: "", due: nfToDatetimeLocal(d.getTime()), dur: 30 });
                      setDoingMenu(null);
                    }}
                  >
                    ⛔ Add blocker
                  </button>
                </div>
              </>
            )}

            {/* Canvas blocker right-click menu (edit time / clear) */}
            {blockerMenu && (() => {
              const b = (visualFlow.blockers ?? []).find((x) => x.id === blockerMenu.id);
              if (!b) return null;
              return (
                <>
                  <div className="nf-menu-scrim" onMouseDown={() => setBlockerMenu(null)} onContextMenu={(e) => { e.preventDefault(); setBlockerMenu(null); }} />
                  <div
                    className="nf-menu"
                    style={{ left: Math.min(blockerMenu.x, window.innerWidth - 190), top: Math.min(blockerMenu.y, window.innerHeight - 110) }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="nf-menu-item"
                      onClick={() => {
                        setBlockerDraft({ x: blockerMenu.x, y: blockerMenu.y, fx: b.x ?? 0, fy: b.y ?? 0, label: b.label, due: nfToDatetimeLocal(b.due), dur: b.dur, edit: b.id });
                        setBlockerMenu(null);
                      }}
                    >
                      Edit time…
                    </button>
                    <div className="nf-menu-sep" />
                    <button type="button" className="nf-menu-item warn" onClick={() => { removeBlocker(b.id); setBlockerMenu(null); }}>
                      Clear blocker
                    </button>
                  </div>
                </>
              );
            })()}

            {/* Blocker create/edit popover */}
            {blockerDraft && (
              <BlockerDraft draft={blockerDraft} setDraft={setBlockerDraft} onCommit={commitBlocker} onCancel={() => setBlockerDraft(null)} />
            )}

            {sectorManagerOpen && (
              <div
                className="fixed inset-0 z-[250] flex items-center justify-center bg-black/55 p-4"
                role="presentation"
                onClick={() => setSectorManagerOpen(false)}
              >
                <div
                  role="dialog"
                  aria-labelledby="sector-manager-title"
                  className="shelf-sector-manager-dialog max-h-[min(80vh,520px)] w-full max-w-md overflow-y-auto rounded-xl border border-emerald-400/20 p-4 shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h2 id="sector-manager-title" className="mb-3 text-sm font-semibold text-zinc-100">
                    Manage sectors
                  </h2>
                  <p className="mb-3 text-[10px] leading-relaxed text-zinc-500">
                    Pick a palette color for each sector (card outline and background wash). Connection points stay the default emerald.
                  </p>
                  {sectorGroups.length === 0 ? (
                    <p className="text-xs leading-relaxed text-zinc-500">
                      No sector names on this canvas yet. Open a task, choose Edit, and set{" "}
                      <span className="text-zinc-400">Sector name (optional)</span>.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {sectorGroups.map(([name, ids]) => (
                        <li
                          key={name}
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                        >
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <span className="min-w-0 truncate text-sm font-medium text-zinc-200" title={name}>
                              {name}
                            </span>
                            <span className="shrink-0 text-[10px] text-zinc-500">
                              {ids.length} {" "}
                              {plane === "main"
                                ? ids.length === 1
                                  ? "task"
                                  : "tasks"
                                : ids.length === 1
                                  ? "item"
                                  : "items"}
                            </span>
                          </div>
                          <label className="mb-1 block text-[10px] font-medium text-zinc-500">
                            Frame color
                          </label>
                          <select
                            value={visualFlow.sectorColors?.[name] ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              applySectorColorByName(
                                name,
                                v === "" ? undefined : (v as SectorColorKey)
                              );
                            }}
                            className="mb-2 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-200 focus:outline-none"
                            aria-label={`Frame color for sector ${name}`}
                          >
                            <option value="">Default (emerald handles)</option>
                            {SECTOR_COLOR_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-zinc-200 hover:bg-white/10"
                              onClick={() => handleRenameSectorGroup(name, ids)}
                            >
                              Rename…
                            </button>
                            <button
                              type="button"
                              className="rounded-md px-2 py-1 text-[11px] text-red-400/90 hover:bg-white/10"
                              onClick={() => handleClearSectorGroup(name, ids)}
                            >
                              Remove from all
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    className="mt-4 w-full rounded-lg border border-white/10 bg-white/5 py-2 text-xs font-medium text-zinc-300 hover:bg-white/10"
                    onClick={() => setSectorManagerOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

          </section>

          {/* Hover trigger + pull-handle: only when the drawer is enabled, and
              only on narrower screens (wide screens dock it open). */}
          {showFocusDrawer && !dockedAlways && (
            <>
              <div
                className="fixed right-0 top-0 bottom-0 w-5 z-[100] cursor-default"
                style={{ marginTop: fullPage ? "6rem" : undefined }}
                onMouseEnter={handleDrawerTriggerEnter}
                onMouseLeave={handleDrawerTriggerLeave}
                aria-hidden="true"
              />
              <button
                type="button"
                className="shelf-flow-focus-handle fixed top-1/2 z-[101] -translate-y-1/2"
                style={{ right: drawerSlideIn ? FOCUS_DRAWER_WIDTH : 0, marginTop: fullPage ? "3rem" : undefined }}
                onMouseEnter={handleDrawerTriggerEnter}
                onMouseLeave={handleDrawerTriggerLeave}
                onClick={handleDrawerToggleFreeze}
                aria-label={drawerFrozen ? "Unpin focused tasks" : "Open focused tasks"}
                title="Focused tasks"
              >
                <svg
                  className={`h-4 w-4 transition-transform ${drawerSlideIn ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24" aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 6l-6 6 6 6" />
                </svg>
              </button>
            </>
          )}

          {/* Focus drawer: slides in from right when hovered — matches settings panel design.
              When docked on wide screens it floats as a rounded panel, offset from the
              bottom so it clears the bottom-right controls. */}
          <aside
            className={`shelf-flow-focus-drawer fixed right-0 top-0 bottom-0 z-[99] flex flex-col overflow-hidden border border-white/15 ${
              dockedAlways ? "rounded-2xl" : "rounded-l-2xl border-r-0"
            } ${drawerSlideIn ? "translate-x-0" : "translate-x-full"}`}
            style={{
              marginTop: fullPage ? "6rem" : undefined,
              marginBottom: dockedAlways ? "5.5rem" : undefined,
              marginRight: dockedAlways ? "0.75rem" : undefined,
              width: FOCUS_DRAWER_WIDTH,
            }}
            onMouseEnter={handleDrawerEnter}
            onMouseLeave={handleDrawerLeave}
            onClick={handleDrawerClick}
            onContextMenu={(e) => {
              e.preventDefault();
              setDrawerMenu({ x: e.clientX, y: e.clientY });
            }}
          >
            {/* Only mount the (potentially heavy) task list while the drawer is
                actually visible — keeps memory/DOM idle when it's tucked away.
                `drawerMounted` lags `drawerSlideIn` so content paints before the
                slide and stays through the slide-out (see the open/close effect). */}
            {drawerMounted && (
            <>
            <div className="flex flex-col gap-2 min-h-0 flex-1 overflow-y-auto p-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-emerald-200">Focused tasks</span>
                  {focusGroups.length > 0 && (
                    <span className="text-[10px] text-zinc-500">
                      {focusGroups.reduce((n, g) => n + g.items.length, 0)}
                    </span>
                  )}
                </div>
                {focusGroups.length === 0 ? (
                  <p className="text-[11px] text-zinc-500">
                    Right-click a task and select <span className="text-zinc-400">Focused</span> to pin it here.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {focusGroups.map((group) => {
                      const groupCollapsed = focusCollapsedGroupSet.has(group.id);
                      return (
                        <div key={group.id} className="flex flex-col gap-1.5">
                          {/* Plane group header — collapsible, color-dotted */}
                          <button
                            type="button"
                            onClick={() => toggleFocusGroup(group.id)}
                            className="flex items-center gap-1.5 px-0.5 text-left"
                            aria-expanded={!groupCollapsed}
                          >
                            <svg
                              className={`h-3 w-3 shrink-0 text-zinc-500 transition-transform ${groupCollapsed ? "" : "rotate-90"}`}
                              fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
                            </svg>
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: group.color || "var(--accent)" }} aria-hidden="true" />
                            <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-zinc-300">{group.label}</span>
                            <span className="text-[10px] text-zinc-500">{group.items.length}</span>
                          </button>
                          {!groupCollapsed && (
                            <div className="flex flex-col gap-2">
                              {group.items.map((todo) => {
                                const expanded = focusExpandedSet.has(todo.id);
                                return (
                                  <div
                                    key={todo.id}
                                    className="shelf-flow-focus-todo-card group/card rounded-lg border border-white/10 bg-black/25 px-2.5 py-2"
                                    onContextMenu={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setFocusItemMenu({ planeId: group.id, id: todo.id, text: todo.text, x: e.clientX, y: e.clientY });
                                    }}
                                  >
                                    {/* Collapsed row: checkbox + title + expand chevron */}
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (todo.done) editItemInPlane(group.id, todo.id, { done: false });
                                          else completeFocusedTask(group.id, todo.id, todo.text);
                                        }}
                                        className="shelf-note-checkbox shelf-note-checkbox--interactive shrink-0 h-4 w-4 rounded border border-zinc-500/50 bg-black/10 flex items-center justify-center hover:bg-emerald-500/15 hover:border-emerald-400/30 focus:outline-none focus:ring-1 focus:ring-emerald-400/25"
                                        aria-label={todo.done ? "Uncheck" : "Complete"}
                                      >
                                        {todo.done && (
                                          <svg className="h-2.5 w-2.5 text-emerald-500/80" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                          </svg>
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => jumpToTask(group.id, todo.id)}
                                        title="Jump to node on canvas"
                                        className={`min-w-0 flex-1 text-left text-sm font-medium text-emerald-100 hover:text-emerald-50 ${
                                          todo.done ? "line-through opacity-70" : ""
                                        } ${expanded ? "whitespace-pre-wrap break-words leading-snug" : "truncate"}`}
                                      >
                                        {todo.subtitle ? `${todo.text} · ${todo.subtitle}` : todo.text}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleFocusExpanded(todo.id);
                                        }}
                                        className="shrink-0 rounded p-0.5 text-zinc-500 hover:bg-white/10 hover:text-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-400/25"
                                        aria-label={expanded ? "Collapse task" : "Expand task"}
                                        aria-expanded={expanded}
                                      >
                                        <svg
                                          className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
                                          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"
                                        >
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                                        </svg>
                                      </button>
                                    </div>
                                    {/* Expanded detail */}
                                    {expanded && (
                                      <div className="mt-1.5 flex flex-col gap-1 pl-6">
                                        {todo.url && (
                                          <a
                                            href={todo.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-emerald-400 truncate"
                                            title={todo.url}
                                          >
                                            <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                            <span className="truncate">{todo.url}</span>
                                          </a>
                                        )}
                                        {editingNoteId === todo.id ? (
                                          <textarea
                                            autoFocus
                                            defaultValue={todo.note ?? ""}
                                            rows={3}
                                            placeholder="Note…"
                                            onClick={(e) => e.stopPropagation()}
                                            onBlur={(e) => {
                                              editItemInPlane(group.id, todo.id, { note: e.target.value });
                                              setEditingNoteId(null);
                                            }}
                                            onKeyDown={(e) => {
                                              if (e.key === "Escape") {
                                                e.preventDefault();
                                                setEditingNoteId(null);
                                              } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                                e.preventDefault();
                                                editItemInPlane(group.id, todo.id, { note: (e.target as HTMLTextAreaElement).value });
                                                setEditingNoteId(null);
                                              }
                                            }}
                                            className="w-full resize-y rounded-md border border-emerald-400/30 bg-black/30 px-2 py-1.5 text-[11px] leading-relaxed text-zinc-200 outline-none focus:border-emerald-400/60"
                                          />
                                        ) : todo.note ? (
                                          <div
                                            className="cursor-text rounded text-[11px] leading-relaxed text-zinc-400 hover:bg-white/5"
                                            title="Click to edit note (Esc cancels, ⌘/Ctrl+Enter saves)"
                                            onClick={(e) => {
                                              // let links and in-note checkboxes work; edit on plain-text clicks
                                              if ((e.target as HTMLElement).closest("a,button")) return;
                                              setEditingNoteId(todo.id);
                                            }}
                                          >
                                            <NoteContent
                                              content={todo.note}
                                              onNoteChange={(newNote) => editItemInPlane(group.id, todo.id, { note: newNote })}
                                              linkify
                                            />
                                          </div>
                                        ) : (
                                          <button
                                            type="button"
                                            className="w-fit text-left text-[11px] text-zinc-500 hover:text-zinc-300"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingNoteId(todo.id);
                                            }}
                                          >
                                            + Add note…
                                          </button>
                                        )}
                                        {todo.tag && (
                                          <span className={`inline-block w-fit rounded px-1.5 py-0.5 text-[9px] font-medium ${tagColorClasses(todo.tag)}`}>
                                            {todo.tag}
                                          </span>
                                        )}
                                        {showTodoDates && todo.date && (
                                          <div className="text-[10px] text-zinc-500">{todo.date}</div>
                                        )}
                                        {(todo.createdAt || todo.updatedAt) && (
                                          <div className="text-[10px] text-zinc-600" title={todo.history?.length ? `${todo.history.length} change${todo.history.length === 1 ? "" : "s"} recorded` : undefined}>
                                            {todo.createdAt && <>Created {formatAuditTs(todo.createdAt)}</>}
                                            {todo.updatedAt && todo.updatedAt !== todo.createdAt && (
                                              <> · Updated {formatAuditTs(todo.updatedAt)}</>
                                            )}
                                          </div>
                                        )}
                                        <button
                                          type="button"
                                          className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-[11px] text-emerald-200 hover:bg-emerald-400/10 hover:text-emerald-100"
                                          onClick={() => {
                                            if (group.id !== plane) jumpToTask(group.id, todo.id);
                                            else setEditNodeId(todo.id);
                                          }}
                                        >
                                          {group.id !== plane ? "Open on canvas…" : "Edit…"}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            {!dockedAlways && (
              <div className="shrink-0 flex items-center justify-between p-2 pt-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDrawerToggleFreeze();
                  }}
                  className={`rounded-lg px-2 py-1.5 text-[11px] transition-colors ${
                    drawerFrozen
                      ? "bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25"
                      : "text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
                  }`}
                  aria-pressed={drawerFrozen}
                  title={drawerFrozen ? "Unpin (let it auto-close)" : "Pin open"}
                >
                  {drawerFrozen ? "📌 Pinned" : "📌 Pin open"}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDrawerClose();
                  }}
                  className="rounded-lg px-2 py-1.5 text-[11px] text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
                  aria-label="Close drawer"
                >
                  ✕
                </button>
              </div>
            )}
            </>
            )}
          </aside>

          {focusItemMenu && (
            <>
              <div className="fixed inset-0 z-[200]" onClick={() => setFocusItemMenu(null)} onContextMenu={(e) => { e.preventDefault(); setFocusItemMenu(null); }} />
              <div
                className="shelf-note-popover fixed z-[201] min-w-[160px] rounded-xl border border-emerald-400/20 bg-zinc-900 py-1 shadow-xl"
                style={{
                  left: Math.max(8, Math.min(focusItemMenu.x, window.innerWidth - 180)),
                  top: Math.max(8, Math.min(focusItemMenu.y, window.innerHeight - 120)),
                }}
              >
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10"
                  onClick={() => {
                    jumpToTask(focusItemMenu.planeId, focusItemMenu.id);
                    setFocusItemMenu(null);
                  }}
                >
                  Jump to node
                </button>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-amber-300 hover:bg-white/10"
                  onClick={() => {
                    editItemInPlane(focusItemMenu.planeId, focusItemMenu.id, { focused: false });
                    setFocusItemMenu(null);
                  }}
                >
                  Unfocus
                </button>
              </div>
            </>
          )}

          {drawerMenu && (
            <div
              ref={drawerMenuRef}
              className="shelf-note-popover fixed z-[200] min-w-[120px] rounded-xl border border-emerald-400/20 bg-zinc-900 py-1 shadow-xl"
              style={{
                left: Math.max(8, Math.min(drawerMenu.x, window.innerWidth - 130)),
                top: Math.max(8, Math.min(drawerMenu.y, window.innerHeight - 50)),
              }}
            >
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDrawerToggleFreeze();
                }}
              >
                {drawerFrozen ? "Unfreeze" : "Freeze"}
              </button>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10"
                onClick={(e) => {
                  e.stopPropagation();
                  stickOutUntilRef.current = Date.now() + 10000;
                  setDrawerMenu(null);
                  cancelDrawerClose();
                }}
              >
                Stick out
              </button>
            </div>
          )}
        </div>

        {editNodeId &&
          (() => {
            const t = canvasItems.find((x) => x.id === editNodeId);
            const canEdit = currentPlaneEdit;
            if (!t || !canEdit) return null;
            return (
              <div
                key={editNodeId}
                className="fixed inset-0 z-[242] flex items-center justify-center bg-black/60 p-4"
                role="presentation"
              >
                <NodeEditCard
                  todo={t}
                  showTodoDates={showTodoDates}
                  editLabel={plane === "main" ? "Edit task" : "Edit item"}
                  titlePlaceholder={plane === "main" ? "Task title" : "Item title"}
                  showBinInfoFields={plane === "bin"}
                  existingSectorNames={allVisualFlowSectorNames}
                  sectorColorMap={visualFlow.sectorColors}
                  onSave={(updates) => {
                    // Committed — no longer a throwaway blank node.
                    freshNodeIdsRef.current.delete(editNodeId);
                    handleEditCanvasItemWithLog(editNodeId, updates);
                    if (plane === "main") {
                      const task = canvasItems.find((x) => x.id === editNodeId);
                      const nm = (updates.sectorName ?? task?.sectorName)?.trim();
                      if (nm) {
                        const mapColor = visualFlow.sectorColors?.[nm];
                        if (updates.sectorColor !== mapColor) {
                          applySectorColorByName(nm, updates.sectorColor);
                        }
                      }
                    }
                    setEditNodeId(null);
                  }}
                  onClose={() => {
                    // Cancelled/Escaped a freshly-created node that was never saved →
                    // discard it (don't leave a blank "New task" on the canvas).
                    if (freshNodeIdsRef.current.has(editNodeId)) {
                      freshNodeIdsRef.current.delete(editNodeId);
                      currentPlaneDelete?.(editNodeId);
                      setEdges((eds) => eds.filter((e) => e.source !== editNodeId && e.target !== editNodeId));
                      setNodes((ns) => ns.filter((n) => n.id !== editNodeId));
                    }
                    setEditNodeId(null);
                  }}
                />
              </div>
            );
          })()}
      </div>
    </div>
  );
}

export function VisualFlowPanel(props: Parameters<typeof VisualFlowPanelInner>[0]) {
  return (
    <ReactFlowProvider>
      <VisualFlowPanelInner {...props} />
    </ReactFlowProvider>
  );
}
