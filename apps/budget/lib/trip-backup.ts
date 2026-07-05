// Trip backup — a versioned, self-contained, checksummed snapshot of one trip.
//
// Why an envelope (not a raw `trip` dump): a trip references members by id
// (paidBy / splitAmong / memberIds), and those members live in a SEPARATE table,
// so a bare trip JSON restores with dangling references. This format embeds the
// members the trip actually uses — plus, best-effort, its expense audit trail —
// so the file restores on its own. The top-level `format` + `formatVersion` +
// integrity `checksum` let a future importer recognise the file, migrate older
// versions, and reject corrupted ones. Keep the read path (parseTripBackup) in
// step with the write path (buildTripBackup) whenever the payload shape changes.

import {
  normBudgetExpense,
  type BudgetTrip,
  type BudgetMember,
  type BudgetCurrency,
  type BudgetExpense,
} from "./budget-types";

/** Discriminator a generic importer matches on to route the file. */
export const TRIP_BACKUP_FORMAT = "shelf.budget.trip" as const;
/** Bump ONLY on a breaking change to `payload`; add a migration in parseTripBackup. */
export const TRIP_BACKUP_VERSION = 1;

const APP_VERSION =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_APP_VERSION) || "0.1.0";

const CURRENCIES: BudgetCurrency[] = ["CZK", "PLN", "EUR"];
const isCurrency = (c: unknown): c is BudgetCurrency => CURRENCIES.includes(c as BudgetCurrency);

/** One expense-audit row, mirroring the API's ExpenseLog (camelCase wire shape). */
export interface TripBackupLog {
  id: string;
  tripId: string;
  expenseId: string;
  actorId?: string;
  actorName?: string;
  action: string;
  amount?: number;
  currency?: string;
  note?: string;
  createdAt: string;
}

export interface TripBackupPayload {
  trip: BudgetTrip;
  /** Every member the trip references — makes the file self-contained. */
  members: BudgetMember[];
  /** The trip's expense audit trail, when it could be fetched. */
  logs?: TripBackupLog[];
}

export interface TripBackupEnvelope {
  format: typeof TRIP_BACKUP_FORMAT;
  formatVersion: number;
  /** Hosting-app version that wrote the file (provenance only). */
  appVersion: string;
  exportedAt: string;
  exportedBy?: string;
  /** Hash over the canonical (sorted-key) serialization of `payload`. */
  checksum: { algo: string; value: string };
  /** Denormalised at-a-glance summary; never the source of truth for a restore. */
  meta: {
    tripId: string;
    tripName: string;
    expenseCount: number;
    memberCount: number;
    logCount: number;
    mainCurrency: BudgetCurrency;
    currencies: BudgetCurrency[];
  };
  payload: TripBackupPayload;
}

/**
 * The members a trip references: its member set (explicit memberIds, or all of
 * them when none are chosen — the "everyone" default) plus anyone named as a
 * payer or split participant on an expense. Preserves the order of `all`.
 */
export function referencedMembers(trip: BudgetTrip, all: BudgetMember[]): BudgetMember[] {
  const wanted = new Set<string>(
    trip.memberIds && trip.memberIds.length ? trip.memberIds : all.map((m) => m.id),
  );
  for (const e of trip.expenses ?? []) {
    if (e.paidBy) wanted.add(e.paidBy);
    for (const id of e.splitAmong ?? []) wanted.add(id);
  }
  return all.filter((m) => wanted.has(m.id));
}

// --- canonical serialization + checksum -----------------------------------

/** Recursively sort object keys and drop `undefined` so the hash is stable. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) {
      if (o[k] !== undefined) out[k] = canonical(o[k]);
    }
    return out;
  }
  return value;
}

/** FNV-1a 32-bit — non-cryptographic fallback when SubtleCrypto is unavailable. */
function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

async function digest(text: string): Promise<{ algo: string; value: string }> {
  const subtle = typeof crypto !== "undefined" ? crypto.subtle : undefined;
  if (subtle) {
    try {
      const buf = await subtle.digest("SHA-256", new TextEncoder().encode(text));
      const value = Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return { algo: "SHA-256", value };
    } catch {
      // Non-secure context, etc. — fall through to the cheap hash.
    }
  }
  return { algo: "FNV-1a-32", value: fnv1a(text) };
}

