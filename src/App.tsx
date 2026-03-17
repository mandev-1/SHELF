import { Input, SearchField, Surface } from "@heroui/react";
import { useState } from "react";
import { useBookmarksSearch } from "./hooks/useBookmarks";
import { BookmarkGrid } from "./components/BookmarkGrid";
import { SearchResults } from "./components/SearchResults";
import { useShelfStorage } from "./hooks/useShelfStorage";
import { PromptLibraryCard } from "./components/PromptLibraryCard";

function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const { shelfName, setShelfName, prompts, savePrompts, updatePrompt, promptRows, setPromptRows } = useShelfStorage();
  const [editingName, setEditingName] = useState(false);
  const { results: searchResults, loading: searchLoading } =
    useBookmarksSearch(searchQuery);

  const showSearch = searchQuery.trim().length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100 flex flex-col">
      <header className="border-b border-white/10 px-6 py-5">
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
        </div>
      </header>

      <main className="flex-1 px-6 py-6 overflow-auto min-h-0">
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
      </main>
    </div>
  );
}

export default App;
