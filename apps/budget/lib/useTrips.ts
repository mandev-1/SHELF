"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "./supabase/client";
import type { BudgetTrip, BudgetExpense } from "./budget-types";

// Trips live in their own Supabase table (one row per trip) so adding/editing a
// trip only writes that row — concurrent tabs can't overwrite each other's trips
// the way the shared jsonb blob did. Each trip keeps its expenses as a jsonb
// column. Open RLS, Realtime — same soft model as the rest of the app.

function rowToTrip(r: any): BudgetTrip {
  return {
    id: r.id,
    name: r.name,
    emoji: r.emoji ?? undefined,
    destination: r.destination ?? undefined,
    startDate: r.start_date ?? undefined,
    endDate: r.end_date ?? undefined,
    datesTBD: r.dates_tbd ?? undefined,
    color: r.color ?? undefined,
    cover: r.cover ?? undefined,
    memberIds: Array.isArray(r.member_ids) ? r.member_ids : [],
    expenses: Array.isArray(r.expenses) ? (r.expenses as BudgetExpense[]) : [],
    createdAt: r.created_at ?? new Date().toISOString(),
    updatedAt: r.updated_at ?? new Date().toISOString(),
  };
}

function tripToRow(t: BudgetTrip): Record<string, unknown> {
  return {
    id: t.id,
    name: t.name,
    emoji: t.emoji ?? null,
    destination: t.destination ?? null,
    start_date: t.startDate ?? null,
    end_date: t.endDate ?? null,
    dates_tbd: !!t.datesTBD,
    color: t.color ?? null,
    cover: t.cover ?? null,
    member_ids: t.memberIds ?? [],
    expenses: t.expenses ?? [],
    updated_at: new Date().toISOString(),
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

  const reload = useCallback(async () => {
    const { data } = await getSupabase()
      .from("trips")
      .select("*")
      .order("created_at", { ascending: false });
    setTrips((data ?? []).map(rowToTrip));
    setReady(true);
  }, []);

  useEffect(() => {
    void reload();
    const supabase = getSupabase();
    const channel = supabase
      .channel("trips")
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, () => {
        void reload();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [reload]);

  const addTrip = useCallback((trip: BudgetTrip) => {
    setTrips((prev) => (prev.some((t) => t.id === trip.id) ? prev : [trip, ...prev]));
    void getSupabase()
      .from("trips")
      .insert({ ...tripToRow(trip), created_at: trip.createdAt });
  }, []);

  const updateTrip = useCallback((trip: BudgetTrip) => {
    setTrips((prev) => prev.map((t) => (t.id === trip.id ? trip : t)));
    // Upsert so an edit still lands even if the row somehow isn't there yet.
    void getSupabase()
      .from("trips")
      .upsert({ ...tripToRow(trip), created_at: trip.createdAt });
  }, []);

  const removeTrip = useCallback((id: string) => {
    setTrips((prev) => prev.filter((t) => t.id !== id));
    void getSupabase().from("trips").delete().eq("id", id);
  }, []);

  return { trips, ready, addTrip, updateTrip, removeTrip };
}
