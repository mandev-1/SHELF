// Lightweight session — stored in localStorage. Two ways in:
//   • a personal/trip link (?me=<userId>[&trip=<tripId>]) → member session
//   • the host password → superuser session
//
// SECURITY: the password is hardcoded in the client bundle and the users table
// is under open RLS, so this is a SOFT gate (keeps honest friends scoped), NOT a
// real security boundary. Hard security needs a server-side check + Supabase Auth.

export type Session =
  | { role: "superuser" }
  | { role: "member"; userId: string; tripId?: string };

const KEY = "budget-session";
const SUPERUSER_PASSWORD = "Test1234"; // TODO: move server-side for real auth.

export function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(s: Session) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignore (private mode, etc.)
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function checkSuperuserPassword(password: string): boolean {
  return password === SUPERUSER_PASSWORD;
}
