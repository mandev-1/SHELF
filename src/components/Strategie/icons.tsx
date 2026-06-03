// Shared inline-SVG icons for the Strategie panel + StatementEditor.

export function IcoCheck() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
export function IcoLock() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="2" y="5.5" width="8" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}
export function IcoPlus() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
}
export function IcoChev({ dir = "right" }: { dir?: "left" | "right" | "down" }) {
  const rot = dir === "left" ? "90deg" : dir === "right" ? "-90deg" : "0deg";
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: `rotate(${rot})` }}><path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
export function IcoX() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>;
}
export function IcoTrash() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3.5h8M4.5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M5 5.5v3M7 5.5v3M3 3.5l.6 6a.5.5 0 0 0 .5.5h3.8a.5.5 0 0 0 .5-.5l.6-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
export function IcoIn() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v7M3 6l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 10h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>;
}
export function IcoOut() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 9V2M3 5l3-3 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 10h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>;
}
export function IcoFile() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 1.5h4l2 2V10a.5.5 0 0 1-.5.5h-5A.5.5 0 0 1 3 10V2a.5.5 0 0 1 .5-.5z" stroke="currentColor" strokeWidth="1.4"/><path d="M7 1.5V3.5H9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
export function IcoHopper() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2h8l-2 4H4L2 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M4.5 6v4M7.5 6v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>;
}
export function IcoUpload() {
  return <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 2v7M3.5 5l3-3 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 10.5h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>;
}
