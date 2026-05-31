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
    <div className="hopper">
      <h1 className="hopper-title">Hopper</h1>
      <p className="hopper-sub">Toss items in the top. The bottom slot is the next one to buy.</p>

      <div className="toss">
        <div className="toss-label">Toss in</div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
          placeholder="What do you want to buy?"
          className="fld"
        />
        <div className="toss-row">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL (optional)"
            className="fld"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="fld"
          />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim()}
            className="toss-btn"
          >
            Toss in
          </button>
        </div>
      </div>

      <div className="stack-head">
        <span className="stack-label">Stack ({items.length})</span>
        <span className="stack-sort-hint">newest ↑ &nbsp; oldest ↓</span>
      </div>

      {items.length === 0 ? (
        <div className="stack-empty">Empty hopper.</div>
      ) : (
        <ol className="stack-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {items.map((item) => {
            const isBottom = item.id === bottomId;
            return (
              <li key={item.id} className={isBottom ? "stack-item stack-item--next" : "stack-item"}>
                <div className="stack-meta">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {isBottom && <span className="stack-badge">NEXT</span>}
                    <span className="stack-name">{item.title}</span>
                  </div>
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="stack-url">
                      {item.url}
                    </a>
                  )}
                  {item.note && <span className="stack-note">{item.note}</span>}
                </div>
                <div className="stack-actions">
                  {isBottom && (
                    <button type="button" onClick={onBuyBottom} className="mini-btn mini-btn--buy">
                      Bought
                    </button>
                  )}
                  <button type="button" onClick={() => onDiscard(item.id)} className="mini-btn">
                    Discard
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
