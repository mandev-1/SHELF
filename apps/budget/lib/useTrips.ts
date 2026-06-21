"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, isNotFound } from "./api";
import { toast } from "./toast";
import {
  normBudgetExpense,
  type BudgetTrip,
  type BudgetExpense,
  type BudgetCurrency,
} from "./budget-types";

const curOrDefault = (c: unknown, def: BudgetCurrency): BudgetCurrency =>
  c === "CZK" || c === "PLN" || c === "EUR" ? c : def;

// Trips live in their own `trips` table behind the Go API (one row per trip).
// The browser talks ONLY to the same-origin API proxy (/api/trips) — never to
// Supabase. The API payload is already camelCase, so it maps to BudgetTrip 1:1;
// expenses are run through normBudgetExpense (same guarantee the blob path had).

function dtoToTrip(r: any): BudgetTrip {
  return {
    id: r.id,
    name: r.name,
    emoji: r.emoji ?? undefined,
    destination: r.destination ?? undefined,
    startDate: r.startDate ?? undefined,
    endDate: r.endDate ?? undefined,
    datesTBD: !!r.datesTBD,
    color: r.color ?? undefined,
    cover: r.cover ?? undefined,
    mainCurrency: curOrDefault(r.mainCurrency, "CZK"),
    secondaryCurrency: curOrDefault(r.secondaryCurrency, "EUR"),
    memberIds: Array.isArray(r.memberIds) ? r.memberIds : [],
    expenses: Array.isArray(r.expenses)
      ? (r.expenses.map(normBudgetExpense).filter(Boolean) as BudgetExpense[])
      : [],
    createdAt: r.createdAt ?? new Date().toISOString(),
    updatedAt: r.updatedAt ?? new Date().toISOString(),
  };
}

export interface UseTripsResult {
  trips: BudgetTrip[];
  ready: boolean;
  addTrip: (trip: BudgetTrip) => void;
  updateTrip: (trip: BudgetTrip) => void;
  removeTrip: (id: string) => void;
}

export function useTrips(): UseTripsResult {
  const [trips, setTrips] = useState<BudgetTrip[]>([]);
  const [ready, setReady] = useState(false);

  // Synchronous mirror of the latest trips, kept current by every mutator.
  const tripsRef = useRef<BudgetTrip[]>([]);
  const setTripsSynced = useCallback((next: BudgetTrip[]) => {
    tripsRef.current = next;
    setTrips(next);
  }, []);

  // In-flight write counter; focus refresh skips reloading while > 0 so a
  // background refetch can't clobber a just-added/edited trip mid-flight.
  const pending = useRef(0);
  const track = useCallback(<T,>(p: Promise<T>): Promise<T> => {
    pending.current++;
    return p.finally(() => {
      pending.current = Math.max(0, pending.current - 1);
    });
  }, []);

  const reload = useCallback(async () => {
    try {
      const data = await api.get<any[]>("/trips");
      setTripsSynced((data ?? []).map(dtoToTrip));
    } catch {
      // Transient failure — keep current trips rather than blanking them.
    } finally {
      setReady(true);
    }
  }, [setTripsSynced]);

  // Load once, then refresh on tab focus (replaces Realtime), unless a write is
  // in flight.
  useEffect(() => {
    void reload();
    const refresh = () => {
      if (document.visibilityState !== "hidden" && pending.current === 0) void reload();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [reload]);

  const addTrip = useCallback(
    (trip: BudgetTrip) => {
      if (!tripsRef.current.some((t) => t.id === trip.id)) {
        setTripsSynced([trip, ...tripsRef.current]);
      }
      track(api.post("/trips", trip)).catch(() => {
        toast("Couldn't save that trip. Refreshing…");
        void reload();
      });
    },
    [reload, track, setTripsSynced],
  );

  const updateTrip = useCallback(
    (trip: BudgetTrip) => {
      setTripsSynced(tripsRef.current.map((t) => (t.id === trip.id ? trip : t)));
      // PUT upserts, so an edit still lands even if the row was missing.
      track(api.put(`/trips/${trip.id}`, trip)).catch((e) => {
        toast(
          isNotFound(e)
            ? "That trip was already removed by someone else."
            : "Couldn't save that trip. Refreshing…",
        );
        void reload();
      });
    },
    [reload, track, setTripsSynced],
  );

  const removeTrip = useCallback(
    (id: string) => {
      setTripsSynced(tripsRef.current.filter((t) => t.id !== id));
      track(api.del(`/trips/${id}`)).catch((e) => {
        if (isNotFound(e)) return; // already gone — our optimistic removal is correct
        toast("Couldn't remove that trip. Refreshing…");
        void reload();
      });
    },
    [reload, track, setTripsSynced],
  );

  return { trips, ready, addTrip, updateTrip, removeTrip };
}
