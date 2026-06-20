// Tiny decoupled toast: any component calls toast("…"); the <Toaster /> mounted
// once in BudgetView listens and renders it. No provider/context needed.

const TOAST_EVENT = "budget-toast";

export function toast(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: message }));
}

export { TOAST_EVENT };
