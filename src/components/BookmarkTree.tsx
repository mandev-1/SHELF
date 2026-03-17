import { Disclosure, Link, Spinner, Surface } from "@heroui/react";
import { useState } from "react";
import type { BookmarkTreeNode } from "../types/bookmarks";
import { isFolder } from "../types/bookmarks";

interface BookmarkTreeProps {
  tree: BookmarkTreeNode[] | null;
}

const ROOT_NAMES: Record<string, string> = {
  "1": "Bookmarks bar",
  "2": "Other bookmarks",
};

function BookmarkItem({ node }: { node: BookmarkTreeNode }) {
  if (node.url) {
    return (
      <Link
        href={node.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-zinc-300 hover:text-white underline-offset-2 hover:underline text-sm truncate block max-w-full"
      >
        {node.title || new URL(node.url).hostname}
      </Link>
    );
  }
  return null;
}

function FolderSection({
  node,
  expandedIds,
  onExpandedChange,
}: {
  node: BookmarkTreeNode;
  expandedIds: Set<string>;
  onExpandedChange: (id: string, expanded: boolean) => void;
}) {
  const children = node.children ?? [];
  const bookmarkChildren = children.filter((c) => c.url);
  const folderChildren = children.filter((c) => !c.url);

  if (bookmarkChildren.length === 0 && folderChildren.length === 0) return null;

  const title = node.title || ROOT_NAMES[node.id] || "Folder";
  const isExpanded = expandedIds.has(node.id);

  return (
    <Disclosure
      key={node.id}
      isExpanded={isExpanded}
      onExpandedChange={(expanded) => onExpandedChange(node.id, expanded)}
      className="border border-white/10 rounded-xl overflow-hidden bg-white/5"
    >
      <Disclosure.Heading>
        <Disclosure.Trigger className="text-left font-medium text-zinc-200 hover:text-white w-full flex items-center justify-between px-4 py-3">
          <span>{title}</span>
          <span className="text-zinc-500 text-xs flex items-center gap-2">
            {bookmarkChildren.length + folderChildren.length} items
            <Disclosure.Indicator />
          </span>
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body className="px-4 pb-3 pt-1 space-y-1">
          {folderChildren.map((child) => (
            <FolderSection
              key={child.id}
              node={child}
              expandedIds={expandedIds}
              onExpandedChange={onExpandedChange}
            />
          ))}
          {bookmarkChildren.map((child) => (
            <div key={child.id} className="pl-2 py-1">
              <BookmarkItem node={child} />
            </div>
          ))}
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}

export function BookmarkTree({ tree }: BookmarkTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(["1"]));

  const onExpandedChange = (id: string, expanded: boolean) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (expanded) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  if (tree === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" color="accent" />
      </div>
    );
  }

  const roots = tree.filter((n) => isFolder(n));

  return (
    <div className="space-y-3">
      {roots.length === 0 ? (
        <Surface variant="secondary" className="rounded-2xl p-8 text-center border border-white/10">
          <p className="text-zinc-400">No bookmarks yet.</p>
          <p className="text-zinc-500 text-sm mt-1">
            Add bookmarks in Chrome and they’ll appear here.
          </p>
        </Surface>
      ) : (
        roots.map((node) => (
          <FolderSection
            key={node.id}
            node={node}
            expandedIds={expandedIds}
            onExpandedChange={onExpandedChange}
          />
        ))
      )}
    </div>
  );
}
