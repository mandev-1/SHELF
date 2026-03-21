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
import { NoteContent } from "./NoteContent";

const NODE_MIN_WIDTH = 260;
const NODE_MAX_WIDTH = 360;
const NODE_MIN_HEIGHT = 64;
const SPACING = 24;
const COLLISION_PADDING = 16;

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
): boolean {
  return a.x < b.x + b.w + COLLISION_PADDING && a.x + a.w + COLLISION_PADDING > b.x && a.y < b.y + b.h + COLLISION_PADDING && a.y + a.h + COLLISION_PADDING > b.y;
}

function resolveCollisions(
  positions: Record<string, { x: number; y: number }>,
  allTodos: ShelfPillarTodoItem[],
  newNodeId: string,
  newPos: { x: number; y: number }
): Record<string, { x: number; y: number }> {
  const result = { ...positions, [newNodeId]: newPos };
  const getRect = (id: string) => {
    const todo = allTodos.find((t) => t.id === id);
    const w = todo ? computeNodeWidth(todo) : NODE_MIN_WIDTH;
    const h = NODE_MIN_HEIGHT;
    const p = result[id] ?? { x: 0, y: 0 };
    return { x: p.x, y: p.y, w, h };
  };

  let changed = true;
  for (let iter = 0; iter < 50 && changed; iter++) {
    changed = false;
    for (const todo of allTodos) {
      if (todo.id === newNodeId) continue;
      const existingRect = getRect(todo.id);
      const newRect = getRect(newNodeId);
      if (!rectsOverlap(existingRect, newRect)) continue;
      const existingCenterY = existingRect.y + existingRect.h / 2;
      const newCenterY = newRect.y + newRect.h / 2;
      const pushDown = existingCenterY < newCenterY;
      const overlap = pushDown
        ? existingRect.y + existingRect.h + COLLISION_PADDING - newRect.y
        : newRect.y + newRect.h + COLLISION_PADDING - existingRect.y;
      if (overlap > 0) {
        result[todo.id] = { ...result[todo.id]!, y: result[todo.id]!.y + (pushDown ? overlap : -overlap) };
        changed = true;
      }
    }
  }
  return result;
}

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
  handleConfig?: ShelfTodoHandleConfig;
  onNoteChange?: (newNote: string) => void;
};

const EDIT_CARD_EXIT_MS = 400;

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
  onSave,
  onClose,
  onClosingStart,
}: {
  todo: ShelfPillarTodoItem;
  onSave: (updates: Partial<ShelfPillarTodoItem>) => void;
  onClose: () => void;
  onClosingStart?: () => void;
}) {
  const [text, setText] = useState(todo.text);
  const [note, setNote] = useState(todo.note ?? "");
  const [tag, setTag] = useState(todo.tag ?? "");
  const [subtitle, setSubtitle] = useState(todo.subtitle ?? "");
  const [blockStatus, setBlockStatus] = useState<ShelfTodoBlockStatus | "">(todo.blockStatus ?? "");
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
    });
    requestClose();
  }, [text, note, tag, subtitle, blockStatus, onSave, requestClose]);

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
        <span className="text-[10px] font-medium text-zinc-500">Edit task</span>
        {escapePrompted && (
          <span className="text-[10px] text-amber-400/90">Press Esc again to close</span>
        )}
      </div>
      <div className="space-y-2">
        <Input
          variant="secondary"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Task title"
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
          className="shelf-note-popover-textarea min-h-[60px] w-full resize-y rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none"
          rows={2}
        />
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
      <div className="mt-2 flex gap-2">
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
  const { text, note, tag, subtitle, blockStatus, handleConfig } = (props.data ?? {}) as TodoFlowNodeData;
  const statusClass = nodeStatusClass(blockStatus);
  const config = handleConfig ?? "horizontal";
  return (
    <div className={`shelf-flow-node shelf-top6-card group flex w-full min-h-[4rem] flex-col gap-1.5 bg-black/35 px-1 py-2.5 shadow-sm ${statusClass}`}>
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
  onEditTodo?: (id: string, updates: Partial<ShelfPillarTodoItem>) => void
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
        handleConfig: todo.handleConfig ?? "horizontal",
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

  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition: sourcePosition ?? Position.Bottom,
    targetPosition: targetPosition ?? Position.Top,
  });

  const effectiveMarkerEnd = arrow ? "arrowclosed" : markerEnd;

  const pathStyle = {
    ...(style as object),
    fill: "none",
  };

  return (
    <g>
      {doubled && (
        <path
          d={path}
          style={{ ...pathStyle, transform: "translate(2px, 0)" } as React.CSSProperties}
          className="react-flow__edge-path"
        />
      )}
      <BaseEdge
        path={path}
        markerEnd={effectiveMarkerEnd}
        markerStart={markerStart}
        style={pathStyle}
        interactionWidth={interactionWidth}
      />
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
      },
    }));
}

