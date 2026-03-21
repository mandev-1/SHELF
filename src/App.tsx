import { Input, SearchField, Surface } from "@heroui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useBookmarksSearch } from "./hooks/useBookmarks";
import { useBookmarksTree } from "./hooks/useBookmarks";
import { BookmarkGrid } from "./components/BookmarkGrid";
import { SearchResults } from "./components/SearchResults";
import { useShelfStorage } from "./hooks/useShelfStorage";
import { PromptLibraryCard } from "./components/PromptLibraryCard";
import { Pillar } from "./components/Pillar";
import { ErrorDashboardPanel } from "./components/ErrorDashboardPanel";
import { VisualFlowPanel } from "./components/VisualFlowPanel";
import { pickCelebrationPhrase } from "./utils/celebration";

const DASHBOARD_OPEN_KEY = "shelf-dashboard-view";
const DASHBOARD_LAST_TOOL_KEY = "shelf-dashboard-last-tool";

type DashboardView = "shelf" | "error" | "visual-flow";
type LastTool = "error" | "visual-flow" | "llm-console";

function openLLMConsoleOverlay(url: string) {
  const resolved = (url || "https://example.org").trim();
  if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage({ type: "openLLMConsole", url: resolved }, () => {
      if (chrome.runtime.lastError) {
        window.open(resolved, "_blank", "noopener,noreferrer");
      }
    });
  } else {
    window.open(resolved, "_blank", "noopener,noreferrer");
  }
}

