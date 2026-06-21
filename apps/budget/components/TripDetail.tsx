"use client";

import { useState } from "react";
import type * as React from "react";
import type {
  BudgetTrip,
  BudgetMember,
  BudgetCurrency,
  BudgetSplitBasis,
  BudgetExpense,
} from "../lib/budget-types";
import { Avatar, fmt, initials, AV_HUES, nowIso, uid } from "../lib/budget-format";
import { tripStats, tripMembers, tripMetaLabel } from "../lib/trips";
import { ExpenseModal } from "./BudgetPanel";
import { toast } from "../lib/toast";

interface TripDetailProps {
  trip: BudgetTrip;
  members: BudgetMember[]; // ALL budget members
  currency: BudgetCurrency;
  splitBasis: BudgetSplitBasis;
  budgetId?: string | null;
  /** Guest mode (trip-scoped link): hide host-only actions. */
  guest?: boolean;
  /** When false (a non-admin member), hide host-only edit actions and show a
   *  read-only list of the people on the trip instead. */
  canManage?: boolean;
  onBack: () => void;
  onEdit: () => void;
  onUpdate: (trip: BudgetTrip) => void; // persist expense add/edit, cover, etc.
}

export function TripDetail({
  trip,
  members,
  currency,
  splitBasis,
  budgetId,
  guest = false,
  canManage = true,
  onBack,
  onEdit,
  onUpdate,
}: TripDetailProps) {
  const [expenseModal, setExpenseModal] = useState<BudgetExpense | "new" | null>(null);
  const [invite, setInvite] = useState(false);

  const tMembers = tripMembers(trip, members);
  const stats = tripStats(trip, members, splitBasis);
  const expenses = trip.expenses ?? [];

  const heroStyle = { ["--trip-hue" as any]: trip.color || "var(--accent)" } as React.CSSProperties;

  const memberById = (id: string) => members.find((m) => m.id === id);

  const onCoverFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onUpdate({ ...trip, cover: dataUrl, updatedAt: nowIso() });
    };
    reader.readAsDataURL(file);
  };

  const openGuest = () => {
    if (budgetId && tMembers[0]) {
      window.open(`${location.origin}/?b=${budgetId}&user=${tMembers[0].id}&trip=${trip.id}`, "_blank");
    }
  };

  return (
    <div>
      {/* Hero */}
      <div className="card gb-trip-hero" style={heroStyle}>
        {trip.cover && (
          <img className="gb-trip-hero-img" src={trip.cover} data-filled="" alt="" />
        )}
        <div className="gb-trip-hero-scrim" />
        {!guest && (
          <button type="button" className="gb-trip-back" onClick={onBack}>
            ← All trips
          </button>
        )}
        <div className="gb-trip-faces">
          {tMembers.map((m, i) => (
            <span
              key={m.id}
              className="gb-av gb-trip-face"
              style={{
                width: 28,
                height: 28,
                fontSize: 11,
                background: m.color || AV_HUES[i % AV_HUES.length],
              }}
            >
              {initials(m.name)}
            </span>
          ))}
        </div>
        <div
          className="gb-trip-hero-body"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}
        >
          <div>
            <div className="gb-trip-hero-emoji">{trip.emoji}</div>
            <h1 className="gb-trip-hero-name">{trip.name}</h1>
            <div className="gb-trip-hero-meta">{tripMetaLabel(trip)}</div>
            {!guest &&
              (canManage ? (
                <div className="gb-trip-hero-actions">
                  <button type="button" className="gb-hero-btn" onClick={() => setInvite(true)}>
                    ＋ Invite to reconcile
                  </button>
                  <button type="button" className="gb-hero-btn ghost" onClick={onEdit}>
                    Edit trip
                  </button>
                </div>
              ) : (
                // Non-admin members can't manage the trip — show who's on it instead.
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                  {tMembers.map((m, i) => (
                    <span
                      key={m.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 11px 4px 4px",
                        borderRadius: 999,
                        background: "rgba(0,0,0,0.32)",
                        color: "#fff",
                        fontSize: 12.5,
                        fontWeight: 600,
                      }}
                    >
                      <span
                        className="gb-av"
                        style={{
                          width: 22,
                          height: 22,
                          fontSize: 10,
                          background: m.color || AV_HUES[i % AV_HUES.length],
                        }}
                      >
                        {initials(m.name)}
                      </span>
                      {m.name}
                    </span>
                  ))}
                </div>
              ))}
          </div>
          {!guest && canManage && (
            <label
              style={{
                cursor: "pointer",
                color: "rgba(255,255,255,0.85)",
                textAlign: "center",
                fontSize: 12,
              }}
            >
              <div style={{ fontSize: 22 }}>🖼</div>
              <div>Drop a cover photo</div>
              <div style={{ textDecoration: "underline" }}>or browse files</div>
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={onCoverFile}
              />
            </label>
          )}
        </div>
      </div>

      {/* Stat tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ padding: "16px 18px" }}>
          <span className="card-eyebrow">TRIP SPEND</span>
          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "var(--fg)",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1.1,
              margin: "4px 0 2px",
            }}
          >
            {fmt(stats.total, currency)}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--dim)" }}>
            {expenses.length} expense{expenses.length === 1 ? "" : "s"}
          </div>
        </div>
        <div className="card" style={{ padding: "16px 18px" }}>
          <span className="card-eyebrow">PER PERSON</span>
          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "var(--fg)",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1.1,
              margin: "4px 0 2px",
            }}
          >
            {fmt(stats.perPerson, currency)}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--dim)" }}>{stats.travellers} travelling</div>
        </div>
        <div
          className="card"
          style={{
            padding: "16px 18px",
            borderColor: "var(--accent)",
            background: "color-mix(in srgb, var(--accent) 7%, var(--surface))",
          }}
        >
          <span className="card-eyebrow">TO SETTLE</span>
          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "var(--accent)",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1.1,
              margin: "4px 0 2px",
            }}
          >
            {stats.squared ? "0" : fmt(stats.toSettle, currency)}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--dim)" }}>
            {stats.squared ? "all square" : "to settle"}
          </div>
        </div>
      </div>

      {/* Who paid what */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span className="card-eyebrow">ON THE ROAD</span>
            <span className="card-title">Who paid what</span>
          </div>
          <button
            type="button"
            className="ghost-btn gb-add-btn"
            onClick={() => setExpenseModal("new")}
            disabled={tMembers.length === 0}
          >
            ＋ Add expense
          </button>
        </div>
        {expenses.length === 0 ? (
          <div className="gb-empty">No expenses logged yet — add the first one.</div>
        ) : (
          <div className="gb-activity-list">
            {expenses.map((e) => {
              const payer = memberById(e.paidBy);
              return (
                <button
                  key={e.id}
                  type="button"
                  className="gb-act-row"
                  onClick={() => setExpenseModal(e)}
                >
                  {payer && <Avatar member={payer} idx={members.indexOf(payer)} size={30} />}
                  <span className="gb-act-main">
                    <span className="gb-act-label">{e.title || "Expense"}</span>
                    <span className="gb-act-meta">
                      {payer?.name ?? "?"} paid · {e.date}
                      {e.category ? ` · ${e.category}` : ""}
                    </span>
                  </span>
                  <span className="gb-act-amt">{fmt(e.amount, e.currency)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Settle up */}
      <div className="card gb-settle">
        <div className="card-head">
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span className="card-eyebrow">RECONCILE</span>
            <span className="card-title">Settle up</span>
          </div>
        </div>
        <div className="gb-settle-body">
          <div className="gb-bal-list">
            {stats.balances.map((b, i) => {
              const max = Math.max(1, ...stats.balances.map((x) => Math.abs(x.net)));
              return (
                <div key={b.member.id} className="gb-bal-row">
                  <Avatar member={b.member} idx={i} size={26} />
                  <span className="gb-bal-name">{b.member.name}</span>
                  <span className="gb-bal-track">
                    <span
                      className="gb-bal-fill"
                      style={{
                        width: `${(Math.abs(b.net) / max) * 100}%`,
                        background: b.net >= 0 ? "var(--gb-pos)" : "var(--gb-neg)",
                        marginLeft: b.net >= 0 ? "50%" : undefined,
                      }}
                    />
                  </span>
                  <span
                    className="gb-bal-net"
                    style={{
                      color:
                        Math.abs(b.net) < 0.5
                          ? "var(--dim)"
                          : b.net > 0
                            ? "var(--gb-pos)"
                            : "var(--gb-neg)",
                    }}
                  >
                    {fmt(b.net, currency)}
                  </span>
                </div>
              );
            })}
          </div>
          {stats.transfers.length === 0 ? (
            <div className="gb-settle-clear">✓ This trip is squared up</div>
          ) : (
            stats.transfers.map((t, i) => (
              <div key={i} className="gb-settle-row">
                <strong>{t.from.name}</strong> → <strong>{t.to.name}</strong>
                <span className="gb-settle-amt">{fmt(t.amount, currency)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {expenseModal && (
        <ExpenseModal
          expense={expenseModal === "new" ? null : expenseModal}
          members={tMembers}
          currency={currency}
          defaultPaidBy={tMembers[0]?.id}
          onSave={(e) => {
            onUpdate({
              ...trip,
              expenses: (trip.expenses ?? []).some((x) => x.id === e.id)
                ? (trip.expenses ?? []).map((x) => (x.id === e.id ? e : x))
                : [e, ...(trip.expenses ?? [])],
              updatedAt: nowIso(),
            });
            setExpenseModal(null);
          }}
          onRemove={(id) => {
            onUpdate({
              ...trip,
              expenses: (trip.expenses ?? []).filter((x) => x.id !== id),
              updatedAt: nowIso(),
            });
            setExpenseModal(null);
          }}
          onClose={() => setExpenseModal(null)}
        />
      )}

      {invite && (
        <div className="gb-modal-backdrop" onClick={() => setInvite(false)}>
          <div className="gb-modal gb-modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="gb-modal-head">
              <span className="card-eyebrow">RECONCILE</span>
              <button
                type="button"
                className="gb-modal-x"
                onClick={() => setInvite(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="gb-modal-body">
              <div className="gb-invite-list">
                {tMembers.map((m) => (
                  <div key={m.id} className="gb-invite-row">
                    <Avatar member={m} idx={members.indexOf(m)} size={26} />
                    <span className="gb-invite-name">{m.name}</span>
                    {budgetId && (
                      <button
                        type="button"
                        className="gb-invite-act"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            `${location.origin}/?b=${budgetId}&user=${m.id}&trip=${trip.id}`,
                          );
                          toast("Trip link copied");
                        }}
                      >
                        Copy link
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="gb-modal-foot">
              <span style={{ flex: 1 }} />
              <button type="button" className="gb-modal-cancel" onClick={() => setInvite(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
