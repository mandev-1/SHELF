"use client";

import { useBudget } from "@/lib/useBudget";
import { BudgetPanel } from "@/components/BudgetPanel";

export function BudgetView() {
  const { budget, setBudget, budgetId, activeMemberId, loading, error } = useBudget();

  if (loading) {
    return <p className="p-8 text-sm text-neutral-400">Loading budget…</p>;
  }
  if (error) {
    return <p className="p-8 text-sm text-red-400">{error}</p>;
  }
  if (!budget) return null;

  return (
    <BudgetPanel
      budget={budget}
      setBudget={setBudget}
      budgetId={budgetId}
      activeMemberId={activeMemberId}
    />
  );
}
