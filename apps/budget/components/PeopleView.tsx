"use client";

import { useState } from "react";
import type { BudgetCurrency, BudgetMember, BudgetTrip } from "../lib/budget-types";
import { Avatar, fmt, type Balance } from "../lib/budget-format";
import { toast } from "../lib/toast";
import { QrModal } from "./QrModal";

interface PeopleViewProps {
  balances: Balance[];
  currency: BudgetCurrency;
  budgetId?: string | null;
  trips: BudgetTrip[];
  onEdit: (m: BudgetMember) => void;
  onAdd: () => void;
}

// Manage the people sharing the budget: roster cards with each person's balance,
// a copy of their personal link (?b=&me=), edit, and an "Add a person" card.
export function PeopleView({ balances, currency, budgetId, trips, onEdit, onAdd }: PeopleViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrFor, setQrFor] = useState<BudgetMember | null>(null);

  const copyLink = (m: BudgetMember) => {
    if (!budgetId) return;
    navigator.clipboard.writeText(`${location.origin}/?b=${budgetId}&user=${m.id}`);
    toast("Link copied");
    setCopiedId(m.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <>
    <div className="gb-trips-grid">
      {balances.map((b, i) => {
        const settled = Math.abs(b.net) < 0.5;
        return (
          <div
            key={b.member.id}
            className="card"
            style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, minHeight: 148 }}
          >
            <button
              type="button"
              onClick={() => onEdit(b.member)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                background: "none",
                border: 0,
                padding: 0,
                cursor: "pointer",
                textAlign: "left",
                font: "inherit",
              }}
            >
              <Avatar member={b.member} idx={i} size={42} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: "var(--fg)" }}>
                  {b.member.name}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 12,
                    color: settled ? "var(--dim)" : b.net > 0 ? "var(--gb-pos)" : "var(--gb-neg)",
                  }}
                >
                  {settled
                    ? "all settled"
                    : b.net > 0
                      ? `gets ${fmt(b.net, currency)}`
                      : `owes ${fmt(-b.net, currency)}`}
                </span>
              </span>
            </button>
            {(() => {
              const pt = trips.filter((t) => (t.memberIds ?? []).includes(b.member.id));
              return (
                <div className="gb-access-row">
                  {pt.length === 0 ? (
                    <span className="gb-access-chip gb-access-full">🔑 Full access</span>
                  ) : (
                    pt.map((t) => (
                      <span
                        key={t.id}
                        className="gb-access-chip"
                        style={{ ["--chip" as any]: t.color || "var(--accent)" }}
                      >
                        <span aria-hidden>{t.emoji || "🏝️"}</span> {t.name}
                      </span>
                    ))
                  )}
                </div>
              );
            })()}
            <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
              <button type="button" className="gb-invite-act" onClick={() => onEdit(b.member)}>
                Edit
              </button>
              {budgetId && (
                <button type="button" className="gb-invite-act" onClick={() => copyLink(b.member)}>
                  {copiedId === b.member.id ? "Copied ✓" : "Copy link"}
                </button>
              )}
              {budgetId && (
                <button type="button" className="gb-invite-act" onClick={() => setQrFor(b.member)}>
                  QR
                </button>
              )}
            </div>
          </div>
        );
      })}
      <button type="button" className="gb-trip-card gb-trip-card--add" onClick={onAdd}>
        <span className="gb-trip-add-plus">＋</span>
        Add a person
      </button>
    </div>
    {qrFor && budgetId && (
      <QrModal
        url={`${location.origin}/?b=${budgetId}&user=${qrFor.id}`}
        title={qrFor.name}
        onClose={() => setQrFor(null)}
      />
    )}
    </>
  );
}
