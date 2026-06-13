/* Visual Flow view transitions — WAAPI on throwaway DOM clones in an absolutely
   positioned overlay. React state has already swapped underneath (hidden), then
   the overlay is removed when the animation resolves. dir = +1 (deeper/forward)
   or −1 (back). Ported 1:1 from the v4 handoff (cylinder runner omitted). */

export type VfTransitionMode = "cardflip" | "depthzoom" | "flipshow";

/** Deep-clone a view, copying live input/checkbox/textarea/select values onto
 *  the clone so the frozen snapshot matches what was on screen. */
export function vfCloneWithValues(el: HTMLElement): HTMLElement {
  const clone = el.cloneNode(true) as HTMLElement;
  const src = el.querySelectorAll("input, textarea, select");
  const dst = clone.querySelectorAll("input, textarea, select");
  src.forEach((s, i) => {
    const d = dst[i] as HTMLElement | undefined;
    if (!d) return;
    if (s.tagName === "TEXTAREA") {
      d.textContent = (s as HTMLTextAreaElement).value;
    } else if (s.tagName === "SELECT") {
      const oi = (s as HTMLSelectElement).selectedIndex;
      Array.from((d as HTMLSelectElement).options).forEach((o, j) => {
        if (j === oi) o.setAttribute("selected", ""); else o.removeAttribute("selected");
      });
    } else {
      const si = s as HTMLInputElement;
      d.setAttribute("value", si.value);
      if (si.checked) d.setAttribute("checked", ""); else d.removeAttribute("checked");
    }
  });
  return clone;
}

/* ── depth zoom — parent ⇄ child (camps ⇄ node flow). Going deeper (dir 1) the
   outgoing layer pushes toward you, blurs and fades while the incoming layer
   rises from ~0.9 into focus; back (dir -1) shrinks the child into the parent. */
export function vfRunDepthZoom(wrap: HTMLElement, outSnap: HTMLElement, outH: number, dir: number): void {
  const view = wrap.querySelector<HTMLElement>(".vf-view");
  if (!view) return;
  const W = wrap.clientWidth;
  if (!W) return;
  const H = Math.max(outH, view.offsetHeight);

  const overlay = document.createElement("div");
  overlay.className = "vf-zoom";
  overlay.style.height = `${H}px`;
  const out = outSnap.cloneNode(true) as HTMLElement;
  out.style.cssText += `;position:absolute;left:0;top:0;width:${W}px;margin:0;`;
  overlay.appendChild(out);
  wrap.appendChild(overlay);

  const EASE = "cubic-bezier(0.33, 0, 0.2, 1)";
  const dur = 560;
  const outTo = dir === 1 ? 1.12 : 0.9;
  const inFrom = dir === 1 ? 0.9 : 1.12;
  const anims = [
    out.animate(
      [{ transform: "scale(1)", opacity: 1, filter: "blur(0px)" },
       { transform: `scale(${outTo})`, opacity: 0, filter: "blur(8px)" }],
      { duration: dur, easing: EASE, fill: "both" }
    ),
    view.animate(
      [{ transform: `scale(${inFrom})`, opacity: 0, filter: "blur(8px)" },
       { transform: "scale(1.012)", opacity: 1, filter: "blur(0px)", offset: 0.82 },
       { transform: "scale(1)", opacity: 1, filter: "blur(0px)" }],
      { duration: dur + 80, delay: 70, easing: EASE, fill: "both" }
    ),
  ];

  Promise.all(anims.map((a) => a.finished)).catch(() => {}).finally(() => {
    overlay.remove();
    view.style.transform = ""; view.style.opacity = ""; view.style.filter = "";
  });
}

/* ── single card flip — the whole canvas turns once on its Y axis (camps ⇄ camp
   detail): outgoing on the front face, incoming on the back. ~940ms "human"
   feel: anticipation wind-up → forward arc → overshoot → settle. */
export function vfRunCardFlip(wrap: HTMLElement, outSnap: HTMLElement, outH: number, dir: number): void {
  const view = wrap.querySelector<HTMLElement>(".vf-view");
  if (!view) return;
  const W = wrap.clientWidth;
  if (!W) return;
  const H = Math.max(outH, view.offsetHeight);
  const inSnap = vfCloneWithValues(view);
  wrap.classList.add("vf-cyl-hide");

  const overlay = document.createElement("div");
  overlay.className = "vf-flip3d";
  overlay.style.height = `${H}px`;
  const cam = document.createElement("div");
  cam.className = "vf-flip3d-cam";
  const card = document.createElement("div");
  card.className = "vf-flip3d-card";
  cam.appendChild(card);
  overlay.appendChild(cam);

  const face = (snap: HTMLElement, back: boolean) => {
    const f = document.createElement("div");
    f.className = "vf-flip3d-face" + (back ? " vf-flip3d-back" : "");
    const inner = snap.cloneNode(true) as HTMLElement;
    inner.style.cssText += `;position:absolute;left:0;top:0;width:${W}px;margin:0;`;
    f.appendChild(inner);
    card.appendChild(f);
  };
  face(outSnap, false);
  face(inSnap, true);
  wrap.appendChild(overlay);

  const end = dir === 1 ? -180 : 180;
  const S = end < 0 ? -1 : 1;       // direction of travel
  const antic = -S * 4;             // wind-up: a hair the opposite way
  const overshoot = end + S * 5;    // glide just past, then settle back
  const dur = 940;
  const anims = [
    card.animate(
      [
        { transform: "rotateY(0deg) rotateX(0deg) translateZ(0px)", offset: 0, easing: "cubic-bezier(0.34, 0, 0.4, 1)" },
        { transform: `rotateY(${antic}deg) rotateX(1.6deg) translateZ(-12px)`, offset: 0.12, easing: "cubic-bezier(0.4, 0, 0.25, 1)" },
        { transform: `rotateY(${end * 0.5}deg) rotateX(0deg) translateZ(-64px)`, offset: 0.52, easing: "cubic-bezier(0.4, 0, 0.3, 1)" },
        { transform: `rotateY(${overshoot}deg) rotateX(-1.1deg) translateZ(-10px)`, offset: 0.88, easing: "cubic-bezier(0.33, 1.1, 0.62, 1)" },
        { transform: `rotateY(${end}deg) rotateX(0deg) translateZ(0px)`, offset: 1 },
      ],
      { duration: dur, fill: "both" }
    ),
    cam.animate(
      [
        { transform: "scale(1) rotateX(0deg)" },
        { transform: "scale(0.952) rotateX(2deg)", offset: 0.5 },
        { transform: "scale(1) rotateX(0deg)" },
      ],
      { duration: dur, easing: "ease-in-out", fill: "both" }
    ),
  ];

  Promise.all(anims.map((a) => a.finished)).catch(() => {}).finally(() => {
    overlay.remove();
    wrap.classList.remove("vf-cyl-hide");
  });
}

