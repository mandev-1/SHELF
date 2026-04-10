import React, { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  Handle,
  Position,
  BaseEdge,
  getBezierPath,
  SelectionMode,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  type EdgeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Input } from "@heroui/react";
import {
  SECTOR_COLOR_OPTIONS,
  SECTOR_HEX,
  type SectorColorKey,
  type ShelfPillarTodoItem,
  type ShelfTodoBlockStatus,
  type ShelfTodoHandleConfig,
  type VisualFlowData,
  type VisualFlowEdge,
  resolveVisualFlowSectorColor,
} from "../types/grid";
import { NoteContent, linkifyText } from "./NoteContent";

const NODE_MIN_WIDTH = 260;
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
  sectorName?: string;
  sectorColor?: SectorColorKey;
  onNoteChange?: (newNote: string) => void;
  /** True while “mark completed” exit animation runs */
  completing?: boolean;
  /** Grazeland plane — subtle distinct styling */
  grazelandPlane?: boolean;
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
function sectorNodeChromeStyleForTheme(colorKey: SectorColorKey, theme: string): React.CSSProperties {
  const hex = SECTOR_HEX[colorKey];
  const [r, g, b] = rgbFromSectorHex(hex);
  const avg = (r + g + b) / 3;

  if (theme === "day") {
    const br = Math.round(r * 0.38 + 118 * 0.62);
    const bgMix = Math.round(g * 0.38 + 112 * 0.62);
    const bb = Math.round(b * 0.38 + 106 * 0.62);
    const borderA = avg > 210 ? 0.58 : avg > 135 ? 0.52 : 0.48;
    return {
      border: `2px solid rgba(${br},${bgMix},${bb}, ${borderA})`,
      backgroundColor: "rgba(255, 252, 247, 0.97)",
      backgroundImage: `linear-gradient(
        168deg,
        rgba(${r},${g},${b}, 0.38) 0%,
        rgba(${r},${g},${b}, 0.16) 42%,
        rgba(255, 252, 247, 0.72) 100%
      )`,
      boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.85), 0 1px 2px rgba(28, 25, 23, 0.07)",
    };
  }

  if (theme === "sap") {
    // Light SAP canvas needs a paper base + visible (still soft) sector wash — flat rgba(r,g,b,0.08) was invisible.
    const topA = avg > 200 ? 0.22 : avg > 115 ? 0.19 : avg > 55 ? 0.16 : 0.13;
    const midA = topA * 0.55;
    return {
      border: "1px solid rgba(0, 112, 242, 0.2)",
      backgroundColor: "rgb(244, 247, 252)",
      backgroundImage: `linear-gradient(
        165deg,
        rgba(${r},${g},${b}, ${topA}) 0%,
        rgba(${r},${g},${b}, ${midA}) 42%,
        rgba(236, 242, 249, 0.97) 68%,
        rgb(244, 247, 252) 100%
      )`,
      boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.75)",
    };
  }

  const lineA = colorKey === "alice-blue" || colorKey === "bone" ? 0.4 : 0.34;
  return {
    border: `1px solid rgba(${r},${g},${b},${lineA})`,
    backgroundImage: `linear-gradient(
      165deg,
      rgba(${r},${g},${b}, 0.13) 0%,
      rgba(${r},${g},${b}, 0.04) 55%,
      transparent 100%
    )`,
    backgroundColor: "rgba(0, 0, 0, 0.38)",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
  };
}

export type VisualFlowPlane = "main" | "grazeland";

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
  { value: "horizontal", label: "Horizontal" },
  { value: "vertical", label: "Vertical" },
  { value: "top", label: "Top only" },
  { value: "bottom", label: "Bottom only" },
  { value: "left", label: "Left only" },
  { value: "right", label: "Right only" },
];

