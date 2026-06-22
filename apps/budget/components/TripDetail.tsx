"use client";

import { useEffect, useState } from "react";
import type * as React from "react";
import type {
  BudgetTrip,
  BudgetMember,
  BudgetCurrency,
  BudgetSplitBasis,
  BudgetExpense,
} from "../lib/budget-types";
import { Avatar, fmt, initials, AV_HUES, nowIso, uid } from "../lib/budget-format";
import { convert, fmtSecondary, tripCurrencyOptions } from "../lib/currency";
import { tripStats, tripMembers, tripMetaLabel } from "../lib/trips";
import { ExpenseModal } from "./BudgetPanel";
import { SpendTrend } from "./SpendTrend";
import { toast } from "../lib/toast";
import { api } from "../lib/api";

// Category → dot hue for the "On the road" ledger (handoff 009).
const CATEGORY_HUE: Record<string, string> = {
  Groceries: "#34c891",
  Dining: "#e0905a",
  Transport: "#0070f2",
  Housing: "#a384df",
  Fun: "#e07a93",
  Health: "#16b6c8",
  Fees: "#8fa5c4",
  Other: "#5e7698",
};

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
  /** Who is performing changes — recorded in the expense audit log. */
  actorId?: string | null;
  actorName?: string;
  /** Guest mode: a header CTA opens the Add-Expense modal by bumping this. */
  addExpenseSignal?: number;
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
  actorId,
  actorName,
  addExpenseSignal,
  onBack,
  onEdit,
  onUpdate,
}: TripDetailProps) {
  const [expenseModal, setExpenseModal] = useState<BudgetExpense | "new" | null>(null);
  const [invite, setInvite] = useState(false);

  // Guest header CTA opens the Add-Expense modal by bumping addExpenseSignal.
  useEffect(() => {
    if (addExpenseSignal) setExpenseModal("new");
  }, [addExpenseSignal]);

  const tMembers = tripMembers(trip, members);
  const stats = tripStats(trip, members, splitBasis);
  const expenses = trip.expenses ?? [];

  // Trip totals are shown in the main currency, with the secondary in parens.
  const main = trip.mainCurrency ?? "CZK";
  const secondary = trip.secondaryCurrency ?? "EUR";
  const dual = (amt: number) => (
    <>
      {fmt(amt, main)}
      {secondary !== main && (
        <span style={{ fontSize: "0.56em", fontWeight: 600, color: "var(--dim)", marginLeft: 7 }}>
          {fmtSecondary(convert(amt, main, secondary), secondary)}
        </span>
      )}
    </>
  );

  const heroStyle = { ["--trip-hue" as any]: trip.color || "var(--accent)" } as React.CSSProperties;

  const memberById = (id: string) => members.find((m) => m.id === id);
  const hueOf = (m: BudgetMember) => m.color || AV_HUES[Math.max(0, members.indexOf(m)) % AV_HUES.length];
  const catHue = (c?: string) => (c && CATEGORY_HUE[c]) || "#8fa5c4";
  const dateLabel = (iso?: string) =>
    iso
      ? new Date(`${iso}T00:00:00`).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })
      : "";
  // Handoff 009 Reconcile card: the trip's cover photo behind a near-white scrim.
  const recStyle = trip.cover
    ? {
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.93) 0%, rgba(255,255,255,0.86) 45%, rgba(255,255,255,0.72) 100%), " +
          `url("${trip.cover}") 50% 72% / cover no-repeat, var(--surface)`,
      }
    : undefined;

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

  // Audit log: one append-only record per expense CRUD action (fire-and-forget).
  const logExpense = (action: "create" | "update" | "delete", e: BudgetExpense) => {
    void api
      .post("/logs", {
        tripId: trip.id,
        expenseId: e.id,
        actorId: actorId ?? undefined,
        actorName: actorName ?? undefined,
        action,
        amount: e.amount,
        currency: e.currency,
        note: e.title || undefined,
      })
      .catch(() => {});
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
            {dual(stats.total)}
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
            {dual(stats.perPerson)}
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
            {dual(stats.squared ? 0 : stats.toSettle)}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--dim)" }}>
            {stats.squared ? "all square" : "to settle"}
          </div>
        </div>
      </div>

      {/* Desktop: "Who paid what" + "Settle up" sit side by side; ≤900px they
          fall back to the stacked phone layout (.tc-board glue in budget.css). */}
      <div className="tc-board">
      <div className="tc-board-main">
      {/* On the road · who paid what (handoff 009) */}
      <section className="tc-card otr">
        <div className="tc-head">
          <div>
            <div className="tc-eyebrow">On the road</div>
            <div className="tc-title">Who paid what</div>
          </div>
          <button
            className="tc-addbtn"
            type="button"
            onClick={() => setExpenseModal("new")}
            disabled={tMembers.length === 0}
          >
            <span className="tc-plus">+</span>
            <span>Add expense</span>
          </button>
        </div>

        {expenses.length === 0 ? (
          <div className="gb-empty">No expenses logged yet — add the first one.</div>
        ) : (
          <div className="tc-ledger">
            {expenses.map((e) => {
              const payer = memberById(e.paidBy);
              const ids = e.splitAmong?.length ? e.splitAmong : tMembers.map((m) => m.id);
              const participants = ids.map(memberById).filter(Boolean) as BudgetMember[];
              return (
                <button key={e.id} className="tc-exp" type="button" onClick={() => setExpenseModal(e)}>
                  <span className="tc-exp-dot" style={{ background: catHue(e.category) }} />
                  <span className="tc-exp-amt">{fmt(e.amount, e.currency)}</span>
                  <span className="tc-exp-main">
                    <span className="tc-exp-label">{e.title || "Expense"}</span>
                    <span className="tc-exp-meta">
                      {e.category || "Other"} · {dateLabel(e.date)}
                    </span>
                  </span>
                  <span className="tc-exp-split">
                    {participants.map((m) => (
                      <span key={m.id} className="tc-av" style={{ backgroundColor: hueOf(m) }}>
                        {m.name.charAt(0).toUpperCase()}
                      </span>
                    ))}
                    <span className="tc-exp-splitlab">split {participants.length}</span>
                  </span>
                  <span className="tc-exp-paid">
                    {payer && (
                      <span className="tc-av" style={{ backgroundColor: hueOf(payer) }}>
                        {payer.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="tc-exp-paidlab">paid</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
      {/* Desktop-only cumulative spend curve, stacked under "Who paid what". */}
      <SpendTrend trip={trip} />
      </div>

      {/* Reconcile · settle up (handoff 009) — trip cover behind a white scrim */}
      <section className="tc-card rec" style={recStyle}>
        <div className="tc-head">
          <div>
            <div className="tc-eyebrow">Reconcile</div>
            <div className="tc-title">Settle up</div>
          </div>
        </div>

        <div className="tc-bal-list">
          {stats.balances.map((b) => {
            const m = b.member;
            const pos = b.net > 0.01;
            const neg = b.net < -0.01;
            const total = Math.max(1, stats.balances.reduce((s, x) => s + Math.abs(x.net), 0));
            const w = Math.min(100, Math.round((Math.abs(b.net) / total) * 100 * stats.balances.length));
            return (
              <div key={m.id} className="tc-bal">
                <span className="tc-av" style={{ backgroundColor: hueOf(m) }}>
                  {m.name.charAt(0).toUpperCase()}
                </span>
                <span className="tc-bal-name">{m.name}</span>
                <span className="tc-bal-track">
                  {(pos || neg) && (
                    <span className={"tc-bal-fill " + (pos ? "pos" : "neg")} style={{ width: w + "%" }} />
                  )}
                </span>
                <span className={"tc-bal-net" + (pos ? " pos" : neg ? " neg" : "")}>{fmt(b.net, main)}</span>
              </div>
            );
          })}
        </div>

        {stats.transfers.length === 0 ? (
          <div className="tc-clear">✓ This trip is squared up</div>
        ) : (
          <div className="tc-tx-list">
            {stats.transfers.map((t, i) => (
              <div key={i} className="tc-tx">
                <span className="tc-tx-name">{t.from.name}</span>
                <span className="tc-tx-arrow">→</span>
                <span className="tc-tx-name">{t.to.name}</span>
                <span className="tc-tx-amt">{fmt(t.amount, main)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
      </div>

      {expenseModal && (
        <ExpenseModal
          expense={expenseModal === "new" ? null : expenseModal}
          members={tMembers}
          currency={main}
          currencies={tripCurrencyOptions(main, secondary)}
          defaultCurrency={main}
          defaultPaidBy={tMembers[0]?.id}
          dateRange={{ start: trip.startDate, end: trip.endDate }}
          onSave={(e) => {
            const existed = (trip.expenses ?? []).some((x) => x.id === e.id);
            onUpdate({
              ...trip,
              expenses: existed
                ? (trip.expenses ?? []).map((x) => (x.id === e.id ? e : x))
                : [e, ...(trip.expenses ?? [])],
              updatedAt: nowIso(),
            });
            logExpense(existed ? "update" : "create", e);
            setExpenseModal(null);
          }}
          onRemove={(id) => {
            const removed = (trip.expenses ?? []).find((x) => x.id === id);
            onUpdate({
              ...trip,
              expenses: (trip.expenses ?? []).filter((x) => x.id !== id),
              updatedAt: nowIso(),
            });
            if (removed) logExpense("delete", removed);
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
