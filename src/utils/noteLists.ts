// Shared "continue the list on Enter" behaviour for note textareas.
// Supports checklist (- [ ] / - [x] / - []), unordered (- / *), ordered (1. / 1)),
// and quote (>) markers. An empty marker line exits the list (clears the marker).
// Used by the Visual Flow node editor and the Doing-now task editor so both stay
// in sync.

import type { KeyboardEvent } from "react";

/**
 * Call from a textarea's onKeyDown. When Enter is pressed at the end of a list
 * line, continues the list (preventing the default newline) by writing the next
 * marker via `setValue`, then restores the caret. No-ops for non-list lines,
 * multi-line selections, or Enter with a modifier (Shift/Ctrl/Meta/Alt).
 */
export function continueNoteListOnEnter(
  e: KeyboardEvent<HTMLTextAreaElement>,
  setValue: (next: string) => void,
): void {
  if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
  const el = e.currentTarget;
  const { selectionStart, selectionEnd, value } = el;
  if (selectionStart !== selectionEnd) return;
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const line = value.slice(lineStart, selectionStart);

  // Checklist matched FIRST — otherwise the unordered regex swallows "[ ] text"
  // as plain content and the box is lost on Enter.
  const checklist = line.match(/^(\s*)([-*])(\s+)\[([ xX]?)\](\s+)(.*)$/);
  const ordered = line.match(/^(\s*)(\d+)([.)])(\s+)(.*)$/);
  const unordered = line.match(/^(\s*)([-*])(\s+)(.*)$/);
  const quote = line.match(/^(\s*)(>)(\s+)(.*)$/);
  const match = checklist ?? ordered ?? unordered ?? quote;
  if (!match) return;

  const indent = match[1];
  const content = match[match.length - 1];

  e.preventDefault();

  let nextValue: string;
  let nextCaret: number;
  if (content.trim() === "") {
    // empty list item -> exit the list, clearing the marker on this line
    nextValue = value.slice(0, lineStart) + indent + value.slice(selectionStart);
    nextCaret = lineStart + indent.length;
  } else {
    let marker: string;
    if (checklist) {
      // Continue the checklist with a fresh UNCHECKED box, preserving spacing.
      marker = `${indent}${checklist[2]}${checklist[3]}[ ]${checklist[5]}`;
    } else if (ordered) {
      marker = `${indent}${Number(ordered[2]) + 1}${ordered[3]}${ordered[4]}`;
    } else if (unordered) {
      marker = `${indent}${unordered[2]}${unordered[3]}`;
    } else {
      marker = `${indent}${quote![2]}${quote![3]}`;
    }
    const insert = `\n${marker}`;
    nextValue = value.slice(0, selectionStart) + insert + value.slice(selectionEnd);
    nextCaret = selectionStart + insert.length;
  }

  setValue(nextValue);
  requestAnimationFrame(() => {
    el.selectionStart = el.selectionEnd = nextCaret;
  });
}
