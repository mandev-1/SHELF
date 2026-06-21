"use client";

import { useEffect } from "react";
import { useBudget } from "@/lib/useBudget";
import { useUsers } from "@/lib/useUsers";
import { useTrips } from "@/lib/useTrips";
import { useSession } from "@/lib/useSession";
import { BudgetPanel } from "@/components/BudgetPanel";
import { BootError } from "@/components/BootError";
import { Gate } from "@/components/Gate";
import { Toaster } from "@/components/Toaster";

export function BudgetView() {
  const { session, ready: sessionReady, login, logout } = useSession();
  const { users, ready: usersReady, addUser, updateUser, removeUser } = useUsers();
  const { trips, ready: tripsReady, addTrip, updateTrip, removeTrip } = useTrips();
  const { budget, setBudget, budgetId, loading, error } = useBudget();

  // Track the *visual* viewport (which shrinks when the mobile keyboard opens —
  // unlike dvh/vh) into CSS vars so modals can size/position to the visible area
  // and stay fully reachable above the keyboard.
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const root = document.documentElement;
    const apply = () => {
      root.style.setProperty("--vvh", `${vv.height}px`);
      root.style.setProperty("--vvt", `${vv.offsetTop}px`);
    };
    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
    };
  }, []);

  if (error) {
    // Even when the data layer fails (e.g. the API token is wrong), let the host
    // log in as admin from here — the session is client-side and persists, so a
    // token fix + reload lands you straight in. Hidden once already superuser.
    return (
      <BootError
        detail={error}
        onLogin={session?.role === "superuser" ? undefined : login}
      />
    );
  }
  if (!sessionReady || loading || !usersReady || !tripsReady) {
    return (
      <div className="gb-loader" role="status" aria-label="Loading budget">
        <div className="gb-loader-dots">
          <span className="gb-loader-dot" />
          <span className="gb-loader-dot" />
          <span className="gb-loader-dot" />
        </div>
        <span className="gb-loader-label">Loading budget…</span>
      </div>
    );
  }
  // No session and no invite link → ask for the host password (or use a link).
  if (!session) {
    return <Gate onLogin={login} />;
  }
  if (!budget) return null;

  // Identity comes from the session now (persisted), not the URL.
  const activeMemberId = session.role === "member" ? session.userId : null;
  const scopedTripId = session.role === "member" ? (session.tripId ?? null) : null;

  return (
    <>
      <BudgetPanel
        // People + trips now come from their own Supabase tables, injected here.
        budget={{ ...budget, members: users, trips }}
        setBudget={setBudget}
        budgetId={budgetId}
        activeMemberId={activeMemberId}
        scopedTripId={scopedTripId}
        isSuperuser={session.role === "superuser"}
        onAddUser={addUser}
        onUpdateUser={updateUser}
        onRemoveUser={removeUser}
        onAddTrip={addTrip}
        onUpdateTrip={updateTrip}
        onRemoveTrip={removeTrip}
        onLogout={logout}
      />
      <Toaster />
    </>
  );
}
