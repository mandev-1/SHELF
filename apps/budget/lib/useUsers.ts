"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "./supabase/client";
import type { BudgetMember } from "./budget-types";

// The budget's people now live in the Supabase `users` table (one source of
// truth), not in the jsonb blob. Ids are reused as the member ids that expenses
// and trips reference. Open RLS — same soft model as the rest of the app.

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "u" + Math.random().toString(36).slice(2);
}

function rowToMember(r: any): BudgetMember {
  return {
    id: r.id,
    name: r.name,
    share: r.share ?? undefined,
    income: r.income ?? undefined,
    color: r.color ?? undefined,
    createdAt: r.created_at ?? new Date().toISOString(),
  };
}

export interface UseUsersResult {
  users: BudgetMember[];
  ready: boolean;
  addUser: (name: string) => Promise<BudgetMember | null>;
  updateUser: (id: string, patch: Partial<BudgetMember>) => void;
  removeUser: (id: string) => void;
}

export function useUsers(): UseUsersResult {
  const [users, setUsers] = useState<BudgetMember[]>([]);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    const { data } = await getSupabase()
      .from("users")
      .select("*")
      .order("created_at", { ascending: true });
    setUsers((data ?? []).map(rowToMember));
    setReady(true);
  }, []);

  useEffect(() => {
    void reload();
    const supabase = getSupabase();
    const channel = supabase
      .channel("users")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, () => {
        void reload();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [reload]);

  const addUser = useCallback(async (name: string) => {
    const id = uid();
    const { data, error } = await getSupabase()
      .from("users")
      .insert({ id, name: name.trim(), role: "member" })
      .select("*")
      .single();
    if (error || !data) return null;
    const member = rowToMember(data);
    setUsers((prev) => (prev.some((u) => u.id === member.id) ? prev : [...prev, member]));
    return member;
  }, []);

  const updateUser = useCallback((id: string, patch: Partial<BudgetMember>) => {
    const dbPatch: Record<string, unknown> = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.share !== undefined) dbPatch.share = patch.share;
    if (patch.income !== undefined) dbPatch.income = patch.income;
    if (patch.color !== undefined) dbPatch.color = patch.color;
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
    void getSupabase().from("users").update(dbPatch).eq("id", id);
  }, []);

  const removeUser = useCallback((id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    void getSupabase().from("users").delete().eq("id", id);
  }, []);

  return { users, ready, addUser, updateUser, removeUser };
}
