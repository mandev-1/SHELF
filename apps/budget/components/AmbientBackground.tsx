// Handoff 0001 — living ambient background: three slow-drifting aurora glows
// (one warm sun + two tinted by --gb-ambient, the open trip's accent) and a
// soft vignette. Purely decorative fixed layers behind the notebook content;
// BudgetPanel keeps --gb-ambient in sync with navigation.
export function AmbientBackground() {
  return (
    <>
      <div className="gb-ambient gb-ambient--sun" aria-hidden />
      <div className="gb-ambient gb-ambient--accent" aria-hidden />
      <div className="gb-ambient gb-ambient--echo" aria-hidden />
      <div className="gb-ambient gb-ambient--vignette" aria-hidden />
    </>
  );
}
