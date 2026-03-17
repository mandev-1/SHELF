import { Link, Spinner, Surface } from "@heroui/react";
import type { BookmarkTreeNode } from "../types/bookmarks";

interface SearchResultsProps {
  results: BookmarkTreeNode[];
  loading: boolean;
  query: string;
}

function faviconUrl(url: string): string {
  try {
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
  } catch {
    return "";
  }
}

export function SearchResults({ results, loading, query }: SearchResultsProps) {
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
        className="rounded-2xl border border-emerald-400/15 bg-black/40 p-8 text-center shadow-[0_0_0_1px_rgba(16,185,129,0.04)]"
      >
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-300/70">No results</p>
        <p className="mt-2 text-zinc-300">No bookmarks match “{query}”.</p>
      </Surface>
    );
  }

  return (
    <Surface
      variant="secondary"
      className="rounded-2xl border border-white/10 overflow-hidden"
    >
      <div className="p-3 border-b border-white/10">
        <p className="text-zinc-400 text-sm">
          {results.length} result{results.length !== 1 ? "s" : ""}
        </p>
      </div>
      <ul className="divide-y divide-white/10 max-h-[60vh] overflow-y-auto">
        {results.map((node) => (
          <li key={node.id} className="px-4 py-3 hover:bg-white/5 transition-colors">
            <Link
              href={node.url!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 no-underline text-zinc-200 hover:text-white"
            >
              <img
                src={faviconUrl(node.url!)}
                alt=""
                className="w-5 h-5 rounded shrink-0"
              />
              <span className="truncate flex-1">{node.title || node.url}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
