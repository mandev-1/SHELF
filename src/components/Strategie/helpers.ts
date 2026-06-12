import type { MonthStatement, CatKey } from "../../types/grid";
import { CAT_KEYS } from "./strategie";

export function totalIncome(stmt: MonthStatement) {
  return stmt.income.reduce((s, r) => s + r.amt, 0);
}

export function totalExpenses(stmt: MonthStatement) {
  return stmt.expenses.reduce((s, r) => s + r.amt, 0);
}

/** Spending per category. Rows tagged as savings-plan contributions or debt
 *  payments are transfers, not spending — they are excluded. */
export function expensesByCat(stmt: MonthStatement): Record<CatKey, number> {
  const out = {} as Record<CatKey, number>;
  for (const k of CAT_KEYS) out[k] = 0;
  for (const e of stmt.expenses) {
    if (e.savingsPlanId || e.debtId) continue;
    out[e.cat] = (out[e.cat] ?? 0) + e.amt;
  }
  return out;
}
