"use client";

import { useBudget } from "@/lib/useBudget";
import { BudgetPanel } from "@/components/BudgetPanel";

export function BudgetView() {
  const { budget, setBudget, loading, error } = useBudget();

  if (loading) {
    return <p className="p-8 text-sm text-neutral-400">Loading budget…</p>;
  }
  if (error) {
    return <p className="p-8 text-sm text-red-400">{error}</p>;
  }
  if (!budget) return null;

  // The ported feature — unchanged from the extension.
  return <BudgetPanel budget={budget} setBudget={setBudget} />;
}
