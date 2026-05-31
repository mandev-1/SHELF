/**
 * Generate a deterministic monogram favicon as an inline SVG data URI.
 * Per spec: hue from hash of hostname, hsl(<hue> 42% 42%) fill,
 * first letter of de-`www.`'d host centered in a 100×100 viewBox.
 */

function hostFrom(input: string): string {
  try {
    const u = new URL(input);
    return u.hostname.replace(/^www\./i, "");
  } catch {
    return input.replace(/^www\./i, "").split("/")[0];
  }
}

function hueFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h * 31) + s.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

/**
 * Build a monogram SVG data URI sized so it scales to any tile.
 * SVG uses viewBox="0 0 100 100" with a single rounded-rect background
 * and a centered uppercase initial.
 */
export function monogramDataUri(urlOrHost: string): string {
  const host = hostFrom(urlOrHost) || "?";
  const letter = (host[0] || "?").toUpperCase();
  const hue = hueFromString(host);
  const bg = `hsl(${hue} 42% 42%)`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>` +
    `<rect width='100' height='100' rx='18' fill='${bg}'/>` +
    `<text x='50' y='50' text-anchor='middle' dominant-baseline='central' ` +
    `font-family='DM Sans, system-ui, sans-serif' font-weight='700' font-size='58' fill='#ffffff'>${letter}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
