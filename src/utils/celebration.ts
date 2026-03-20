/** Corporate-friendly celebratory phrases with emoji – pick random on each call */
export const CELEBRATION_PHRASES: readonly string[] = [
  "Hooray! 🎉",
  "Done! ✓",
  "Task crushed! 🏆",
  "Nice work! ✓",
  "Mission accomplished! 🎯",
  "Boom! Completed. 💪",
  "Another one in the bag! ✓",
  "You're on fire! 🔥",
  "Crushing it! 🏆",
  "Shipped! 🚀",
  "Nailed it! ✓",
  "Win! 🎉",
  "Crossed off! ✅",
  "Done and done! 🎉",
  "Solid work! 🏆",
  "Check! ✓",
];

export function pickCelebrationPhrase(): string {
  const idx = Math.floor(Math.random() * CELEBRATION_PHRASES.length);
  return CELEBRATION_PHRASES[idx];
}
