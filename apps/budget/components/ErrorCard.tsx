"use client";

import type { ReactNode } from "react";

// Reusable pretty-error template: a white card on the grid (matches the Gate /
// BootError look). Optional primary action + an "admin" footer link that drops
// the viewer back to the host password gate.
export function ErrorCard({
  emoji = "⚠️",
  title,
  message,
  actionLabel,
  onAction,
  onAdmin,
  adminLabel = "Log in as admin instead",
}: {
  emoji?: string;
  title: string;
  message?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  onAdmin?: () => void;
  adminLabel?: string;
}) {
  return (
    <main
      style={{
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--surface, #ffffff)",
          border: "1px solid var(--line, #d8e0ee)",
          borderRadius: 18,
          boxShadow: "var(--sh-2, 0 10px 30px -12px rgba(8, 48, 120, 0.25))",
          padding: "30px 28px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 40, lineHeight: 1 }}>{emoji}</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--fg)", margin: 0 }}>{title}</h1>
        {message && (
          <p
            style={{
              fontSize: 13.5,
              color: "var(--muted, var(--dim))",
              margin: 0,
              lineHeight: 1.55,
              maxWidth: 340,
            }}
          >
            {message}
          </p>
        )}

        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            style={{
              marginTop: 4,
              border: 0,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 13.5,
              fontWeight: 600,
              color: "#fff",
              background: "var(--accent, #0070f2)",
              borderRadius: 10,
              padding: "10px 20px",
            }}
          >
            {actionLabel}
          </button>
        )}

        {onAdmin && (
          <div
            style={{
              marginTop: 8,
              paddingTop: 14,
              borderTop: "1px solid var(--line, #e6ecf6)",
              width: "100%",
            }}
          >
            <button
              type="button"
              onClick={onAdmin}
              style={{
                background: "none",
                border: 0,
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--accent, #0070f2)",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              {adminLabel}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
