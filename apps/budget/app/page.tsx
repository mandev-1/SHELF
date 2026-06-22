import { BudgetView } from "./BudgetView";

// No auth — the app opens straight onto the shared budget.
export default function Home() {
  return (
    // relative z-10 keeps content above the fixed .office-paper backdrop;
    // max-w-[1640px] matches the extension's budget container width.
    // .notebook-page = handoff 007's summer-notebook background (ported 1:1).
    <div className="notebook-page" style={{ minHeight: "100dvh" }}>
      {/* Desktop (≥900px) padding matches the design spec: 56 top / 16 sides / 40
          bottom. Mobile/tablet keep their existing padding (px-3 → sm:px-6, etc.). */}
      <main className="relative z-10 mx-auto min-h-screen w-full max-w-[1640px] px-3 pt-6 pb-24 sm:px-6 min-[900px]:px-4 min-[900px]:pt-14 min-[900px]:pb-10">
        <BudgetView />
      </main>
    </div>
  );
}
