export type BookmarkTreeNode = chrome.bookmarks.BookmarkTreeNode;

export function isFolder(node: BookmarkTreeNode): boolean {
  return node.url === undefined;
}

export function isBookmark(node: BookmarkTreeNode): boolean {
  return typeof node.url === "string";
}
