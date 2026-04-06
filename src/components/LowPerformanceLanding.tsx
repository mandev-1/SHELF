import { SearchField, Surface } from "@heroui/react";
import { useCallback, useEffect, useState } from "react";
import type { BookmarkTreeNode } from "../types/bookmarks";
import { useBookmarksSearch } from "../hooks/useBookmarks";
import { SearchResults } from "./SearchResults";

const PILLAR_KEY = "pillar-pins";
const BOOKMARK_OVERRIDES_KEY = "bookmark-overrides";
const SHELF_NAME_KEY = "shelf-name";
const THEME_KEY = "shelf-theme";

/** Modern productivity & leadership lines often used in enterprise contexts */
const LOW_PERF_QUOTES: readonly string[] = [
  "What gets measured gets managed.",
  "Culture eats strategy for breakfast.",
  "Done is better than perfect.",
  "Focus on being productive instead of busy.",
  "Innovation distinguishes between a leader and a follower.",
  "Simplicity is the ultimate sophistication.",
  "The way to get started is to quit talking and begin doing.",
  "Excellence is never an accident; it is always the result of high intention.",
  "Quality means doing it right when no one is looking.",
  "Your work is going to fill a large part of your life — love what you do.",
  "Strategy without tactics is the slowest route to victory.",
  "The best time to plant a tree was twenty years ago. The second best time is now.",
  "Discipline is the bridge between goals and accomplishment.",
  "We are what we repeatedly do. Excellence, then, is not an act but a habit.",
  "Efficiency is doing things right; effectiveness is doing the right things.",
];

const QUOTE_ROTATE_MS = 26_000;

