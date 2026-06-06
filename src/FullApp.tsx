import { Input } from "@heroui/react";
import { useCallback, useEffect, useRef, useState, lazy, Suspense } from "react";
import { useBookmarksSearch } from "./hooks/useBookmarks";
import { useBookmarksTree } from "./hooks/useBookmarks";
import { BookmarkGrid } from "./components/BookmarkGrid";
import { SearchResults } from "./components/SearchResults";
import { useShelfStorage } from "./hooks/useShelfStorage";
import { PromptLibraryCard } from "./components/PromptLibraryCard";
import { Pillar } from "./components/Pillar";
// Lazy + prefetch: split the React Flow chunk, but warm it in the background
// (idle time + hover/focus on the nav button) so the click feels instant.
let _visualFlowPromise: Promise<{ default: typeof import("./components/VisualFlow/VisualFlowPanel")["VisualFlowPanel"] }> | null = null;
function prefetchVisualFlow() {
  if (!_visualFlowPromise) {
    _visualFlowPromise = import("./components/VisualFlow/VisualFlowPanel").then((m) => ({ default: m.VisualFlowPanel }));
  }
  return _visualFlowPromise;
}
const VisualFlowPanel = lazy(prefetchVisualFlow);
import { BuylistPanel } from "./components/Hopper/BuylistPanel";
import { StrategiePanel } from "./components/Strategie/StrategiePanel";
import { InventoryPanel } from "./components/Inventory/InventoryPanel";
import { pickCelebrationPhrase } from "./utils/celebration";
import type { ShelfPillarTodoItem } from "./types/grid";

const DASHBOARD_OPEN_KEY = "shelf-dashboard-view";
const DASHBOARD_LAST_TOOL_KEY = "shelf-dashboard-last-tool";

type DashboardView = "shelf" | "visual-flow" | "buylist" | "strategie" | "inventory";
type LastTool = "visual-flow" | "llm-console";

