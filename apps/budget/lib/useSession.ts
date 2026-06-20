"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type Session,
  loadSession,
  saveSession,
  clearSession,
  checkSuperuserPassword,
} from "./session";

export interface UseSessionResult {
  session: Session | null;
  ready: boolean; // false until we've resolved the initial session
  login: (password: string) => boolean;
  logout: () => void;
}

export function useSession(): UseSessionResult {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  // Resolve the session once: a ?me link wins (and is remembered), else load
  // whatever was stored, else stay logged out (→ gate).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userParam = params.get("user") ?? params.get("me"); // accept legacy ?me
    const trip = params.get("trip");
    if (userParam) {
      const s: Session = trip
        ? { role: "member", userId: userParam, tripId: trip }
        : { role: "member", userId: userParam };
      saveSession(s);
      setSession(s);
    } else {
      setSession(loadSession());
    }
    setReady(true);
  }, []);

  const login = useCallback((password: string) => {
    if (checkSuperuserPassword(password)) {
      const s: Session = { role: "superuser" };
      saveSession(s);
      setSession(s);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
    // Drop ?user/?trip so a reload can't re-establish the member session — this
    // is also how "Log in as admin instead" reaches the gate.
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  return { session, ready, login, logout };
}
