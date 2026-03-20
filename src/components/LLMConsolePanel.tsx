import { useEffect, useState } from "react";
import type { ShelfPromptMap } from "../types/grid";

const DEFAULT_LLM_URL = "https://example.org";

function openInTab(url: string) {
  const resolved = url?.trim() || DEFAULT_LLM_URL;
  if (typeof chrome !== "undefined" && chrome.tabs?.create) {
    chrome.tabs.create({ url: resolved });
  } else {
    window.open(resolved, "_blank", "noopener,noreferrer");
  }
}

export function LLMConsolePanel({
  fullPage = false,
  prompts = {},
  iframeUrl,
  onClose,
  onEditPromptInLibrary,
}: {
  fullPage?: boolean;
  prompts?: ShelfPromptMap;
  iframeUrl?: string;
  onClose?: () => void;
  onEditPromptInLibrary?: (promptId: string) => void;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  const containerClass = fullPage
    ? "min-w-0 rounded-2xl border border-white/10 bg-zinc-900/50 flex flex-col h-[calc(100vh-9rem)] overflow-hidden"
    : "mt-3 min-w-0 rounded-2xl border border-white/10 bg-black/20 p-3";

  const copyPrompt = async (body: string, id: string) => {
    await navigator.clipboard.writeText(body);
    setCopiedId(id);
    setCopyToast("Copied to clipboard");
    window.setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1200);
    window.setTimeout(() => setCopyToast(null), 1400);
  };

  useEffect(() => {
    if (!menu) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target?.closest(".shelf-llm-context-menu")) return;
      setMenu(null);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown, true);
    };
  }, [menu]);

  const promptList = Object.values(prompts);

  return (
    <div className={`shelf-llm-console-panel ${containerClass}`}>
      {copyToast && (
        <div className="pointer-events-none fixed right-5 top-5 z-[80] animate-[toast-enter_180ms_ease-out]">
          <div className="results-glow rounded-2xl border border-emerald-400/20 bg-black/90 px-4 py-3 text-sm text-emerald-100 shadow-[0_0_20px_rgba(74,222,128,0.18)]">
            {copyToast}
          </div>
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
            className="shelf-llm-context-menu absolute min-w-40 rounded-2xl border border-emerald-400/15 bg-black/90 p-2 shadow-[0_0_40px_rgba(16,185,129,0.16),0_0_90px_rgba(59,130,246,0.08)]"
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
            {onEditPromptInLibrary && (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-emerald-200 hover:bg-emerald-400/10 hover:text-emerald-100"
                onClick={() => {
                  onEditPromptInLibrary(menu.id);
                  setMenu(null);
                }}
              >
                Edit in Prompt Library
              </button>
            )}
          </div>
        </div>
      )}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/20 px-4 py-3">
        <h1 className="text-base font-semibold tracking-tight text-zinc-100">
          LLM Console
        </h1>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
          >
            Close
          </button>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Main area: iframe (works for localhost, Ollama, LM Studio, etc.) */}
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <iframe
            src={iframeUrl?.trim() || DEFAULT_LLM_URL}
            title="LLM Console"
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="absolute right-3 top-3">
            <button
              type="button"
              onClick={() => openInTab(iframeUrl ?? "")}
              className="rounded-lg border border-white/20 bg-black/60 px-3 py-1.5 text-xs text-zinc-300 backdrop-blur-sm transition hover:bg-black/80 hover:text-white"
              title="Open in new tab (use if embedding is blocked)"
            >
              Open in tab
            </button>
          </div>
        </div>

        {/* Right pillar: prompt library cards — settings color scheme */}
        <aside className="shelf-llm-pillar relative flex h-full min-h-0 w-[280px] shrink-0 flex-col">
          <div className="shelf-llm-pillar-header shrink-0 border-b p-4">
            <div className="shelf-llm-pillar-title">
              Prompt Library
            </div>
            <div className="shelf-llm-pillar-subtitle">
              {promptList.length} prompt{promptList.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4">
            {promptList.length === 0 ? (
              <p className="shelf-llm-pillar-empty">
                No prompts yet. Add them from the shelf.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {promptList.map((prompt) => {
                  const body = prompt.body;
                  const isCopied = copiedId === prompt.id;
                  return (
                    <button
                      key={prompt.id}
                      type="button"
                      onClick={() => copyPrompt(body, prompt.id)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setMenu({ id: prompt.id, x: e.clientX, y: e.clientY });
                      }}
                      className={`shelf-llm-pillar-card ${isCopied ? "shelf-llm-pillar-card--copied" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="shelf-llm-pillar-card-title truncate">
                          {prompt.title}
                        </p>
                        <span className="shelf-llm-pillar-card-action shrink-0">
                          {isCopied ? "Copied" : "Copy"}
                        </span>
                      </div>
                      <p className="shelf-llm-pillar-card-body mt-1 line-clamp-2">
                        {body}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
