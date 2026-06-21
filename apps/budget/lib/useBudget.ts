"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";
import {
  type BudgetState,
  DEFAULT_BUDGET_STATE,
  normalizeBudget,
} from "./budget-types";

export interface UseBudgetResult {
  budget: BudgetState | null;
  setBudget: (next: BudgetState | ((prev: BudgetState) => BudgetState)) => void;
  budgetId: string | null;
  loading: boolean;
  error: string | null;
}

interface BudgetDTO {
  id: string;
  name?: string;
  data: unknown;
  createdAt?: string;
  updatedAt?: string;
}

const SAVE_DEBOUNCE_MS = 600;

// One shared budget for the whole friend group, served by the Go API. Loads the
// budget (the singleton, or a specific one via ?b=), then debounce-saves edits.
// The browser never touches Supabase — everything goes through /api/budget.
export function useBudget(): UseBudgetResult {
  const [budget, setBudgetState] = useState<BudgetState | null>(null);
  const [budgetId, setBudgetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const idRef = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<BudgetState | null>(null); // last value awaiting save

  // Load the budget. A personal link carries ?b=<budgetId>&user=<memberId>:
  //   - ?b present → load that specific budget (the friend's link)
  //   - no ?b      → the owner's singleton budget (created on first run by the API)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const bParam = params.get("b");
        const dto = bParam
          ? await api.get<BudgetDTO>(`/budget/${encodeURIComponent(bParam)}`)
          : await api.get<BudgetDTO>("/budget");
        if (cancelled) return;

        const state = normalizeBudget(dto.data);
        idRef.current = dto.id;
        setBudgetId(dto.id);
        setBudgetState(state);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        // 404 on a ?b link → that budget is gone; anything else → generic boot
        // failure (missing BUDGET_API_URL, API down, etc.) → the friendly screen.
        if (e instanceof ApiError && e.status === 404) {
          setError("That budget link is invalid or was removed.");
        } else {
          setError(e instanceof Error ? e.message : "The budget failed to start.");
        }
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((state: BudgetState) => {
    const id = idRef.current;
    if (!id) return;
    pendingRef.current = null;
    // members live in the users table and trips in the trips table now — don't
    // re-persist stale snapshots into the budget blob (one source of truth per
    // field). The body IS the new `data` jsonb; last-writer-wins, and a failed
    // save is retried on the next edit.
    const data = { ...state, members: [], trips: [] };
    void api.patch(`/budget/${id}`, data).catch(() => {});
  }, []);

  // Persist any pending (debounced) change immediately — used on unmount / tab
  // hide so a just-made edit (e.g. a new trip) can't be dropped before the timer.
  const flush = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (pendingRef.current) persist(pendingRef.current);
  }, [persist]);

  const setBudget = useCallback(
    (next: BudgetState | ((prev: BudgetState) => BudgetState)) => {
      setBudgetState((prev) => {
        const base = prev ?? DEFAULT_BUDGET_STATE;
        const value =
          typeof next === "function"
            ? (next as (p: BudgetState) => BudgetState)(base)
            : next;
        pendingRef.current = value;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => persist(value), SAVE_DEBOUNCE_MS);
        return value;
      });
    },
    [persist],
  );

  // Durability: flush on unmount and when the tab is hidden/closed.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, [flush]);

  return { budget, setBudget, budgetId, loading, error };
}
