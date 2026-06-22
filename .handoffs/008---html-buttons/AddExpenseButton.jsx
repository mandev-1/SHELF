// ============================================================================
// <AddExpenseButton /> — Notebook Ruled-Underline (Option A), React
// Drop-in for the Holiday Budget / Shared-budget header (top-right action).
// Requires notebook-add-button.css to be loaded once in the app.
// ============================================================================

function AddExpenseButton({ onClick, label = "Add expense" }) {
  return (
    <button className="add-expense-btn" type="button" onClick={onClick}>
      <svg className="ae-plus" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path
          d="M16 2.5 C24 2.2 29.6 8 29.5 16 C29.4 24 23.8 29.6 16 29.5 C8.2 29.4 2.5 23.7 2.6 16 C2.7 8.4 8 2.8 16 2.5 Z"
          stroke="#4a6a92" strokeWidth="1.7" fill="none" strokeLinecap="round"
        />
        <path d="M16 9.5 L16 22.5 M9.5 16 L22.5 16" stroke="#4a6a92" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span className="ae-lab">{label}</span>
    </button>
  );
}

// Usage in the header row:
//   <div className="header-row">           {/* display:flex; justify-content:space-between */}
//     <div>{/* eyebrow + title */}</div>
//     <AddExpenseButton onClick={openAddExpense} />
//   </div>

export default AddExpenseButton;