/** Recompute the checksum of an envelope's payload (for verify-on-import). */
export function checksumOf(payload: TripBackupPayload): Promise<{ algo: string; value: string }> {
  return digest(JSON.stringify(canonical(payload)));
}

// --- build / serialize / download -----------------------------------------

export interface BuildTripBackupOptions {
  trip: BudgetTrip;
  /** All budget members; the referenced subset is embedded. */
  members: BudgetMember[];
  logs?: TripBackupLog[];
  exportedBy?: string;
  appVersion?: string;
  /** Injectable for deterministic tests; defaults to now. */
  exportedAt?: string;
}

export async function buildTripBackup(opts: BuildTripBackupOptions): Promise<TripBackupEnvelope> {
  const { trip } = opts;
  const members = referencedMembers(trip, opts.members);
  const expenses = trip.expenses ?? [];
  const main = trip.mainCurrency ?? "CZK";
  const currencies = Array.from(
    new Set<BudgetCurrency>([
      main,
      ...(trip.secondaryCurrency ? [trip.secondaryCurrency] : []),
      ...expenses.map((e) => e.currency),
    ]),
  );

  const payload: TripBackupPayload = {
    trip,
    members,
    ...(opts.logs && opts.logs.length ? { logs: opts.logs } : {}),
  };

  return {
    format: TRIP_BACKUP_FORMAT,
    formatVersion: TRIP_BACKUP_VERSION,
    appVersion: opts.appVersion ?? APP_VERSION,
    exportedAt: opts.exportedAt ?? new Date().toISOString(),
    exportedBy: opts.exportedBy,
    checksum: await checksumOf(payload),
    meta: {
      tripId: trip.id,
      tripName: trip.name,
      expenseCount: expenses.length,
      memberCount: members.length,
      logCount: opts.logs?.length ?? 0,
      mainCurrency: main,
      currencies,
    },
    payload,
  };
}

export function serializeTripBackup(envelope: TripBackupEnvelope): string {
  return JSON.stringify(envelope, null, 2);
}

/** Slug-and-date filename, e.g. `shelf-trip-krakow-weekender-2026-06-28.json`. */
export function tripBackupFilename(trip: BudgetTrip, at: Date = new Date()): string {
  const slug =
    trip.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "trip";
  return `shelf-trip-${slug}-${at.toISOString().slice(0, 10)}.json`;
}