function NodeEditCard({
  todo,
  showTodoDates = false,
  editLabel = "Edit task",
  titlePlaceholder = "Task title",
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
  /** Distinct sector names already used on Visual Flow (for combobox hints). */
  existingSectorNames?: string[];
  sectorColorMap?: Record<string, SectorColorKey>;
  onSave: (updates: Partial<ShelfPillarTodoItem>) => void;
  onClose: () => void;
  onClosingStart?: () => void;
}) {
  const [text, setText] = useState(todo.text);
  const [note, setNote] = useState(todo.note ?? "");
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
      tag: tag || undefined,
      subtitle: subtitle || undefined,
      blockStatus: blockStatus || undefined,
      date: date.trim() || undefined,
      sectorName: sectorName.trim() || undefined,
      sectorColor: sectorColor === "" ? undefined : sectorColor,
    });
    requestClose();
  }, [text, note, tag, subtitle, blockStatus, date, sectorName, sectorColor, onSave, requestClose]);

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
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="shelf-note-popover-textarea min-h-[60px] max-h-64 w-full resize-y rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none"
          rows={2}
        />
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
            aria-label="Sector border color"
          >
            <option value="">Default (no sector tint)</option>
            {SECTOR_COLOR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-[9px] leading-snug text-zinc-600">
            On Visual Flow, this adds a thin colored outline and a light background wash on nodes in that sector.
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
  daySectorHandleStyle,
}: {
  config: ShelfTodoHandleConfig;
  /** When set (day + sector), fills/border come from sector — not default emerald. */
  daySectorHandleStyle?: React.CSSProperties;
}) {
  const handleClass = daySectorHandleStyle ? HANDLE_CLASS_NEUTRAL : HANDLE_CLASS_BASE;
  const handleStyle = daySectorHandleStyle;
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
    grazelandPlane,
    sectorName,
    sectorColor,
  } = (props.data ?? {}) as TodoFlowNodeData;
  const uiTheme = useShelfDocumentTheme();
  const statusClass = nodeStatusClass(blockStatus);
  const config = handleConfig ?? "horizontal";
  const isSelected = props.selected === true;
  const showDate = showTodoDates && date && blockStatus !== "blocked";
  const sectorStyle = sectorColor ? sectorNodeChromeStyleForTheme(sectorColor, uiTheme) : undefined;
  const baseBgClass = sectorColor ? "" : "bg-black/35";
  const daySectorHandleStyle =
    uiTheme === "day" && sectorColor ? sectorHandleStyleDay(sectorColor) : undefined;
  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className={`shelf-flow-node shelf-top6-card group flex w-full min-h-[4rem] flex-col gap-1.5 ${baseBgClass} px-1 py-2.5 shadow-sm ${statusClass} ${isSelected ? "shelf-flow-node--selected" : ""} ${grazelandPlane ? "shelf-flow-node--grazeland ring-1 ring-amber-200/25" : ""}`}
      style={sectorStyle}
    >
      <FlowHandles config={config} daySectorHandleStyle={daySectorHandleStyle} />
      <div className="min-w-0 flex-1 overflow-visible px-2 pr-3 pl-3">
        {sectorName && (
          <div className="mb-0.5 text-[9px] font-medium uppercase tracking-wide text-zinc-500/90 truncate" title={sectorName}>
            {sectorName}
          </div>
        )}
        <div className="font-semibold leading-snug text-white group-hover:text-emerald-100 break-words whitespace-pre-wrap">
          {subtitle ? `${text} · ${subtitle}` : text}
        </div>
        {note && (
          <div className="shelf-flow-node-note mt-0.5 text-[11px] leading-relaxed">
            <NoteContent content={note} onNoteChange={(props.data as TodoFlowNodeData).onNoteChange} />
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
    NODE_MIN_WIDTH,
    Math.min(NODE_MAX_WIDTH, longestTitleLine * 9 + 100)
  );
}

function buildInitialNodes(
  todos: ShelfPillarTodoItem[],
  storedPositions?: Record<string, { x: number; y: number }>,
  onEditTodo?: (id: string, updates: Partial<ShelfPillarTodoItem>) => void,
  showTodoDates?: boolean,
  grazelandPlane?: boolean,
  sectorColorMap?: Record<string, SectorColorKey>
): Node[] {
  return todos.map((todo, i) => {
    const pos = storedPositions?.[todo.id];
    const width = computeNodeWidth(todo);
    const resolvedSector = resolveVisualFlowSectorColor(todo, sectorColorMap);
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
        handleConfig: todo.handleConfig ?? "horizontal",
        grazelandPlane: !!grazelandPlane,
        sectorName: todo.sectorName,
        sectorColor: resolvedSector,
        onNoteChange:
          onEditTodo && todo.note
            ? (newNote: string) => onEditTodo(todo.id, { note: newNote })
            : undefined,
      },
      style: {
        width,
        minHeight: NODE_MIN_HEIGHT,
        ["--node-width" as string]: `${width}px`,
      },
    };
  });
}

const EDGE_STYLE = {
  stroke: "#0070f2",
  strokeWidth: 3,
  strokeDasharray: "12 12",
  strokeLinecap: "round",
} as const;

const EDGE_INTERACTION_WIDTH = 28;
const PARALLEL_OFFSET = 4;
const ARROW_COUNT = 4;

