import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type {
  ShelfPillarTodoItem,
  ShelfTodoBlockStatus,
  ShelfTodoHandleConfig,
  VisualFlowData,
  VisualFlowEdge,
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
  onNoteChange?: (newNote: string) => void;
  /** True while “mark completed” exit animation runs */
  completing?: boolean;
  /** Grazeland plane — subtle distinct styling */
  grazelandPlane?: boolean;
};

export type VisualFlowPlane = "main" | "grazeland";

const VISUAL_FLOW_PLANE_LS_KEY = "shelf-visual-flow-plane";

const EDIT_CARD_EXIT_MS = 400;
/** Time for node exit animation before todo is removed from the map and list */
const COMPLETE_EXIT_MS = 720;

function EditCardWrapper({ children }: { children: React.ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsExpanded(true));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const handleClosingStart = useCallback(() => {
    setIsClosing(true);
  }, []);

  return (
    <div
      className={`shelf-flow-edit-card-wrapper ${isExpanded && !isClosing ? "shelf-flow-edit-card-wrapper--open" : ""} ${isClosing ? "shelf-flow-edit-card-wrapper--closing" : ""}`}
    >
      {React.isValidElement(children)
        ? React.cloneElement(children, { onClosingStart: handleClosingStart } as Record<string, unknown>)
        : children}
    </div>
  );
}

const BLOCK_STATUS_OPTIONS: { value: ShelfTodoBlockStatus; label: string }[] = [
  { value: "ready", label: "Ready" },
  { value: "blocked", label: "Blocked" },
  { value: "abeyed", label: "Abeyed" },
];

