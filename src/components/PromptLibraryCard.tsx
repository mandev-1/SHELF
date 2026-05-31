import { useEffect, useState } from "react";
import type { ShelfPrompt, ShelfPromptMap, ShelfPromptVersion } from "../types/grid";

function renderPromptPreview(text: string) {
  return text.split("\n").map((line, lineIndex) => {
    if (/^-{4,}\s*$/.test(line)) {
      return (
        <div key={`line-${lineIndex}`} className="font-bold text-sky-300">
          {line}
        </div>
      );
    }

    const parts: Array<{ key: string; text: string; className?: string }> = [];
    let cursor = 0;
    const tokenPattern = /\$\{[^}]+\}|\{[^}]+\}|\[[^\]]+\]/g;
    let match: RegExpExecArray | null;

    while ((match = tokenPattern.exec(line)) !== null) {
      if (match.index > cursor) {
        parts.push({ key: `${lineIndex}-${cursor}`, text: line.slice(cursor, match.index) });
      }
      const token = match[0];
      parts.push({
        key: `${lineIndex}-${match.index}`,
        text: token,
        className: token.startsWith("${")
          ? "rounded bg-fuchsia-500/25 px-1 font-bold text-fuchsia-200"
          : token.startsWith("[")
            ? "rounded bg-amber-500/25 px-1 font-bold text-amber-200"
            : "rounded bg-cyan-500/20 px-1 font-bold text-cyan-200",
      });
      cursor = match.index + token.length;
    }

    if (cursor < line.length) {
      parts.push({ key: `${lineIndex}-${cursor}`, text: line.slice(cursor) });
    }

    return (
      <div key={`line-${lineIndex}`}>
        {parts.length === 0
          ? "\u00A0"
          : parts.map((part) => (
              <span key={part.key} className={part.className}>
                {part.text}
              </span>
            ))}
      </div>
    );
  });
}

function makeVersionCode(index: number) {
  return `1.0.${index}`;
}

interface PromptLibraryCardProps {
  prompts: ShelfPromptMap;
  onUpdatePrompt: (id: string, next: ShelfPrompt) => void;
  onDeletePrompt: (id: string) => void;
  onUpdatePromptMeta: (id: string, updater: (prompt: ShelfPrompt) => ShelfPrompt) => void;
  promptRows: 1 | 2;
  onPromptRowsChange: (rows: 1 | 2) => void;
  initialEditId?: string | null;
  onInitialEditConsumed?: () => void;
}

