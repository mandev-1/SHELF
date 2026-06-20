"use client";

import { useBudget } from "@/lib/useBudget";
import { useUsers } from "@/lib/useUsers";
import { useSession } from "@/lib/useSession";
import { BudgetPanel } from "@/components/BudgetPanel";
import { BootError } from "@/components/BootError";
import { Gate } from "@/components/Gate";
import { Toaster } from "@/components/Toaster";

export function BudgetView() {
  const { session, ready: sessionReady, login, logout } = useSession();
  const { users, ready: usersReady, addUser, updateUser, removeUser } = useUsers();
  const { budget, setBudget, budgetId, loading, error } = useBudget();

  if (error) {
    return <BootError detail={error} />;
  }
  if (!sessionReady || loading || !usersReady) {
    return <p className="p-8 text-sm text-neutral-400">Loading budget…</p>;
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
        // People now come from the Supabase users table, injected as members.
        budget={{ ...budget, members: users }}
        setBudget={setBudget}
        budgetId={budgetId}
        activeMemberId={activeMemberId}
        scopedTripId={scopedTripId}
        isSuperuser={session.role === "superuser"}
        onAddUser={addUser}
        onUpdateUser={updateUser}
        onRemoveUser={removeUser}
        onLogout={logout}
      />
      <Toaster />
    </>
  );
}
