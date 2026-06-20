"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase/client";
import {
  type BudgetState,
  DEFAULT_BUDGET_STATE,
  normalizeBudget,
} from "./budget-types";

export interface UseBudgetResult {
  budget: BudgetState | null;
  setBudget: (next: BudgetState | ((prev: BudgetState) => BudgetState)) => void;
  loading: boolean;
  error: string | null;
}

const SAVE_DEBOUNCE_MS = 600;

// One shared budget for the whole friend group. Loads the single budgets row
// (creating it if missing), debounce-saves edits, and applies live changes from
// other people via Realtime. No auth — last-writer-wins.
export function useBudget(): UseBudgetResult {
  const [budget, setBudgetState] = useState<BudgetState | null>(null);
  const [budgetId, setBudgetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const idRef = useRef<string | null>(null);
  const lastSyncedRef = useRef<string>(""); // JSON we last wrote or received
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load (or create) the single shared budget row.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: rows, error: selErr } = await supabase
        .from("budgets")
        .select("id,data")
        .order("created_at", { ascending: true })
        .limit(1);
      if (cancelled) return;
      if (selErr) {
        setError(selErr.message);
        setLoading(false);
        return;
      }

      let row = rows?.[0];
      if (!row) {
        const { data: created, error: insErr } = await supabase
          .from("budgets")
          .insert({})
          .select("id,data")
          .single();
        if (cancelled) return;
        if (insErr || !created) {
          setError(insErr?.message ?? "Could not create budget");
          setLoading(false);
          return;
        }
        row = created;
      }

      const state = normalizeBudget(row.data);
      idRef.current = row.id;
      lastSyncedRef.current = JSON.stringify(state);
      setBudgetId(row.id);
      setBudgetState(state);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Realtime: apply remote edits from other people.
  useEffect(() => {
    if (!budgetId) return;
    const channel = supabase
      .channel(`budget:${budgetId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "budgets",
          filter: `id=eq.${budgetId}`,
        },
        (payload) => {
          const incoming = normalizeBudget((payload.new as any)?.data);
          const json = JSON.stringify(incoming);
          if (json === lastSyncedRef.current) return; // our own echo
          lastSyncedRef.current = json;
          setBudgetState(incoming);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [budgetId]);

  const persist = useCallback((state: BudgetState) => {
    const id = idRef.current;
    if (!id) return;
    lastSyncedRef.current = JSON.stringify(state);
    void supabase
      .from("budgets")
      .update({ data: state, updated_at: new Date().toISOString() })
      .eq("id", id);
  }, []);

  const setBudget = useCallback(
    (next: BudgetState | ((prev: BudgetState) => BudgetState)) => {
      setBudgetState((prev) => {
        const base = prev ?? DEFAULT_BUDGET_STATE;
        const value =
          typeof next === "function"
            ? (next as (p: BudgetState) => BudgetState)(base)
            : next;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => persist(value), SAVE_DEBOUNCE_MS);
        return value;
      });
    },
    [persist],
  );

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  return { budget, setBudget, loading, error };
}