/** Trigger a browser download of the serialized envelope. No-op server-side. */
export function downloadTripBackup(envelope: TripBackupEnvelope, filename: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([serializeTripBackup(envelope)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after the click-initiated download has grabbed the blob.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// --- read path (future import) --------------------------------------------

export type ParseTripBackupResult =
  | { ok: true; envelope: TripBackupEnvelope; checksumValid: boolean }
  | { ok: false; error: string };

function normLog(o: any): TripBackupLog | null {
  if (!o || typeof o !== "object") return null;
  if (typeof o.id !== "string" || typeof o.tripId !== "string" || typeof o.expenseId !== "string")
    return null;
  return {
    id: o.id,
    tripId: o.tripId,
    expenseId: o.expenseId,
    actorId: typeof o.actorId === "string" ? o.actorId : undefined,
    actorName: typeof o.actorName === "string" ? o.actorName : undefined,
    action: typeof o.action === "string" ? o.action : "update",
    amount: typeof o.amount === "number" ? o.amount : undefined,
    currency: typeof o.currency === "string" ? o.currency : undefined,
    note: typeof o.note === "string" ? o.note : undefined,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
  };
}

function normMember(o: any): BudgetMember | null {
  if (!o || typeof o !== "object" || typeof o.id !== "string" || typeof o.name !== "string")
    return null;
  return {
    id: o.id,
    name: o.name,
    role: typeof o.role === "string" ? o.role : undefined,
    share: typeof o.share === "number" ? o.share : undefined,
    income: typeof o.income === "number" ? o.income : undefined,
    color: typeof o.color === "string" ? o.color : undefined,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
  };
}

function normTrip(o: any): BudgetTrip | null {
  if (!o || typeof o !== "object" || typeof o.id !== "string" || typeof o.name !== "string")
    return null;
  const nowIso = new Date().toISOString();
  return {
    id: o.id,
    name: o.name,
    emoji: typeof o.emoji === "string" ? o.emoji : undefined,
    destination: typeof o.destination === "string" ? o.destination : undefined,
    startDate: typeof o.startDate === "string" ? o.startDate : undefined,
    endDate: typeof o.endDate === "string" ? o.endDate : undefined,
    datesTBD: !!o.datesTBD,
    color: typeof o.color === "string" ? o.color : undefined,
    cover: typeof o.cover === "string" ? o.cover : undefined,
    mainCurrency: isCurrency(o.mainCurrency) ? o.mainCurrency : "CZK",
    secondaryCurrency: isCurrency(o.secondaryCurrency) ? o.secondaryCurrency : "EUR",
    memberIds: Array.isArray(o.memberIds)
      ? o.memberIds.filter((x: unknown) => typeof x === "string")
      : undefined,
    expenses: Array.isArray(o.expenses)
      ? (o.expenses.map(normBudgetExpense).filter(Boolean) as BudgetExpense[])
      : undefined,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : nowIso,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : nowIso,
  };
}

/**
 * Validate and normalise an untrusted backup file (string or parsed value) into
 * a typed envelope, verifying the checksum. Unknown future `formatVersion`s are
 * rejected with a clear message; add migrations here when the version bumps.
 */
export async function parseTripBackup(input: unknown): Promise<ParseTripBackupResult> {
  let raw: any = input;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input);
    } catch {
      return { ok: false, error: "Not valid JSON." };
    }
  }
  if (!raw || typeof raw !== "object") return { ok: false, error: "Empty or malformed file." };
  if (raw.format !== TRIP_BACKUP_FORMAT)
    return { ok: false, error: "Not a ShELF trip backup file." };
  if (typeof raw.formatVersion !== "number" || raw.formatVersion > TRIP_BACKUP_VERSION)
    return {
      ok: false,
      error: `Unsupported backup version (${raw.formatVersion}); update the app to import it.`,
    };

  const trip = normTrip(raw.payload?.trip);
  if (!trip) return { ok: false, error: "Backup is missing a valid trip." };
  const members = Array.isArray(raw.payload?.members)
    ? (raw.payload.members.map(normMember).filter(Boolean) as BudgetMember[])
    : [];
  const logs = Array.isArray(raw.payload?.logs)
    ? (raw.payload.logs.map(normLog).filter(Boolean) as TripBackupLog[])
    : undefined;

  const payload: TripBackupPayload = { trip, members, ...(logs ? { logs } : {}) };
  const recomputed = await checksumOf(payload);
  const claimed = raw.checksum;
  const checksumValid =
    !!claimed &&
    claimed.algo === recomputed.algo &&
    claimed.value === recomputed.value;

  const envelope: TripBackupEnvelope = {
    format: TRIP_BACKUP_FORMAT,
    formatVersion: raw.formatVersion,
    appVersion: typeof raw.appVersion === "string" ? raw.appVersion : "unknown",
    exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : new Date().toISOString(),
    exportedBy: typeof raw.exportedBy === "string" ? raw.exportedBy : undefined,
    checksum: recomputed,
    meta: {
      tripId: trip.id,
      tripName: trip.name,
      expenseCount: trip.expenses?.length ?? 0,
      memberCount: members.length,
      logCount: logs?.length ?? 0,
      mainCurrency: trip.mainCurrency ?? "CZK",
      currencies: Array.from(
        new Set<BudgetCurrency>([
          trip.mainCurrency ?? "CZK",
          ...(trip.secondaryCurrency ? [trip.secondaryCurrency] : []),
          ...(trip.expenses ?? []).map((e) => e.currency),
        ]),
      ),
    },
    payload,
  };
  return { ok: true, envelope, checksumValid };
}