/** Focus drawer layout — adjust these to tune the open animation */
const FOCUS_DRAWER_WIDTH = "18rem";           /* Width of the drawer panel */
const FOCUS_DRAWER_CARD_MARGIN = "6rem";     /* Margin-right on the card (section) containing the canvas */
const FOCUS_DRAWER_CANVAS_TRANSLATE = "-12rem"; /* translateX on the canvas — how far it slides left */
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

  const pathStyle = {
    ...(style as object),
    fill: "none",
    ...(muted && {
      stroke: "#6b7280",
      opacity: 0.5,
    } as React.CSSProperties),
  };

  const parallelPaths = doubled ? createParallelPaths(path, PARALLEL_OFFSET) : null;
  const arrowPlacements = arrow ? getArrowPlacements(path, ARROW_COUNT) : null;
  const arrowColor = muted ? "#6b7280" : (style as { stroke?: string })?.stroke ?? EDGE_STYLE.stroke;

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
  showTodoDates = false,
  visualFlow,
  onVisualFlowChange,
  focusDesynced = false,
  setPillarTodoPins,
  onEditTodo,
  onDeleteTodo,
  onAddTodo,
  onEditGrazelandItem,
  onDeleteGrazelandItem,
  onAddGrazelandItem,
  onTaskCompleted,
  onTodoLog,
  fullPage = false,
}: {
  todos: ShelfPillarTodoItem[];
  grazelandItems?: ShelfPillarTodoItem[];
  showTodoDates?: boolean;
  visualFlow: VisualFlowData;
  onVisualFlowChange: (data: VisualFlowData) => void;
  focusDesynced?: boolean;
  setPillarTodoPins?: (next: string[] | ((prev: string[]) => string[])) => void;
  onEditTodo?: (id: string, updates: Partial<ShelfPillarTodoItem>) => void;
  onDeleteTodo?: (id: string) => void;
  onAddTodo?: (todo: ShelfPillarTodoItem) => void;
  onEditGrazelandItem?: (id: string, updates: Partial<ShelfPillarTodoItem>) => void;
  onDeleteGrazelandItem?: (id: string) => void;
  onAddGrazelandItem?: (todo: ShelfPillarTodoItem) => void;
  onTaskCompleted?: () => void;
  onTodoLog?: (entry: string) => void;
  fullPage?: boolean;
}) {
  const { screenToFlowPosition, getNodes } = useReactFlow();
  const [nodeMenu, setNodeMenu] = useState<{ nodeIds: string[]; x: number; y: number } | null>(null);
  const [edgeMenu, setEdgeMenu] = useState<{ edgeId: string; x: number; y: number } | null>(null);
  const [paneMenu, setPaneMenu] = useState<{ x: number; y: number } | null>(null);
  const [sectorManagerOpen, setSectorManagerOpen] = useState(false);
  const [editNodeId, setEditNodeId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerFrozen, setDrawerFrozen] = useState(false);
  const [drawerPinned, setDrawerPinned] = useState(false);
  const [drawerMenu, setDrawerMenu] = useState<{ x: number; y: number } | null>(null);
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
      return v === "grazeland" ? "grazeland" : "main";
    } catch {
      return "main";
    }
  });

  const canvasItems = plane === "main" ? todos : grazelandItems;
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
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [todos, grazelandItems]);
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
  const storedNodePositions = plane === "main" ? visualFlow.nodePositions : visualFlow.grazelandNodePositions;
  const storedFlowEdges = plane === "main" ? visualFlow.edges : visualFlow.grazelandEdges;

  const flushCanvasToVisualFlow = useCallback(
    (targetPlane: VisualFlowPlane, nodeList: Node[], edgeList: Edge[]) => {
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
      if (targetPlane === "main") {
        onVisualFlowChange({
          ...visualFlow,
          nodePositions: positions,
          edges: edgeData,
        });
      } else {
        onVisualFlowChange({
          ...visualFlow,
          grazelandNodePositions: positions,
          grazelandEdges: edgeData,
        });
      }
    },
    [onVisualFlowChange, visualFlow]
  );

  const handleEditCanvasItemWithLog = useCallback(
    (id: string, updates: Partial<ShelfPillarTodoItem>) => {
      const todo = canvasItems.find((t) => t.id === id);
      const logLabel = plane === "main" ? "Visual Flow" : "Visual Flow Grazeland";
      if (todo && onTodoLog && !(updates.done === true && Object.keys(updates).length === 1)) {
        const lines: string[] = [];
        if (updates.text !== undefined && updates.text !== todo.text) {
          lines.push(`Title: ${todo.text || "(empty)"} → ${updates.text || "(empty)"}`);
        }
        if (updates.note !== undefined && updates.note !== (todo.note ?? "")) {
          const oldNote = todo.note ?? "";
          const newNote = updates.note ?? "";
          lines.push(`Description: ${oldNote || "(empty)"} → ${newNote || "(empty)"}`);
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
          const kind = plane === "grazeland" ? "item" : "task";
          onTodoLog(`${logLabel}: updated ${kind} "${todo.text}":\n${lines.join("\n")}`);
        }
      }
      if (plane === "main") onEditTodo?.(id, updates);
      else onEditGrazelandItem?.(id, updates);
    },
    [canvasItems, onEditGrazelandItem, onEditTodo, onTodoLog, plane]
  );

  const initialNodes = useMemo(
    () =>
      buildInitialNodes(
        canvasItems,
        storedNodePositions,
        handleEditCanvasItemWithLog,
        showTodoDates,
        plane === "grazeland",
        visualFlow.sectorColors
      ),
    [canvasItems, storedNodePositions, handleEditCanvasItemWithLog, showTodoDates, plane, visualFlow.sectorColors]
  );
  const initialEdges = useMemo(
    () => buildInitialEdges(canvasItems, storedFlowEdges),
    [canvasItems, storedFlowEdges]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const switchPlane = useCallback(
    (next: VisualFlowPlane) => {
      setPlaneState((prev) => {
        if (next === prev) return prev;
        flushCanvasToVisualFlow(prev, nodes, edges);
        try {
          window.localStorage.setItem(VISUAL_FLOW_PLANE_LS_KEY, next);
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [flushCanvasToVisualFlow, nodes, edges]
  );

  useEffect(() => {
    setNodes((current) => {
      const fresh = buildInitialNodes(
        canvasItems,
        storedNodePositions,
        handleEditCanvasItemWithLog,
        showTodoDates,
        plane === "grazeland",
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
    storedFlowEdges,
    handleEditCanvasItemWithLog,
    showTodoDates,
    plane,
    visualFlow.sectorColors,
    setNodes,
    setEdges,
  ]);

  const onConnect = useCallback(
    (params: Connection) => {
      hasInteracted.current = true;
      setEdges((eds) => {
        const next = addEdge(params, eds);
        return next.map((e) =>
          e.type !== "todoFlow"
            ? { ...e, type: "todoFlow", data: { ...(e.data as object), arrow: false, doubled: false, muted: false } }
            : e
        );
      });
    },
    [setEdges]
  );

  const persist = useCallback(
    (positionsOverride?: Record<string, { x: number; y: number }>) => {
      if (!hasInteracted.current) return;
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
      if (plane === "main") {
        onVisualFlowChange({
          ...visualFlow,
          nodePositions: positions,
          edges: edgeList,
        });
      } else {
        onVisualFlowChange({
          ...visualFlow,
          grazelandNodePositions: positions,
          grazelandEdges: edgeList,
        });
      }
    },
    [nodes, edges, onVisualFlowChange, visualFlow, plane]
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
      const target = e.target;
      if (menuRef.current && target instanceof HTMLElement && !menuRef.current.contains(target))
        setNodeMenu(null);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [nodeMenu]);

  useEffect(() => {
    if (!paneMenu) return;
    const close = (e: MouseEvent) => {
      const target = e.target;
      if (
        paneMenuRef.current &&
        target instanceof HTMLElement &&
        !paneMenuRef.current.contains(target)
      )
        setPaneMenu(null);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
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
      const target = e.target;
      if (
        edgeMenuRef.current &&
        target instanceof HTMLElement &&
        !edgeMenuRef.current.contains(target)
      )
        setEdgeMenu(null);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
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

  useEffect(() => {
    if (!drawerMenu) return;
    const close = (e: MouseEvent) => {
      const target = e.target;
      if (
        drawerMenuRef.current &&
        target instanceof HTMLElement &&
        !drawerMenuRef.current.contains(target)
      )
        setDrawerMenu(null);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [drawerMenu]);

  const onPaneContextMenu = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
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
      const canAdd =
        (plane === "main" && onAddTodo) || (plane === "grazeland" && onAddGrazelandItem);
      if (canAdd) {
        setNodeMenu(null);
        setPaneMenu({ x: e.clientX, y: e.clientY });
      }
    },
    [getNodes, onAddGrazelandItem, onAddTodo, plane]
  );

  const handleCreateTask = useCallback(() => {
    if (!paneMenu) return;
    const flowPos = screenToFlowPosition({ x: paneMenu.x, y: paneMenu.y });
    const width = NODE_MIN_WIDTH;
    const height = NODE_MIN_HEIGHT;
    const pos = { x: flowPos.x - width / 2, y: flowPos.y - height / 2 };
    if (plane === "main") {
      if (!onAddTodo) return;
      const newTodo: ShelfPillarTodoItem = {
        id: crypto.randomUUID(),
        text: "New task",
        done: false,
      };
      onAddTodo(newTodo);
      onVisualFlowChange({
        ...visualFlow,
        nodePositions: { ...(visualFlow.nodePositions ?? {}), [newTodo.id]: pos },
      });
      setPaneMenu(null);
      setEditNodeId(newTodo.id);
      onTodoLog?.(`Visual Flow: added new task "${newTodo.text}"`);
      return;
    }
    if (!onAddGrazelandItem) return;
    const newItem: ShelfPillarTodoItem = {
      id: crypto.randomUUID(),
      text: "New item",
      done: false,
    };
    onAddGrazelandItem(newItem);
    onVisualFlowChange({
      ...visualFlow,
      grazelandNodePositions: { ...(visualFlow.grazelandNodePositions ?? {}), [newItem.id]: pos },
    });
    setPaneMenu(null);
    setEditNodeId(newItem.id);
    onTodoLog?.(`Visual Flow Grazeland: added new item "${newItem.text}"`);
  }, [
    onAddGrazelandItem,
    onAddTodo,
    onTodoLog,
    onVisualFlowChange,
    paneMenu,
    plane,
    screenToFlowPosition,
    visualFlow,
  ]);

  const handleOpenSectorManager = useCallback(() => {
    setPaneMenu(null);
    setSectorManagerOpen(true);
  }, []);

  const applySectorColorByName = useCallback(
    (sectorName: string, color: SectorColorKey | undefined) => {
      const trimmed = sectorName.trim();
      if (!trimmed) return;
      hasInteracted.current = true;
      const nextMap = { ...(visualFlow.sectorColors ?? {}) };
      if (color) nextMap[trimmed] = color;
      else delete nextMap[trimmed];
      onVisualFlowChange({ ...visualFlow, sectorColors: nextMap });
      const patch = color ? { sectorColor: color } : { sectorColor: undefined };
      for (const t of todos) {
        if (t.sectorName?.trim() !== trimmed) continue;
        onEditTodo?.(t.id, patch);
      }
      for (const t of grazelandItems) {
        if (t.sectorName?.trim() !== trimmed) continue;
        onEditGrazelandItem?.(t.id, patch);
      }
      onTodoLog?.(
        color
          ? `Visual Flow: sector "${trimmed}" frame color → ${color} (all matching tasks)`
          : `Visual Flow: cleared sector "${trimmed}" frame color (all matching tasks)`
      );
    },
    [grazelandItems, onEditGrazelandItem, onEditTodo, onTodoLog, onVisualFlowChange, todos, visualFlow]
  );

  const handleRenameSectorGroup = useCallback(
    (oldName: string, ids: string[]) => {
      const next = window.prompt(`Rename sector`, oldName);
      if (next === null) return;
      const trimmed = next.trim();
      hasInteracted.current = true;
      const nextSc = { ...(visualFlow.sectorColors ?? {}) };
      if (nextSc[oldName] !== undefined) {
        const c = nextSc[oldName];
        delete nextSc[oldName];
        if (trimmed) nextSc[trimmed] = c;
      }
      onVisualFlowChange({ ...visualFlow, sectorColors: nextSc });
      ids.forEach((id) => {
        if (plane === "main") onEditTodo?.(id, { sectorName: trimmed || undefined });
        else onEditGrazelandItem?.(id, { sectorName: trimmed || undefined });
      });
      const label = plane === "main" ? "Visual Flow" : "Visual Flow Grazeland";
      const n = ids.length;
      const u =
        plane === "grazeland" ? (n === 1 ? "item" : "items") : n === 1 ? "task" : "tasks";
      onTodoLog?.(`${label}: renamed sector "${oldName}" → "${trimmed || "—"}" (${n} ${u})`);
    },
    [onEditGrazelandItem, onEditTodo, onTodoLog, onVisualFlowChange, plane, visualFlow]
  );

  const handleClearSectorGroup = useCallback(
    (name: string, ids: string[]) => {
      if (
        !window.confirm(
          `Remove sector "${name}" from ${ids.length} ${plane === "grazeland" ? "items" : "tasks"}?`
        )
      )
        return;
      hasInteracted.current = true;
      ids.forEach((id) => {
        if (plane === "main") onEditTodo?.(id, { sectorName: undefined, sectorColor: undefined });
        else onEditGrazelandItem?.(id, { sectorName: undefined, sectorColor: undefined });
      });
      const willRemainElsewhere = [...todos, ...grazelandItems].some(
        (t) => t.sectorName?.trim() === name && !ids.includes(t.id)
      );
      const nextSc = { ...(visualFlow.sectorColors ?? {}) };
      if (!willRemainElsewhere) delete nextSc[name];
      onVisualFlowChange({ ...visualFlow, sectorColors: nextSc });
      const label = plane === "main" ? "Visual Flow" : "Visual Flow Grazeland";
      onTodoLog?.(
        `${label}: removed sector "${name}" from ${ids.length} ${plane === "grazeland" ? "items" : "tasks"}`
      );
      setSectorManagerOpen(false);
    },
    [grazelandItems, onEditGrazelandItem, onEditTodo, onTodoLog, onVisualFlowChange, plane, todos, visualFlow]
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
      const noun = plane === "grazeland" ? "item" : "task";
      const label = todo?.text ? `"${todo.text}"` : `this ${noun}`;
      if (!window.confirm(`Remove ${label}? This will clear it from your list.`)) return;
      if (!window.confirm(`Are you sure? This cannot be undone.`)) return;
      setNodeMenu(null);
      setEditNodeId(null);
      if (plane === "main") onDeleteTodo?.(id);
      else onDeleteGrazelandItem?.(id);
      if (todo) {
        onTodoLog?.(
          plane === "main"
            ? `Visual Flow: removed task "${todo.text}"`
            : `Visual Flow Grazeland: removed item "${todo.text}"`
        );
      }
      hasInteracted.current = true;
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      setNodes((ns) => ns.filter((n) => n.id !== id));
    },
    [canvasItems, onDeleteGrazelandItem, onDeleteTodo, onTodoLog, plane, setEdges, setNodes]
  );

  const handleMarkCompleted = useCallback(
    (id: string) => {
      const canComplete = plane === "main" ? onDeleteTodo : onDeleteGrazelandItem;
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
        if (plane === "main") onDeleteTodo?.(id);
        else onDeleteGrazelandItem?.(id);
        onTaskCompleted?.();
        onTodoLog?.(
          plane === "main" ? `completed task ${todo.text}` : `completed item ${todo.text} (Grazeland)`
        );
        setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      }, COMPLETE_EXIT_MS);
    },
    [
      canvasItems,
      onDeleteGrazelandItem,
      onDeleteTodo,
      onTaskCompleted,
      onTodoLog,
      plane,
      setEdges,
      setNodes,
    ]
  );

  const handleBulkMarkCompleted = useCallback(
    (ids: string[]) => {
      const canComplete = plane === "main" ? onDeleteTodo : onDeleteGrazelandItem;
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
          if (plane === "main") onDeleteTodo?.(id);
          else onDeleteGrazelandItem?.(id);
        });
        onTaskCompleted?.();
        onTodoLog?.(
          plane === "main"
            ? `Visual Flow: completed ${valid.length} tasks (bulk)`
            : `Visual Flow Grazeland: completed ${valid.length} items (bulk)`
        );
        setEdges((eds) =>
          eds.filter((e) => !valid.includes(e.source) && !valid.includes(e.target))
        );
        setNodes((ns) => ns.filter((n) => !valid.includes(n.id)));
      }, COMPLETE_EXIT_MS);
    },
    [
      canvasItems,
      onDeleteGrazelandItem,
      onDeleteTodo,
      onTaskCompleted,
      onTodoLog,
      plane,
      setEdges,
      setNodes,
    ]
  );

  const handleBulkSetBlockStatus = useCallback(
    (ids: string[], status: ShelfTodoBlockStatus) => {
      const canEdit = plane === "main" ? onEditTodo : onEditGrazelandItem;
      if (!canEdit || ids.length === 0) return;
      setNodeMenu(null);
      hasInteracted.current = true;
      ids.forEach((id) => {
        if (plane === "main") onEditTodo?.(id, { blockStatus: status });
        else onEditGrazelandItem?.(id, { blockStatus: status });
      });
      const n = ids.length;
      const unit =
        plane === "grazeland"
          ? n === 1
            ? "item"
            : "items"
          : n === 1
            ? "task"
            : "tasks";
      onTodoLog?.(
        `${plane === "main" ? "Visual Flow" : "Visual Flow Grazeland"}: set status to ${status} for ${n} ${unit}`
      );
    },
    [onEditGrazelandItem, onEditTodo, onTodoLog, plane]
  );

  const handleBulkSetSector = useCallback(
    (ids: string[], sectorName: string | undefined) => {
      const canEdit = plane === "main" ? onEditTodo : onEditGrazelandItem;
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
        if (plane === "main") onEditTodo?.(id, patch);
        else onEditGrazelandItem?.(id, patch);
      });
      const n = ids.length;
      const unit =
        plane === "grazeland" ? (n === 1 ? "item" : "items") : n === 1 ? "task" : "tasks";
      onTodoLog?.(
        `${plane === "main" ? "Visual Flow" : "Visual Flow Grazeland"}: set sector to ${trimmed || "(none)"} for ${n} ${unit}`
      );
    },
    [onEditGrazelandItem, onEditTodo, onTodoLog, plane, visualFlow.sectorColors]
  );

  const handleToggleFocus = useCallback(
    (id: string) => {
      if (plane !== "main") return;
      const todo = todos.find((t) => t.id === id);
      if (!todo) return;
      const nextFocused = !todo.focused;
      onEditTodo?.(id, { focused: nextFocused });
      if (!focusDesynced && setPillarTodoPins) {
        const nextFocusedIds = todos
          .map((t) => (t.id === id ? { ...t, focused: nextFocused } : t))
          .filter((t) => t.focused)
          .map((t) => t.id)
          .slice(0, MAX_PILLAR_TODO_PINS);
        setPillarTodoPins(nextFocusedIds);
      }
      setNodeMenu(null);
    },
    [onEditTodo, todos, focusDesynced, setPillarTodoPins]
  );

  const scheduleDrawerClose = useCallback(() => {
    if (drawerFrozen || drawerMenu) return;
    const now = Date.now();
    if (stickOutUntilRef.current && now < stickOutUntilRef.current) return;
    if (drawerCloseTimeoutRef.current !== null) window.clearTimeout(drawerCloseTimeoutRef.current);
    const delay = drawerPinned ? 5000 : 200;
    drawerCloseTimeoutRef.current = window.setTimeout(() => {
      setDrawerOpen(false);
      setDrawerPinned(false);
      stickOutUntilRef.current = null;
      drawerCloseTimeoutRef.current = null;
    }, delay);
  }, [drawerPinned, drawerFrozen, drawerMenu]);

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
    <div className={`shelf-error-dashboard ${containerClass}`}>
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/20 px-4 py-3">
        <h1 className="text-base font-semibold tracking-tight text-zinc-100">
          Visual Flow of Action
        </h1>
        <div
          className="flex rounded-lg border border-white/10 bg-black/30 p-0.5 text-xs font-medium"
          role="tablist"
          aria-label="Canvas layer"
        >
          <button
            type="button"
            role="tab"
            aria-selected={plane === "main"}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              plane === "main" ? "bg-white/15 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
            }`}
            onClick={() => switchPlane("main")}
          >
            Main canvas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={plane === "grazeland"}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              plane === "grazeland" ? "bg-amber-500/20 text-amber-100" : "text-zinc-400 hover:text-zinc-200"
            }`}
            onClick={() => switchPlane("grazeland")}
          >
            Grazeland plane
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 px-6 pt-6 pb-6 overflow-x-hidden">
          <section
            className="h-full flex-1 min-w-0 shelf-flow-canvas-transition"
            style={{ marginRight: drawerOpen ? FOCUS_DRAWER_CARD_MARGIN : 0 }}
          >
            <div
              className={`relative h-full min-h-[280px] rounded-xl border visual-flow-canvas shelf-flow-canvas-transition ${
                plane === "grazeland" ? "border-amber-200/20 bg-amber-950/10" : "border-white/10"
              }`}
              style={{ transform: drawerOpen ? `translateX(${FOCUS_DRAWER_CANVAS_TRANSLATE})` : "translateX(0)" }}
            >
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                connectionLineStyle={{
                  stroke: "#0070f2",
                  strokeWidth: 3,
                  strokeDasharray: "12 12",
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
                onNodeDragStop={onNodeDragStop}
                onNodeContextMenu={onNodeContextMenu}
                onSelectionContextMenu={onSelectionContextMenu}
                onPaneContextMenu={onPaneContextMenu}
                onEdgeContextMenu={onEdgeContextMenuHandler}
                onEdgeClick={() => {}}
                selectionKeyCode={["Control", "Meta"]}
                multiSelectionKeyCode={["Shift"]}
                selectionMode={SelectionMode.Partial}
                fitView
                fitViewOptions={{ padding: 0.2 }}
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
              />
              {canvasItems.length === 0 && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4">
                  <p className="text-sm text-zinc-400">
                    {plane === "main"
                      ? "Right-click on the canvas to create a task, or add todos in the Pillar."
                      : "Right-click on the canvas to add an item. Grazeland items stay on this plane only."}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Drag nodes to arrange. Ctrl+drag to select several. Right-click a selected node or the canvas with
                    multiple nodes selected for bulk status and actions.
                  </p>
                </div>
              )}
            </div>

            {nodeMenu && (() => {
              const ids = nodeMenu.nodeIds;
              const canEdit = plane === "main" ? onEditTodo : onEditGrazelandItem;
              const canDelete = plane === "main" ? onDeleteTodo : onDeleteGrazelandItem;
              const noun = plane === "grazeland" ? "items" : "tasks";
              const menuW = 200;
              const left = Math.max(8, Math.min(nodeMenu.x, window.innerWidth - menuW));

              if (ids.length > 1) {
                const present = ids
                  .map((id) => canvasItems.find((t) => t.id === id))
                  .filter((t): t is ShelfPillarTodoItem => Boolean(t));
                if (present.length === 0 || (!canEdit && !canDelete)) return null;
                const anyUndone = present.some((t) => !t.done);
                const menuH = 400;
                const top = Math.max(8, Math.min(nodeMenu.y, window.innerHeight - menuH));
                return (
                  <div
                    ref={menuRef}
                    className="shelf-note-popover fixed z-[200] min-w-[180px] max-w-[220px] rounded-xl border border-emerald-400/20 bg-zinc-900 py-1 shadow-xl"
                    style={{ left, top }}
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
                  </div>
                );
              }

              const todo = canvasItems.find((t) => t.id === ids[0]);
              if (!todo || (!canEdit && !canDelete)) return null;
              const currentHandle = (todo.handleConfig ?? "horizontal") as ShelfTodoHandleConfig;
              const setHandle = (config: ShelfTodoHandleConfig) => {
                if (plane === "main") onEditTodo?.(ids[0], { handleConfig: config });
                else onEditGrazelandItem?.(ids[0], { handleConfig: config });
                setNodeMenu(null);
              };
              const menuH = 400;
              const top = Math.max(8, Math.min(nodeMenu.y, window.innerHeight - menuH));
              const layoutSelectValue = currentHandle === "hidden" ? "" : currentHandle;
              return (
                <div
                  ref={menuRef}
                  className="shelf-note-popover fixed z-[200] min-w-[140px] rounded-xl border border-emerald-400/20 bg-zinc-900 py-1 shadow-xl"
                  style={{ left, top }}
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
                      {plane === "grazeland" ? "Edit item…" : "Edit task…"}
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
                        {!todo.done && (
                          <button
                            type="button"
                            className="mt-2 w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium text-emerald-400 hover:bg-white/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkCompleted(ids[0]);
                            }}
                          >
                            Mark completed ✓
                          </button>
                        )}
                      </div>
                    </>
                  )}
                  {canEdit && plane === "main" && (
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFocus(ids[0]);
                      }}
                    >
                      <span
                        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          todo.focused ? "border-emerald-400 bg-emerald-500/30" : "border-zinc-500 bg-transparent"
                        }`}
                      >
                        {todo.focused && (
                          <svg className="h-2.5 w-2.5 text-emerald-400" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 6l3 3 5-6" />
                          </svg>
                        )}
                      </span>
                      Focused
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-red-400/90 hover:bg-white/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(ids[0]);
                      }}
                    >
                      {plane === "grazeland" ? "Delete item" : "Delete task"}
                    </button>
                  )}
                  {canEdit && (
                    <>
                      <div className="my-1 border-t border-white/10" />
                      <div className="px-3 py-2">
                        <label className="mb-1 block text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                          Connection points
                        </label>
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
                      </div>
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
                </div>
              );
            })()}

            {paneMenu && ((plane === "main" && onAddTodo) || (plane === "grazeland" && onAddGrazelandItem)) && (() => {
              const menuW = 200;
              const menuH = 108;
              const left = Math.max(8, Math.min(paneMenu.x, window.innerWidth - menuW));
              const top = Math.max(8, Math.min(paneMenu.y, window.innerHeight - menuH));
              return (
              <div
                ref={paneMenuRef}
                className="shelf-note-popover fixed z-[200] min-w-[180px] rounded-xl border border-emerald-400/20 bg-zinc-900 py-1 shadow-xl"
                style={{ left, top }}
              >
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCreateTask();
                  }}
                >
                  {plane === "grazeland" ? "Create new item" : "Create new task"}
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
              </div>
            );
            })()}

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
                              {ids.length}{" "}
                              {plane === "grazeland"
                                ? ids.length === 1
                                  ? "item"
                                  : "items"
                                : ids.length === 1
                                  ? "task"
                                  : "tasks"}
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

          {/* Hover trigger: thin strip on the right edge to summon the drawer */}
          <div
            className="fixed right-0 top-0 bottom-0 w-4 z-[100] cursor-default"
            style={{ marginTop: fullPage ? "6rem" : undefined }}
            onMouseEnter={handleDrawerTriggerEnter}
            onMouseLeave={handleDrawerTriggerLeave}
            aria-label="Open focus drawer"
          />

          {/* Focus drawer: slides in from right when hovered — matches settings panel design */}
          <aside
            className={`shelf-flow-focus-drawer fixed right-0 top-0 bottom-0 z-[99] flex flex-col overflow-hidden rounded-l-2xl border border-emerald-400/15 border-r-0 bg-black/92 shadow-[0_0_40px_rgba(16,185,129,0.16),0_0_90px_rgba(59,130,246,0.08)] ${
              drawerOpen ? "translate-x-0" : "translate-x-full"
            }`}
            style={{ marginTop: fullPage ? "6rem" : undefined, width: FOCUS_DRAWER_WIDTH }}
            onMouseEnter={handleDrawerEnter}
            onMouseLeave={handleDrawerLeave}
            onClick={handleDrawerClick}
            onContextMenu={(e) => {
              e.preventDefault();
              setDrawerMenu({ x: e.clientX, y: e.clientY });
            }}
          >
            <div className="flex flex-col gap-2 min-h-0 flex-1 overflow-y-auto p-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                <div className="mb-1.5 text-xs font-medium text-emerald-200">Focused tasks</div>
                {(() => {
                  const focusedTodos = todos.filter((t) => t.focused);
                  if (focusedTodos.length === 0) {
                    return (
                      <p className="text-[11px] text-zinc-500">
                        Right-click a task and select <span className="text-zinc-400">Focused</span> to pin it here.
                      </p>
                    );
                  }
                  return (
                    <div className="flex flex-col gap-2">
                      {focusedTodos.map((todo) => (
                        <div
                          key={todo.id}
                          className="shelf-flow-focus-todo-card group/card rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 relative"
                        >
                          {todo.url && (
                            <a
                              href={todo.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover/card:opacity-60 hover:!opacity-100 transition-opacity text-zinc-500 hover:text-emerald-400 focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-emerald-400/40"
                              aria-label="Open link"
                              title={todo.url}
                            >
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          )}
                          <div className="flex gap-2 items-start">
                            {onEditTodo && (
                              <button
                                type="button"
                                onClick={() =>
                                  todo.done ? onEditTodo(todo.id, { done: false }) : handleMarkCompleted(todo.id)
                                }
                                className="shelf-note-checkbox shelf-note-checkbox--interactive mt-0.5 shrink-0 h-4 w-4 rounded border border-zinc-500/50 bg-black/10 flex items-center justify-center hover:bg-emerald-500/15 hover:border-emerald-400/30 focus:outline-none focus:ring-1 focus:ring-emerald-400/25"
                                aria-label={todo.done ? "Uncheck" : "Check"}
                              >
                                {todo.done && (
                                  <svg className="h-2.5 w-2.5 text-emerald-500/80" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </button>
                            )}
                            <div
                              className={`font-medium leading-snug text-emerald-100 break-words whitespace-pre-wrap text-sm flex-1 min-w-0 ${todo.url ? "pr-5" : ""} ${
                                todo.done ? "line-through opacity-70" : ""
                              }`}
                            >
                              {linkifyText(
                                todo.subtitle ? `${todo.text} · ${todo.subtitle}` : todo.text
                              )}
                            </div>
                          </div>
                          {todo.note && (
                            <div className="mt-1 text-[11px] leading-relaxed text-zinc-400">
                              <NoteContent
                                content={todo.note}
                                onNoteChange={onEditTodo ? (newNote) => onEditTodo(todo.id, { note: newNote }) : undefined}
                                linkify
                              />
                            </div>
                          )}
                          {todo.tag && (
                            <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-medium ${tagColorClasses(todo.tag)}`}>
                              {todo.tag}
                            </span>
                          )}
                          {showTodoDates && todo.date && (
                            <div className="mt-1 text-[10px] text-zinc-500">{todo.date}</div>
                          )}
                          {onEditTodo && (
                            <button
                              type="button"
                              className="mt-2 w-full rounded-lg px-2 py-1.5 text-left text-[11px] text-emerald-200 hover:bg-emerald-400/10 hover:text-emerald-100"
                              onClick={() => setEditNodeId(todo.id)}
                            >
                              Edit…
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="shrink-0 flex justify-start p-2 pt-0">
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
          </aside>

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
            const canEdit = plane === "main" ? onEditTodo : onEditGrazelandItem;
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
                  editLabel={plane === "grazeland" ? "Edit item" : "Edit task"}
                  titlePlaceholder={plane === "grazeland" ? "Item title" : "Task title"}
                  existingSectorNames={allVisualFlowSectorNames}
                  sectorColorMap={visualFlow.sectorColors}
                  onSave={(updates) => {
                    handleEditCanvasItemWithLog(editNodeId, updates);
                    const task = canvasItems.find((x) => x.id === editNodeId);
                    const nm = (updates.sectorName ?? task?.sectorName)?.trim();
                    if (nm) {
                      const mapColor = visualFlow.sectorColors?.[nm];
                      if (updates.sectorColor !== mapColor) {
                        applySectorColorByName(nm, updates.sectorColor);
                      }
                    }
                    setEditNodeId(null);
                  }}
                  onClose={() => setEditNodeId(null)}
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
