// Handoff 0001 — one-shot confetti burst, fired when a settle-up payment
// squares a trip. Self-cleaning: the host element removes itself after the
// last particle has landed.
export function confettiBurst() {
  if (typeof document === "undefined") return;
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:400;overflow:hidden";
  document.body.appendChild(host);
  const hues = ["#0070f2", "#36d399", "#ffb054", "#e07a93", "#a384df", "#ffd166"];
  for (let i = 0; i < 90; i++) {
    const p = document.createElement("div");
    const size = 6 + Math.random() * 8;
    p.style.cssText = `position:absolute;top:-4%;left:${Math.random() * 100}%;width:${size}px;height:${size * 0.6}px;background:${hues[i % hues.length]};border-radius:2px;opacity:0.95`;
    host.appendChild(p);
    p.animate(
      [
        { transform: "translate3d(0,-20px,0) rotate(0deg)" },
        { transform: `translate3d(${(Math.random() - 0.5) * 30}vw,105vh,0) rotate(${360 + Math.random() * 720}deg)` },
      ],
      {
        duration: 1400 + Math.random() * 1400,
        delay: Math.random() * 500,
        easing: "cubic-bezier(.2,.6,.3,1)",
        fill: "forwards",
      },
    );
  }
  setTimeout(() => host.remove(), 3600);
}
