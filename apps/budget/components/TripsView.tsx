"use client";
import { useEffect, useState } from "react";
import type * as React from "react";
import type { BudgetTrip, BudgetMember, BudgetCurrency, BudgetSplitBasis } from "../lib/budget-types";
import { fmt, initials, AV_HUES } from "../lib/budget-format";
import { tripStats, tripMembers, tripMetaLabel } from "../lib/trips";
import { TripModal } from "./TripModal";
import { TripDetail } from "./TripDetail";
import { toast } from "../lib/toast";
import { api } from "../lib/api";
import {
  buildTripBackup,
  downloadTripBackup,
  tripBackupFilename,
  type TripBackupLog,
} from "../lib/trip-backup";

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
  /** Open trip — lifted to BudgetPanel so the page header can show its actions. */
  selectedTripId?: string | null;
  onSelectTrip?: (id: string | null) => void;
  /** Bumping this opens the open trip's Add-Expense modal (header CTA). */
  addExpenseSignal?: number;
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
  selectedTripId = null,
  onSelectTrip,
  addExpenseSignal,
  onAddTrip,
  onUpdateTrip,
  onRemoveTrip,
}: TripsViewProps) {
  const setSelectedId = (id: string | null) => onSelectTrip?.(id);
  const [modal, setModal] = useState<BudgetTrip | "new" | null>(null);
  // Admin-only right-click menu (download a per-trip JSON backup, etc.).
  const [menu, setMenu] = useState<{ x: number; y: number; trip: BudgetTrip } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const selected = selectedTripId ? trips.find((t) => t.id === selectedTripId) ?? null : null;

  // Close the right-click menu on Escape (outside-click is handled by the catcher).
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  const openMenu = (e: React.MouseEvent, trip: BudgetTrip) => {
    if (!canManage) return; // non-admins keep the browser's native menu
    e.preventDefault();
    const W = 224;
    const H = 96;
    const PAD = 8;
    setMenu({
      x: Math.max(PAD, Math.min(e.clientX, window.innerWidth - W - PAD)),
      y: Math.max(PAD, Math.min(e.clientY, window.innerHeight - H - PAD)),
      trip,
    });
  };

  const exportTrip = async (trip: BudgetTrip) => {
    setMenu(null);
    if (busyId) return;
    setBusyId(trip.id);
    try {
      // Best-effort: fold in the trip's expense audit trail if the API has one.
      let logs: TripBackupLog[] | undefined;
      try {
        logs = await api.get<TripBackupLog[]>(`/logs?tripId=${encodeURIComponent(trip.id)}`);
      } catch {
        logs = undefined;
      }
      const envelope = await buildTripBackup({ trip, members, logs, exportedBy: actorName });
      downloadTripBackup(envelope, tripBackupFilename(trip));
      const n = logs?.length ?? 0;
      toast(`Backed up “${trip.name}”${n ? ` · ${n} log${n === 1 ? "" : "s"}` : ""}`);
    } catch {
      toast("Couldn't build that backup. Try again.");
    } finally {
      setBusyId(null);
    }
  };

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
          addExpenseSignal={addExpenseSignal}
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
              onContextMenu={(e) => openMenu(e, trip)}
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
      {menu && (
        <>
          {/* Transparent catcher closes the menu on any outside click / right-click. */}
          <div
            className="gb-ctx-catch"
            onClick={() => setMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu(null);
            }}
          />
          <div className="card gb-ctx-menu" role="menu" style={{ left: menu.x, top: menu.y }}>
            <div className="gb-ctx-title">
              {menu.trip.emoji ? `${menu.trip.emoji} ` : ""}
              {menu.trip.name}
            </div>
            <button
              type="button"
              role="menuitem"
              className="gb-ctx-item"
              disabled={busyId === menu.trip.id}
              onClick={() => void exportTrip(menu.trip)}
            >
              <span aria-hidden style={{ fontSize: 14 }}>
                ⬇
              </span>
              {busyId === menu.trip.id ? "Preparing backup…" : "Download JSON backup"}
            </button>
          </div>
        </>
      )}
      {modalNode}
    </>
  );
}
