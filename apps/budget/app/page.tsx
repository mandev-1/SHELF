import { BudgetView } from "./BudgetView";

// No auth — the app opens straight onto the shared budget.
export default function Home() {
  return (
    // relative z-10 keeps content above the fixed .office-paper backdrop;
    // max-w-[1640px] matches the extension's budget container width.
    <main className="relative z-10 mx-auto min-h-screen max-w-[1640px] px-6 py-6">
      <BudgetView />
    </main>
  );
}