export function PromptLibraryCard({
  prompts,
  onUpdatePrompt,
  onDeletePrompt,
  onUpdatePromptMeta,
  promptRows,
  onPromptRowsChange,
  initialEditId,
  onInitialEditConsumed,
}: PromptLibraryCardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activePrompt = activeId ? prompts[activeId] : null;
  const [draft, setDraft] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [savedPulse, setSavedPulse] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [menu, setMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  useEffect(() => {
    setDraft(activePrompt?.body ?? "");
    setDraftTitle(activePrompt?.title ?? "");
    setSelectedVersionId(activePrompt?.activeVersionId ?? activePrompt?.versions?.at(-1)?.id ?? null);
  }, [activePrompt?.activeVersionId, activePrompt?.body, activePrompt?.title, activePrompt?.versions]);

  useEffect(() => {
    if (initialEditId && prompts[initialEditId]) {
      setActiveId(initialEditId);
      onInitialEditConsumed?.();
    }
  }, [initialEditId, onInitialEditConsumed, prompts]);

  const close = () => setActiveId(null);

  const copyPrompt = async (body: string, id: string) => {
    await navigator.clipboard.writeText(body);
    setCopiedId(id);
    setCopyToast("Copied to clipboard");
    window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1200);
    window.setTimeout(() => setCopyToast(null), 1400);
  };

  const addPrompt = () => {
    const title = window.prompt("Prompt title", "New prompt");
    if (!title?.trim()) return;
    const body = window.prompt("Prompt text", "Write your prompt here.");
    if (!body?.trim()) return;
    const id = crypto.randomUUID();
    const versionId = `${id}-${makeVersionCode(0)}`;
    onUpdatePrompt(id, {
      id,
      title: title.trim(),
      body: body.trim(),
      versions: [
        {
          id: versionId,
          code: makeVersionCode(0),
          body: body.trim(),
          createdAt: new Date().toISOString(),
        },
      ],
      activeVersionId: versionId,
    });
  };

  const startEdit = (id: string) => {
    setActiveId(id);
    setMenu(null);
    setSavedPulse(false);
    setShowVersions(false);
  };

  const activeVersion = activePrompt?.versions?.find((version) => version.id === selectedVersionId) ?? activePrompt?.versions?.at(-1) ?? null;

  const saveActivePrompt = () => {
    if (!activePrompt) return;
    const versions = activePrompt.versions ?? [];
    const current = activeVersion ?? versions.at(-1);
    const nextVersions = current
      ? versions.map((version) => (version.id === current.id ? { ...version, body: draft } : version))
      : [
          ...versions,
          {
            id: `${activePrompt.id}-${makeVersionCode(versions.length)}`,
            code: makeVersionCode(versions.length),
            body: draft,
            createdAt: new Date().toISOString(),
          },
        ];
    onUpdatePrompt(activePrompt.id, {
      ...activePrompt,
      title: draftTitle.trim() || activePrompt.title,
      body: draft,
      versions: nextVersions.length ? nextVersions : versions,
      activeVersionId: current?.id ?? nextVersions.at(-1)?.id,
    });
    setSavedPulse(true);
    window.setTimeout(() => {
      setSavedPulse(false);
      setActiveId(null);
    }, 550);
  };

  const deleteActivePrompt = () => {
    if (!activePrompt) return;
    if (!window.confirm(`Delete "${activePrompt.title}"?`)) return;
    onDeletePrompt(activePrompt.id);
    setSavedPulse(false);
    setActiveId(null);
  };

  const addVersion = () => {
    if (!activePrompt) return;
    const code = window.prompt("Version code", makeVersionCode(activePrompt.versions?.length ?? 0));
    if (!code?.trim()) return;
    const nextVersion: ShelfPromptVersion = {
      id: crypto.randomUUID(),
      code: code.trim(),
      body: draft,
      createdAt: new Date().toISOString(),
    };
    onUpdatePromptMeta(activePrompt.id, (prompt) => ({
      ...prompt,
      versions: [...(prompt.versions ?? []), nextVersion],
      activeVersionId: nextVersion.id,
    }));
    setSelectedVersionId(nextVersion.id);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && activePrompt) {
        event.preventDefault();
        close();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activePrompt]);

  return (
    <>
      {copyToast && (
        <div className="toast" role="status" aria-live="polite">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {copyToast}
        </div>
      )}
      {menu && prompts[menu.id] && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu(null);
          }}
        >
          <div
            className="absolute min-w-40 rounded-2xl border border-emerald-400/15 bg-black/90 p-2 shadow-[0_0_40px_rgba(16,185,129,0.16),0_0_90px_rgba(59,130,246,0.08)]"
            style={{
              left: Math.max(8, Math.min(menu.x, window.innerWidth - 180)),
              top: Math.max(8, Math.min(menu.y, window.innerHeight - 120)),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-emerald-200 hover:bg-emerald-400/10 hover:text-emerald-100"
              onClick={async () => {
                await copyPrompt(prompts[menu.id].body, menu.id);
                setMenu(null);
              }}
            >
              Copy
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-emerald-200 hover:bg-emerald-400/10 hover:text-emerald-100"
              onClick={() => startEdit(menu.id)}
            >
              Edit
            </button>
          </div>
        </div>
      )}
      <div className="prompt-card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="prompt-eyebrow">Prompt Library</p>
            <h2 className="prompt-title">Prompt library</h2>
          </div>
          <div className="prompt-tools">
            <div className="prompt-rows-sel">
              <span>Visible rows</span>
              <select
                value={promptRows}
                onChange={(e) => onPromptRowsChange(Number(e.target.value) as 1 | 2)}
                className="pill"
                aria-label="Visible prompt rows"
              >
                <option value={1}>One Row</option>
                <option value={2}>Two Rows</option>
              </select>
            </div>
            <span className="prompt-count">{Object.keys(prompts).length} saved</span>
            <button type="button" onClick={addPrompt} className="prompt-add">
              + Prompt
            </button>
          </div>
        </div>
        <div
          className="prompt-grid"
          style={{
            maxHeight: promptRows === 1 ? "5rem" : "12rem",
            overflowY: "auto",
            paddingRight: "4px",
          }}
        >
          {Object.values(prompts).map((prompt) => (
            <button
              key={prompt.id}
              type="button"
              onClick={() => {
                void copyPrompt(prompt.body, prompt.id);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({
                  id: prompt.id,
                  x: e.clientX,
                  y: e.clientY,
                });
              }}
              className="prompt"
            >
              <div className="prompt-h">
                <span className="prompt-name">{prompt.title}</span>
                <span className="prompt-copy">
                  {copiedId === prompt.id ? "Copied" : "Click to copy"}
                </span>
              </div>
              <div className="prompt-body">
                {prompt.body.split(/(\[[A-Z][A-Z0-9_-]*\])/g).map((part, i) =>
                  /^\[[A-Z][A-Z0-9_-]*\]$/.test(part) ? (
                    <span key={i} className="tok-sys">{part}</span>
                  ) : (
                    <span key={i}>{part}</span>
                  )
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {activePrompt && (
        <div className="fixed inset-0 z-[60] overflow-hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity duration-300"
            onClick={close}
            aria-label="Close prompt editor"
          />
          <div className="relative z-[61] flex h-full w-full items-stretch justify-stretch p-3 sm:p-5">
            <div className="shelf-prompt-editor flex h-full w-full flex-col overflow-hidden rounded-[28px] border border-emerald-400/20 bg-black/94 shadow-[0_0_70px_rgba(16,185,129,0.12),0_0_120px_rgba(59,130,246,0.10),0_0_180px_rgba(236,72,153,0.08)] transition-all duration-300 ease-out animate-[prompt-enter_220ms_ease-out]"
            >
              <div className="shelf-prompt-editor-header flex items-center justify-between border-b border-emerald-400/10 bg-white/5 px-6 py-4">
                <div className="min-w-0 flex-1">
                  <p className="shelf-prompt-editor-label text-xs uppercase tracking-[0.2em] text-emerald-300/80">Prompt editor</p>
                  <input
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    className="mt-1 w-full max-w-xl rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-lg font-semibold text-white outline-none"
                    aria-label="Prompt title"
                  />
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="shelf-prompt-editor-close rounded-full border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-300 transition hover:border-emerald-300/30 hover:text-white"
                >
                  Close
                </button>
              </div>
              <div className="flex min-h-0 flex-1 flex-col p-5">
                <div className="min-h-0 flex-1 overflow-auto">
                  <div className="grid min-h-0 gap-4 lg:grid-cols-[1fr_280px]">
                    <div className="flex flex-col gap-4">
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        className="shelf-prompt-body min-h-[320px] w-full resize-none rounded-[22px] border border-emerald-400/25 bg-black/92 p-5 font-mono text-sm outline-none shadow-[0_0_0_1px_rgba(16,185,129,0.1)]"
                      />
                      <div className="shelf-prompt-preview pointer-events-none rounded-[22px] border border-emerald-400/15 bg-black/70 p-5 font-mono text-sm leading-6">
                        {renderPromptPreview(draft)}
                      </div>
                    </div>
                    <div className="shelf-prompt-editor-versions flex min-h-0 flex-col rounded-[22px] border border-white/10 bg-black/45 p-4">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Versions</p>
                        <button
                          type="button"
                          onClick={() => setShowVersions((v) => !v)}
                          className="shelf-prompt-versions-toggle rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300 hover:text-white"
                        >
                          {showVersions ? "Hide" : "Show"}
                        </button>
                      </div>
                      {showVersions && (
                        <div className="mb-3 flex items-center gap-2">
                          <button type="button" onClick={addVersion} className="rounded-full bg-emerald-300 px-3 py-2 text-xs font-medium text-black">
                            + Version
                          </button>
                        </div>
                      )}
                      <div className="min-h-0 flex-1 overflow-auto space-y-2 pr-1">
                        {(activePrompt.versions ?? []).map((version) => (
                          <button
                            key={version.id}
                            type="button"
                            onClick={() => {
                              setSelectedVersionId(version.id);
                              setDraft(version.body);
                            }}
                            className={`shelf-prompt-version-btn w-full rounded-xl border px-3 py-2 text-left transition ${
                              selectedVersionId === version.id
                                ? "shelf-prompt-version-btn--selected border-emerald-300/50 bg-emerald-400/10 text-white"
                                : "border-white/10 bg-black/25 text-zinc-300 hover:border-white/20 hover:bg-black/35"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium">{version.code}</span>
                              <span className="text-[10px] text-zinc-500">{version.id === activeVersion?.id ? "Current" : "Older"}</span>
                            </div>
                            <div className="mt-1 text-[11px] text-zinc-500">{new Date(version.createdAt).toLocaleString()}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="shelf-prompt-editor-actions mt-4 flex shrink-0 items-center justify-end gap-2 border-t border-white/5 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowVersions((v) => !v)}
                    className="rounded-full border border-white/10 bg-black/70 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:border-cyan-300/40 hover:text-white"
                  >
                    Version Manager
                  </button>
                  <button
                    type="button"
                    onClick={deleteActivePrompt}
                    className="rounded-full border border-red-400/20 bg-black/70 px-5 py-3 text-sm font-medium text-red-200 transition hover:border-red-300/40 hover:bg-red-500/10 hover:text-red-100"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={saveActivePrompt}
                    className={`shelf-prompt-editor-save rounded-full px-5 py-3 text-sm font-medium text-black transition-all duration-300 ${
                      savedPulse
                        ? "scale-110 bg-emerald-300 shadow-[0_0_24px_rgba(74,222,128,0.55),0_0_60px_rgba(74,222,128,0.25)]"
                        : "bg-emerald-300 shadow-[0_0_18px_rgba(74,222,128,0.28)] hover:scale-[1.03]"
                    }`}
                  >
                    {savedPulse ? "Saved" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