function VisualFlowPanelInner({
  todos,
  visualFlow,
  onVisualFlowChange,
  onEditTodo,
  onDeleteTodo,
  onAddTodo,
  onTaskCompleted,
  onTodoLog,
  fullPage = false,
}: {
  todos: ShelfPillarTodoItem[];
  visualFlow: VisualFlowData;
  onVisualFlowChange: (data: VisualFlowData) => void;
  onEditTodo?: (id: string, updates: Partial<ShelfPillarTodoItem>) => void;
  onDeleteTodo?: (id: string) => void;
  onAddTodo?: (todo: ShelfPillarTodoItem) => void;
  onTaskCompleted?: () => void;
  onTodoLog?: (entry: string) => void;
  fullPage?: boolean;
}) {
  const { screenToFlowPosition } = useReactFlow();
  const [nodeMenu, setNodeMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [edgeMenu, setEdgeMenu] = useState<{ edgeId: string; x: number; y: number } | null>(null);
  const [paneMenu, setPaneMenu] = useState<{ x: number; y: number } | null>(null);
  const [editNodeId, setEditNodeId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const edgeMenuRef = useRef<HTMLDivElement>(null);
  const paneMenuRef = useRef<HTMLDivElement>(null);

  const initialNodes = useMemo(
    () => buildInitialNodes(todos, visualFlow.nodePositions, onEditTodo),
    [todos, visualFlow.nodePositions, onEditTodo]
  );
  const initialEdges = useMemo(
    () => buildInitialEdges(todos, visualFlow.edges),
    [todos, visualFlow.edges]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(buildInitialNodes(todos, visualFlow.nodePositions, onEditTodo));
    setEdges(buildInitialEdges(todos, visualFlow.edges));
  }, [todos, visualFlow.nodePositions, visualFlow.edges, onEditTodo, setNodes, setEdges]);

  const hasInteracted = useRef(false);

  const onConnect = useCallback(
    (params: Connection) => {
      hasInteracted.current = true;
      setEdges((eds) => {
        const next = addEdge(params, eds);
        return next.map((e) =>
          e.type !== "todoFlow"
            ? { ...e, type: "todoFlow", data: { ...(e.data as object), arrow: false, doubled: false } }
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
        const d = e.data as { arrow?: boolean; doubled?: boolean } | undefined;
        return {
          source: e.source,
          target: e.target,
          ...(d?.arrow && { arrow: true }),
          ...(d?.doubled && { doubled: true }),
        };
      });
      onVisualFlowChange({ nodePositions: positions, edges: edgeList });
    },
    [nodes, edges, onVisualFlowChange]
  );

  useEffect(() => {
    if (nodes.length === 0 && edges.length === 0) return;
    const t = window.setTimeout(() => persist(), 100);
    return () => window.clearTimeout(t);
  }, [nodes, edges, persist]);

  const onNodeDragStop = useCallback(
    (_e: React.MouseEvent, node: Node) => {
      hasInteracted.current = true;
      const selectedCount = nodes.filter((n) => n.selected).length;
      if (selectedCount > 1) {
        persist();
        return;
      }
      const positions: Record<string, { x: number; y: number }> = {};
      nodes.forEach((n) => {
        if (n.position) positions[n.id] = { x: n.position.x, y: n.position.y };
      });
      const pos = positions[node.id];
      if (!pos) {
        persist();
        return;
      }
      const resolved = resolveCollisions(positions, todos, node.id, pos);
      const changed = Object.keys(resolved).some(
        (id) => resolved[id].x !== positions[id]?.x || resolved[id].y !== positions[id]?.y
      );
      if (changed) {
        setNodes((nds) =>
          nds.map((n) => {
            const p = resolved[n.id];
            if (!p || (n.position?.x === p.x && n.position?.y === p.y)) return n;
            return { ...n, position: { x: p.x, y: p.y } };
          })
        );
        persist(resolved);
      } else {
        persist();
      }
    },
    [nodes, todos, setNodes, persist]
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

  const onPaneContextMenu = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      e.preventDefault();
      setEdgeMenu(null);
      if (onAddTodo) setPaneMenu({ x: e.clientX, y: e.clientY });
    },
    [onAddTodo]
  );

  const handleCreateTask = useCallback(() => {
    if (!onAddTodo || !paneMenu) return;
    const newTodo: ShelfPillarTodoItem = {
      id: crypto.randomUUID(),
      text: "New task",
      done: false,
    };
    const flowPos = screenToFlowPosition({ x: paneMenu.x, y: paneMenu.y });
    const width = NODE_MIN_WIDTH;
    const height = NODE_MIN_HEIGHT;
    const pos = { x: flowPos.x - width / 2, y: flowPos.y - height / 2 };
    const resolved = resolveCollisions(
      visualFlow.nodePositions ?? {},
      [...todos, newTodo],
      newTodo.id,
      pos
    );
    onAddTodo(newTodo);
    onVisualFlowChange({
      ...visualFlow,
      nodePositions: resolved,
    });
    setPaneMenu(null);
    setEditNodeId(newTodo.id);
  }, [onAddTodo, onVisualFlowChange, paneMenu, visualFlow, todos]);

  const handleEdit = useCallback(
    (id: string) => {
      setNodeMenu(null);
      setEditNodeId(id);
    },
    []
  );

  const handleDelete = useCallback(
    (id: string) => {
      const todo = todos.find((t) => t.id === id);
      const label = todo?.text ? `"${todo.text}"` : "this task";
      if (!window.confirm(`Remove ${label}? This will clear it from your list.`)) return;
      if (!window.confirm(`Are you sure? This cannot be undone.`)) return;
      setNodeMenu(null);
      setEditNodeId(null);
      onDeleteTodo?.(id);
      hasInteracted.current = true;
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
      setNodes((ns) => ns.filter((n) => n.id !== id));
    },
    [onDeleteTodo, setEdges, setNodes, todos]
  );

  const handleMarkCompleted = useCallback(
    (id: string) => {
      const todo = todos.find((t) => t.id === id);
      onEditTodo?.(id, { done: true });
      onTaskCompleted?.();
      setNodeMenu(null);
      if (todo) onTodoLog?.(`completed task ${todo.text}`);
    },
    [onEditTodo, onTaskCompleted, onTodoLog, todos]
  );

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
      </div>

      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        <div className="shrink-0 p-6 pb-0">
          {editNodeId && (() => {
            const t = todos.find((x) => x.id === editNodeId);
            if (!t || !onEditTodo) return null;
            return (
              <EditCardWrapper key={editNodeId}>
                <NodeEditCard
                  todo={t}
                  onSave={(updates) => {
                    onEditTodo(editNodeId, updates);
                    setEditNodeId(null);
                  }}
                  onClose={() => setEditNodeId(null)}
                />
              </EditCardWrapper>
            );
          })()}
        </div>
        <div className="flex-1 min-h-0 px-6 pb-6">
          <section className="h-full">
            <div className="relative h-full min-h-[280px] rounded-xl border border-white/10 visual-flow-canvas">
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
                multiSelectionKeyCode={["Control", "Meta"]}
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
              {todos.length === 0 && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
                  <p className="text-sm text-zinc-400">
                    Right-click on the canvas to create a task, or add todos in the Pillar.
                  </p>
                  <p className="text-xs text-zinc-500">
                    Drag nodes to arrange, Ctrl+click to select multiple, connect handles to define sequence.
                  </p>
                </div>
              )}
            </div>

            {nodeMenu && (() => {
              const todo = todos.find((t) => t.id === nodeMenu.nodeId);
              if (!todo || (!onEditTodo && !onDeleteTodo)) return null;
              const currentHandle = (todo.handleConfig ?? "horizontal") as ShelfTodoHandleConfig;
              const setHandle = (config: ShelfTodoHandleConfig) => {
                onEditTodo?.(nodeMenu.nodeId, { handleConfig: config });
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
                  {onEditTodo && (
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(nodeMenu.nodeId);
                      }}
                    >
                      Edit task…
                    </button>
                  )}
                  {onEditTodo && !todo.done && (
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
                  {onDeleteTodo && (
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-red-400/90 hover:bg-white/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(nodeMenu.nodeId);
                      }}
                    >
                      Delete task
                    </button>
                  )}
                  {onEditTodo && (
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
              const d = edge.data as { arrow?: boolean; doubled?: boolean } | undefined;
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

            {paneMenu && onAddTodo && (() => {
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
                  Create new task
                </button>
              </div>
            );
            })()}

          </section>
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
