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

export function NoteContent({
  content,
  onNoteChange,
}: {
  content: string;
  onNoteChange?: (newNote: string) => void;
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
              <span className="whitespace-pre-wrap">{numberedMatch[2]}</span>
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
                className="shelf-note-checkbox shelf-note-checkbox--interactive mt-0.5 shrink-0 h-4 w-4 rounded border border-zinc-500/50 bg-black/10 flex items-center justify-center hover:bg-emerald-500/15 hover:border-emerald-400/30 focus:outline-none focus:ring-1 focus:ring-emerald-400/25"
                aria-label={isChecked ? "Uncheck" : "Check"}
              >
                {isChecked && (
                  <svg className="h-2.5 w-2.5 text-emerald-500/80" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
              <span className={`whitespace-pre-wrap ${isChecked ? "line-through opacity-70" : ""}`}>{rest}</span>
            </div>
          );
        }
        if (checkboxMatch) {
          const [, , checked, rest] = checkboxMatch;
          const isChecked = checked.toLowerCase() === "x";
          return (
            <div key={i} className="flex gap-1.5 items-start">
              <span className="shelf-note-checkbox shrink-0 mt-0.5 h-4 w-4 rounded border border-zinc-500/40 flex items-center justify-center bg-black/10">
                {isChecked && (
                  <svg className="h-2.5 w-2.5 text-emerald-500/70" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </span>
              <span className={`whitespace-pre-wrap ${isChecked ? "line-through opacity-70" : ""}`}>{rest}</span>
            </div>
          );
        }
        return (
          <div key={i} className="whitespace-pre-wrap">
            {line}
          </div>
        );
      })}
    </div>
  );
}
