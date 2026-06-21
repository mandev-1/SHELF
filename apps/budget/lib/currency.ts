import type { BudgetCurrency } from "./budget-types";

// Static REFERENCE rates — units per 1 EUR. Approximate, NOT live FX; good enough
// for showing a trip's spend in a couple of currencies. Adjust here if needed
// (or wire a live rates feed later).
const PER_EUR: Record<BudgetCurrency, number> = {
  EUR: 1,
  CZK: 25,
  PLN: 4.3,
};

/** Convert an amount between CZK / PLN / EUR using the static reference rates. */
export function convert(amount: number, from: BudgetCurrency, to: BudgetCurrency): number {
  if (from === to || !amount) return amount;
  return (amount / PER_EUR[from]) * PER_EUR[to];
}

/** The currencies offered when logging a trip expense: main, secondary, EUR (deduped). */
export function tripCurrencyOptions(
  main: BudgetCurrency,
  secondary: BudgetCurrency,
): BudgetCurrency[] {
  const out: BudgetCurrency[] = [];
  for (const c of [main, secondary, "EUR" as BudgetCurrency]) {
    if (!out.includes(c)) out.push(c);
  }
  return out;
}

/** "(123 czk)" — secondary amount in lowercase code, for the parenthetical reference. */
export function fmtSecondary(amount: number, c: BudgetCurrency): string {
  return `(${Math.round(amount).toLocaleString()} ${c.toLowerCase()})`;
}
