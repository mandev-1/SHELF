import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type ClipboardEvent } from "react";

const DASHBOARDS_KEY = "shelf-error-dashboards";
const CURRENT_DASHBOARD_KEY = "shelf-error-dashboard-current";

interface SavedDashboard {
  id: string;
  name: string;
  rawJson: string;
  sourceLabel?: string;
}

interface RawDashboardError {
  Error?: unknown;
  Key_problem?: unknown;
  Multiple_count?: unknown;
  Importance?: unknown;
  Count?: unknown;
  Affected_IDs?: unknown;
}

interface DashboardError {
  error: string;
  keyProblem: string;
  multipleCount: boolean;
  importance: string;
  count: number;
  affectedIds: string[];
}

interface DashboardPayload {
  totalCount: number;
  foundDistinct: number;
  errors: DashboardError[];
}

const IMPORTANCE_ORDER = ["Very High", "High", "Moderate", "Low", "Unknown"] as const;

function normalizeImportance(input: string): string {
  const value = input.trim();
  if (!value) return "Unknown";
  const lower = value.toLowerCase();
  if (lower === "very high") return "Very High";
  if (lower === "high") return "High";
  if (lower === "moderate" || lower === "medium") return "Moderate";
  if (lower === "low") return "Low";
  return value;
}

function readNumber(input: unknown, fallback = 0): number {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input === "string") {
    const parsed = Number(input.trim());
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function readString(input: unknown, fallback = ""): string {
  return typeof input === "string" ? input : fallback;
}

function readStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((item): item is string => typeof item === "string");
}

function normalizePayload(input: unknown): DashboardPayload {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("JSON root must be an object.");
  }

  const raw = input as Record<string, unknown>;
  const rawErrors = raw.Errors;

  if (!Array.isArray(rawErrors)) {
    throw new Error("Expected an 'Errors' array in the JSON payload.");
  }

  const errors = rawErrors
    .filter((item): item is RawDashboardError => item !== null && typeof item === "object")
    .map((item) => {
      const count = Math.max(0, readNumber(item.Count));
      return {
        error: readString(item.Error, "Unknown error"),
        keyProblem: readString(item.Key_problem, "No key problem details"),
        multipleCount: Boolean(item.Multiple_count),
        importance: normalizeImportance(readString(item.Importance, "Unknown")),
        count,
        affectedIds: readStringArray(item.Affected_IDs),
      } satisfies DashboardError;
    });

  const totalCount = Math.max(0, readNumber(raw.Total_count, errors.reduce((sum, item) => sum + item.count, 0)));
  const foundDistinct = Math.max(0, readNumber(raw.Found_distinct, errors.length));

  return {
    totalCount,
    foundDistinct,
    errors,
  };
}

function importanceColor(importance: string): string {
  switch (importance) {
    case "Very High":
      return "bg-rose-500/15 text-rose-200 border border-rose-300/25";
    case "High":
      return "bg-orange-500/15 text-orange-200 border border-orange-300/25";
    case "Moderate":
      return "bg-amber-500/15 text-amber-100 border border-amber-300/25";
    case "Low":
      return "bg-emerald-500/15 text-emerald-100 border border-emerald-300/25";
    default:
      return "bg-zinc-500/20 text-zinc-200 border border-zinc-300/20";
  }
}

