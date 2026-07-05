"use client";

import { useEffect, useState } from "react";
import type * as React from "react";
import type {
  BudgetTrip,
  BudgetMember,
  BudgetCurrency,
  BudgetSplitBasis,
  BudgetExpense,
  TripReconcile,
  TripReconcileMode,
} from "../lib/budget-types";
import {
  Avatar,
  expenseShares,
  fmt,
  initials,
  AV_HUES,
  CATEGORY_HUE,
  nowIso,
  today,
  uid,
  type Transfer,
} from "../lib/budget-format";
import { convert, fmtSecondary, tripCurrencyOptions } from "../lib/currency";
import { tripStats, tripMembers, tripMetaLabel } from "../lib/trips";
import { ExpenseModal } from "./BudgetPanel";
import { SpendTrend } from "./SpendTrend";
import { DailyBars } from "./DailyBars";
import { toast } from "../lib/toast";
import { api } from "../lib/api";
import {
  buildTripBackup,
  downloadTripBackup,
  downloadTripCsv,
  tripBackupFilename,
  tripExpensesCsv,
  type TripBackupLog,
} from "../lib/trip-backup";

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
  /** How this trip settles up (shared, from BudgetState.tripSettings). */
  reconcile?: TripReconcile;
  /** When set, the settle-up plan is changeable from the Reconcile card. */
  onReconcileChange?: (r: TripReconcile) => void;
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
  reconcile,
  onReconcileChange,
  onBack,
  onEdit,
  onUpdate,
}: TripDetailProps) {
  const [expenseModal, setExpenseModal] = useState<BudgetExpense | "new" | null>(null);
  const [settleModal, setSettleModal] = useState<BudgetExpense | "new" | null>(null);
  const [txDetail, setTxDetail] = useState<Transfer | null>(null);
  const [pairFor, setPairFor] = useState<BudgetMember | null>(null);
  const [invite, setInvite] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractDlg, setExtractDlg] = useState(false);

  // Extract = download the trip. JSON is the full restorable backup (same as
  // TripsView's right-click menu); Excel is a human-readable CSV of the ledger.
  const extract = async (kind: "json" | "excel") => {
    if (extracting) return;
    setExtractDlg(false);
    setExtracting(true);
    try {
      if (kind === "excel") {
        downloadTripCsv(tripExpensesCsv(trip, members), tripBackupFilename(trip, new Date(), "csv"));
        toast(`Extracted “${trip.name}” for Excel`);
        return;
      }
      let logs: TripBackupLog[] | undefined;
      try {
        logs = await api.get<TripBackupLog[]>(`/logs?tripId=${encodeURIComponent(trip.id)}`);
      } catch {
        logs = undefined;
      }
      const envelope = await buildTripBackup({ trip, members, logs, exportedBy: actorName });
      downloadTripBackup(envelope, tripBackupFilename(trip));
      toast(`Extracted “${trip.name}”`);
    } catch {
      toast("Couldn't build that backup. Try again.");
    } finally {
      setExtracting(false);
    }
  };

  // Guest header CTA opens the Add-Expense modal by bumping addExpenseSignal.
  useEffect(() => {
    if (addExpenseSignal) setExpenseModal("new");
  }, [addExpenseSignal]);

  const tMembers = tripMembers(trip, members);
  const stats = tripStats(trip, members, splitBasis, reconcile);
  const expenses = trip.expenses ?? [];

  // Settle-up plan (how the transfer suggestions are built). Payment rules
  // ("I will only pay Mark and Petra") take precedence over any preset mode.
  const planMode: TripReconcileMode = reconcile?.mode ?? "min";
  const planHub = reconcile?.hubId ? members.find((m) => m.id === reconcile.hubId) : undefined;
  const hasRules = !!reconcile?.payTo && Object.keys(reconcile.payTo).length > 0;
  const planLabel = hasRules
    ? "Custom rules"
    : planMode === "hub" && planHub
      ? `Via ${planHub.name}`
      : planMode === "pairs"
        ? "Pair by pair"
        : "Fewest payments";
  const [planDlg, setPlanDlg] = useState(false);

  // Payment-rule edits. No stored rule = pays anyone; an EMPTY list = pays no
  // one (their debt stays open in the plan).
  const saveRules = (payTo: Record<string, string[]>) => {
    onReconcileChange?.({
      ...reconcile,
      mode: undefined,
      hubId: undefined,
      payTo: Object.keys(payTo).length ? payTo : undefined,
    });
  };
  const togglePay = (payerId: string, targetId: string) => {
    const all = tMembers.filter((x) => x.id !== payerId).map((x) => x.id);
    const cur = reconcile?.payTo?.[payerId];
    const eff = cur === undefined ? all : cur.filter((id) => all.includes(id));
    const next = eff.includes(targetId)
      ? eff.filter((id) => id !== targetId)
      : [...eff, targetId];
    const payTo = { ...(reconcile?.payTo ?? {}) };
    if (next.length === all.length) delete payTo[payerId];
    else payTo[payerId] = next;
    saveRules(payTo);
  };
  const togglePaysNoone = (payerId: string) => {
    const cur = reconcile?.payTo?.[payerId];
    const payTo = { ...(reconcile?.payTo ?? {}) };
    if (cur !== undefined && cur.length === 0) delete payTo[payerId]; // back to "anyone"
    else payTo[payerId] = [];
    saveRules(payTo);
  };

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
  // Ledger day headers ("20th – Saturday"): newest day first, undated last.
  const dayHeading = (iso?: string) => {
    if (!iso) return "No date";
    const d = new Date(`${iso}T00:00:00`);
    const day = d.getDate();
    const suffix =
      day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
    return `${day}${suffix} – ${d.toLocaleDateString("en", { weekday: "long" })}`;
  };
  // Reconciliation statements live in the Settle-up card, not the spend ledger.
  const settlements = expenses
    .filter((e) => e.settlement)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const expenseDays = (() => {
    const sorted = [...expenses]
      .filter((e) => !e.settlement)
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    const days: { date?: string; items: BudgetExpense[] }[] = [];
    for (const e of sorted) {
      const last = days[days.length - 1];
      if (last && (last.date ?? "") === (e.date ?? "")) last.items.push(e);
      else days.push({ date: e.date, items: [e] });
    }
    return days;
  })();
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

  // Shared save/remove used by both the expense and the reconciliation modals.
  const saveExpense = (e: BudgetExpense) => {
    const existed = (trip.expenses ?? []).some((x) => x.id === e.id);
    onUpdate({
      ...trip,
      expenses: existed
        ? (trip.expenses ?? []).map((x) => (x.id === e.id ? e : x))
        : [e, ...(trip.expenses ?? [])],
      updatedAt: nowIso(),
    });
    logExpense(existed ? "update" : "create", e);
  };
  const removeExpense = (id: string) => {
    const removed = (trip.expenses ?? []).find((x) => x.id === id);
    onUpdate({
      ...trip,
      expenses: (trip.expenses ?? []).filter((x) => x.id !== id),
      updatedAt: nowIso(),
    });
    if (removed) logExpense("delete", removed);
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

      {/* Stat tiles (+ admin-only Extract button as a fourth, content-hugging cell) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: canManage ? "repeat(3, 1fr) auto" : "repeat(3, 1fr)",
          gap: 12,
          marginBottom: 16,
        }}
      >
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
            {(() => {
              const n = expenses.filter((e) => !e.settlement).length;
              return `${n} expense${n === 1 ? "" : "s"}`;
            })()}
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
        {canManage && (
          <button
            type="button"
            className="card tc-extract"
            onClick={() => setExtractDlg(true)}
            disabled={extracting}
            title="Download this trip as a JSON backup"
          >
            <span>{extracting ? "Extracting…" : "Extract"}</span>
            <span className="tc-extract-arrow" aria-hidden>
              ↓
            </span>
          </button>
        )}
      </div>

      {/* Desktop: "Who paid what" + "Settle up" sit side by side; ≤900px they
          fall back to the stacked phone layout (.tc-board glue in budget.css). */}
      <div className="tc-board">
      <div className="tc-board-main">
      {/* On the road · who paid what — live ".gb-ledger" (strategie-group.css).
          Exact dims live in budget.css; the larger handoff-009 mock was image scale. */}
      <section className="card gb-ledger">
        <div className="card-head">
          <div>
            <div className="card-eyebrow">On the road</div>
            <h3 className="card-title">Who paid what</h3>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              className="ghost-btn"
              type="button"
              onClick={() => setSettleModal("new")}
              disabled={tMembers.length < 2}
              title="Log a settle-up payment between two people"
            >
              + Reconciliation
            </button>
            <button
              className="ghost-btn"
              type="button"
              onClick={() => setExpenseModal("new")}
              disabled={tMembers.length === 0}
            >
              + Add expense
            </button>
          </div>
        </div>

        {expenseDays.length === 0 ? (
          <div className="gb-empty">No expenses logged yet — add the first one.</div>
        ) : (
          <div className="gb-ledger-body">
            {expenseDays.map((day) => (
              <div key={day.date || "undated"} className="gb-led-day">
                <div className="gb-led-dayhead">{dayHeading(day.date)}</div>
                {day.items.map((e) => {
              const payer = memberById(e.paidBy);
              const ids = e.splitAmong?.length ? e.splitAmong : tMembers.map((m) => m.id);
              const participants = ids.map(memberById).filter(Boolean) as BudgetMember[];
              return (
                <button
                  key={e.id}
                  className="gb-led-row"
                  type="button"
                  onClick={() => (e.settlement ? setSettleModal(e) : setExpenseModal(e))}
                >
                  <span
                    className="gb-led-dot"
                    style={{ background: e.settlement ? CATEGORY_HUE.Settlement : catHue(e.category) }}
                  />
                  <span className="gb-led-main">
                    <span className="gb-led-label">{e.title || (e.settlement ? "Settlement" : "Expense")}</span>
                    <span className="gb-led-meta">
                      {e.settlement ? "Settlement" : e.category || "Other"} · {dateLabel(e.date)}
                    </span>
                  </span>
                  <span className="gb-led-split">
                    {participants.map((m) => (
                      <span
                        key={m.id}
                        className="gb-av gb-led-part"
                        style={{ width: 26, height: 26, fontSize: 11, background: hueOf(m) }}
                      >
                        {m.name.charAt(0).toUpperCase()}
                      </span>
                    ))}
                    <span className="gb-led-splitlab">
                      {e.settlement ? "received" : `split ${participants.length}`}
                    </span>
                  </span>
                  <span className="gb-led-paid">
                    {payer && (
                      <span
                        className="gb-av"
                        style={{ width: 26, height: 26, fontSize: 11, background: hueOf(payer) }}
                      >
                        {payer.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="gb-led-paidlab">paid</span>
                  </span>
                  <span className="gb-led-amt">{fmt(e.amount, e.currency)}</span>
                </button>
              );
                })}
              </div>
            ))}
          </div>
        )}
      </section>
      {/* Desktop-only cumulative spend curve, stacked under "Who paid what". */}
      <SpendTrend trip={trip} />
      {/* Desktop-only per-day stacked bars (by payer / by expense type). */}
      <DailyBars trip={trip} members={tMembers} />
      </div>

      {/* Reconcile · settle up (handoff 009) — trip cover behind a white scrim */}
      <section className="tc-card rec" style={recStyle}>
        <div className="tc-head">
          <div>
            <div className="tc-eyebrow">Reconcile</div>
            <div className="tc-title">Settle up</div>
          </div>
          {onReconcileChange ? (
            <button
              type="button"
              className="tc-plan-btn"
              onClick={() => setPlanDlg(true)}
              aria-haspopup="dialog"
              title="Change how the group settles up"
            >
              {planLabel} <span aria-hidden>▾</span>
            </button>
          ) : (
            <span className="tc-plan-btn tc-plan-btn--ro">{planLabel}</span>
          )}
        </div>

        <div className="tc-bal-list">
          {stats.balances.map((b) => {
            const m = b.member;
            const pos = b.net > 0.01;
            const neg = b.net < -0.01;
            const total = Math.max(1, stats.balances.reduce((s, x) => s + Math.abs(x.net), 0));
            const w = Math.min(100, Math.round((Math.abs(b.net) / total) * 100 * stats.balances.length));
            return (
              <button
                key={m.id}
                type="button"
                className="tc-bal"
                onClick={() => setPairFor(m)}
                title={`See who ${m.name} paid for — and who paid for ${m.name}`}
              >
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
                <span className="tc-bal-eye" aria-hidden>
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="2.6" />
                  </svg>
                </span>
              </button>
            );
          })}
        </div>

        {stats.transfers.length === 0 ? (
          stats.balances.some((b) => Math.abs(b.net) > 0.5) ? (
            <div className="tc-clear tc-clear--open">
              No payments planned — the remaining balances stay open under the current payment
              rules.
            </div>
          ) : (
            <div className="tc-clear">✓ This trip is squared up</div>
          )
        ) : (
          <div className="tc-tx-list">
            {stats.transfers.map((t, i) => (
              <button
                key={i}
                type="button"
                className="tc-tx"
                onClick={() => setTxDetail(t)}
                title="See how this amount was worked out"
              >
                <span className="tc-tx-name">{t.from.name}</span>
                <span className="tc-tx-arrow">→</span>
                <span className="tc-tx-name">{t.to.name}</span>
                <span className="tc-tx-amt">{fmt(t.amount, main)}</span>
              </button>
            ))}
          </div>
        )}

        {settlements.length > 0 && (
          <div className="tc-stmt-list">
            <div className="tc-stmt-head">Reconciliation statements</div>
            {settlements.map((e) => {
              const payer = memberById(e.paidBy);
              const payee = memberById(e.splitAmong?.[0] ?? "");
              return (
                <button
                  key={e.id}
                  type="button"
                  className="tc-stmt"
                  onClick={() => canManage && setSettleModal(e)}
                  style={canManage ? undefined : { cursor: "default" }}
                >
                  <span className="tc-stmt-main">
                    <span className="tc-stmt-line">
                      <span className="tc-stmt-name" title={`Payer: ${payer?.name ?? "?"}`}>
                        {payer?.name ?? "?"}
                      </span>{" "}
                      paid{" "}
                      <span
                        className="tc-stmt-name tc-stmt-name--payee"
                        title={`Received the money: ${payee?.name ?? "?"}`}
                      >
                        {payee?.name ?? "?"}
                      </span>
                    </span>
                    <span className="tc-stmt-meta">Settlement · {dateLabel(e.date)}</span>
                  </span>
                  <span className="tc-stmt-amt">{fmt(e.amount, e.currency)}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>
      </div>

      {planDlg && onReconcileChange && (
        <div className="gb-modal-backdrop" onClick={() => setPlanDlg(false)}>
          <div
            className="gb-modal gb-modal--sm"
            role="dialog"
            aria-label="How should this trip settle up?"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="gb-modal-head">
              <span className="card-eyebrow">Reconcile</span>
              <button type="button" className="gb-modal-x" onClick={() => setPlanDlg(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="gb-modal-body" style={{ display: "block" }}>
              <h2 className="gb-modal-title">Who pays whom?</h2>
              <p className="gb-modal-desc">
                By default the plan uses the fewest payments. Untick people someone isn’t willing
                to pay (e.g. “I will only pay Mark and Petra”) and the plan reroutes around it —
                everyone sees the same plan.
              </p>
              {tMembers.map((m) => {
                const targets = tMembers.filter((x) => x.id !== m.id);
                const list = reconcile?.payTo?.[m.id];
                const paysNoone = list !== undefined && list.length === 0;
                const isOn = (id: string) => (list === undefined ? true : list.includes(id));
                return (
                  <div className="gb-fld" key={m.id} style={{ marginTop: 12 }}>
                    <span className="gb-fld-lab">{m.name} pays only</span>
                    <div className="gb-paidby">
                      {targets.map((x) => (
                        <button
                          key={x.id}
                          type="button"
                          className={`gb-paid-chip${isOn(x.id) ? " on" : ""}`}
                          aria-pressed={isOn(x.id)}
                          onClick={() => togglePay(m.id, x.id)}
                        >
                          <Avatar member={x} idx={members.indexOf(x)} size={22} /> {x.name}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={`gb-paid-chip gb-paid-chip--none${paysNoone ? " on" : ""}`}
                        aria-pressed={paysNoone}
                        title={`${m.name} makes no payments — their balance stays open`}
                        onClick={() => togglePaysNoone(m.id)}
                      >
                        🚫 No one
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="gb-modal-foot">
              <button
                type="button"
                className="gb-modal-cancel"
                onClick={() => onReconcileChange({})}
                disabled={!hasRules}
              >
                Reset rules
              </button>
              <span style={{ flex: 1 }} />
              <button
                type="button"
                className="gb-settle-btn"
                style={{ width: "auto", marginTop: 0, padding: "10px 18px" }}
                onClick={() => setPlanDlg(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {pairFor && tMembers.length > 1 && (
        <PairModal
          person={pairFor}
          members={tMembers}
          expenses={expenses.map((e) => ({
            ...e,
            amount: convert(e.amount, e.currency, main),
            currency: main,
          }))}
          splitBasis={splitBasis}
          main={main}
          onClose={() => setPairFor(null)}
        />
      )}

      {txDetail && (() => {
        // Line-by-line settle-up math, all in the trip's main currency — the same
        // conversion + share function (expenseShares) the engine itself uses.
        const mainExp = expenses.map((e) => ({
          ...e,
          amount: convert(e.amount, e.currency, main),
          currency: main,
        }));
        const ledgerOf = (mid: string) =>
          mainExp
            .map((e) => {
              const share = expenseShares(tMembers, e, splitBasis).get(mid) ?? 0;
              const paidAmt = e.paidBy === mid ? e.amount : 0;
              return { e, paid: paidAmt, share, net: paidAmt - share };
            })
            .filter((l) => l.paid > 0.005 || l.share > 0.005);
        const sgn = (v: number) => `${v < 0 ? "−" : "+"}${fmt(Math.abs(v), main)}`;
        const netOf = (mid: string) => stats.balances.find((b) => b.member.id === mid)?.net ?? 0;
        return (
          <div className="gb-modal-backdrop" onClick={() => setTxDetail(null)}>
            <div className="gb-modal" onClick={(e) => e.stopPropagation()}>
              <div className="gb-modal-head">
                <span className="card-eyebrow">Settle-up math</span>
                <button type="button" className="gb-modal-x" onClick={() => setTxDetail(null)} aria-label="Close">
                  ✕
                </button>
              </div>
              <div className="gb-modal-body" style={{ display: "block" }}>
                <h2 className="gb-modal-title">
                  {txDetail.from.name} → {txDetail.to.name} · {fmt(txDetail.amount, main)}
                </h2>
                <p className="gb-modal-desc">
                  Everything below is in {main}. For each expense: what the person paid in, minus
                  their share of it, gives the line's effect on their balance.
                </p>
                {[txDetail.from, txDetail.to].map((m) => {
                  const lines = ledgerOf(m.id);
                  const paidSum = lines.reduce((s, l) => s + l.paid, 0);
                  const shareSum = lines.reduce((s, l) => s + l.share, 0);
                  const net = paidSum - shareSum;
                  return (
                    <div key={m.id} className="txd-sec">
                      <div className="txd-head">
                        <span>{m.name}</span>
                        <span className={net >= 0 ? "pos" : "neg"}>net {sgn(net)}</span>
                      </div>
                      {lines.map((l) => (
                        <div key={l.e.id} className="txd-line">
                          <span className={`txd-title${l.e.settlement ? " txd-title--stmt" : ""}`}>
                            {l.e.title || (l.e.settlement ? "Settlement" : "Expense")}
                            <span className="txd-meta">
                              {l.e.settlement ? "Settlement" : l.e.category || "Other"} ·{" "}
                              {dateLabel(l.e.date)}
                            </span>
                          </span>
                          <span className="txd-cols">
                            {l.paid > 0.005 && <span className="txd-paid">paid {fmt(l.paid, main)}</span>}
                            {l.share > 0.005 && (
                              <span className="txd-share">
                                {l.e.settlement ? `received ${fmt(l.share, main)}` : `share −${fmt(l.share, main)}`}
                              </span>
                            )}
                          </span>
                          <span className={`txd-net ${l.net >= 0 ? "pos" : "neg"}`}>{sgn(l.net)}</span>
                        </div>
                      ))}
                      <div className="txd-total">
                        paid {fmt(paidSum, main)} − share {fmt(shareSum, main)} ={" "}
                        <b className={net >= 0 ? "pos" : "neg"}>{sgn(net)}</b>
                      </div>
                    </div>
                  );
                })}
                <div className="txd-sec">
                  <div className="txd-head">
                    <span>The match</span>
                  </div>
                  <p className="txd-note">
                    {hasRules
                      ? `This trip uses payment rules (some people only pay certain others), so debts are routed along the allowed pairs — sometimes via a middleman. `
                      : planMode === "hub" && planHub
                        ? `This trip settles through ${planHub.name}: whoever owes pays ${planHub.name}, and ${planHub.name} pays out whoever is owed. `
                        : planMode === "pairs"
                          ? `This trip settles pair by pair: each pair pays back exactly what one covered for the other. `
                          : `To square up in the fewest payments, the biggest debt is paired with the biggest credit until nothing is left: `}
                    {txDetail.from.name} owes {fmt(Math.abs(netOf(txDetail.from.id)), main)},{" "}
                    {txDetail.to.name} is owed {fmt(netOf(txDetail.to.id), main)} — so{" "}
                    {fmt(txDetail.amount, main)} goes from {txDetail.from.name} to {txDetail.to.name}.
                  </p>
                  {stats.transfers.map((t, i) => (
                    <div
                      key={i}
                      className={`txd-match-row${
                        t.from.id === txDetail.from.id && t.to.id === txDetail.to.id ? " on" : ""
                      }`}
                    >
                      <span>
                        {t.from.name} → {t.to.name}
                      </span>
                      <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
                        {fmt(t.amount, main)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="gb-modal-foot">
                <span style={{ flex: 1 }} />
                <button type="button" className="gb-modal-cancel" onClick={() => setTxDetail(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {extractDlg && (
        <div className="gb-modal-backdrop" onClick={() => setExtractDlg(false)}>
          <div className="gb-modal gb-modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="gb-modal-head">
              <span className="card-eyebrow">Extract</span>
              <button type="button" className="gb-modal-x" onClick={() => setExtractDlg(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="gb-modal-body" style={{ display: "block" }}>
              <h2 className="gb-modal-title">Extract “{trip.name}”</h2>
              <p className="gb-modal-desc">Choose a format for the download.</p>
              <div className="gb-extract-opts">
                <button type="button" className="gb-extract-opt" onClick={() => void extract("json")}>
                  <span className="gb-extract-opt-main">
                    <span aria-hidden>🗄</span> JSON backup
                  </span>
                  <span className="gb-extract-opt-sub">
                    Full snapshot — trip, people and audit log. Restorable later.
                  </span>
                </button>
                <button type="button" className="gb-extract-opt" onClick={() => void extract("excel")}>
                  <span className="gb-extract-opt-main">
                    <span aria-hidden>📊</span> Excel
                  </span>
                  <span className="gb-extract-opt-sub">
                    Expense table (CSV) — opens straight in Excel, Numbers or Sheets.
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
            saveExpense(e);
            setExpenseModal(null);
          }}
          onRemove={(id) => {
            removeExpense(id);
            setExpenseModal(null);
          }}
          onClose={() => setExpenseModal(null)}
        />
      )}

      {settleModal && (
        <SettleModal
          existing={settleModal === "new" ? null : settleModal}
          members={tMembers}
          currencies={tripCurrencyOptions(main, secondary)}
          defaultCurrency={main}
          onSave={(e) => {
            saveExpense(e);
            setSettleModal(null);
          }}
          onRemove={(id) => {
            removeExpense(id);
            setSettleModal(null);
          }}
          onClose={() => setSettleModal(null)}
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

// Reconciliation statement — logs a settle-up payment ("X paid Y back") as a
// settlement expense: it shifts balances in the settle-up engine but is
// excluded from trip-spend totals (see computeBalances).
function SettleModal({
  existing,
  members,
  currencies,
  defaultCurrency,
  onSave,
  onRemove,
  onClose,
}: {
  existing: BudgetExpense | null;
  members: BudgetMember[];
  currencies: BudgetCurrency[];
  defaultCurrency: BudgetCurrency;
  onSave: (e: BudgetExpense) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const [from, setFrom] = useState(existing?.paidBy ?? members[0]?.id ?? "");
  const [to, setTo] = useState(existing?.splitAmong?.[0] ?? members[1]?.id ?? "");
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [cur, setCur] = useState<BudgetCurrency>(existing?.currency ?? defaultCurrency);
  const [date, setDate] = useState(existing?.date ?? today());

  const amt = Number(amount) || 0;
  const valid = from && to && from !== to && amt > 0;
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "?";

  const submit = () => {
    if (!valid) return;
    onSave({
      ...(existing ?? { id: uid(), createdAt: nowIso() }),
      title: `${nameOf(from)} paid ${nameOf(to)}`,
      amount: amt,
      currency: cur,
      category: undefined,
      date,
      paidBy: from,
      splitAmong: [to],
      customWeights: undefined,
      settlement: true,
      updatedAt: nowIso(),
    } as BudgetExpense);
  };

  const chipRow = (value: string, set: (id: string) => void, exclude?: string) => (
    <div className="gb-paidby">
      {members.map((m, i) => (
        <button
          key={m.id}
          type="button"
          className={`gb-paid-chip${value === m.id ? " on" : ""}`}
          disabled={m.id === exclude}
          style={m.id === exclude ? { opacity: 0.35, cursor: "default" } : undefined}
          onClick={() => set(m.id)}
        >
          <Avatar member={m} idx={i} size={22} /> {m.name}
        </button>
      ))}
    </div>
  );

  return (
    <div className="gb-modal-backdrop" onClick={onClose}>
      <div className="gb-modal gb-modal--sm" onClick={(e) => e.stopPropagation()}>
        <div className="gb-modal-head">
          <span className="card-eyebrow">Reconciliation</span>
          <button type="button" className="gb-modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="gb-modal-body" style={{ display: "block" }}>
          <h2 className="gb-modal-title">{existing ? "Edit statement" : "Log a settle-up payment"}</h2>
          <p className="gb-modal-desc">
            Record money that changed hands. It squares the balances without counting as trip spend.
          </p>

          <div className="gb-fld" style={{ marginTop: 14 }}>
            <span className="gb-fld-lab">Who paid</span>
            {chipRow(from, setFrom, to)}
          </div>

          <div className="gb-fld">
            <span className="gb-fld-lab">Who received</span>
            {chipRow(to, setTo, from)}
          </div>

          <label className="gb-fld">
            <span className="gb-fld-lab">Amount</span>
            <div className="gb-amt">
              <select className="gb-amt-cur" value={cur} onChange={(e) => setCur(e.target.value as BudgetCurrency)} aria-label="Currency">
                {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                className="se-amt-input"
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                style={{ flex: 1, minWidth: 0, padding: 0, textAlign: "right", fontSize: 16, fontWeight: 700, color: "var(--fg)" }}
              />
            </div>
          </label>

          <label className="gb-fld">
            <span className="gb-fld-lab">When</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <div className="gb-modal-foot">
          {existing && (
            <button type="button" className="gb-modal-del" onClick={() => onRemove(existing.id)}>
              Delete
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="gb-modal-cancel" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="gb-settle-btn"
            style={{ width: "auto", marginTop: 0, padding: "10px 18px" }}
            disabled={!valid}
            onClick={submit}
          >
            {existing ? "Save changes" : "Log payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Pairwise ledger — "who paid for whom" between two people. Answers "how much
// did Mike pay for me, and did I settle it?". Uses the engine's expenseShares,
// so amounts match the settle-up exactly; settlements count as direct payments.
function PairModal({
  person,
  members,
  expenses,
  splitBasis,
  main,
  onClose,
}: {
  person: BudgetMember;
  members: BudgetMember[];
  /** Trip expenses already converted to the main currency. */
  expenses: BudgetExpense[];
  splitBasis: BudgetSplitBasis;
  main: BudgetCurrency;
  onClose: () => void;
}) {
  const others = members.filter((m) => m.id !== person.id);
  const [otherId, setOtherId] = useState(others[0]?.id ?? "");
  const other = others.find((m) => m.id === otherId) ?? others[0];

  const dateLabel = (iso?: string) =>
    iso
      ? new Date(`${iso}T00:00:00`).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })
      : "";

  // Everything `payer` fronted that landed on `beneficiary`'s tab: their share
  // of expenses the payer covered, plus settlements paid to them.
  const linesFor = (payer: BudgetMember, beneficiary: BudgetMember) =>
    expenses
      .map((e) => ({
        e,
        amt: e.paidBy === payer.id ? expenseShares(members, e, splitBasis).get(beneficiary.id) ?? 0 : 0,
      }))
      .filter((l) => l.amt > 0.005)
      .sort((a, b) => (a.e.date ?? "").localeCompare(b.e.date ?? ""));

  const sum = (ls: { amt: number }[]) => ls.reduce((s, l) => s + l.amt, 0);
  const personForOther = other ? linesFor(person, other) : [];
  const otherForPerson = other ? linesFor(other, person) : [];
  const net = sum(otherForPerson) - sum(personForOther); // >0 → person owes other

  const section = (payer: BudgetMember, beneficiary: BudgetMember, lines: { e: BudgetExpense; amt: number }[]) => (
    <div className="txd-sec">
      <div className="txd-head">
        <span>
          {payer.name} paid for {beneficiary.name}
        </span>
        <span>{fmt(sum(lines), main)}</span>
      </div>
      {lines.length === 0 ? (
        <p className="txd-note" style={{ margin: "6px 0 2px" }}>
          Nothing — {payer.name} hasn’t covered anything for {beneficiary.name}.
        </p>
      ) : (
        lines.map((l) => (
          <div key={l.e.id} className="txd-line">
            <span className={`txd-title${l.e.settlement ? " txd-title--stmt" : ""}`}>
              {l.e.title || (l.e.settlement ? "Settlement" : "Expense")}
              <span className="txd-meta">
                {l.e.settlement ? "Settlement" : l.e.category || "Other"} · {dateLabel(l.e.date)}
              </span>
            </span>
            <span className={`txd-net ${l.e.settlement ? "pos" : ""}`}>{fmt(l.amt, main)}</span>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="gb-modal-backdrop" onClick={onClose}>
      <div className="gb-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gb-modal-head">
          <span className="card-eyebrow">Between two people</span>
          <button type="button" className="gb-modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="gb-modal-body" style={{ display: "block" }}>
          <h2 className="gb-modal-title">{person.name} — who paid for whom</h2>
          <p className="gb-modal-desc">
            Compare {person.name} with one other person. All amounts in {main}; settlements count
            as money paid straight to the other person.
          </p>

          <div className="gb-fld" style={{ marginTop: 12 }}>
            <span className="gb-fld-lab">Compare with</span>
            <div className="gb-paidby">
              {others.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  className={`gb-paid-chip${other?.id === m.id ? " on" : ""}`}
                  onClick={() => setOtherId(m.id)}
                >
                  <Avatar member={m} idx={i} size={22} /> {m.name}
                </button>
              ))}
            </div>
          </div>

          {other && (
            <>
              {section(other, person, otherForPerson)}
              {section(person, other, personForOther)}
              <div className="txd-sec txd-verdict">
                {Math.abs(net) <= 0.5 ? (
                  <span className="pos">✓ {person.name} and {other.name} are square with each other</span>
                ) : net > 0 ? (
                  <span>
                    <b className="neg">{person.name} still owes {other.name} {fmt(net, main)}</b> to
                    square up between the two of them
                  </span>
                ) : (
                  <span>
                    <b className="neg">{other.name} still owes {person.name} {fmt(-net, main)}</b> to
                    square up between the two of them
                  </span>
                )}
              </div>
            </>
          )}
        </div>
        <div className="gb-modal-foot">
          <span style={{ flex: 1 }} />
          <button type="button" className="gb-modal-cancel" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