function NodeEditCard({
  todo,
  showTodoDates = false,
  editLabel = "Edit task",
  titlePlaceholder = "Task title",
  onSave,
  onClose,
  onClosingStart,
}: {
  todo: ShelfPillarTodoItem;
  showTodoDates?: boolean;
  editLabel?: string;
  titlePlaceholder?: string;
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
  const [isClosing, setIsClosing] = useState(false);
  const [escapePrompted, setEscapePrompted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
    });
    requestClose();
  }, [text, note, tag, subtitle, blockStatus, date, onSave, requestClose]);

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
      className={`shelf-flow-edit-card shelf-note-popover mx-auto mb-4 max-w-lg rounded-xl border border-emerald-400/20 bg-zinc-900 p-4 shadow-xl ${isClosing ? "shelf-flow-edit-card--exit" : ""}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium text-zinc-500">{editLabel}</span>
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

const HANDLE_CLASS =
  "shelf-flow-handle !z-10 !h-2.5 !w-2.5 !rounded-full !border-2 !border-emerald-400/60 !bg-emerald-500/80";

function FlowHandles({ config }: { config: ShelfTodoHandleConfig }) {
  if (config === "hidden") return null;
  if (config === "horizontal") {
    return (
      <>
        <Handle type="target" id="target-left" position={Position.Left} className={`${HANDLE_CLASS} !left-2 !top-1/2 -translate-y-1/2`} />
        <Handle type="source" id="source-right" position={Position.Right} className={`${HANDLE_CLASS} !right-2 !top-1/2 -translate-y-1/2`} />
      </>
    );
  }
  if (config === "vertical") {
    return (
      <>
        <Handle type="target" id="target-top" position={Position.Top} className={`${HANDLE_CLASS} !left-1/2 !top-2 -translate-x-1/2`} />
        <Handle type="source" id="source-bottom" position={Position.Bottom} className={`${HANDLE_CLASS} !left-1/2 !bottom-2 -translate-x-1/2`} />
      </>
    );
  }
  if (config === "top") {
    return (
      <Handle type="target" id="target-top" position={Position.Top} className={`${HANDLE_CLASS} !left-1/2 !top-2 -translate-x-1/2`} />
    );
  }
  if (config === "bottom") {
    return (
      <>
        <Handle type="target" id="target-bottom" position={Position.Bottom} className={`${HANDLE_CLASS} !left-[30%] !bottom-2 -translate-x-1/2`} />
        <Handle type="source" id="source-bottom" position={Position.Bottom} className={`${HANDLE_CLASS} !left-[70%] !bottom-2 -translate-x-1/2`} />
      </>
    );
  }
  if (config === "left") {
    return (
      <>
        <Handle type="target" id="target-left" position={Position.Left} className={`${HANDLE_CLASS} !left-2 !top-1/3 -translate-y-1/2`} />
        <Handle type="source" id="source-left" position={Position.Left} className={`${HANDLE_CLASS} !left-2 !top-2/3 -translate-y-1/2`} />
      </>
    );
  }
  if (config === "right") {
    return (
      <>
        <Handle type="target" id="target-right" position={Position.Right} className={`${HANDLE_CLASS} !right-2 !top-1/3 -translate-y-1/2`} />
        <Handle type="source" id="source-right" position={Position.Right} className={`${HANDLE_CLASS} !right-2 !top-2/3 -translate-y-1/2`} />
      </>
    );
  }
  return null;
}

function TodoFlowNode(props: NodeProps) {
  const { text, note, tag, subtitle, blockStatus, date, showTodoDates, handleConfig, grazelandPlane } = (props.data ?? {}) as TodoFlowNodeData;
  const statusClass = nodeStatusClass(blockStatus);
  const config = handleConfig ?? "horizontal";
  const isSelected = props.selected === true;
  const showDate = showTodoDates && date && blockStatus !== "blocked";
  return (
    <div
      className={`shelf-flow-node shelf-top6-card group flex w-full min-h-[4rem] flex-col gap-1.5 bg-black/35 px-1 py-2.5 shadow-sm ${statusClass} ${isSelected ? "shelf-flow-node--selected" : ""} ${grazelandPlane ? "shelf-flow-node--grazeland ring-1 ring-amber-200/25" : ""}`}
    >
      <FlowHandles config={config} />
      <div className="min-w-0 flex-1 overflow-visible px-2 pr-3 pl-3">
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
  grazelandPlane?: boolean
): Node[] {
  return todos.map((todo, i) => {
    const pos = storedPositions?.[todo.id];
    const width = computeNodeWidth(todo);
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
  const { screenToFlowPosition } = useReactFlow();
  const [nodeMenu, setNodeMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [edgeMenu, setEdgeMenu] = useState<{ edgeId: string; x: number; y: number } | null>(null);
  const [paneMenu, setPaneMenu] = useState<{ x: number; y: number } | null>(null);
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
        plane === "grazeland"
      ),
    [canvasItems, storedNodePositions, handleEditCanvasItemWithLog, showTodoDates, plane]
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
        plane === "grazeland"
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
    (e: React.MouseEvent, node: { id: string }) => {
      e.preventDefault();
      setEdgeMenu(null);
      setNodeMenu({ nodeId: node.id, x: e.clientX, y: e.clientY });
    },
    []
  );

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
      const canAdd =
        (plane === "main" && onAddTodo) || (plane === "grazeland" && onAddGrazelandItem);
      if (canAdd) setPaneMenu({ x: e.clientX, y: e.clientY });
    },
    [onAddGrazelandItem, onAddTodo, plane]
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
        <div className="shrink-0 p-6 pb-0">
          {editNodeId && (() => {
            const t = canvasItems.find((x) => x.id === editNodeId);
            const canEdit = plane === "main" ? onEditTodo : onEditGrazelandItem;
            if (!t || !canEdit) return null;
            return (
              <EditCardWrapper key={editNodeId}>
                <NodeEditCard
                  todo={t}
                  showTodoDates={showTodoDates}
                  editLabel={plane === "grazeland" ? "Edit item" : "Edit task"}
                  titlePlaceholder={plane === "grazeland" ? "Item title" : "Task title"}
                  onSave={(updates) => {
                    handleEditCanvasItemWithLog(editNodeId, updates);
                    setEditNodeId(null);
                  }}
                  onClose={() => setEditNodeId(null)}
                />
              </EditCardWrapper>
            );
          })()}
        </div>
        <div className="flex-1 min-h-0 px-6 pb-6 overflow-x-hidden">
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
                    Drag nodes to arrange. Ctrl+drag to draw selection rectangle. Selected nodes move in bulk.
                  </p>
                </div>
              )}
            </div>

            {nodeMenu && (() => {
              const todo = canvasItems.find((t) => t.id === nodeMenu.nodeId);
              const canEdit = plane === "main" ? onEditTodo : onEditGrazelandItem;
              const canDelete = plane === "main" ? onDeleteTodo : onDeleteGrazelandItem;
              if (!todo || (!canEdit && !canDelete)) return null;
              const currentHandle = (todo.handleConfig ?? "horizontal") as ShelfTodoHandleConfig;
              const setHandle = (config: ShelfTodoHandleConfig) => {
                if (plane === "main") onEditTodo?.(nodeMenu.nodeId, { handleConfig: config });
                else onEditGrazelandItem?.(nodeMenu.nodeId, { handleConfig: config });
                setNodeMenu(null);
              };
              const menuW = 180;
              const menuH = 420;
              const left = Math.max(8, Math.min(nodeMenu.x, window.innerWidth - menuW));
              const top = Math.max(8, Math.min(nodeMenu.y, window.innerHeight - menuH));
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
                        handleEdit(nodeMenu.nodeId);
                      }}
                    >
                      {plane === "grazeland" ? "Edit item…" : "Edit task…"}
                    </button>
                  )}
                  {canEdit && !todo.done && (
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-emerald-400 hover:bg-white/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkCompleted(nodeMenu.nodeId);
                      }}
                    >
                      Mark completed ✓
                    </button>
                  )}
                  {canEdit && plane === "main" && (
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFocus(nodeMenu.nodeId);
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
                        handleDelete(nodeMenu.nodeId);
                      }}
                    >
                      {plane === "grazeland" ? "Delete item" : "Delete task"}
                    </button>
                  )}
                  {canEdit && (
                    <>
                      <div className="my-1 border-t border-white/10" />
                      <div className="px-3 py-1.5 text-[10px] text-zinc-500 uppercase tracking-wider">
                        Connection points
                      </div>
                      {(
                        [
                          ["hidden", "Hidden"],
                          ["horizontal", "Horizontal"],
                          ["vertical", "Vertical"],
                          ["top", "Top only"],
                          ["bottom", "Bottom only"],
                          ["left", "Left only"],
                          ["right", "Right only"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-white/10 ${currentHandle === value ? "text-emerald-400" : "text-zinc-200"}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setHandle(value);
                          }}
                        >
                          {label}
                        </button>
                      ))}
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
              const menuW = 160;
              const menuH = 60;
              const left = Math.max(8, Math.min(paneMenu.x, window.innerWidth - menuW));
              const top = Math.max(8, Math.min(paneMenu.y, window.innerHeight - menuH));
              return (
              <div
                ref={paneMenuRef}
                className="shelf-note-popover fixed z-[200] min-w-[140px] rounded-xl border border-emerald-400/20 bg-zinc-900 py-1 shadow-xl"
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
              </div>
            );
            })()}

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
