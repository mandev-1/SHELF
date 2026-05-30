import { useState } from "react";
import type { BuylistItem } from "../types/grid";

interface Props {
  items: BuylistItem[];
  onAdd: (input: { title: string; url?: string; note?: string }) => void;
  onDiscard: (id: string) => void;
  onBuyBottom: () => void;
}

export function BuylistPanel({ items, onAdd, onDiscard, onBuyBottom }: Props) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");

  const submit = () => {
    if (!title.trim()) return;
    onAdd({ title, url, note });
    setTitle("");
    setUrl("");
    setNote("");
  };

  const bottomId = items.length > 0 ? items[items.length - 1].id : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
          Hopper
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Toss items in the top. The bottom slot is the next one to buy.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-sm shadow-slate-900/5 backdrop-blur-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Toss in
        </h3>
        <div className="mt-3 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
            placeholder="What do you want to buy?"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <div className="flex gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="URL (optional)"
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optional)"
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={submit}
              disabled={!title.trim()}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
            >
              Toss in
            </button>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Stack <span className="ml-1 text-slate-400">({items.length})</span>
          </h3>
          <span className="text-xs text-slate-400">newest ↑ &nbsp; oldest ↓</span>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/40 px-4 py-10 text-center text-sm text-slate-400">
            Empty hopper.
          </div>
        ) : (
          <ol className="space-y-2">
            {items.map((item) => {
              const isBottom = item.id === bottomId;
              return (
                <li
                  key={item.id}
                  className={
                    isBottom
                      ? "rounded-xl border border-emerald-400/50 bg-gradient-to-br from-emerald-50 to-white p-3 shadow-sm shadow-emerald-500/10"
                      : "rounded-xl border border-slate-200/70 bg-white/70 p-3 shadow-sm shadow-slate-900/5"
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {isBottom && (
                          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                            next
                          </span>
                        )}
                        <span className="truncate text-sm font-medium text-slate-900">
                          {item.title}
                        </span>
                      </div>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 block truncate text-xs text-indigo-600 hover:text-indigo-500 hover:underline"
                        >
                          {item.url}
                        </a>
                      )}
                      {item.note && (
                        <p className="mt-1 text-xs text-slate-500">{item.note}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {isBottom && (
                        <button
                          type="button"
                          onClick={onBuyBottom}
                          className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-500"
                        >
                          Buy
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDiscard(item.id)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        title="Discard (archive)"
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
