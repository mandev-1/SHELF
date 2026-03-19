import { useEffect, useMemo, useState, type ChangeEvent, type ClipboardEvent } from "react";

const DASHBOARD_RAW_KEY = "shelf-error-dashboard-raw-json";
const DASHBOARD_SOURCE_KEY = "shelf-error-dashboard-source";

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

export function ErrorDashboardPanel({ fullPage = false }: { fullPage?: boolean }) {
  const [rawJson, setRawJson] = useState("");
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const [showInputPanel, setShowInputPanel] = useState(() => true);
  const [showSummaryPanel, setShowSummaryPanel] = useState(() => !fullPage);
  const [showCoveragePanel, setShowCoveragePanel] = useState(() => !fullPage);
  const [showImportancePanel, setShowImportancePanel] = useState(() => !fullPage);

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

  const parseAndLoad = (text: string, source?: string) => {
    try {
      const parsed = JSON.parse(text);
      const normalized = normalizePayload(parsed);
      setPayload(normalized);
      setErrorText(null);
      if (source) setSourceLabel(source);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to parse JSON.";
      setErrorText(message);
      setPayload(null);
    }
  };

  useEffect(() => {
    try {
      const persistedRaw = window.localStorage.getItem(DASHBOARD_RAW_KEY) ?? "";
      const persistedSource = window.localStorage.getItem(DASHBOARD_SOURCE_KEY);
      if (!persistedRaw.trim()) return;
      setRawJson(persistedRaw);
      parseAndLoad(persistedRaw, persistedSource ?? undefined);
    } catch {
      // ignore persistence failures
    }
  }, []);

  useEffect(() => {
    try {
      if (rawJson.trim()) window.localStorage.setItem(DASHBOARD_RAW_KEY, rawJson);
      else window.localStorage.removeItem(DASHBOARD_RAW_KEY);
      if (sourceLabel?.trim()) window.localStorage.setItem(DASHBOARD_SOURCE_KEY, sourceLabel);
      else window.localStorage.removeItem(DASHBOARD_SOURCE_KEY);
    } catch {
      // ignore persistence failures
    }
  }, [rawJson, sourceLabel]);

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
    parseAndLoad(text, file.name);
    event.target.value = "";
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = event.clipboardData.getData("text");
    if (!pasted.trim()) return;
    // Parse immediately so pasted JSON works without file upload or extra clicks.
    window.setTimeout(() => {
      setRawJson(pasted);
      parseAndLoad(pasted, "Pasted JSON");
    }, 0);
  };

  const containerClass = fullPage
    ? "min-w-0 rounded-3xl border border-cyan-300/20 bg-black/30 p-6 h-[calc(100vh-9.5rem)] flex flex-col"
    : "mt-3 min-w-0 rounded-2xl border border-white/10 bg-black/20 p-3";

  const textareaRows = fullPage ? 10 : 6;

  const summaryGridClass = fullPage ? "grid grid-cols-1 gap-2 md:grid-cols-3" : "grid grid-cols-1 gap-2";

  const listClass = fullPage ? "flex-1 min-h-[1080px] space-y-1.5 overflow-auto pr-1" : "max-h-72 space-y-1.5 overflow-auto pr-1";

  const collapseEverything = () => {
    setShowInputPanel(false);
    setShowSummaryPanel(false);
    setShowCoveragePanel(false);
    setShowImportancePanel(false);
  };

  const expandEverything = () => {
    setShowInputPanel(true);
    setShowSummaryPanel(true);
    setShowCoveragePanel(true);
    setShowImportancePanel(true);
  };

  return (
    <div className={containerClass}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className={fullPage ? "text-lg font-semibold text-cyan-100" : "text-xs font-semibold text-cyan-200"}>
          Error Dashboard
        </div>
        <div className="flex items-center gap-2">
          {fullPage ? (
            <>
              <button
                type="button"
                onClick={collapseEverything}
                className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[10px] text-zinc-300 hover:bg-white/10"
              >
                Collapse panels
              </button>
              <button
                type="button"
                onClick={expandEverything}
                className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[10px] text-zinc-300 hover:bg-white/10"
              >
                Expand panels
              </button>
            </>
          ) : null}
          {sourceLabel ? <div className="truncate text-[10px] text-cyan-100/70">{sourceLabel}</div> : null}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03]">
        <button
          type="button"
          onClick={() => setShowInputPanel((prev) => !prev)}
          className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-zinc-200 hover:bg-white/5"
        >
          <span>Input</span>
          <span className="text-zinc-400">{showInputPanel ? "Hide" : "Show"}</span>
        </button>
        {showInputPanel ? (
          <div className="space-y-2 border-t border-white/10 p-3">
            <label className="block rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] text-zinc-300 hover:border-cyan-300/40 hover:text-cyan-100 cursor-pointer">
              Load JSON file
              <input type="file" accept="application/json,.json" className="hidden" onChange={handleFileChange} />
            </label>

            <textarea
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
              onPaste={handlePaste}
              placeholder="Paste raw JSON here..."
              rows={textareaRows}
              className="w-full resize-y rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] text-zinc-200 placeholder:text-zinc-500 outline-none transition focus:border-cyan-300/45 focus:ring-1 focus:ring-cyan-300/20"
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLoadClick}
                className="rounded-lg border border-cyan-300/35 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-medium text-cyan-100 hover:bg-cyan-400/20"
              >
                Visualize JSON
              </button>
              <button
                type="button"
                onClick={() => {
                  setRawJson("");
                  setPayload(null);
                  setErrorText(null);
                  setSourceLabel(null);
                }}
                className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300 hover:bg-white/10"
              >
                Clear
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {errorText ? <div className="mt-2 rounded-lg border border-rose-300/30 bg-rose-400/10 px-2 py-1 text-[11px] text-rose-100">{errorText}</div> : null}

      {payload ? (
        <div className={fullPage ? "mt-3 space-y-2 flex-1 min-h-0 flex flex-col" : "mt-3 space-y-2"}>
          <div className="rounded-xl border border-white/10 bg-white/[0.03]">
            <button
              type="button"
              onClick={() => setShowSummaryPanel((prev) => !prev)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-zinc-200 hover:bg-white/5"
            >
              <span>Summary</span>
              <span className="text-zinc-400">{showSummaryPanel ? "Hide" : "Show"}</span>
            </button>
            {showSummaryPanel ? (
              <div className={`${summaryGridClass} border-t border-white/10 p-2`}>
                <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 p-2">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-100/70">Total Count</div>
                  <div className="text-base font-semibold text-cyan-50">{payload.totalCount}</div>
                </div>
                <div className="rounded-xl border border-fuchsia-300/20 bg-fuchsia-400/10 p-2">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-fuchsia-100/70">Distinct Errors</div>
                  <div className="text-base font-semibold text-fuchsia-50">{payload.foundDistinct}</div>
                </div>
                <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-2">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-emerald-100/70">Top Error Count</div>
                  <div className="text-base font-semibold text-emerald-50">{topError?.count ?? 0}</div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03]">
            <button
              type="button"
              onClick={() => setShowCoveragePanel((prev) => !prev)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-zinc-200 hover:bg-white/5"
            >
              <span>Coverage</span>
              <span className="text-zinc-400">{showCoveragePanel ? "Hide" : "Show"}</span>
            </button>
            {showCoveragePanel ? (
              <div className="border-t border-white/10 p-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.16em] text-zinc-400">Coverage</div>
                  <div className="h-2 rounded-full bg-white/10">
                    <div className="h-2 rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300" style={{ width: `${parsedCoverage}%` }} />
                  </div>
                  <div className="mt-1 text-[10px] text-zinc-400">
                    Parsed rows sum: {totalFromRows} ({parsedCoverage}%)
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03]">
            <button
              type="button"
              onClick={() => setShowImportancePanel((prev) => !prev)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-zinc-200 hover:bg-white/5"
            >
              <span>Importance Breakdown</span>
              <span className="text-zinc-400">{showImportancePanel ? "Hide" : "Show"}</span>
            </button>
            {showImportancePanel ? (
              <div className="border-t border-white/10 p-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                  <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-zinc-400">Importance Breakdown</div>
                  <div className="space-y-1.5">
                    {importanceBreakdown.map((item) => {
                      const width = Math.max(8, Math.round((item.count / maxImportanceCount) * 100));
                      return (
                        <div key={item.importance}>
                          <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-300">
                            <span>{item.importance}</span>
                            <span>{item.count}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/10">
                            <div className="h-1.5 rounded-full bg-gradient-to-r from-sky-300/90 to-blue-300/90" style={{ width: `${width}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
            <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-zinc-400">Error List</div>
            <div className={listClass}>
            {payload.errors
              .slice()
              .sort((a, b) => b.count - a.count)
              .map((item) => {
                const ratio = payload.totalCount ? Math.round((item.count / payload.totalCount) * 100) : 0;
                return (
                  <div key={`${item.error}-${item.count}`} className="rounded-xl border border-white/10 bg-black/25 p-2">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <div className={fullPage ? "line-clamp-2 text-base font-semibold leading-snug text-zinc-100" : "line-clamp-2 text-[12px] font-semibold text-zinc-100"}>{item.error}</div>
                      <div className="shrink-0 rounded-md border border-cyan-300/30 bg-cyan-400/10 px-1.5 py-0.5 text-[10px] text-cyan-100">{item.count}</div>
                    </div>
                    <div
                      className={
                        fullPage
                          ? "mb-2 min-h-28 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300"
                          : "mb-1 min-h-16 whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-300"
                      }
                    >
                      {item.keyProblem}
                    </div>
                    <div className="mb-1 flex items-center justify-between text-[10px]">
                      <span className={`rounded-md px-1.5 py-0.5 ${importanceColor(item.importance)}`}>{item.importance}</span>
                      <span className="text-zinc-400">{ratio}% of total</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10">
                      <div className="h-1.5 rounded-full bg-gradient-to-r from-cyan-300 to-violet-300" style={{ width: `${Math.max(4, ratio)}%` }} />
                    </div>
                    {item.affectedIds.length > 0 ? (
                      <div className="mt-1 line-clamp-2 text-[10px] text-zinc-500 font-mono">IDs: {item.affectedIds.join(", ")}</div>
                    ) : null}
                    {item.multipleCount ? <div className="mt-1 text-[10px] text-cyan-200/80">Appears multiple times</div> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
