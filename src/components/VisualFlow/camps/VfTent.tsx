/** A status-hued campsite tent. `lit` warms the inner flap. */
export function VfTent({ hue, lit }: { hue: string; lit: boolean }) {
  return (
    <svg className="camp-tent" viewBox="0 0 40 30" aria-hidden="true">
      <polygon points="20,2 38,28 2,28" fill="var(--surface)" stroke={hue} strokeWidth="2.4" strokeLinejoin="round" />
      <polygon points="20,10 27,28 13,28" fill={hue} opacity={lit ? 0.9 : 0.35} />
    </svg>
  );
}
