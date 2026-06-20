"use client";

import { useState } from "react";

// Shown when there's no session and no invite link in the URL. The host enters
// the password to unlock full access; friends use their personal link instead.
export function Gate({ onLogin }: { onLogin: (password: string) => boolean }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);

  return (
    <main
      style={{
        minHeight: "80vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!onLogin(pw)) setError(true);
        }}
        style={{
          width: "100%",
          maxWidth: 380,
          background: "var(--surface, #ffffff)",
          border: "1px solid var(--line, #d8e0ee)",
          borderRadius: 18,
          boxShadow: "var(--sh-2, 0 10px 30px -12px rgba(8, 48, 120, 0.25))",
          padding: "30px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "var(--dim)",
            }}
          >
            Shared Budget
          </span>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--fg)", margin: "4px 0 0" }}>
            Welcome back 🔑
          </h1>
          <p style={{ fontSize: 13, color: "var(--dim)", margin: "8px 0 0", lineHeight: 1.5 }}>
            Enter the host password to manage everything — or just open your personal invite
            link to join.
          </p>
        </div>

        <input
          type="password"
          autoFocus
          value={pw}
          onChange={(e) => {
            setPw(e.target.value);
            setError(false);
          }}
          placeholder="Host password"
          style={{
            border: "1px solid var(--line-strong, #c2cfe6)",
            borderRadius: 10,
            padding: "11px 13px",
            fontSize: 14,
            background: "var(--inset, #f3f6fc)",
            color: "var(--fg)",
            outline: "none",
          }}
        />
        {error && (
          <span style={{ fontSize: 12.5, color: "var(--gb-neg, #e5484d)" }}>
            That password didn&apos;t work.
          </span>
        )}

        <button
          type="submit"
          style={{
            border: 0,
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 14,
            fontWeight: 600,
            color: "#fff",
            background: "var(--accent, #0070f2)",
            borderRadius: 10,
            padding: "11px 18px",
          }}
        >
          Enter
        </button>
      </form>
    </main>
  );
}
