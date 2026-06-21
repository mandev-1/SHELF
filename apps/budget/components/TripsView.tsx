"use client";
import { useState } from "react";
import type * as React from "react";
import type { BudgetTrip, BudgetMember, BudgetCurrency, BudgetSplitBasis } from "../lib/budget-types";
import { fmt, initials, AV_HUES } from "../lib/budget-format";
import { tripStats, tripMembers, tripMetaLabel } from "../lib/trips";
import { TripModal } from "./TripModal";
import { TripDetail } from "./TripDetail";

interface TripsViewProps {
  trips: BudgetTrip[];
  members: BudgetMember[];
  currency: BudgetCurrency;
  splitBasis: BudgetSplitBasis;
  budgetId?: string | null;
  /** Non-admin members can't manage trips (hide host-only edit actions). */
  canManage?: boolean;
  /** Who is performing changes — recorded in the expense audit log. */
  actorId?: string | null;
  actorName?: string;
  onAddTrip: (trip: BudgetTrip) => void;
  onUpdateTrip: (trip: BudgetTrip) => void;
  onRemoveTrip: (id: string) => void;
}

export function TripsView({
  trips,
  members,
  currency,
  splitBasis,
  budgetId,
  canManage = true,
  actorId,
  actorName,
  onAddTrip,
  onUpdateTrip,
  onRemoveTrip,
}: TripsViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<BudgetTrip | "new" | null>(null);

  const selected = selectedId ? trips.find((t) => t.id === selectedId) ?? null : null;

  const modalNode = modal && (
    <TripModal
      trip={modal === "new" ? null : modal}
      members={members}
      onSave={(t) => {
        if (modal === "new") {
          onAddTrip(t);
          setSelectedId(t.id);
        } else {
          onUpdateTrip(t);
        }
        setModal(null);
      }}
      onRemove={
        modal === "new"
          ? undefined
          : () => {
              onRemoveTrip((modal as BudgetTrip).id);
              setSelectedId(null);
              setModal(null);
            }
      }
      onClose={() => setModal(null)}
    />
  );

  if (selected) {
    return (
      <>
        <TripDetail
          trip={selected}
          members={members}
          currency={currency}
          splitBasis={splitBasis}
          budgetId={budgetId}
          canManage={canManage}
          actorId={actorId}
          actorName={actorName}
          onBack={() => setSelectedId(null)}
          onEdit={() => setModal(selected)}
          onUpdate={onUpdateTrip}
        />
        {modalNode}
      </>
    );
  }

  return (
    <>
      <div className="gb-trips-grid">
        {trips.map((trip) => {
          const stats = tripStats(trip, members, splitBasis);
          const tm = tripMembers(trip, members);
          const main = trip.mainCurrency ?? "CZK";
          return (
            <button
              type="button"
              key={trip.id}
              className="gb-trip-card"
              style={{ ["--trip-hue" as any]: trip.color || "var(--accent)" } as React.CSSProperties}
              onClick={() => setSelectedId(trip.id)}
            >
              <div className="gb-trip-cover">
                {trip.cover && <img className="gb-trip-img" src={trip.cover} data-filled="" alt="" />}
                <span className="gb-trip-cover-fallback">{trip.emoji || "🏖️"}</span>
                <span className={"gb-trip-status" + (stats.squared ? " ok" : "")}>
                  {stats.squared ? "Squared up" : `${fmt(stats.toSettle, main)} to settle`}
                </span>
              </div>
              <div className="gb-trip-body">
                <h3 className="gb-trip-name">{trip.name}</h3>
                <div className="gb-trip-meta">{tripMetaLabel(trip)}</div>
                <div className="gb-trip-figs">
                  <span className="gb-trip-total">{fmt(stats.total, main)}</span>
                  <span className="gb-trip-per">{fmt(stats.perPerson, main)} pp</span>
                </div>
                <div className="gb-trip-foot">
                  <div className="gb-trip-faces">
                    {tm.slice(0, 4).map((m, i) => (
                      <span
                        key={m.id}
                        className="gb-av gb-trip-face"
                        style={{ width: 24, height: 24, fontSize: 10, background: m.color || AV_HUES[i % AV_HUES.length] }}
                      >
                        {initials(m.name)}
                      </span>
                    ))}
                    {tm.length > 4 && <span className="gb-trip-facemore">+{tm.length - 4}</span>}
                  </div>
                  <span className="gb-trip-count">
                    {(trip.expenses ?? []).length} expense{(trip.expenses ?? []).length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
        <button type="button" className="gb-trip-card gb-trip-card--add" onClick={() => setModal("new")}>
          <span className="gb-trip-add-plus">＋</span>
          Plan a trip
        </button>
      </div>
      {modalNode}
    </>
  );
}
