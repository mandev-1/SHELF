import { Link, Spinner, Surface } from "@heroui/react";
import { useEffect, useRef } from "react";
import type { BookmarkTreeNode } from "../types/bookmarks";

interface SearchResultsProps {
  results: BookmarkTreeNode[];
  loading: boolean;
  query: string;
  selectedIndex?: number;
}

function faviconUrl(url: string): string {
  try {
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
  } catch {
    return "";
  }
}

export function SearchResults({ results, loading, query, selectedIndex = 0 }: SearchResultsProps) {
  const selectedRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedIndex]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" color="accent" />
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <Surface
        variant="secondary"
        className="results-glow rounded-2xl border border-emerald-400/15 bg-black/50 p-8 text-center"
      >
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-300/70">No results</p>
        <p className="mt-2 text-zinc-300">No bookmarks match “{query}”.</p>
      </Surface>
    );
  }

  return (
    <Surface
      variant="secondary"
      className="results-glow rounded-2xl border border-emerald-400/15 bg-black/45 overflow-hidden"
    >
      <div className="border-b border-emerald-400/10 bg-white/5 p-3">
        <p className="text-sm text-emerald-200/80">
          {results.length} result{results.length !== 1 ? "s" : ""}
        </p>
      </div>
      <ul className="divide-y divide-emerald-400/10 max-h-[60vh] overflow-y-auto" role="listbox" aria-activedescendant={results[selectedIndex] != null ? `search-result-${selectedIndex}` : undefined}>
        {results.map((node, i) => (
          <li
            key={node.id}
            ref={i === selectedIndex ? selectedRef : undefined}
            role="option"
            id={`search-result-${i}`}
            aria-selected={i === selectedIndex}
            className={`px-4 py-3 transition-colors hover:bg-emerald-400/5 ${i === selectedIndex ? "bg-emerald-400/15" : ""}`}
          >
            <Link
              href={node.url!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 no-underline text-zinc-200 hover:text-emerald-100"
            >
              <img
                src={faviconUrl(node.url!)}
                alt=""
                className="w-5 h-5 rounded shrink-0 ring-1 ring-emerald-300/20"
              />
              <span className="truncate flex-1">{node.title || node.url}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
