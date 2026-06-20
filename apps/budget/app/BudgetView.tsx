"use client";

import { useBudget } from "@/lib/useBudget";
import { BudgetPanel } from "@/components/BudgetPanel";
import { BootError } from "@/components/BootError";

export function BudgetView() {
  const { budget, setBudget, budgetId, activeMemberId, scopedTripId, loading, error } =
    useBudget();

  if (loading) {
    return <p className="p-8 text-sm text-neutral-400">Loading budget…</p>;
  }
  if (error) {
    return <BootError detail={error} />;
  }
  if (!budget) return null;

  return (
    <BudgetPanel
      budget={budget}
      setBudget={setBudget}
      budgetId={budgetId}
      activeMemberId={activeMemberId}
      scopedTripId={scopedTripId}
    />
  );
}
