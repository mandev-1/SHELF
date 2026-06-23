import { BudgetView } from "./BudgetView";

// No auth — the app opens straight onto the shared budget.
export default function Home() {
  return (
    // relative z-10 keeps content above the fixed .office-paper backdrop;
    // max-w-[1640px] matches the extension's budget container width.
    // .notebook-page = handoff 007's summer-notebook background (ported 1:1).
    <div className="notebook-page" style={{ minHeight: "100dvh" }}>
      {/* Desktop (≥900px) matches the design: content capped at 760px and centered,
          56px top / 40px bottom. No side padding at this width — the content centers
          with gutters far wider than the design's 16px, so it's subsumed (and px
          would otherwise shrink the box below 760). Mobile/tablet keep their existing
          padding (px-3 → sm:px-6) and full width. */}
      <main className="relative z-10 mx-auto min-h-screen w-full max-w-[1640px] px-3 pt-6 pb-24 sm:px-6 min-[900px]:max-w-[760px] min-[900px]:px-0 min-[900px]:pt-14 min-[900px]:pb-10">
        <BudgetView />
      </main>
    </div>
  );
}
