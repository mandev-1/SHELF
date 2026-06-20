import { BudgetView } from "./BudgetView";

// No auth — the app opens straight onto the shared budget.
export default function Home() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl p-6">
      <BudgetView />
    </main>
  );
}
