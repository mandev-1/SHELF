import React from "react";

export function toggleCheckboxInNote(content: string, lineIndex: number): string {
  const lines = content.split("\n");
  const line = lines[lineIndex];
  const m = line?.match(/^(\s*[-*])\s*\[([ xX])\]\s*(.*)$/);
  if (!m) return content;
  const [, bullet, checked, rest] = m;
  const newChecked = checked === " " ? "x" : " ";
  lines[lineIndex] = `${bullet} [${newChecked}] ${rest}`;
  return lines.join("\n");
}

const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/g;

const MD_LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g;

const LINK_ANCHOR_CLASS =
  "text-emerald-400 hover:underline nodrag nopan";

function safeHttpHref(raw: string): string | null {
  const href = raw.trim();
  if (!href.startsWith("http://") && !href.startsWith("https://")) return null;
  try {
    const u = new URL(href);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

function linkifyUrlsInSegment(segment: string, keyPrefix: string): React.ReactNode[] {
  URL_REGEX.lastIndex = 0;
  const parts = segment.split(URL_REGEX);
  return parts.map((part, i) => {
    if (part.startsWith("http://") || part.startsWith("https://")) {
      return (
        <a
          key={`${keyPrefix}-${i}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_ANCHOR_CLASS}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

/**
 * Renders plain text with `[label](url)` markdown links and raw `https://` URLs as clickable links.
 * Only `http:` / `https:` hrefs are turned into anchors (other schemes stay literal).
 * Exported for use on the visual flow canvas and in the drawer.
 */
export function linkifyText(text: string): React.ReactNode {
  if (!text) return text;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let mi = 0;
  const re = new RegExp(MD_LINK_REGEX.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      nodes.push(...linkifyUrlsInSegment(text.slice(lastIndex, m.index), `u${mi}`));
      mi++;
    }
    const label = m[1];
    const href = safeHttpHref(m[2]);
    if (href) {
      nodes.push(
        <a
          key={`m${mi}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_ANCHOR_CLASS}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {label}
        </a>
      );
    } else {
      nodes.push(m[0]);
    }
    mi++;
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) {
    nodes.push(...linkifyUrlsInSegment(text.slice(lastIndex), `u${mi}`));
  }
  if (nodes.length === 0) {
    return <>{linkifyUrlsInSegment(text, "u0")}</>;
  }
  return <>{nodes}</>;
}

export function NoteContent({
  content,
  onNoteChange,
  linkify = false,
}: {
  content: string;
  onNoteChange?: (newNote: string) => void;
  /** When true, render URLs as clickable links (used only in drawer) */
  linkify?: boolean;
}) {
  const lines = content.split("\n");
  return (
    <div className="break-words space-y-0.5">
      {lines.map((line, i) => {
        const numberedMatch = line.match(/^(\d+)\.\s*(.*)$/);
        if (numberedMatch) {
          return (
            <div key={i} className="flex gap-1.5">
              <span className="shrink-0 font-medium text-zinc-500">{numberedMatch[1]}.</span>
              <span className="whitespace-pre-wrap">{linkify ? linkifyText(numberedMatch[2]) : numberedMatch[2]}</span>
            </div>
          );
        }
        const checkboxMatch = line.match(/^(\s*[-*])\s*\[([ xX])\]\s*(.*)$/);
        if (checkboxMatch && onNoteChange) {
          const [, , checked, rest] = checkboxMatch;
          const isChecked = checked.toLowerCase() === "x";
          return (
            <div key={i} className="flex gap-1.5 items-start">
              <button
                type="button"
                onClick={() => onNoteChange(toggleCheckboxInNote(content, i))}
                className="shelf-note-checkbox shelf-note-checkbox--in-body shelf-note-checkbox--interactive mt-0.5 shrink-0 h-4 w-4 rounded border border-zinc-500/50 bg-black/10 flex items-center justify-center hover:bg-emerald-500/15 hover:border-emerald-400/30 focus:outline-none focus:ring-1 focus:ring-emerald-400/25"
                aria-label={isChecked ? "Uncheck" : "Check"}
              >
                {isChecked && (
                  <svg className="h-2.5 w-2.5 text-emerald-500/80" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
              <span className={`whitespace-pre-wrap ${isChecked ? "line-through opacity-70" : ""}`}>{linkify ? linkifyText(rest) : rest}</span>
            </div>
          );
        }
        if (checkboxMatch) {
          const [, , checked, rest] = checkboxMatch;
          const isChecked = checked.toLowerCase() === "x";
          return (
            <div key={i} className="flex gap-1.5 items-start">
              <span className="shelf-note-checkbox shelf-note-checkbox--in-body shrink-0 mt-0.5 h-4 w-4 rounded border border-zinc-500/40 flex items-center justify-center bg-black/10">
                {isChecked && (
                  <svg className="h-2.5 w-2.5 text-emerald-500/70" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </span>
              <span className={`whitespace-pre-wrap ${isChecked ? "line-through opacity-70" : ""}`}>{linkify ? linkifyText(rest) : rest}</span>
            </div>
          );
        }
        return (
          <div key={i} className="whitespace-pre-wrap">
            {linkify ? linkifyText(line) : line}
          </div>
        );
      })}
    </div>
  );
}
