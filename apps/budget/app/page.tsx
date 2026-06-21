import { BudgetView } from "./BudgetView";

// No auth — the app opens straight onto the shared budget.
export default function Home() {
  return (
    // relative z-10 keeps content above the fixed .office-paper backdrop;
    // max-w-[1640px] matches the extension's budget container width.
    // .notebook-page = handoff 007's summer-notebook background (ported 1:1).
    <div className="notebook-page" style={{ minHeight: "100dvh" }}>
      <main className="relative z-10 mx-auto min-h-screen w-full max-w-[1640px] px-3 pt-6 pb-24 sm:px-6">
        <BudgetView />
      </main>
    </div>
  );
}
