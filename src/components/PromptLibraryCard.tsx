import { Button, Modal, Surface } from "@heroui/react";
import { useEffect, useState } from "react";
import type { ShelfPromptMap } from "../types/grid";

interface PromptLibraryCardProps {
  prompts: ShelfPromptMap;
  onUpdatePrompt: (id: string, next: { title: string; body: string }) => void;
}

export function PromptLibraryCard({ prompts, onUpdatePrompt }: PromptLibraryCardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activePrompt = activeId ? prompts[activeId] : null;
  const [draft, setDraft] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setDraft(activePrompt?.body ?? "");
  }, [activePrompt?.body]);

  const close = () => setActiveId(null);

  const copyPrompt = async (body: string, id: string) => {
    await navigator.clipboard.writeText(body);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1200);
  };

  return (
    <>
      <Surface variant="secondary" className="rounded-2xl border border-emerald-400/20 bg-black/40 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/80">Prompt Library</p>
            <h2 className="text-lg font-semibold text-white">One card for your prompts</h2>
          </div>
          <span className="text-xs text-zinc-500">{Object.keys(prompts).length} saved</span>
        </div>
        <div className="space-y-2">
          {Object.values(prompts).map((prompt) => (
            <button
              key={prompt.id}
              type="button"
              onClick={() => {
                void copyPrompt(prompt.body, prompt.id);
              }}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-left transition-colors hover:border-emerald-400/40 hover:bg-emerald-400/5"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-emerald-200">{prompt.title}</p>
                <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-300/70">
                  {copiedId === prompt.id ? "Copied" : "Click to copy"}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-emerald-200/80 font-mono">{prompt.body}</p>
            </button>
          ))}
        </div>
      </Surface>

      <Modal isOpen={Boolean(activePrompt)} onOpenChange={(open) => !open && close()}>
        <Modal.Container placement="center" size="lg">
          <Modal.Dialog className="rounded-3xl border border-emerald-400/20 bg-black/95 text-white">
            <Modal.Header className="flex flex-col gap-1 px-6 pt-6">
              <span className="text-emerald-300 text-xs uppercase tracking-[0.2em]">Prompt</span>
              <span className="text-white">{activePrompt?.title}</span>
            </Modal.Header>
            <Modal.Body className="px-6 py-4">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                className="min-h-[320px] w-full rounded-2xl border border-emerald-400/30 bg-black/90 p-4 font-mono text-sm text-emerald-200 outline-none shadow-[0_0_0_1px_rgba(16,185,129,0.1)]"
                />
            </Modal.Body>
            <Modal.Footer className="gap-2 px-6 pb-6">
                <Button
                  variant="ghost"
                  onPress={async () => {
                    await navigator.clipboard.writeText(draft);
                  }}
                  className="text-emerald-200"
                >
                  Copy
                </Button>
                <Button
                  variant="ghost"
                  onPress={() => {
                    if (!activePrompt) return;
                    onUpdatePrompt(activePrompt.id, { title: activePrompt.title, body: draft });
                  }}
                >
                  Save
                </Button>
                <Button variant="ghost" onPress={() => setActiveId(null)}>
                  Close
                </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal>
    </>
  );
}
