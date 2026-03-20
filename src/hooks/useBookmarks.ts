import { useCallback, useEffect, useState } from "react";
import type { BookmarkTreeNode } from "../types/bookmarks";

export function useBookmarksTree() {
  const [tree, setTree] = useState<BookmarkTreeNode[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!chrome?.bookmarks) {
      setError("Bookmarks API not available (run inside the extension).");
      return;
    }
    setError(null);
    chrome.bookmarks.getTree().then(([root]) => {
      if (!root?.children) {
        setTree([]);
        return;
      }
      setTree(root.children);
    }).catch((e) => {
      setError(e?.message ?? "Failed to load bookmarks");
    });
  }, []);

  useEffect(() => {
    load();
    const listener = () => load();
    chrome?.bookmarks?.onCreated?.addListener(listener);
    chrome?.bookmarks?.onRemoved?.addListener(listener);
    chrome?.bookmarks?.onChanged?.addListener(listener);
    chrome?.bookmarks?.onMoved?.addListener(listener);
    return () => {
      chrome?.bookmarks?.onCreated?.removeListener(listener);
      chrome?.bookmarks?.onRemoved?.removeListener(listener);
      chrome?.bookmarks?.onChanged?.removeListener(listener);
      chrome?.bookmarks?.onMoved?.removeListener(listener);
    };
  }, [load]);

  return { tree, error, reload: load };
}

export function useBookmarksSearch(query: string) {
  const [results, setResults] = useState<BookmarkTreeNode[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!chrome?.bookmarks) return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setLoading(true);
    chrome.bookmarks.search(q).then((nodes) => {
      setResults(nodes.filter((n) => n.url != null));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [query]);

  return { results, loading };
}

export async function createFolder(title: string, parentId = "1") {
  if (!chrome?.bookmarks) return null;
  return chrome.bookmarks.create({ parentId, title });
}

export async function deleteBookmarkNode(id: string) {
  if (!chrome?.bookmarks) return null;
  return chrome.bookmarks.removeTree(id);
}

export async function moveBookmark(id: string, parentId: string, index?: number) {
  if (!chrome?.bookmarks) return null;
  return chrome.bookmarks.move(id, index === undefined ? { parentId } : { parentId, index });
}

export async function createBookmark(
  title: string,
  url: string,
  parentId = "1"
) {
  if (!chrome?.bookmarks) return null;
  return chrome.bookmarks.create({ parentId, title, url });
}

export async function updateBookmark(
  id: string,
  changes: { title?: string; url?: string }
) {
  if (!chrome?.bookmarks) return;
  await chrome.bookmarks.update(id, changes);
}
