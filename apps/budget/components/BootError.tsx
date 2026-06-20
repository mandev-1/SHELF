"use client";

import type { CSSProperties } from "react";

// Friendly boot-failure screen. Shown when the budget can't start — most often
// because the Vercel deployment is missing its Supabase env vars, but it covers
// any startup error. Illustration + a light-hearted line, with the technical
// detail tucked underneath for whoever's deploying.

function isConfigError(detail?: string): boolean {
  return !!detail && /NEXT_PUBLIC_SUPABASE|supabaseUrl|env var/i.test(detail);
}

export function BootError({ detail }: { detail?: string }) {
  const config = isConfigError(detail);
  const headline = config
    ? "This budget hasn't been handed its keys yet 🔑"
    : "Our budget wandered off to the beach 🏖️";
  const sub = config
    ? "The app booted fine — it just can't find the vault. Someone forgot to give the deployment its Supabase keys."
    : "It started up but couldn't reach the money brain. Almost certainly our fault, not yours.";

  return (
    <div
      style={{
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 18,
        padding: "48px 24px",
        color: "var(--fg, #1f2a44)",
      }}
    >
      <Suitcase />
      <div
        style={{
          background: "var(--surface, #ffffff)",
          border: "1px solid var(--line, #d8e0ee)",
          borderRadius: 18,
          boxShadow: "var(--sh-2, 0 10px 30px -12px rgba(8, 48, 120, 0.25))",
          padding: "30px 28px",
          maxWidth: 520,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div style={{ maxWidth: 440, display: "flex", flexDirection: "column", gap: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", margin: 0 }}>{headline}</h1>
        <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--muted, var(--dim))", margin: 0 }}>{sub}</p>
      </div>

      <button
        type="button"
        onClick={() => (typeof window !== "undefined" ? window.location.reload() : undefined)}
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
        Try again
      </button>

      {config && (
        <p style={{ fontSize: 12, color: "var(--dim)", maxWidth: 460, lineHeight: 1.5, margin: "4px 0 0" }}>
          Fix: add <code style={code}>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code style={code}>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in Vercel → Settings → Environment Variables, then
          redeploy.
        </p>
      )}

      {detail && (
        <details style={{ marginTop: 6, maxWidth: 520, width: "100%" }}>
          <summary style={{ cursor: "pointer", fontSize: 11.5, color: "var(--faint, var(--dim))", listStyle: "none" }}>
            Technical detail
          </summary>
          <pre
            style={{
              marginTop: 8,
              textAlign: "left",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontFamily: "var(--mono, ui-monospace, monospace)",
              fontSize: 11,
              color: "var(--dim)",
              background: "color-mix(in srgb, var(--surface, #ffffff) 70%, transparent)",
              border: "1px solid var(--line, #d8e0ee)",
              borderRadius: 10,
              padding: "10px 12px",
            }}
          >
            {detail}
          </pre>
        </details>
      )}
      </div>
    </div>
  );
}

const code: CSSProperties = {
  fontFamily: "var(--mono, ui-monospace, monospace)",
  fontSize: 11,
  background: "color-mix(in srgb, var(--surface, #ffffff) 70%, transparent)",
  border: "1px solid var(--line, #d8e0ee)",
  borderRadius: 5,
  padding: "1px 5px",
};

/** A little line-art suitcase on holiday — sad-but-cute, with sunglasses. */
function Suitcase() {
  return (
    <svg width="148" height="148" viewBox="0 0 148 148" fill="none" aria-hidden="true">
      {/* sun */}
      <circle cx="116" cy="34" r="13" fill="color-mix(in srgb, var(--accent, #0070f2) 22%, transparent)" />
      <g stroke="var(--accent, #0070f2)" strokeWidth="2.4" strokeLinecap="round" opacity="0.55">
        <path d="M116 14v-6M116 60v-6M136 34h6M90 34h6M130 20l4-4M98 52l4-4M130 48l4 4M98 16l4 4" />
      </g>
      {/* dotted travel path */}
      <path
        d="M18 122 C 40 110, 56 128, 78 116"
        stroke="var(--line-strong, var(--line, #d8e0ee))"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeDasharray="1 9"
        opacity="0.7"
      />
      {/* suitcase body */}
      <rect x="40" y="62" width="68" height="54" rx="10" fill="var(--surface, #ffffff)" stroke="var(--fg, #1f2a44)" strokeWidth="2.6" />
      {/* handle */}
      <path d="M62 62v-7a6 6 0 0 1 6-6h12a6 6 0 0 1 6 6v7" stroke="var(--fg, #1f2a44)" strokeWidth="2.6" strokeLinecap="round" />
      {/* latches */}
      <path d="M40 84h68" stroke="var(--fg, #1f2a44)" strokeWidth="2.2" opacity="0.35" />
      <rect x="68" y="80" width="12" height="8" rx="2" fill="var(--accent, #0070f2)" />
      {/* face: sunglasses + small frown */}
      <g stroke="var(--fg, #1f2a44)" strokeWidth="2.4" strokeLinecap="round">
        <rect x="52" y="94" width="12" height="9" rx="3" fill="var(--fg, #1f2a44)" stroke="none" />
        <rect x="84" y="94" width="12" height="9" rx="3" fill="var(--fg, #1f2a44)" stroke="none" />
        <path d="M64 97h20" />
        <path d="M66 111c4-4 12-4 16 0" />
      </g>
      {/* luggage tag */}
      <g>
        <path d="M108 74l12 5" stroke="var(--fg, #1f2a44)" strokeWidth="2" strokeLinecap="round" />
        <rect x="116" y="74" width="18" height="13" rx="3" fill="color-mix(in srgb, var(--accent, #0070f2) 16%, var(--surface, #ffffff))" stroke="var(--fg, #1f2a44)" strokeWidth="2" transform="rotate(8 125 80)" />
      </g>
    </svg>
  );
}