/** Render a greeting, styling the word "smile" (case-insensitive) in --accent-bright. */
function renderGreeting(text: string) {
  if (!text) return null;
  const parts = text.split(/(smile)/i);
  return parts.map((part, i) =>
    /^smile$/i.test(part) ? (
      <span key={i} className="smile">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

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

export default function FullApp() {
  // Warm the Visual Flow chunk during idle time after mount so the user's first
  // click on the tab loads instantly. Browsers that lack requestIdleCallback fall
  // back to a short timeout.
  useEffect(() => {
    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (h: number) => void;
    };
    const w = window as IdleWindow;
    let idleHandle: number | undefined;
    let timeoutHandle: number | undefined;
    if (typeof w.requestIdleCallback === "function") {
      idleHandle = w.requestIdleCallback(() => { prefetchVisualFlow(); }, { timeout: 4000 });
    } else {
      timeoutHandle = window.setTimeout(() => { prefetchVisualFlow(); }, 1500);
    }
    return () => {
      if (idleHandle !== undefined && typeof w.cancelIdleCallback === "function") w.cancelIdleCallback(idleHandle);
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    };
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [dashboardView, setDashboardView] = useState<DashboardView>(() => {
    try {
      const v = window.localStorage.getItem(DASHBOARD_OPEN_KEY);
      if (v === "visual-flow" || v === "buylist" || v === "strategie" || v === "inventory") return v;
      return "shelf";
    } catch {
      return "shelf";
    }
  });
  const [lastTool, setLastTool] = useState<LastTool>(() => {
    try {
      const v = window.localStorage.getItem(DASHBOARD_LAST_TOOL_KEY);
      if (v === "visual-flow") return "visual-flow";
      if (v === "llm-console") return "llm-console";
      return "visual-flow";
    } catch {
      return "visual-flow";
    }
  });
  const {
    shelfName,
    setShelfName,
    resolvedTheme,
    accent,
    pillarTodos,
    showTodoDates,
    visualFlow,
    updateVisualFlow,
    prompts,
    savePrompts,
    updatePrompt,
    promptRows,
    setPromptRows,
    pillarPins,
    setPillarPins,
    setPillarPinOverride,
    pillarTodoPins,
    setPillarTodoPins,
    focusDesynced,
    grazelandItems,
    setGrazelandItems,
    binItems,
    setBinItems,
    setPillarTodos,
    obsidianLog,
    logToObsidian,
    appendTaskLog,
    llmConsoleUrl,
    buylist,
    buylistAdd,
    buylistDiscard,
    buylistBuyBottom,
    buylistBump,
    buylistSkip,
    saleItems,
    saleItemAdd,
    saleItemUpdate,
    saleItemRemove,
    inventoryItems,
    inventoryAdd,
    inventoryUpdate,
    inventoryRemove,
    strategieState,
    strategieSaveStatement,
    strategieAddPot,
    strategieSetCurrency,
    strategieToggleCompareCurrency,
    strategieSetRungAccounts,
    strategieUpsertAccountDictEntry,
  } = useShelfStorage();
  const [editingName, setEditingName] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // ⌘K / Ctrl+K → focus the topbar search input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const [pendingEditPromptId, setPendingEditPromptId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<string | null>(null);
  const celebrationTimerRef = useRef<number | null>(null);
  const [pinnedLimitToast, setPinnedLimitToast] = useState(false);
  const [viewSlideDir, setViewSlideDir] = useState<"left" | "right" | null>(null);

  const showTaskCelebration = useCallback(() => {
    setCelebration(pickCelebrationPhrase());
    if (celebrationTimerRef.current !== null) window.clearTimeout(celebrationTimerRef.current);
    celebrationTimerRef.current = window.setTimeout(() => {
      setCelebration(null);
      celebrationTimerRef.current = null;
    }, 2500);
  }, []);

  const handleVisualFlowEditTodo = useCallback(
    (id: string, updates: Partial<ShelfPillarTodoItem>) => {
      setPillarTodos((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    },
    [setPillarTodos]
  );

  const handleVisualFlowDeleteTodo = useCallback(
    (id: string) => {
      setPillarTodos((prev) => prev.filter((t) => t.id !== id));
      setPillarTodoPins((prev) => prev.filter((x) => x !== id));
    },
    [setPillarTodos, setPillarTodoPins]
  );

  const handleVisualFlowEditGrazeland = useCallback(
    (id: string, updates: Partial<ShelfPillarTodoItem>) => {
      setGrazelandItems((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    },
    [setGrazelandItems]
  );

  const handleVisualFlowDeleteGrazeland = useCallback(
    (id: string) => {
      setGrazelandItems((prev) => prev.filter((t) => t.id !== id));
    },
    [setGrazelandItems]
  );

  const handleVisualFlowEditBin = useCallback(
    (id: string, updates: Partial<ShelfPillarTodoItem>) => {
      setBinItems((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    },
    [setBinItems]
  );

  const handleVisualFlowDeleteBin = useCallback(
    (id: string) => {
      setBinItems((prev) => prev.filter((t) => t.id !== id));
    },
    [setBinItems]
  );
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
      if (dashboardView === "visual-flow") {
        window.localStorage.setItem(DASHBOARD_LAST_TOOL_KEY, dashboardView);
      }
    } catch {
      // ignore persistence failures
    }
  }, [dashboardView]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("no-transition");
    root.setAttribute("data-theme", resolvedTheme);
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => root.classList.remove("no-transition"))
    );
    return () => cancelAnimationFrame(id);
  }, [resolvedTheme]);

  useEffect(() => {
    const root = document.documentElement;
    const accentPalettes: Record<string, { bright: string; deep: string; ink: string }> = {
      "#16b981": { bright: "#34d399", deep: "#0c8f66", ink: "#d4f3e7" },
      "#5b9cff": { bright: "#8bb8ff", deep: "#3a6fd0", ink: "#d6e6ff" },
      "#c98bff": { bright: "#dcb0ff", deep: "#9d5fd6", ink: "#eedcff" },
      "#e0905a": { bright: "#f2ad7d", deep: "#bf6f3c", ink: "#f8e3d3" },
      "#d97706": { bright: "#f59e0b", deep: "#b45309", ink: "#7c4a0c" },
      "#0070f2": { bright: "#1b90ff", deep: "#0058c4", ink: "#084298" },
    };
    const palette = accentPalettes[accent] || accentPalettes["#16b981"];
    root.classList.add("no-transition");
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--accent-bright", palette.bright);
    root.style.setProperty("--accent-deep", palette.deep);
    root.style.setProperty("--accent-ink", palette.ink);
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => root.classList.remove("no-transition"))
    );
    return () => cancelAnimationFrame(id);
  }, [accent]);

  useEffect(() => {
    document.documentElement.setAttribute("data-density", "compact");
  }, []);

  useEffect(() => {
    const isWin = /Win/.test(navigator.userAgent) || /Win/.test(navigator.platform ?? "");
    document.documentElement.setAttribute("data-platform", isWin ? "windows" : "mac");
  }, []);

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
        if (dashboardView === "visual-flow") {
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
      if (dx < 0 && dashboardView === "visual-flow") {
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
      style={{ color: "var(--shelf-fg)" }}
    >
      <Pillar
        shelfName={shelfName}
        tree={tree}
        pinnedTop={pillarPins.top}
        pinOverrides={pillarPins.overrides}
        onSetPinned={setPillarPins}
        onSetPinOverride={setPillarPinOverride}
        todos={pillarTodos}
        pillarTodoPins={pillarTodoPins}
        onSetPillarTodoPins={setPillarTodoPins}
        focusDesynced={focusDesynced}
        onShowPinnedLimitToast={() => {
          setPinnedLimitToast(true);
          window.setTimeout(() => setPinnedLimitToast(false), 2500);
        }}
        onSetTodos={setPillarTodos}
        onTodoLog={(entry) => {
          const time = new Date().toTimeString().slice(0, 5);
          const formatted =
            entry.includes("\n") ? `- ${time} - ${entry.split("\n")[0]}\n${entry.split("\n").slice(1).join("\n")}` : `- ${time} - ${entry}`;
          appendTaskLog(formatted);
          if (obsidianLog.enabled) logToObsidian(formatted);
        }}
        onOpenVisualFlow={() => {
          setLastTool("visual-flow");
          setViewSlideDir("left");
          setDashboardView("visual-flow");
        }}
        onTaskCompleted={showTaskCelebration}
      />
      <div className="flex-1 flex flex-col min-w-0" data-swipe-area>
        <header className="topbar">
          <div className="topbar-inner">
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
                className="greeting"
                title="Click to edit"
              >
                {renderGreeting(shelfName)}
              </button>
            )}
            <div className="search-pill" data-search-area>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                aria-label="Search bookmarks"
                placeholder="Search bookmarks…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  style={{ background: "none", border: 0, color: "var(--dim)", cursor: "pointer", padding: 0, fontSize: 14, lineHeight: 1 }}
                >
                  ×
                </button>
              ) : (
                <kbd>⌘K</kbd>
              )}
            </div>
            <nav className="nav">
              {([
                { id: "shelf",       label: "Shelf"       },
                { id: "visual-flow", label: "Visual Flow" },
                { id: "strategie",   label: "Strategie"   },
                { id: "buylist",     label: "Hopper"      },
                { id: "inventory",   label: "Inventory"   },
              ] as const).map((tab) => {
                const isActive = dashboardView === tab.id;
                const isVF = tab.id === "visual-flow";
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onMouseEnter={isVF ? () => prefetchVisualFlow() : undefined}
                    onFocus={isVF ? () => prefetchVisualFlow() : undefined}
                    onTouchStart={isVF ? () => prefetchVisualFlow() : undefined}
                    onClick={() => {
                      if (isActive) return;
                      // Slide direction: tabs to the right of current slide in from the right
                      const order: DashboardView[] = ["shelf", "visual-flow", "strategie", "buylist"];
                      const fromIdx = order.indexOf(dashboardView);
                      const toIdx = order.indexOf(tab.id);
                      setViewSlideDir(toIdx > fromIdx ? "left" : "right");
                      if (tab.id === "visual-flow") setLastTool("visual-flow");
                      setDashboardView(tab.id);
                    }}
                    aria-current={isActive ? "page" : undefined}
                    className={`nav-btn${isActive ? " nav-btn--on" : ""}`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </header>

        <main className="flex-1 overflow-hidden min-h-0 relative">
          <div
            key={dashboardView}
            className={`shelf-view-slide h-full px-6 py-6 overflow-auto ${viewSlideDir === "left" ? "shelf-view-slide--from-right" : viewSlideDir === "right" ? "shelf-view-slide--from-left" : ""}`}
            onAnimationEnd={() => setViewSlideDir(null)}
          >
          {/* bg-diffuse-host = relative wrapper so the aurora is part of the scroll
              content (scrolls along with the page) instead of stuck to the viewport. */}
          <div className="bg-diffuse-host">
            <div className="bg-diffuse" aria-hidden="true" />
          {dashboardView === "strategie" ? (
            <div className="max-w-[1640px] mx-auto px-6 py-6">
              <StrategiePanel
                state={strategieState}
                buylistItems={buylist}
                onSaveStatement={strategieSaveStatement}
                onAddPot={strategieAddPot}
                onSetCurrency={strategieSetCurrency}
                onToggleCompareCurrency={strategieToggleCompareCurrency}
                onSetRungAccounts={strategieSetRungAccounts}
                onUpsertAccountDictEntry={strategieUpsertAccountDictEntry}
              />
            </div>
          ) : dashboardView === "buylist" ? (
            <BuylistPanel
              items={buylist}
              saleItems={saleItems}
              onAdd={buylistAdd}
              onDiscard={buylistDiscard}
              onBuyBottom={buylistBuyBottom}
              onBump={buylistBump}
              onSkip={buylistSkip}
              onSaleAdd={saleItemAdd}
              onSaleUpdate={saleItemUpdate}
              onSaleRemove={saleItemRemove}
            />
          ) : dashboardView === "inventory" ? (
            <div className="max-w-[1640px] mx-auto px-6 py-6">
              <InventoryPanel
                items={inventoryItems}
                onAdd={inventoryAdd}
                onUpdate={inventoryUpdate}
                onRemove={inventoryRemove}
                onSell={(it) => {
                  const now = new Date().toISOString();
                  saleItemAdd({
                    name: it.name,
                    where: "resale",
                    price: it.estimatedValue,
                    unit: "Kč",
                    status: "listed",
                    url: it.sellUrl,
                    createdAt: now,
                    updatedAt: now,
                    soldAt: null,
                    history: [{ at: now, text: "Moved from inventory" }],
                  });
                }}
              />
            </div>
          ) : dashboardView === "visual-flow" ? (
            <div className="max-w-[1640px] mx-auto">
              <Suspense fallback={<div className="py-20 text-center text-sm text-slate-500">Loading Visual Flow…</div>}>
              <VisualFlowPanel
                todos={pillarTodos}
                grazelandItems={grazelandItems}
                binItems={binItems}
                showTodoDates={showTodoDates}
                visualFlow={visualFlow}
                onUpdateVisualFlow={updateVisualFlow}
                focusDesynced={focusDesynced}
                setPillarTodoPins={setPillarTodoPins}
                onEditTodo={handleVisualFlowEditTodo}
                onDeleteTodo={handleVisualFlowDeleteTodo}
                onAddTodo={(todo) =>
                  setPillarTodos((prev) => [...prev, todo])
                }
                onEditGrazelandItem={handleVisualFlowEditGrazeland}
                onDeleteGrazelandItem={handleVisualFlowDeleteGrazeland}
                onAddGrazelandItem={(todo) =>
                  setGrazelandItems((prev) => [...prev, todo])
                }
                onEditBinItem={handleVisualFlowEditBin}
                onDeleteBinItem={handleVisualFlowDeleteBin}
                onAddBinItem={(todo) =>
                  setBinItems((prev) => [...prev, todo])
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
              </Suspense>
              <BookmarkGrid bodyHidden />
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
          </div> {/* /bg-diffuse-host */}
          </div>

          {showSearch && dashboardView === "visual-flow" && (
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
      {pinnedLimitToast && (
        <div
          className="pointer-events-none fixed right-6 bottom-6 z-[300] animate-[toast-enter_180ms_ease-out]"
          role="status"
          aria-live="polite"
        >
          <div className="rounded-2xl border border-amber-400/25 bg-amber-500/15 px-4 py-3 text-sm font-medium text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
            Please optimize your current task allocation before adding further priorities.
          </div>
        </div>
      )}
    </div>
  );
}
