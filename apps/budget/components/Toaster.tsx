"use client";

import { useEffect, useState } from "react";
import { TOAST_EVENT } from "../lib/toast";

interface Toast {
  id: number;
  msg: string;
}

// Mount once. Listens for toast() events and shows a top-right stack that
// auto-dismisses. Pointer-events disabled so toasts never block the UI.
export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let counter = 0;
    const handler = (e: Event) => {
      const msg = (e as CustomEvent<string>).detail;
      const id = ++counter;
      setToasts((t) => [...t, { id, msg }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2200);
    };
    window.addEventListener(TOAST_EVENT, handler);
    return () => window.removeEventListener(TOAST_EVENT, handler);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 400,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            background: "var(--fg, #1f2a44)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            padding: "10px 16px",
            borderRadius: 10,
            boxShadow: "0 10px 30px -10px rgba(0,0,0,0.45)",
            animation: "budget-toast-in 0.18s ease-out",
          }}
        >
          {t.msg}
        </div>
      ))}
      <style>{`@keyframes budget-toast-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}
