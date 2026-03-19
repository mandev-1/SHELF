import { Input, SearchField, Surface } from "@heroui/react";
import { useEffect, useState } from "react";
import { useBookmarksSearch } from "./hooks/useBookmarks";
import { useBookmarksTree } from "./hooks/useBookmarks";
import { BookmarkGrid } from "./components/BookmarkGrid";
import { SearchResults } from "./components/SearchResults";
import { useShelfStorage } from "./hooks/useShelfStorage";
import { PromptLibraryCard } from "./components/PromptLibraryCard";
import { Pillar } from "./components/Pillar";
import { ErrorDashboardPanel } from "./components/ErrorDashboardPanel";

const DASHBOARD_OPEN_KEY = "shelf-error-dashboard-open";

function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [dashboardOpen, setDashboardOpen] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(DASHBOARD_OPEN_KEY) === "1";
    } catch {
      return false;
    }
  });
  const {
    shelfName,
    setShelfName,
    prompts,
    savePrompts,
    updatePrompt,
    promptRows,
    setPromptRows,
    pillarPins,
    setPillarPins,
    setPillarPinOverride,
    pillarTodos,
    setPillarTodos,
    obsidianLog,
    logToObsidian,
    appendTaskLog,
  } = useShelfStorage();
  const [editingName, setEditingName] = useState(false);
  const { results: searchResults, loading: searchLoading } =
    useBookmarksSearch(searchQuery);
  const { tree } = useBookmarksTree();

  const showSearch = searchQuery.trim().length > 0;

  useEffect(() => {
    try {
      window.localStorage.setItem(DASHBOARD_OPEN_KEY, dashboardOpen ? "1" : "0");
    } catch {
      // ignore persistence failures
    }
  }, [dashboardOpen]);

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100">
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
        onOpenDashboard={() => setDashboardOpen(true)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="shrink-0 border-b border-white/10 px-6 py-5">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
              onClick={() => setDashboardOpen((prev) => !prev)}
              className="shrink-0 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-400/20"
            >
              {dashboardOpen ? "Back to Shelf" : "Open Dashboard"}
            </button>
          </div>
        </header>

        <main className="flex-1 px-6 py-6 overflow-auto min-h-0">
          {dashboardOpen ? (
            <div className="max-w-6xl mx-auto">
              <ErrorDashboardPanel fullPage />
            </div>
          ) : (
            <div className="max-w-6xl mx-auto">
              <div className="mb-6">
                <PromptLibraryCard
                  prompts={prompts}
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
                <SearchResults
                  results={searchResults}
                  loading={searchLoading}
                  query={searchQuery}
                />
              ) : (
                <BookmarkGrid />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