function faviconUrl(url: string): string {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`;
  } catch {
    return "";
  }
}

function resolveThemeFromStorage(raw: unknown): "dark" | "day" | "sap" {
  const t = raw === "dark" || raw === "day" || raw === "sap" || raw === "auto" ? raw : "auto";
  if (t !== "auto") return t;
  const d = new Date();
  const totalMin = d.getHours() * 60 + d.getMinutes();
  const darkUntil = 8 * 60;
  const darkFrom = 21 * 60 + 40;
  return totalMin < darkUntil || totalMin >= darkFrom ? "dark" : "sap";
}

export function LowPerformanceLanding({ onOpenFullShelf }: { onOpenFullShelf: () => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [shelfName, setShelfName] = useState("ShELF");
  const [pinnedNodes, setPinnedNodes] = useState<BookmarkTreeNode[]>([]);
  const [overrides, setOverrides] = useState<Record<string, { title?: string; imageUrl?: string }>>({});
  const { results: searchResults, loading: searchLoading } = useBookmarksSearch(searchQuery);
  const showSearch = searchQuery.trim().length > 0;
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * LOW_PERF_QUOTES.length));

  useEffect(() => {
    setSelectedSearchIndex(0);
  }, [searchQuery, searchResults]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setQuoteIndex((i) => (i + 1) % LOW_PERF_QUOTES.length);
    }, QUOTE_ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!chrome?.storage?.local) return;
    chrome.storage.local.get([PILLAR_KEY, BOOKMARK_OVERRIDES_KEY, SHELF_NAME_KEY, THEME_KEY], (r) => {
      const name = typeof r[SHELF_NAME_KEY] === "string" ? (r[SHELF_NAME_KEY] as string) : "ShELF";
      setShelfName(name);
      const rawPins = r[PILLAR_KEY] as { top?: string[]; list?: string[]; overrides?: Record<string, { title?: string; imageUrl?: string }> } | undefined;
      const topRaw = rawPins?.top ?? rawPins?.list;
      const top = Array.isArray(topRaw) ? topRaw.filter((x): x is string => typeof x === "string").slice(0, 6) : [];
      const pillarOverrides = rawPins?.overrides && typeof rawPins.overrides === "object" && !Array.isArray(rawPins.overrides) ? rawPins.overrides : {};
      const gridOverrides = r[BOOKMARK_OVERRIDES_KEY];
      const gridOv =
        gridOverrides && typeof gridOverrides === "object" && !Array.isArray(gridOverrides)
          ? (gridOverrides as Record<string, { title?: string; imageUrl?: string }>)
          : {};
      setOverrides({ ...gridOv, ...pillarOverrides });
      const theme = resolveThemeFromStorage(r[THEME_KEY]);
      document.documentElement.setAttribute("data-theme", theme);
      const isWin = /Win/.test(navigator.userAgent) || /Win/.test(navigator.platform ?? "");
      document.documentElement.setAttribute("data-platform", isWin ? "windows" : "mac");

      if (!chrome?.bookmarks || top.length === 0) {
        setPinnedNodes([]);
        return;
      }
      // chrome.bookmarks.get([...ids]) fails entirely if any id is missing; fetch per id.
      void (async () => {
        const out: BookmarkTreeNode[] = [];
        for (const id of top) {
          try {
            const nodes = await chrome.bookmarks.get(id);
            const n = nodes[0];
            if (n?.url) out.push(n as BookmarkTreeNode);
          } catch {
            /* deleted or invalid id */
          }
        }
        const order = new Map(top.map((id, i) => [id, i]));
        out.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
        setPinnedNodes(out);
      })();
    });
  }, []);

  const handleSearchKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (searchResults.length === 0 || searchLoading) return;
      const target = e.target as Element | null;
      if (!target?.closest("[data-search-area]")) return;
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

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--shelf-bg)", color: "var(--shelf-fg)" }}
    >
      <header className="shrink-0 border-b border-white/10 px-6 py-5">
        <div className="max-w-[960px] mx-auto flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-semibold tracking-tight">{shelfName}</h1>
            <button
              type="button"
              onClick={onOpenFullShelf}
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-white/10 hover:text-white transition-colors"
            >
              Open full shelf
            </button>
          </div>

          {pinnedNodes.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Quick access</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {pinnedNodes.map((b) => {
                  const ov = overrides[b.id];
                  const title = ov?.title ?? b.title ?? b.url ?? "";
                  const img = ov?.imageUrl?.trim() ? ov.imageUrl : faviconUrl(b.url!);
                  return (
                    <a
                      key={b.id}
                      href={b.url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex flex-col rounded-xl border border-white/10 bg-white/[0.04] p-3 shadow-sm transition hover:border-white/20 hover:bg-white/[0.07] hover:shadow-md min-h-[88px]"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <img
                          src={img}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-lg object-cover bg-white/5 ring-1 ring-black/5"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = faviconUrl(b.url!);
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold text-zinc-100 line-clamp-2 leading-snug group-hover:text-white">
                            {title}
                          </span>
                          <span className="mt-1 block text-[10px] text-zinc-500 truncate">
                            {(() => {
                              try {
                                return new URL(b.url!).hostname;
                              } catch {
                                return "";
                              }
                            })()}
                          </span>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          <Surface
            data-search-area
            variant="secondary"
            className="w-full rounded-2xl p-2 border border-white/10 bg-white/5"
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
        </div>
      </header>

      <main className="flex-1 px-6 py-6 overflow-auto">
        <div className="max-w-[960px] mx-auto">
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
            <p className="text-sm text-zinc-500 text-center py-12">
              Type above to search your bookmarks, or open the full shelf for the grid, prompts, and tools.
            </p>
          )}
        </div>
      </main>

      <blockquote
        className="shelf-low-perf-quote shelf-low-perf-quote__fade pointer-events-none fixed bottom-5 left-5 z-10 max-w-[min(22rem,calc(100vw-2.5rem))] text-left"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="block text-[13px] sm:text-sm">“{LOW_PERF_QUOTES[quoteIndex]}”</span>
      </blockquote>
    </div>
  );
}