/* ── showy card flip — the "open a camp" turn (6 camps → camp detail). Same
   3D family as the plain flip, but slower, softer and more lavish: the card
   lifts toward you mid-turn (`translateZ` bloom) with a gentle `rotateX` tilt,
   the camera blooms ~1.05, and an accent-tinted light sheen glints across the
   face as it rolls. One continuous ease-in-out turn — NO overshoot/spring, so
   it reads perfectly smooth. The way back keeps the plain `vfRunCardFlip`. */
export function vfRunCardFlipShow(wrap: HTMLElement, outSnap: HTMLElement, outH: number, dir: number): void {
  const view = wrap.querySelector<HTMLElement>(".vf-view");
  if (!view) return;
  const W = wrap.clientWidth;
  if (!W) return;
  const H = Math.max(outH, view.offsetHeight);
  const inSnap = vfCloneWithValues(view);
  wrap.classList.add("vf-cyl-hide");

  const overlay = document.createElement("div");
  overlay.className = "vf-flip3d vf-flip3d--show";
  overlay.style.height = `${H}px`;
  const cam = document.createElement("div");
  cam.className = "vf-flip3d-cam";
  const card = document.createElement("div");
  card.className = "vf-flip3d-card";
  cam.appendChild(card);

  const faceEl = (snap: HTMLElement, back: boolean) => {
    const f = document.createElement("div");
    f.className = "vf-flip3d-face" + (back ? " vf-flip3d-back" : "");
    const inner = snap.cloneNode(true) as HTMLElement;
    inner.style.cssText += `;position:absolute;left:0;top:0;width:${W}px;margin:0;`;
    f.appendChild(inner);
    card.appendChild(f);
  };
  faceEl(outSnap, false);
  faceEl(inSnap, true);
  overlay.appendChild(cam);

  const sheen = document.createElement("div");
  sheen.className = "vf-flip3d-sheen";
  overlay.appendChild(sheen);
  wrap.appendChild(overlay);

  const end = dir >= 0 ? -180 : 180;
  const dur = 1080;
  // One continuous ease-in-out turn — no overshoot, no spring. The midpoint
  // keyframe sits at the geometric half-turn with matched velocities either side
  // (accelerate in → decelerate out), so the rotation reads perfectly smooth;
  // translateZ/rotateX just bloom and settle along the same curve.
  const anims = [
    card.animate(
      [
        { transform: "rotateY(0deg) rotateX(0deg) translateZ(0px)", offset: 0, easing: "cubic-bezier(0.42, 0, 1, 1)" },
        { transform: `rotateY(${end * 0.5}deg) rotateX(2.6deg) translateZ(150px)`, offset: 0.5, easing: "cubic-bezier(0, 0, 0.58, 1)" },
        { transform: `rotateY(${end}deg) rotateX(0deg) translateZ(0px)`, offset: 1 },
      ],
      { duration: dur, fill: "both" }
    ),
    cam.animate(
      [
        { transform: "scale(1) rotateX(0deg)" },
        { transform: "scale(1.05) rotateX(-1.6deg)", offset: 0.5 },
        { transform: "scale(1) rotateX(0deg)" },
      ],
      { duration: dur, easing: "ease-in-out", fill: "both" }
    ),
    sheen.animate(
      [
        { transform: "translateX(-130%) skewX(-14deg)", opacity: 0 },
        { transform: "translateX(0%) skewX(-14deg)", opacity: 0.85, offset: 0.5 },
        { transform: "translateX(130%) skewX(-14deg)", opacity: 0 },
      ],
      { duration: dur, easing: "cubic-bezier(0.45, 0.05, 0.3, 1)", fill: "both" }
    ),
  ];

  Promise.all(anims.map((a) => a.finished)).catch(() => {}).finally(() => {
    overlay.remove();
    wrap.classList.remove("vf-cyl-hide");
  });
}

export function vfRunTransition(wrap: HTMLElement, outSnap: HTMLElement, outH: number, dir: number, mode: VfTransitionMode): void {
  if (mode === "cardflip") return vfRunCardFlip(wrap, outSnap, outH, dir);
  if (mode === "flipshow") return vfRunCardFlipShow(wrap, outSnap, outH, dir);
  return vfRunDepthZoom(wrap, outSnap, outH, dir);
}