function loadDashboardsFromStorage(): SavedDashboard[] {
  try {
    const raw = window.localStorage.getItem(DASHBOARDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(
          (x: unknown) =>
            x !== null &&
            typeof x === "object" &&
            typeof (x as SavedDashboard).id === "string" &&
            typeof (x as SavedDashboard).name === "string" &&
            typeof (x as SavedDashboard).rawJson === "string"
        )
      : [];
  } catch {
    return [];
  }
}

function migrateLegacyStorage(): { dashboards: SavedDashboard[]; currentId: string | null } {
  try {
    const raw = window.localStorage.getItem("shelf-error-dashboard-raw-json") ?? "";
    const source = window.localStorage.getItem("shelf-error-dashboard-source");
    if (!raw.trim()) return { dashboards: loadDashboardsFromStorage(), currentId: null };
    const dashboards = loadDashboardsFromStorage();
    if (dashboards.length > 0) return { dashboards, currentId: window.localStorage.getItem(CURRENT_DASHBOARD_KEY) };
    const id = crypto.randomUUID();
    const migrated: SavedDashboard[] = [{ id, name: "Default", rawJson: raw, sourceLabel: source ?? undefined }];
    window.localStorage.setItem(DASHBOARDS_KEY, JSON.stringify(migrated));
    window.localStorage.setItem(CURRENT_DASHBOARD_KEY, id);
    window.localStorage.removeItem("shelf-error-dashboard-raw-json");
    window.localStorage.removeItem("shelf-error-dashboard-source");
    return { dashboards: migrated, currentId: id };
  } catch {
    return { dashboards: loadDashboardsFromStorage(), currentId: null };
  }
}

export function ErrorDashboardPanel({ fullPage = false }: { fullPage?: boolean }) {
  const [dashboards, setDashboards] = useState<SavedDashboard[]>(() => []);
  const [currentId, setCurrentId] = useState<string | null>(() => null);
  const [rawJson, setRawJson] = useState("");
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const [showInputPanel, setShowInputPanel] = useState(() => true);
  const [showCoveragePanel, setShowCoveragePanel] = useState(() => false);
  const [showImportancePanel, setShowImportancePanel] = useState(() => false);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [initDone, setInitDone] = useState(false);

  const persistDashboards = useCallback((list: SavedDashboard[], selectedId: string | null) => {
    try {
      window.localStorage.setItem(DASHBOARDS_KEY, JSON.stringify(list));
      if (selectedId) window.localStorage.setItem(CURRENT_DASHBOARD_KEY, selectedId);
      else window.localStorage.removeItem(CURRENT_DASHBOARD_KEY);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const { dashboards: loaded, currentId: loadedCurrent } = migrateLegacyStorage();
    setDashboards(loaded);
    if (loaded.length > 0) {
      const id = loadedCurrent && loaded.some((d) => d.id === loadedCurrent) ? loadedCurrent : loaded[0].id;
      setCurrentId(id);
      const d = loaded.find((x) => x.id === id);
      if (d) {
        setRawJson(d.rawJson);
        setSourceLabel(d.sourceLabel ?? null);
        try {
          const normalized = normalizePayload(JSON.parse(d.rawJson));
          setPayload(normalized);
          setErrorText(null);
        } catch {
          setPayload(null);
          setErrorText(null);
        }
      }
    }
    setInitDone(true);
  }, []);

  useEffect(() => {
    if (!initDone || !currentId) return;
    setDashboards((prev) =>
      prev.map((d) => (d.id === currentId ? { ...d, rawJson, sourceLabel: sourceLabel ?? undefined } : d))
    );
  }, [rawJson, sourceLabel, currentId, initDone]);

  useEffect(() => {
    if (!initDone) return;
    persistDashboards(dashboards, currentId);
  }, [dashboards, currentId, initDone, persistDashboards]);

  const selectTab = useCallback(
    (id: string) => {
      const d = dashboards.find((x) => x.id === id);
      if (!d) return;
      setCurrentId(id);
      setRawJson(d.rawJson);
      setSourceLabel(d.sourceLabel ?? null);
      setErrorText(null);
      try {
        if (d.rawJson.trim()) {
          const normalized = normalizePayload(JSON.parse(d.rawJson));
          setPayload(normalized);
        } else setPayload(null);
      } catch {
        setPayload(null);
      }
    },
    [dashboards]
  );

  const addDashboard = useCallback(() => {
    const id = crypto.randomUUID();
    const name = `Analytics ${dashboards.length + 1}`;
    const newDashboards = [...dashboards, { id, name, rawJson: "" }];
    setDashboards(newDashboards);
    setCurrentId(id);
    setRawJson("");
    setSourceLabel(null);
    setPayload(null);
    setErrorText(null);
    persistDashboards(newDashboards, id);
  }, [dashboards, persistDashboards]);

  const removeDashboard = useCallback(
    (id: string) => {
      const next = dashboards.filter((d) => d.id !== id);
      setDashboards(next);
      if (currentId === id) {
        const nextId = next.length > 0 ? next[0].id : null;
        setCurrentId(nextId);
        const d = next.find((x) => x.id === nextId);
        if (d) {
          setRawJson(d.rawJson);
          setSourceLabel(d.sourceLabel ?? null);
          try {
            setPayload(d.rawJson.trim() ? normalizePayload(JSON.parse(d.rawJson)) : null);
            setErrorText(null);
          } catch {
            setPayload(null);
          }
        } else {
          setRawJson("");
          setSourceLabel(null);
          setPayload(null);
        }
      }
      persistDashboards(next, currentId === id ? (next[0]?.id ?? null) : currentId);
    },
    [dashboards, currentId, persistDashboards]
  );

  const renameDashboard = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim() || "Unnamed";
      setDashboards((prev) => prev.map((d) => (d.id === id ? { ...d, name: trimmed } : d)));
      setEditingNameId(null);
      persistDashboards(
        dashboards.map((d) => (d.id === id ? { ...d, name: trimmed } : d)),
        currentId
      );
    },
    [dashboards, currentId, persistDashboards]
  );

  const totalFromRows = useMemo(
    () => payload?.errors.reduce<number>((sum, item) => sum + item.count, 0) ?? 0,
    [payload]
  );

  const importanceBreakdown = useMemo(() => {
    if (!payload) return [] as Array<{ importance: string; count: number }>;

    const map = new Map<string, number>();
    for (const item of payload.errors) {
      map.set(item.importance, (map.get(item.importance) ?? 0) + item.count);
    }

    const list = Array.from(map.entries()).map(([importance, count]) => ({ importance, count }));
    return list.sort((a, b) => {
      const indexA = IMPORTANCE_ORDER.indexOf(a.importance as (typeof IMPORTANCE_ORDER)[number]);
      const indexB = IMPORTANCE_ORDER.indexOf(b.importance as (typeof IMPORTANCE_ORDER)[number]);
      const rankA = indexA === -1 ? IMPORTANCE_ORDER.length : indexA;
      const rankB = indexB === -1 ? IMPORTANCE_ORDER.length : indexB;
      if (rankA !== rankB) return rankA - rankB;
      return b.count - a.count;
    });
  }, [payload]);

  const maxImportanceCount = useMemo(() => {
    if (importanceBreakdown.length === 0) return 1;
    return Math.max(...importanceBreakdown.map((item) => item.count), 1);
  }, [importanceBreakdown]);

  const topError = useMemo(() => {
    if (!payload || payload.errors.length === 0) return null;
    return [...payload.errors].sort((a, b) => b.count - a.count)[0];
  }, [payload]);

  const parsedCoverage = payload?.totalCount ? Math.min(100, Math.round((totalFromRows / payload.totalCount) * 100)) : 0;

  const parseAndLoad = useCallback((text: string, source?: string) => {
    try {
      const parsed = JSON.parse(text);
      const normalized = normalizePayload(parsed);
      setPayload(normalized);
      setErrorText(null);
      if (source !== undefined) setSourceLabel(source);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to parse JSON.";
      setErrorText(message);
      setPayload(null);
    }
  }, []);

  const handleLoadClick = () => {
    if (!rawJson.trim()) {
      setErrorText("Paste JSON content or load a JSON file first.");
      return;
    }
    parseAndLoad(rawJson);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setRawJson(text);
    setSourceLabel(file.name);
    parseAndLoad(text, file.name);
    event.target.value = "";
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = event.clipboardData.getData("text");
    if (!pasted.trim()) return;
    window.setTimeout(() => {
      setRawJson(pasted);
      setSourceLabel("Pasted JSON");
      parseAndLoad(pasted, "Pasted JSON");
    }, 0);
  };

  const handleClear = () => {
    setRawJson("");
    setPayload(null);
    setErrorText(null);
    setSourceLabel(null);
  };

  const containerClass = fullPage
    ? "min-w-0 rounded-2xl border border-white/10 bg-zinc-900/50 flex flex-col h-[calc(100vh-9rem)] overflow-hidden"
    : "mt-3 min-w-0 rounded-2xl border border-white/10 bg-black/20 p-3";

  const textareaRows = fullPage ? 6 : 6;

  const summaryGridClass = "grid grid-cols-3 gap-2";

  const collapseEverything = () => {
    setShowInputPanel(false);
    setShowCoveragePanel(false);
    setShowImportancePanel(false);
  };

  const expandEverything = () => {
    setShowInputPanel(true);
    setShowCoveragePanel(true);
    setShowImportancePanel(true);
  };

  const sortedErrors = useMemo(
    () => (payload ? [...payload.errors].sort((a, b) => b.count - a.count) : []),
    [payload]
  );

  return (
    <div className={containerClass}>
      {/* Header: title + compact toolbar */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/20 px-4 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold tracking-tight text-zinc-100">
            Error Dashboard
          </h1>
          {sourceLabel ? (
            <span className="truncate max-w-[12rem] text-xs text-zinc-500" title={sourceLabel}>
              {sourceLabel}
            </span>
          ) : null}
        </div>
        {fullPage ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={collapseEverything}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] text-zinc-400 hover:text-zinc-200"
            >
              Collapse all
            </button>
            <button
              type="button"
              onClick={expandEverything}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] text-zinc-400 hover:text-zinc-200"
            >
              Expand all
            </button>
          </div>
        ) : null}
      </div>

      {/* Tabs: named dashboards */}
      <div className="shrink-0 flex flex-wrap items-center gap-1 border-b border-white/10 bg-black/15 px-4 py-2">
        {dashboards.map((d) => (
          <div
            key={d.id}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs ${
              d.id === currentId
                ? "border-cyan-400/40 bg-cyan-500/20 text-cyan-100"
                : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:bg-white/10 hover:text-zinc-200"
            }`}
          >
            {editingNameId === d.id ? (
              <input
                type="text"
                value={d.name}
                autoFocus
                className="min-w-[4rem] max-w-[10rem] rounded border-0 bg-black/30 px-1 py-0.5 text-xs text-zinc-100 outline-none focus:ring-1 focus:ring-cyan-400/50"
                onChange={(e) =>
                  setDashboards((prev) => prev.map((x) => (x.id === d.id ? { ...x, name: e.target.value } : x)))
                }
                onBlur={(e) => renameDashboard(d.id, (e.target as HTMLInputElement).value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") renameDashboard(d.id, (e.target as HTMLInputElement).value);
                  if (e.key === "Escape") setEditingNameId(null);
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => selectTab(d.id)}
                onDoubleClick={() => setEditingNameId(d.id)}
                className="truncate max-w-[8rem] text-left"
                title="Double-click to rename"
              >
                {d.name}
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (dashboards.length <= 1) return;
                if (window.confirm(`Remove "${d.name}"?`)) removeDashboard(d.id);
              }}
              className="rounded p-0.5 text-zinc-500 hover:bg-white/10 hover:text-zinc-200 disabled:invisible"
              aria-label={`Remove ${d.name}`}
              title="Remove tab"
              disabled={dashboards.length <= 1}
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addDashboard}
          className="rounded-lg border border-dashed border-white/20 bg-white/5 px-2.5 py-1.5 text-[11px] text-zinc-500 hover:border-cyan-400/30 hover:bg-cyan-500/10 hover:text-cyan-200"
        >
          + New
        </button>
      </div>

      {dashboards.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-12 text-center">
          <p className="text-sm text-zinc-400">No analytics dashboards yet.</p>
          <button
            type="button"
            onClick={addDashboard}
            className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/30"
          >
            Add analytics
          </button>
        </div>
      ) : (
        <>
      {/* Input panel (collapsible) */}
      <div className="shrink-0 border-b border-white/10 bg-white/[0.02]">
        <button
          type="button"
          onClick={() => setShowInputPanel((prev) => !prev)}
          className="flex w-full items-center justify-between px-4 py-2 text-left text-xs font-medium text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
        >
          <span>Paste or load JSON</span>
          <span className="text-zinc-500">{showInputPanel ? "Hide" : "Show"}</span>
        </button>
        {showInputPanel ? (
          <div className="space-y-2 border-t border-white/10 px-4 pb-4 pt-2">
            <div className="flex items-center gap-2">
              <label className="cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-zinc-300 hover:border-cyan-400/30 hover:text-cyan-100">
                Load file
                <input type="file" accept="application/json,.json" className="hidden" onChange={handleFileChange} />
              </label>
              <button
                type="button"
                onClick={handleLoadClick}
                className="rounded-lg border border-cyan-400/30 bg-cyan-500/15 px-3 py-2 text-[11px] font-medium text-cyan-100 hover:bg-cyan-500/25"
              >
                Visualize
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-zinc-400 hover:text-zinc-200"
              >
                Clear
              </button>
            </div>
            <textarea
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
              onPaste={handlePaste}
              placeholder="Paste raw JSON here…"
              rows={textareaRows}
              className="w-full resize-y rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-500 outline-none focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/20"
            />
          </div>
        ) : null}
      </div>

      {errorText ? (
        <div className="shrink-0 border-b border-rose-400/20 bg-rose-500/10 px-4 py-2 text-xs text-rose-100">
          {errorText}
        </div>
      ) : null}

      {payload ? (
        <>
          {/* Compact summary bar — single row, doesn't compete with list */}
          <div className="shrink-0 border-b border-white/10 bg-black/30 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className={summaryGridClass}>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">Total</div>
                  <div className="text-lg font-semibold tabular-nums text-zinc-100">{payload.totalCount}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">Distinct</div>
                  <div className="text-lg font-semibold tabular-nums text-zinc-100">{payload.foundDistinct}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">Top count</div>
                  <div className="text-lg font-semibold tabular-nums text-zinc-100">{topError?.count ?? 0}</div>
                </div>
              </div>
              {fullPage ? (
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setShowCoveragePanel((prev) => !prev)}
                    className="text-[11px] text-zinc-500 hover:text-zinc-300"
                  >
                    {showCoveragePanel ? "Hide coverage" : "Show coverage"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowImportancePanel((prev) => !prev)}
                    className="text-[11px] text-zinc-500 hover:text-zinc-300"
                  >
                    {showImportancePanel ? "Hide importance" : "Show importance"}
                  </button>
                </div>
              ) : null}
            </div>
            {fullPage && (showCoveragePanel || showImportancePanel) ? (
              <div className="mt-3 flex flex-wrap gap-4 border-t border-white/10 pt-3">
                {showCoveragePanel ? (
                  <div className="min-w-[140px]">
                    <div className="mb-1 text-[10px] text-zinc-500">Coverage</div>
                    <div className="h-1.5 w-full rounded-full bg-white/10">
                      <div
                        className="h-1.5 rounded-full bg-cyan-500/80"
                        style={{ width: `${parsedCoverage}%` }}
                      />
                    </div>
                    <div className="mt-0.5 text-[10px] text-zinc-500">
                      {totalFromRows} ({parsedCoverage}%)
                    </div>
                  </div>
                ) : null}
                {showImportancePanel ? (
                  <div className="flex flex-1 flex-wrap gap-x-4 gap-y-1">
                    {importanceBreakdown.map((item) => {
                      const width = Math.max(6, Math.round((item.count / maxImportanceCount) * 100));
                      return (
                        <div key={item.importance} className="flex items-center gap-2">
                          <span className="w-20 truncate text-[10px] text-zinc-400">{item.importance}</span>
                          <div className="h-1.5 w-24 rounded-full bg-white/10">
                            <div
                              className="h-1.5 rounded-full bg-zinc-400/60"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                          <span className="text-[10px] tabular-nums text-zinc-500">{item.count}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Primary content: error list */}
          <div className={fullPage ? "flex-1 min-h-0 overflow-auto" : "max-h-80 overflow-auto"}>
            <div className="px-4 py-3">
              <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Errors · {sortedErrors.length} distinct
              </h2>
              <ul className="space-y-4">
                {sortedErrors.map((item) => {
                  const ratio = payload.totalCount ? Math.round((item.count / payload.totalCount) * 100) : 0;
                  return (
                    <li
                      key={`${item.error}-${item.count}`}
                      className="rounded-xl border border-white/10 bg-zinc-800/40 p-4 shadow-sm"
                    >
                      {/* Level 1: Error title */}
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <h3 className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-zinc-100">
                          {item.error}
                        </h3>
                        <span className="shrink-0 rounded-md bg-cyan-500/15 px-2 py-1 text-xs font-medium tabular-nums text-cyan-100">
                          {item.count}
                        </span>
                      </div>
                      {/* Level 2: Key problem — main readable body */}
                      <p className="mb-3 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-300">
                        {item.keyProblem}
                      </p>
                      {/* Level 3: Metadata row */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                        <span className={`rounded px-1.5 py-0.5 font-medium ${importanceColor(item.importance)}`}>
                          {item.importance}
                        </span>
                        <span className="text-zinc-500">{ratio}% of total</span>
                        {item.multipleCount ? (
                          <span className="text-cyan-400/90">Multiple occurrences</span>
                        ) : null}
                      </div>
                      {/* Progress bar — subtle */}
                      <div className="mt-2 h-1 w-full rounded-full bg-white/5">
                        <div
                          className="h-1 rounded-full bg-cyan-500/30"
                          style={{ width: `${Math.max(2, ratio)}%` }}
                        />
                      </div>
                      {item.affectedIds.length > 0 ? (
                        <div className="mt-2 truncate font-mono text-[10px] text-zinc-500">
                          IDs: {item.affectedIds.join(", ")}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center px-4 py-12 text-center text-sm text-zinc-500">
          Paste JSON above and click Visualize to see the error list.
        </div>
      )}
        </>
      )}
    </div>
  );
}
