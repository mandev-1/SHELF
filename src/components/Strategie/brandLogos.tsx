// Tasteful, stylized brand marks for well-known recurring memberships.
// These are *evocative* simplifications drawn with currentColor — not pixel-perfect logo copies.
// Matching is intentionally forgiving: lowercase, strip non-letters, alias common variants.
// So "you tube", "yout0ube", "YT Premium", "yt-music" all collapse to "youtube".

export type BrandKey =
  | "netflix" | "spotify" | "youtube" | "chatgpt" | "icloud"
  | "disney"  | "gamepass" | "adobe"  | "notion"  | "amazon";

/** Brand identity: the SVG mark + the canonical brand color. */
export const BRAND_COLORS: Record<BrandKey, string> = {
  netflix:  "#E50914",
  spotify:  "#1DB954",
  youtube:  "#FF0033",
  chatgpt:  "#10A37F",
  icloud:   "#3B82F6",
  disney:   "#1A47BE",
  gamepass: "#107C10",
  adobe:    "#DA1F26",
  notion:   "#111111",
  amazon:   "#FF9900",
};

/** Normalize a free-text membership name into a brand key, or null if no match. */
export function brandMatch(name: string): BrandKey | null {
  if (!name) return null;
  // Lowercase, strip everything that isn't a letter — kills spaces, digits, punctuation.
  const k = name.toLowerCase().replace(/[^a-z]/g, "");
  if (!k) return null;

  const aliases: Record<string, BrandKey> = {
    netflix: "netflix", nflx: "netflix",
    spotify: "spotify", spot: "spotify",
    youtube: "youtube", youtubepremium: "youtube", youtubemusic: "youtube", ytpremium: "youtube", ytmusic: "youtube", yt: "youtube",
    chatgpt: "chatgpt", openai: "chatgpt", gpt: "chatgpt", chatgptplus: "chatgpt",
    icloud: "icloud", icloudplus: "icloud", apple: "icloud", appleone: "icloud",
    disney: "disney", disneyplus: "disney", disneyp: "disney",
    gamepass: "gamepass", xboxgamepass: "gamepass", xbox: "gamepass", xboxultimate: "gamepass", gamepassultimate: "gamepass",
    adobe: "adobe", adobecc: "adobe", creativecloud: "adobe", adobecreative: "adobe", photoshop: "adobe", lightroom: "adobe",
    notion: "notion", notionplus: "notion", notionpro: "notion",
    amazon: "amazon", amazonprime: "amazon", prime: "amazon", primevideo: "amazon",
  };

  if (aliases[k]) return aliases[k];
  // substring fallback — handles "netflix family", "spotify duo", etc.
  for (const key of Object.keys(aliases)) {
    if (k.includes(key)) return aliases[key];
  }
  return null;
}

/** Inline SVG mark for a brand. `size` defaults to 22 (fits the .se-tile). */
export function BrandMark({ brand, size = 22 }: { brand: BrandKey; size?: number }) {
  const s = size;
  switch (brand) {
    case "netflix":
      // Tilted N — three bars suggesting the iconic mark.
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M7 4v16M12 4v16M17 4v16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
          <path d="M7 4l10 16" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
        </svg>
      );
    case "spotify":
      // Three concentric arcs — the sound wave signature.
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.4" opacity="0.25"/>
          <path d="M6.5 9.5c4-1.3 8-1.3 12 0.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M7.5 13c3-1 6.5-1 9.5 0.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/>
          <path d="M8.5 16c2.2-0.7 5-0.7 7 0.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
        </svg>
      );
    case "youtube":
      // Rounded square with a centered triangle.
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="6" width="18" height="12" rx="3.5" fill="currentColor"/>
          <path d="M10 9.5l5 2.5-5 2.5z" fill="#fff"/>
        </svg>
      );
    case "chatgpt":
      // Six-pointed knot mark — abstracted from the OpenAI hex flower.
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3l7.5 4.5v9L12 21l-7.5-4.5v-9L12 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
          <path d="M12 7v10M7.5 9.5l9 5M16.5 9.5l-9 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.7"/>
        </svg>
      );
    case "icloud":
      // Cloud silhouette.
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M7 17h10a4 4 0 0 0 0.5-7.97A6 6 0 0 0 5.5 10.5 4 4 0 0 0 7 18z" fill="currentColor"/>
        </svg>
      );
    case "disney":
      // Stylized cursive D — single stroke loop.
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M7 6c3-1 8-0.5 9.5 2 1.6 2.8-0.8 6-4 7.2-2.5 0.9-5 0.5-6.5-0.7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M8 6v12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
        </svg>
      );
    case "gamepass":
      // Bold X — Xbox shorthand.
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" opacity="0.35"/>
          <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
        </svg>
      );
    case "adobe":
      // The classic stylized A — triangle with a notch.
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 19l8-15 8 15h-5l-3-6-3 6z" fill="currentColor"/>
        </svg>
      );
    case "notion":
      // Bold N with corner accent.
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.6"/>
          <path d="M9 17V8l6 9V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case "amazon":
      // Smile arc.
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4.5 13c2 4 6 6 9.5 6 2.5 0 5-1 7-3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
          <path d="M18 14l2.5 2-0.5 3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
  }
}