function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [dashboardView, setDashboardView] = useState<DashboardView>(() => {
    try {
      const v = window.localStorage.getItem(DASHBOARD_OPEN_KEY);
      return v === "error" || v === "visual-flow" ? v : "shelf";
    } catch {
      return "shelf";
    }
  });
  const [lastTool, setLastTool] = useState<LastTool>(() => {
    try {
      const v = window.localStorage.getItem(DASHBOARD_LAST_TOOL_KEY);
      if (v === "visual-flow") return "visual-flow";
      if (v === "llm-console") return "llm-console";
      if (v === "error") return "error";
      const view = window.localStorage.getItem(DASHBOARD_OPEN_KEY);
      return view === "visual-flow" ? "visual-flow" : "error";
    } catch {
      return "error";
    }
  });
  const {
    shelfName,
    setShelfName,
    resolvedTheme,
    pillarTodos,
    showTodoDates,
    visualFlow,
    setVisualFlow,
    prompts,
    savePrompts,
    updatePrompt,
    promptRows,
    setPromptRows,
    pillarPins,
    setPillarPins,
    setPillarPinOverride,
    setPillarTodos,
    obsidianLog,
    logToObsidian,
    appendTaskLog,
    llmConsoleUrl,
  } = useShelfStorage();
  const [editingName, setEditingName] = useState(false);
  const [pendingEditPromptId, setPendingEditPromptId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<string | null>(null);
  const celebrationTimerRef = useRef<number | null>(null);
  const [addTaskToast, setAddTaskToast] = useState(false);
  const [viewSlideDir, setViewSlideDir] = useState<"left" | "right" | null>(null);

  const showTaskCelebration = useCallback(() => {
    setCelebration(pickCelebrationPhrase());
    if (celebrationTimerRef.current !== null) window.clearTimeout(celebrationTimerRef.current);
    celebrationTimerRef.current = window.setTimeout(() => {
      setCelebration(null);
      celebrationTimerRef.current = null;
    }, 2500);
  }, []);
  const { results: searchResults, loading: searchLoading } =
    useBookmarksSearch(searchQuery);
  const { tree } = useBookmarksTree();

  const showSearch = searchQuery.trim().length > 0;
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);

  useEffect(() => {
    setSelectedSearchIndex(0);
  }, [searchQuery, searchResults]);

  const handleSearchKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (searchResults.length === 0 || searchLoading) return;
      const target = e.target as Element | null;
      const inSearchContext = target?.closest("[data-search-area], [data-search-overlay]");
      if (!inSearchContext) return;
      const isArrowDown = e.key === "ArrowDown";
      const isArrowUp = e.key === "ArrowUp";
      const isEnter = e.key === "Enter";
      if (!isArrowDown && !isArrowUp && !isEnter) return;
      e.preventDefault();
      e.stopPropagation();
      if (isEnter) {
        const node = searchResults[selectedSearchIndex];
        if (node?.url) window.open(node.url, "_blank", "noopener,noreferrer");
        return;
      }
      if (isArrowDown) {
        setSelectedSearchIndex((i) => Math.min(i + 1, searchResults.length - 1));
      } else {
        setSelectedSearchIndex((i) => Math.max(i - 1, 0));
      }
    },
    [searchResults, searchLoading, selectedSearchIndex]
  );

  useEffect(() => {
    if (!showSearch || searchResults.length === 0 || searchLoading) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
        handleSearchKeyDown(e);
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [showSearch, searchResults.length, searchLoading, handleSearchKeyDown]);

  useEffect(() => {
    try {
      window.localStorage.setItem(DASHBOARD_OPEN_KEY, dashboardView);
      if (dashboardView === "error" || dashboardView === "visual-flow") {
        window.localStorage.setItem(DASHBOARD_LAST_TOOL_KEY, dashboardView);
      }
    } catch {
      // ignore persistence failures
    }
  }, [dashboardView]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    return () => {
      if (celebrationTimerRef.current !== null) window.clearTimeout(celebrationTimerRef.current);
    };
  }, []);

  const swipeAccumRef = useRef(0);
  const swipeTimeoutRef = useRef<number | null>(null);

  const handleWheelSwipe = useCallback(
    (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      const dx = e.deltaX;
      const dy = e.deltaY;
      if (Math.abs(dx) < Math.abs(dy) * 1.2) return;
      swipeAccumRef.current += dx;
      if (swipeTimeoutRef.current !== null) window.clearTimeout(swipeTimeoutRef.current);
      swipeTimeoutRef.current = window.setTimeout(() => {
        swipeAccumRef.current = 0;
        swipeTimeoutRef.current = null;
      }, 150);
      const threshold = 80;
      if (swipeAccumRef.current < -threshold) {
        swipeAccumRef.current = 0;
        if (swipeTimeoutRef.current !== null) {
          window.clearTimeout(swipeTimeoutRef.current);
          swipeTimeoutRef.current = null;
        }
        if (dashboardView === "error" || dashboardView === "visual-flow") {
          setViewSlideDir("right");
          setDashboardView("shelf");
        }
      } else if (swipeAccumRef.current > threshold) {
        swipeAccumRef.current = 0;
        if (swipeTimeoutRef.current !== null) {
          window.clearTimeout(swipeTimeoutRef.current);
          swipeTimeoutRef.current = null;
        }
        if (dashboardView === "shelf") {
          if (lastTool === "llm-console") {
            openLLMConsoleOverlay(llmConsoleUrl);
          } else {
            setViewSlideDir("left");
            setDashboardView(lastTool);
          }
        }
      }
    },
    [dashboardView, lastTool, llmConsoleUrl]
  );

  useEffect(() => {
    const el = document.querySelector("[data-swipe-area]");
    if (!el) return;
    const handler = (e: Event) => handleWheelSwipe(e as WheelEvent);
    el.addEventListener("wheel", handler, { passive: true });
    return () => el.removeEventListener("wheel", handler);
  }, [handleWheelSwipe]);

  const touchSwipeRef = useRef<{ startX: number; startTime: number } | null>(null);
  const touchLastXRef = useRef<number>(0);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      touchSwipeRef.current = { startX: cx, startTime: Date.now() };
      touchLastXRef.current = cx;
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      touchLastXRef.current = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    }
  }, []);

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length >= 2 || !touchSwipeRef.current) return;
      const dx = touchLastXRef.current - touchSwipeRef.current.startX;
      if (Math.abs(dx) < 60) {
        touchSwipeRef.current = null;
        return;
      }
      if (Date.now() - touchSwipeRef.current.startTime > 500) {
        touchSwipeRef.current = null;
        return;
      }
      touchSwipeRef.current = null;
      if (dx < 0 && (dashboardView === "error" || dashboardView === "visual-flow")) {
        setViewSlideDir("right");
        setDashboardView("shelf");
      } else if (dx > 0 && dashboardView === "shelf") {
        if (lastTool === "llm-console") {
          openLLMConsoleOverlay(llmConsoleUrl);
        } else {
          setViewSlideDir("left");
          setDashboardView(lastTool);
        }
      }
    },
    [dashboardView, lastTool, llmConsoleUrl]
  );

  useEffect(() => {
    const el = document.querySelector("[data-swipe-area]");
    if (!el) return;
    const onStart = (e: Event) => handleTouchStart(e as TouchEvent);
    const onMove = (e: Event) => handleTouchMove(e as TouchEvent);
    const onEnd = (e: Event) => handleTouchEnd(e as TouchEvent);
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "var(--shelf-bg)", color: "var(--shelf-fg)" }}
    >
      <Pillar
        shelfName={shelfName}
        tree={tree}
        pinnedTop={pillarPins.top}
        pinOverrides={pillarPins.overrides}
        onSetPinned={setPillarPins}
        onSetPinOverride={setPillarPinOverride}
        todos={pillarTodos}
        onSetTodos={setPillarTodos}
        onTodoLog={(entry) => {
          const time = new Date().toTimeString().slice(0, 5);
          const formatted =
            entry.includes("\n") ? `- ${time} - ${entry.split("\n")[0]}\n${entry.split("\n").slice(1).join("\n")}` : `- ${time} - ${entry}`;
          appendTaskLog(formatted);
          if (obsidianLog.enabled) logToObsidian(formatted);
        }}
        onOpenDashboard={() => {
          setLastTool("error");
          setViewSlideDir("left");
          setDashboardView("error");
        }}
        onOpenVisualFlow={() => {
          setLastTool("visual-flow");
          setViewSlideDir("left");
          setDashboardView("visual-flow");
        }}
        onTaskCompleted={showTaskCelebration}
      />
      <div className="flex-1 flex flex-col min-w-0" data-swipe-area>
        <header className="shrink-0 border-b border-white/10 px-6 py-5">
          <div className="max-w-[1640px] mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {editingName ? (
              <Input
                autoFocus
                value={shelfName}
                onChange={(e) => setShelfName(e.target.value)}
                onBlur={() => setEditingName(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setEditingName(false);
                  if (e.key === "Escape") setEditingName(false);
                }}
                variant="secondary"
                className="max-w-xs text-2xl font-semibold tracking-tight"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditingName(true)}
                className="text-2xl font-semibold tracking-tight text-white text-left"
              >
                {shelfName}
              </button>
            )}
            <Surface
              data-search-area
              variant="secondary"
              className="w-full sm:max-w-md rounded-2xl p-2 border border-white/10 bg-white/5"
            >
              <SearchField
                aria-label="Search bookmarks"
                value={searchQuery}
                onChange={setSearchQuery}
                variant="secondary"
                fullWidth
                className="search-field"
              >
                <SearchField.Group>
                  <SearchField.SearchIcon />
                  <SearchField.Input placeholder="Search bookmarks…" />
                  <SearchField.ClearButton />
                </SearchField.Group>
              </SearchField>
            </Surface>
            <button
              type="button"
              onClick={() => {
                if (dashboardView !== "shelf") {
                  setViewSlideDir("right");
                  setDashboardView("shelf");
                } else if (lastTool === "llm-console") {
                  openLLMConsoleOverlay(llmConsoleUrl);
                } else {
                  setViewSlideDir("left");
                  setDashboardView(lastTool);
                }
              }}
              className="shrink-0 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-400/20"
            >
              {dashboardView !== "shelf"
                ? "Back to Shelf"
                : lastTool === "visual-flow"
                  ? "Visual Flow of Action"
                  : lastTool === "llm-console"
                    ? "Open LLM Console"
                    : "Open Dashboard"}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-hidden min-h-0 relative">
          <div
            key={dashboardView}
            className={`shelf-view-slide h-full px-6 py-6 overflow-auto ${viewSlideDir === "left" ? "shelf-view-slide--from-right" : viewSlideDir === "right" ? "shelf-view-slide--from-left" : ""}`}
            onAnimationEnd={() => setViewSlideDir(null)}
          >
          {dashboardView === "error" ? (
            <div className="max-w-[1640px] mx-auto">
              <ErrorDashboardPanel
                fullPage
                onOpenLLMConsole={() => {
                  setLastTool("llm-console");
                  openLLMConsoleOverlay(llmConsoleUrl);
                }}
                onAddTask={(err) => {
                  const note = [
                    err.keyProblem,
                    err.affectedFiles.length
                      ? `Affected: ${err.affectedFiles.map((af) => (af.line && af.line !== "n/A" ? `${af.file}:${af.line}` : af.file)).join(", ")}`
                      : "",
                    err.affectedIds.length ? `IDs: ${err.affectedIds.join(", ")}` : "",
                  ]
                    .filter(Boolean)
                    .join("\n\n");
                  const d = new Date();
                  const dd = String(d.getDate()).padStart(2, "0");
                  const mm = String(d.getMonth() + 1).padStart(2, "0");
                  setPillarTodos((prev) => [
                    ...prev,
                    {
                      id: crypto.randomUUID(),
                      text: err.error,
                      done: false,
                      subtitle: `Added ${dd}-${mm}`,
                      note: note || undefined,
                      tag: err.importance,
                      blockStatus: "ready" as const,
                    },
                  ]);
                  setAddTaskToast(true);
                  window.setTimeout(() => setAddTaskToast(false), 1800);
                }}
              />
            </div>
          ) : dashboardView === "visual-flow" ? (
            <div className="max-w-[1640px] mx-auto">
              <VisualFlowPanel
                todos={pillarTodos}
                showTodoDates={showTodoDates}
                visualFlow={visualFlow}
                onVisualFlowChange={setVisualFlow}
                onEditTodo={(id, updates) =>
                  setPillarTodos((prev) =>
                    prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
                  )
                }
                onDeleteTodo={(id) =>
                  setPillarTodos((prev) => prev.filter((t) => t.id !== id))
                }
                onAddTodo={(todo) =>
                  setPillarTodos((prev) => [...prev, todo])
                }
                onTaskCompleted={showTaskCelebration}
                onTodoLog={(entry) => {
                  const time = new Date().toTimeString().slice(0, 5);
                  const formatted =
                    entry.includes("\n") ? `- ${time} - ${entry.split("\n")[0]}\n${entry.split("\n").slice(1).join("\n")}` : `- ${time} - ${entry}`;
                  appendTaskLog(formatted);
                  if (obsidianLog.enabled) logToObsidian(formatted);
                }}
                fullPage
              />
            </div>
          ) : (
            <div className="max-w-[1640px] mx-auto">
              <div className="mb-6">
                <PromptLibraryCard
                  prompts={prompts}
                  initialEditId={pendingEditPromptId}
                  onInitialEditConsumed={() => setPendingEditPromptId(null)}
                  onUpdatePrompt={(id, next) => {
                    savePrompts({
                      ...prompts,
                      [id]: next,
                    });
                  }}
                  onDeletePrompt={(id) => {
                    const next = { ...prompts };
                    delete next[id];
                    savePrompts(next);
                  }}
                  onUpdatePromptMeta={(id, updater) => updatePrompt(id, updater)}
                  promptRows={promptRows}
                  onPromptRowsChange={setPromptRows}
                />
              </div>
              {showSearch ? (
                <div data-search-area>
                  <SearchResults
                    results={searchResults}
                    loading={searchLoading}
                    query={searchQuery}
                    selectedIndex={selectedSearchIndex}
                  />
                </div>
              ) : (
                <BookmarkGrid />
              )}
            </div>
          )}
          </div>

          {showSearch && (dashboardView === "error" || dashboardView === "visual-flow") && (
            <div
              data-search-overlay
              className="fixed inset-0 z-[150] flex items-start justify-center pt-24 px-6 pb-6"
              onClick={() => setSearchQuery("")}
              role="dialog"
              aria-label="Search results overlay"
            >
              <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                aria-hidden
              />
              <div
                className="relative w-full max-w-2xl max-h-[calc(100vh-7rem)] overflow-auto rounded-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <SearchResults
                  results={searchResults}
                  loading={searchLoading}
                  query={searchQuery}
                  selectedIndex={selectedSearchIndex}
                />
              </div>
            </div>
          )}
        </main>
      </div>
      {celebration && (
        <div
          className="pointer-events-none fixed right-6 top-20 z-[300] animate-[toast-enter_180ms_ease-out]"
          role="status"
          aria-live="polite"
        >
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/20 px-4 py-3 text-sm font-medium text-emerald-100 shadow-[0_0_24px_rgba(16,185,129,0.2)]">
            {celebration}
          </div>
        </div>
      )}
      {addTaskToast && (
        <div
          className="pointer-events-none fixed right-6 bottom-6 z-[300] animate-[toast-enter_180ms_ease-out]"
          role="status"
          aria-live="polite"
        >
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/15 px-4 py-3 text-sm font-medium text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
            This task was added to your To-Do list.
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
