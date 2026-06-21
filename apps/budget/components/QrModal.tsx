"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "../lib/toast";

// A centered modal showing a scannable QR of an invite/share URL. The QR is
// rendered client-side (qrcode.react → SVG) so the link never leaves the app —
// consistent with the self-hosted, no-third-party ethos.
export function QrModal({ url, title, onClose }: { url: string; title?: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(url);
    toast("Link copied");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="gb-modal-backdrop" onClick={onClose}>
      <div className="gb-modal gb-modal--sm" onClick={(e) => e.stopPropagation()}>
        <div className="gb-modal-head">
          <span className="card-eyebrow">Invite QR</span>
          <button type="button" className="gb-modal-x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div
          className="gb-modal-body"
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}
        >
          {title && (
            <h2 className="gb-modal-title" style={{ margin: 0 }}>
              {title}
            </h2>
          )}
          <p className="gb-modal-desc" style={{ margin: 0 }}>
            Point a phone camera at this to open the shared budget as this person.
          </p>

          <div style={{ background: "#fff", padding: 16, borderRadius: 16, boxShadow: "var(--sh-2)" }}>
            <QRCodeSVG value={url} size={212} level="M" marginSize={0} fgColor="#0f172a" bgColor="#ffffff" />
          </div>

          <div style={{ display: "flex", gap: 8, width: "100%" }}>
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 13,
                color: "var(--fg)",
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "9px 11px",
                outline: "none",
              }}
            />
            <button
              type="button"
              className="gb-settle-btn"
              style={{ width: "auto", marginTop: 0, padding: "10px 16px", whiteSpace: "nowrap" }}
              onClick={copy}
            >
              {copied ? "Copied ✓" : "Copy link"}
            </button>
          </div>
        </div>
        <div className="gb-modal-foot">
          <span style={{ flex: 1 }} />
          <button type="button" className="gb-modal-cancel" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
