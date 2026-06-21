"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, isNotFound } from "./api";
import { toast } from "./toast";
import type { BudgetMember } from "./budget-types";

// People live in the `users` table behind the Go API. The browser talks ONLY to
// the same-origin API proxy (/api/users) — never to Supabase directly. Ids are
// reused as the member ids that expenses and trips reference.

interface UserDTO {
  id: string;
  name: string;
  role?: string;
  share?: number | null;
  income?: number | null;
  color?: string | null;
  createdAt?: string;
}

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "u" + Math.random().toString(36).slice(2);
}

function dtoToMember(r: UserDTO): BudgetMember {
  return {
    id: r.id,
    name: r.name,
    share: r.share ?? undefined,
    income: r.income ?? undefined,
    color: r.color ?? undefined,
    createdAt: r.createdAt ?? new Date().toISOString(),
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

  // Synchronous mirror of the latest users — updated immediately by every mutator
  // (not only on render) so updateUser can build a full PATCH body from current
  // data even for two edits dispatched in the same tick.
  const usersRef = useRef<BudgetMember[]>([]);
  const setUsersSynced = useCallback((next: BudgetMember[]) => {
    usersRef.current = next;
    setUsers(next);
  }, []);

  // Count of in-flight writes; the focus refresh skips reloading while > 0 so a
  // background refetch can't clobber a just-made optimistic change mid-flight.
  const pending = useRef(0);
  const track = useCallback(<T,>(p: Promise<T>): Promise<T> => {
    pending.current++;
    return p.finally(() => {
      pending.current = Math.max(0, pending.current - 1);
    });
  }, []);

  const reload = useCallback(async () => {
    try {
      const data = await api.get<UserDTO[]>("/users");
      setUsersSynced((data ?? []).map(dtoToMember));
    } catch {
      // Transient failure — keep what we have rather than blanking the list.
    } finally {
      setReady(true);
    }
  }, [setUsersSynced]);

  // Load once, then refresh on tab focus — but only when no write is in flight
  // (replaces Realtime: re-pull from the API instead of subscribing to the DB).
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

  const addUser = useCallback(
    async (name: string): Promise<BudgetMember | null> => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const id = uid(); // send a real UUID so the (uuid) id column accepts it
      try {
        const created = await track(api.post<UserDTO>("/users", { id, name: trimmed }));
        const member = dtoToMember(created);
        if (!usersRef.current.some((u) => u.id === member.id)) {
          setUsersSynced([...usersRef.current, member]);
        }
        return member;
      } catch {
        toast("Couldn't add that person. Try again.");
        return null;
      }
    },
    [track, setUsersSynced],
  );

  const updateUser = useCallback(
    (id: string, patch: Partial<BudgetMember>) => {
      const current = usersRef.current.find((u) => u.id === id);
      if (!current) {
        // Not in local state — don't synthesize an empty-name overwrite; reconcile.
        void reload();
        return;
      }
      const merged: BudgetMember = { ...current, ...patch };
      setUsersSynced(usersRef.current.map((u) => (u.id === id ? merged : u)));
      // PATCH replaces all editable columns, so send the full merged set.
      track(
        api.patch<UserDTO>(`/users/${id}`, {
          name: merged.name,
          share: merged.share,
          income: merged.income,
          color: merged.color,
        }),
      ).catch((e) => {
        toast(
          isNotFound(e)
            ? "That person was already removed by someone else."
            : "Couldn't save that change. Refreshing…",
        );
        void reload();
      });
    },
    [reload, track, setUsersSynced],
  );

  const removeUser = useCallback(
    (id: string) => {
      setUsersSynced(usersRef.current.filter((u) => u.id !== id));
      track(api.del(`/users/${id}`)).catch((e) => {
        if (isNotFound(e)) return; // already gone — our optimistic removal is correct
        toast("Couldn't remove that person. Refreshing…");
        void reload();
      });
    },
    [reload, track, setUsersSynced],
  );

  return { users, ready, addUser, updateUser, removeUser };
}
