// ─────────────────────────────────────────────────────────────────────────────
// statementImport.ts — local, security-first bank-statement parser.
//
// Pure, DOM-free, dependency-free. Everything runs in-memory; nothing here makes
// a network call, touches chrome.storage, or holds the raw statement after the
// call returns. The only non-determinism is crypto.randomUUID() for row ids.
//
// Feeds the Strategie StatementEditor: positive amounts → IncomeRow, negative →
// ExpenseRow. Amounts are stored "USD-base" (value / CURRENCIES[code].rate) so
// they round-trip back to the original currency in the editor, which rounds for
// display only. See .context/bank-import/SPEC.md for the full design contract.
// ─────────────────────────────────────────────────────────────────────────────

import type { CatKey, IncomeRow, ExpenseRow, MonthStatement } from "../../types/grid";
import { CURRENCIES } from "./strategie";

export type AmountMode = "signed" | "debitCredit";
export type ParseMode = "delimited" | "whitespace" | "freeform";
export type TxnKind = "income" | "expense";

export interface ParsedTxn {
  rawDate: string;
  isoDate: string;            // canonical YYYY-MM-DD (validated calendar day)
  description: string;
  counterparty: string;       // "" when no dedicated column
  amount: number;             // SIGNED display-currency value; full precision
  currencyCode: string;       // resolved ISO code for this row
  nativeCategory: string | null;
  cat: CatKey;                // initial category guess (expense side)
  kind: TxnKind;
  monthKey: string;           // isoDate.slice(0, 7)
}

export interface ColumnMap {
  date: number;
  amount: number | null;
  debit: number | null;
  credit: number | null;
  description: number | null;
  counterparty: number | null;
  currency: number | null;
  nativeCategory: number | null;
  amountMode: AmountMode;
}

export interface StatementMeta {
  delimiter: string | null;
  mode: ParseMode;
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
  columnMap: ColumnMap;
  headerCells: string[];      // header labels, or "Column N" when headerless
  headerIndex: number;
  rowsParsed: number;
  rowsSkipped: number;
  skippedLines: string[];     // raw text of skipped rows (capped) for review UI
  decimalSep: "," | ".";
}

export interface ParseOptions {
  columnMap?: Partial<ColumnMap>;
  currencyHint?: string;
  dayFirst?: boolean;
}

export interface StatementParseResult {
  transactions: ParsedTxn[];
  byMonth: Record<string, MonthStatement>;
  meta: StatementMeta;
}

// ─── Limits (DoS bounding) ─────────────────────────────────────────────────────
const MAX_LINES = 50000;
const MAX_LINE_LENGTH = 10000;
const SAMPLE_ROWS = 200;
const MAX_SKIPPED_LINES = 40;

// ─── ASCII folding ─────────────────────────────────────────────────────────────
/** Lowercase, strip diacritics, collapse whitespace. č→c, ě→e, ů→u, etc. */
export function foldAscii(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Currency tokens ────────────────────────────────────────────────────────────
const CURRENCY_TOKEN_TO_ISO: Record<string, string> = {
  "kc": "CZK", "kč": "CZK", "czk": "CZK",
  "€": "EUR", "eur": "EUR",
  "$": "USD", "usd": "USD",
  "£": "GBP", "gbp": "GBP",
  "zł": "PLN", "zl": "PLN", "pln": "PLN",
  "ft": "HUF", "huf": "HUF",
  "chf": "CHF",
};
const KNOWN_CODES = new Set(Object.keys(CURRENCIES));

// ─── Column-header synonyms (ASCII-folded) ──────────────────────────────────────
const ROLE_SYNONYMS: Record<string, string[]> = {
  date: ["datum", "datum provedeni", "datum zauctovani", "datum splatnosti", "datum zauctovani/provedeni", "zauctovano/provedeno", "datum transakce", "datum odepsani", "datum a cas zadani", "datum schvaleni", "datum a cas", "den", "uctovano", "provedeno", "zauctovano", "ucinnost", "booking date", "value date", "date", "posted", "buchungstag", "valuta"],
  amount: ["castka", "castka czk", "castka eur", "castka v mene uctu", "objem", "castka transakce", "suma", "hodnota", "obnos", "puvodni castka uhrady", "odesilatel poslal", "obrat", "pohyb", "amount", "value", "sum", "betrag"],
  debit: ["odepsano", "odepsano z uctu", "ma dati", "md", "debet", "vydaj", "na vrub", "debit", "withdrawal", "soll"],
  credit: ["pripsano", "pripsano na uctu", "dal", "kredit", "prijem", "ve prospech", "credit", "deposit", "haben"],
  description: ["detaily", "detail", "popis", "popis transakce", "popis platby", "zprava pro prijemce", "zprava", "ucel uhrady", "ucel platby", "poznamka", "poznamka pro mne", "poznamka k uhrade", "uzivatelska identifikace", "upresneni", "komentar", "identifikace transakce", "oznaceni", "obchodni misto", "misto", "terminal", "nazev karty", "text", "udaj", "description", "details", "memo", "narrative", "verwendungszweck", "purpose"],
  counterparty: ["nazev / cislo uctu", "nazev/cislo uctu", "nazev protistrany", "cislo uctu protistrany", "nazev uctu protistrany", "protiucet", "protiucet a kod banky", "nazev protiuctu", "ucet protistrany", "protistrana", "prijemce", "platce", "odesilatel", "nazev, adresa a stat protistrany", "nazev banky", "banka protistrany", "nazev a adresa protiuctu", "counterparty", "payee", "beneficiary", "merchant", "partner", "account name", "empfanger"],
  currency: ["mena", "mena uctu", "mena vypisu", "mena transakce", "puvodni mena uhrady", "mena platby", "valuta", "currency", "curr", "wahrung", "ccy"],
  nativeCategory: ["kategorie plateb", "kategorie", "category"],
  balance: ["zustatek", "konecny zustatek", "zustatek po transakci", "zustatek na uctu", "disponibilni zustatek", "stav uctu", "stav po pohybu", "balance", "running balance", "saldo", "kontostand"],
};

// ─── Category dictionary (match-priority order; longer/specific keys first) ──────
export const CAT_KEYWORDS: { cat: CatKey; keywords: string[] }[] = [
  { cat: "taxi", keywords: ["bolt food", "bolt.food", "boltfood", "uber eats", "ubereats", "damejidlo", "dame jidlo", "wolt", "foodora", "bolt", "uber", "liftago", "taxi"] },
  { cat: "eating", keywords: ["restaurace", "restaurant", "kavarna", "cafe", "bistro", "jidelna", "obcerstveni", "cukrarna", "mcdonald", "kfc", "burger king", "burgerking", "subway", "starbucks", "costa coffee", "ugo", "pizza", "pizzeria", "sushi", "kebab", "gril", "grill", "obed", "vecere", "snidane"] },
  { cat: "food", keywords: ["rohlik", "kosik", "albert", "billa", "lidl", "kaufland", "tesco", "penny", "globus", "makro", "coop", "jednota", "konzum", "norma", "zabka", "potravin", "supermarket", "hypermarket", "whole foods", "wholefoods", "marks spencer food", "grocery", "grocer", "pekarna", "jidlo", "lahudky", "reznictvi", "vinoteka"] },
  { cat: "transport", keywords: ["dpp", "dopravni podnik", "pid", "litacka", "mhd", "jizdne", "jizdenka", "kupon mhd", "shell", "mol", "omv", "benzina", "orlen", "eurooil", "euro oil", "cepro", "cerpaci stanice", "pohonne hmoty", "tankovani", "natural 95", "diesel", "nafta", "ceske drahy", "cd.cz", "regiojet", "regio jet", "leo express", "leoexpress", "arriva", "flixbus", "student agency", "parkovani", "parkovaci", "pre parkovani", "parkomat", "garaze", "dalnicni znamka", "edalnice", "myto", "vignette", "ryanair", "wizz air", "wizzair", "smartwings", "letiste", "airport", "pneuservis", "autoservis", "stk"] },
  { cat: "housing", keywords: ["najem", "najemne", "rent", "podnajem", "svj", "spolecenstvi vlastniku", "fond oprav", "bytove druzstvo", "druzstvo", "sprava nemovitosti", "hypoteka", "mortgage", "hypotecni", "energie", "elektrina", "cez", "cez prodej", "prazska energetika", "innogy", "rwe", "e.on", "eon", "prazska plynarenska", "plyn", "plynarenska", "teplo", "teplarny", "vodne", "stocne", "vodarny", "pvk", "prazske vodovody", "centropol", "bohemia energy", "mnd", "lumius", "ubytovani"] },
  { cat: "home", keywords: ["o2", "t-mobile", "tmobile", "t mobile", "vodafone", "vodafone tv", "internet", "upc", "nordic telecom", "poda", "cetin", "tarif", "pausal", "mobilni tarif", "kabelova televize", "pojisteni", "insurance", "pojistovna", "kooperativa", "ceska pojistovna", "generali", "allianz", "uniqa", "axa", "direct pojistovna", "slavia pojistovna", "pojistne", "alza domacnost", "ikea", "jysk", "kika", "xxxlutz", "asko nabytek", "sconto", "mobelix", "siko", "obi", "hornbach", "bauhaus", "baumax", "unihobby", "drogerie", "rossmann", "dm drogerie", "teta drogerie", "domacnost", "praci prostredky", "nabytek", "kvetiny", "zahrada"] },
  { cat: "fun", keywords: ["netflix", "spotify", "hbo max", "max.com", "hbo", "disney+", "disney plus", "disney", "apple tv", "appletv", "apple.com/bill", "amazon prime video", "paramount", "skyshowtime", "voyo", "oneplay", "steam", "steampowered", "playstation", "psn", "xbox", "xbox live", "nintendo", "epic games", "epicgames", "gog.com", "twitch", "patreon", "youtube premium", "youtubepremium", "kino", "cinema city", "cinemacity", "cinestar", "premiere cinemas", "imax", "divadlo", "koncert", "festival", "ticketportal", "ticketmaster", "goout", "go out", "smsticket", "bar", "pub", "hospoda", "hostinec", "pivnice", "nightclub", "diskoteka", "zoo", "aquapark", "aquapalace", "bowling", "laser game", "lasergame", "escape room", "audible", "muzeum", "galerie", "casino", "sazka", "tipsport", "fortuna", "betano"] },
  { cat: "health", keywords: ["lekarna", "pharmacy", "dr.max", "dr max", "drmax", "benu lekarna", "benu", "pilulka", "magistra", "doktor", "lekar", "klinika", "poliklinika", "ordinace", "nemocnice", "zubar", "stomatolog", "dental", "zubni", "ocni", "optika", "fokus optik", "grandoptical", "vasecocky", "multisport", "multi sport", "fitness", "posilovna", "fitcentrum", "form factory", "formfactory", "bigone", "yoga", "joga", "pilates", "bazen", "plavani", "wellness", "masaz", "fyzioterapie", "rehabilitace", "vzp", "zdravotni pojisteni", "zdravotni pojistovna", "decathlon", "doplnky stravy", "vitaminy"] },
  { cat: "electronics", keywords: ["alza", "alza.cz", "czc.cz", "tsbohemia", "ts bohemia", "datart", "electroworld", "electro world", "euronics", "okay elektro", "planeo", "megapixel", "fotolab", "istyle", "mobil pohotovost", "mobilpohotovost"] },
  { cat: "shopping", keywords: ["notino", "zalando", "about you", "aboutyou", "zara", "h&m", "hm.com", "reserved", "cropp", "sinsay", "mohito", "new yorker", "newyorker", "c&a", "takko", "kik", "primark", "mall.cz", "mall group", "ccc", "deichmann", "bata", "humanic", "sportisimo", "amazon.de", "amazon", "amzn", "aliexpress", "ali express", "temu", "shein", "wish", "ebay", "allegro", "answear", "footshop", "bonprix", "bonami", "mountfield", "eshop", "e-shop", "kosmetika", "parfumy", "sephora", "douglas", "marionnaud", "fann", "klenoty", "hodinky", "obuv", "obleceni"] },
  { cat: "vending", keywords: ["delikomat", "dallmayr", "vending", "kavomat", "prodejni automat", "napojovy automat", "samoobsluzny automat", "automat na kavu"] },
  { cat: "cash", keywords: ["vyber z bankomatu", "vyber hotovosti", "bankomat", "atm", "cash withdrawal", "withdrawal", "cashback"] },
  { cat: "fees", keywords: ["bankovni poplatek", "mesicni poplatek", "poplatek za vedeni", "poplatek", "poplatky", "provize", "bank charge", "service charge", "card fee", "account fee", "maintenance fee", "fee", "fees"] },
  { cat: "other", keywords: ["prevod", "transfer", "odchozi platba", "trvaly prikaz", "inkaso", "vlastni ucet", "mezi ucty", "sporeni", "sporici ucet", "investice", "portu", "fondee", "etf", "trading212", "xtb", "revolut", "wise", "splatka uveru", "splatka", "uver", "pujcka", "kreditni karta", "dane", "financni urad", "cssz", "socialni pojisteni", "alimenty", "exekuce", "pokuta", "charita", "nadace", "clenstvi", "membership", "predplatne", "subscription", "paypal", "icloud", "apple.com", "microsoft", "google"] },
];

// Air Bank's own category (when present) beats keyword guessing.
export const AIRBANK_CAT_MAP: Record<string, CatKey> = {
  "bydleni": "housing",
  "jidlo a potraviny": "food",
  "jidlo": "food",
  "potraviny": "food",
  "doprava": "transport",
  "domacnost": "home",
  "zabava": "fun",
  "zdravi": "health",
  "nakupy": "shopping",
  "elektronika": "electronics",
  "restaurace": "eating",
  "stravovani": "eating",
  "vyber hotovosti": "cash",
  "vybery hotovosti": "cash",
  "poplatky": "fees",
  "bankovni sluzby": "fees",
};

// Short tokens that need a word boundary to avoid false positives.
// ("fee"/"fees" would otherwise substring-match "coffee", "feed", …)
const BOUNDED = new Set(["o2", "hbo", "cez", "eon", "dpp", "pid", "mhd", "mol", "omv", "atm", "vzp", "bata", "cd.cz", "ikea", "obi", "kik", "fee", "fees"]);

// Specific multi-word phrases only — a bare "zustatek"/"balance" would wrongly
// drop real transactions like "Úrok ze zůstatku" (interest credited).
const SUMMARY_KEYWORDS = [
  "pocatecni zustatek", "konecny zustatek", "zustatek po transakci", "disponibilni zustatek",
  "pocatecni stav uctu", "konecny stav uctu", "opening balance", "closing balance",
  "balance carried", "balance brought", "brought forward", "carried forward",
  "mezisoucet", "suma za obdobi", "celkem za obdobi", "celkem za", "obrat za", "total for",
];

/** Map a transaction description / native category to a spending category. */
export function guessCategory(text: string, nativeCategory?: string | null): CatKey {
  if (nativeCategory) {
    const nat = AIRBANK_CAT_MAP[foldAscii(nativeCategory)];
    if (nat) return nat;
  }
  const hay = foldAscii(text);
  if (!hay) return "other";
  for (const { cat, keywords } of CAT_KEYWORDS) {
    for (const kw of keywords) {
      if (BOUNDED.has(kw)) {
        const re = new RegExp("(^|[^a-z0-9])" + escapeRe(kw) + "([^a-z0-9]|$)");
        if (re.test(hay)) return cat;
      } else if (hay.includes(kw)) {
        return cat;
      }
    }
  }
  return "other";
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Number parsing ──────────────────────────────────────────────────────────────
/** Parse a money string to an unsigned magnitude + sign + detected currency token. */
export function parseAmount(raw: string): { value: number | null; sign: 1 | -1; currencyToken: string | null } {
  if (raw == null) return { value: null, sign: 1, currencyToken: null };
  let s = String(raw).trim();
  if (!s) return { value: null, sign: 1, currencyToken: null };

  // normalise the many unicode minus glyphs to ASCII "-"
  s = s.replace(/[\u2212\u2012\u2013\u2014\uFE63\uFF0D]/g, "-");

  let sign: 1 | -1 = 1;
  if (/^\(.*\)$/.test(s)) { sign = -1; s = s.slice(1, -1).trim(); }
  if (/^\s*-/.test(s) || /-\s*$/.test(s)) sign = -1;

  // currency token (record before we strip non-digits)
  let currencyToken: string | null = null;
  const tok = s.match(/(kč|kc|czk|eur|usd|gbp|chf|huf|pln|€|\$|£|zł|zl|ft)/i);
  if (tok) currencyToken = CURRENCY_TOKEN_TO_ISO[tok[1].toLowerCase()] ?? null;

  // strip everything but digits / separators — this also removes spaces, NBSP,
  // narrow-NBSP, thin spaces and apostrophe groupers in one shot.
  const digits = s.replace(/[^\d.,]/g, "");
  if (!digits) return { value: null, sign, currencyToken };

  const hasDot = digits.includes(".");
  const hasComma = digits.includes(",");
  let canonical = digits;

  if (hasDot && hasComma) {
    // last-occurring separator is the decimal point
    if (digits.lastIndexOf(",") > digits.lastIndexOf(".")) {
      canonical = digits.replace(/\./g, "").replace(",", ".");
    } else {
      canonical = digits.replace(/,/g, "");
    }
  } else if (hasComma) {
    const parts = digits.split(",");
    const last = parts[parts.length - 1];
    canonical = (parts.length === 2 && last.length >= 1 && last.length <= 2)
      ? parts[0] + "." + last
      : digits.replace(/,/g, "");
  } else if (hasDot) {
    const parts = digits.split(".");
    const last = parts[parts.length - 1];
    canonical = (parts.length === 2 && last.length >= 1 && last.length <= 2)
      ? digits
      : digits.replace(/\./g, "");
  }

  const value = Number(canonical);
  if (!isFinite(value)) return { value: null, sign, currencyToken };
  return { value, sign, currencyToken };
}

// ─── Date parsing ────────────────────────────────────────────────────────────────
function finalizeDate(y: number, mon: number, day: number, rawDate: string): { iso: string | null; rawDate: string } {
  if (mon < 1 || mon > 12 || day < 1 || y < 1900 || y > 2200) return { iso: null, rawDate };
  const dim = new Date(y, mon, 0).getDate();
  if (day > dim) return { iso: null, rawDate };
  const iso = `${y}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { iso, rawDate };
}

function pivotYear(raw: string): number {
  const y = parseInt(raw, 10);
  if (raw.length === 2) return y <= 69 ? 2000 + y : 1900 + y;
  return y;
}

export function parseDate(
  raw: string,
  periodHint?: { start: string | null; end: string | null },
  dayFirst?: boolean,
): { iso: string | null; rawDate: string } {
  const rawDate = String(raw ?? "").trim();
  if (!rawDate) return { iso: null, rawDate };

  // drop a trailing time / GMT offset
  let s = rawDate.replace(/[T ]\d{1,2}:\d{2}(:\d{2})?.*$/, "").replace(/\+\d{2}:\d{2}$/, "").trim();

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return finalizeDate(+m[1], +m[2], +m[3], rawDate);

  m = s.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{2,4})$/);
  if (m) return finalizeDate(pivotYear(m[3]), +m[2], +m[1], rawDate);

  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const a = +m[1], b = +m[2], y = pivotYear(m[3]);
    let day: number, mon: number;
    if (a > 12 && b <= 12) { day = a; mon = b; }
    else if (b > 12 && a <= 12) { day = b; mon = a; }
    else if (resolveDayFirst(a, b, y, periodHint, dayFirst)) { day = a; mon = b; }
    else { day = b; mon = a; }
    return finalizeDate(y, mon, day, rawDate);
  }

  return { iso: null, rawDate };
}

function resolveDayFirst(
  a: number, b: number, y: number,
  periodHint?: { start: string | null; end: string | null },
  dayFirst?: boolean,
): boolean {
  // A definite column-wide inference (or explicit option) is authoritative — it
  // must not be overridden per-cell by the period range, or one column could end
  // up with mixed DD/MM and MM/DD interpretations.
  if (dayFirst !== undefined) return dayFirst;
  if (periodHint?.start && periodHint?.end) {
    const pad = (n: number) => String(n).padStart(2, "0");
    const ddmm = `${y}-${pad(b)}-${pad(a)}`;
    const mmdd = `${y}-${pad(a)}-${pad(b)}`;
    const inRange = (iso: string) => iso >= periodHint.start! && iso <= periodHint.end!;
    const okDDMM = a <= 31 && b <= 12 && inRange(ddmm);
    const okMMDD = a <= 12 && b <= 31 && inRange(mmdd);
    if (okDDMM && !okMMDD) return true;
    if (okMMDD && !okDDMM) return false;
  }
  return true; // default European day-first
}

/** Decide DD/MM vs MM/DD for a column of slash-dates from cross-row evidence. */
function inferDayFirst(cells: string[]): boolean | undefined {
  let dayFirst = 0, monthFirst = 0;
  for (const c of cells) {
    const m = String(c).trim().match(/^(\d{1,2})\/(\d{1,2})\/\d{2,4}$/);
    if (!m) continue;
    const a = +m[1], b = +m[2];
    if (a > 12 && b <= 12) dayFirst++;
    else if (b > 12 && a <= 12) monthFirst++;
  }
  if (dayFirst && !monthFirst) return true;
  if (monthFirst && !dayFirst) return false;
  return undefined;
}

// ─── CSV / matrix helpers ────────────────────────────────────────────────────────
/** RFC4180-ish field split: honours double quotes and "" escapes. */
export function splitLine(line: string, delimiter: string | null): string[] {
  if (delimiter === null) return line.split(/\s{2,}|\t/).map((c) => c.trim()).filter((c) => c !== "");
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === delimiter) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function countFields(line: string, delimiter: string): number {
  return splitLine(line, delimiter).length;
}

export function detectDelimiter(lines: string[]): { delimiter: string | null; mode: ParseMode } {
  const sample = lines.slice(0, SAMPLE_ROWS);
  const candidates = [";", "\t", "|", ","];
  let best: { delimiter: string; score: number; modal: number } | null = null;

  for (const d of candidates) {
    const counts = sample.map((l) => countFields(l, d)).filter((n) => n >= 1);
    if (!counts.length) continue;
    const freq = new Map<number, number>();
    for (const c of counts) freq.set(c, (freq.get(c) ?? 0) + 1);
    let modal = 0, modalHits = 0;
    for (const [val, hits] of freq) if (hits > modalHits) { modal = val; modalHits = hits; }
    if (modal < 2) continue;
    const score = modalHits / counts.length;
    if (score >= 0.6 && (!best || score > best.score)) best = { delimiter: d, score, modal };
  }

  if (best) return { delimiter: best.delimiter, mode: "delimited" };

  // whitespace fallback: usable only if most lines split into ≥2 columns
  const wsCols = sample.map((l) => l.split(/\s{2,}|\t/).length);
  const multi = wsCols.filter((n) => n >= 2).length;
  if (multi >= Math.max(2, Math.floor(sample.length * 0.5))) return { delimiter: null, mode: "whitespace" };

  return { delimiter: null, mode: "freeform" };
}

function toMatrix(lines: string[], delimiter: string | null): string[][] {
  return lines.map((l) => splitLine(l, delimiter)).filter((r) => r.some((c) => c !== ""));
}

// ─── Header + column mapping ─────────────────────────────────────────────────────
function roleOf(cell: string): string | null {
  const f = foldAscii(cell);
  if (!f) return null;
  for (const role of ["date", "amount", "debit", "credit", "currency", "nativeCategory", "counterparty", "description", "balance"]) {
    if (ROLE_SYNONYMS[role].includes(f)) return role;
  }
  // looser contains-match for compound headers (e.g. "Částka v měně účtu")
  for (const role of ["date", "amount", "debit", "credit", "currency", "nativeCategory", "counterparty", "description"]) {
    if (ROLE_SYNONYMS[role].some((syn) => syn.length >= 5 && f.includes(syn))) return role;
  }
  return null;
}

function detectHeader(matrix: string[][]): { headerIndex: number; header: string[] | null } {
  const scan = Math.min(matrix.length, 10);
  let bestIdx = -1, bestScore = 0;
  for (let i = 0; i < scan; i++) {
    const row = matrix[i];
    const hasDate = row.some((c) => parseDate(c).iso !== null);
    const hasAmount = row.some((c) => parseAmount(c).value !== null && /\d/.test(c));
    if (hasDate || hasAmount) continue;
    const hits = row.filter((c) => roleOf(c) !== null).length;
    if (hits >= 2 && hits > bestScore) { bestScore = hits; bestIdx = i; }
  }
  return bestIdx >= 0 ? { headerIndex: bestIdx, header: matrix[bestIdx] } : { headerIndex: -1, header: null };
}

function emptyMap(): ColumnMap {
  return { date: -1, amount: null, debit: null, credit: null, description: null, counterparty: null, currency: null, nativeCategory: null, amountMode: "signed" };
}

function autoMapColumns(header: string[] | null, dataRows: string[][], override?: Partial<ColumnMap>): ColumnMap {
  const map = emptyMap();

  if (header) {
    header.forEach((cell, i) => {
      const role = roleOf(cell);
      if (!role || role === "balance") return;
      switch (role) {
        case "date": if (map.date < 0) map.date = i; break;
        case "amount": if (map.amount === null) map.amount = i; break;
        case "debit": if (map.debit === null) map.debit = i; break;
        case "credit": if (map.credit === null) map.credit = i; break;
        case "description": if (map.description === null) map.description = i; break;
        case "counterparty": if (map.counterparty === null) map.counterparty = i; break;
        case "currency": if (map.currency === null) map.currency = i; break;
        case "nativeCategory": if (map.nativeCategory === null) map.nativeCategory = i; break;
      }
    });
  }

  // type inference for anything still unmapped
  const cols = Math.max(0, ...dataRows.map((r) => r.length));
  const sample = dataRows.slice(0, SAMPLE_ROWS);
  const colScore = (i: number, pred: (c: string) => boolean) =>
    sample.length ? sample.filter((r) => r[i] !== undefined && r[i] !== "" && pred(r[i])).length / sample.length : 0;

  if (map.date < 0) {
    let best = -1, bestS = 0.3;
    for (let i = 0; i < cols; i++) { const s = colScore(i, (c) => parseDate(c).iso !== null); if (s > bestS) { bestS = s; best = i; } }
    map.date = best;
  }
  if (map.amount === null && map.debit === null && map.credit === null) {
    const numeric: { i: number; s: number }[] = [];
    for (let i = 0; i < cols; i++) {
      if (i === map.date) continue;
      const s = colScore(i, (c) => parseAmount(c).value !== null && /\d/.test(c));
      if (s > 0.5) numeric.push({ i, s });
    }
    if (numeric.length) {
      // prefer the non-monotonic numeric column (a monotonic one is a running balance)
      const isMono = (i: number) => {
        const vals = sample.map((r) => parseAmount(r[i] ?? "").value).filter((v): v is number => v !== null);
        if (vals.length < 3) return false;
        let inc = true, dec = true;
        for (let k = 1; k < vals.length; k++) { if (vals[k] < vals[k - 1]) inc = false; if (vals[k] > vals[k - 1]) dec = false; }
        return inc || dec;
      };
      const nonMono = numeric.filter((n) => !isMono(n.i));
      map.amount = (nonMono[0] ?? numeric[0]).i;
    }
  }
  if (map.description === null) {
    let best = -1, bestLen = 0;
    for (let i = 0; i < cols; i++) {
      if (i === map.date || i === map.amount || i === map.currency) continue;
      const avg = sample.reduce((a, r) => a + (r[i]?.length ?? 0), 0) / (sample.length || 1);
      const texty = colScore(i, (c) => /[a-zà-ž]/i.test(c) && parseAmount(c).value === null);
      if (texty > 0.5 && avg > bestLen) { bestLen = avg; best = i; }
    }
    if (best >= 0) map.description = best;
  }
  if (map.currency === null) {
    for (let i = 0; i < cols; i++) {
      if (colScore(i, (c) => KNOWN_CODES.has(c.trim().toUpperCase())) > 0.7) { map.currency = i; break; }
    }
  }

  map.amountMode = (map.amount === null && (map.debit !== null || map.credit !== null)) ? "debitCredit" : "signed";

  if (override) {
    for (const k of Object.keys(override) as (keyof ColumnMap)[]) {
      const v = override[k];
      if (v !== undefined) (map as unknown as Record<string, unknown>)[k] = v;
    }
  }
  return map;
}

// ─── Period + currency ───────────────────────────────────────────────────────────
function detectPeriod(lines: string[], fallbackDates: string[]): { start: string | null; end: string | null } {
  const labelRe = /(obdob[ií]\s*v[ýy]pisu|za obdob[ií]|v[ýy]pis za|statement period|period|zeitraum)/i;
  const rangeRe = /(\d{1,2}\.\s?\d{1,2}\.\s?\d{2,4}|\d{4}-\d{1,2}-\d{1,2})\s*(?:[-–—]|az|až|do)\s*(\d{1,2}\.\s?\d{1,2}\.\s?\d{2,4}|\d{4}-\d{1,2}-\d{1,2})/i;

  for (const line of lines) {
    if (!labelRe.test(line)) continue;
    const m = line.match(rangeRe);
    if (m) {
      const start = parseDate(m[1]).iso;
      const end = parseDate(m[2]).iso;
      if (start && end) return { start, end };
    }
  }
  // any line with a clean range, even without the label
  for (const line of lines) {
    const m = line.match(rangeRe);
    if (m) {
      const start = parseDate(m[1]).iso;
      const end = parseDate(m[2]).iso;
      if (start && end) return { start, end };
    }
  }
  // derive from min/max of parsed transaction dates
  const sorted = [...fallbackDates].filter(Boolean).sort();
  if (sorted.length) return { start: sorted[0], end: sorted[sorted.length - 1] };
  return { start: null, end: null };
}

function detectCurrency(
  rows: string[][], map: ColumnMap, header: string[] | null,
  tokens: string[], opts?: ParseOptions,
): string {
  // 1. explicit currency column
  if (map.currency !== null) {
    const freq = new Map<string, number>();
    for (const r of rows) {
      const raw = (r[map.currency] ?? "").trim().toUpperCase();
      const iso = KNOWN_CODES.has(raw) ? raw : CURRENCY_TOKEN_TO_ISO[raw.toLowerCase()];
      if (iso) freq.set(iso, (freq.get(iso) ?? 0) + 1);
    }
    const top = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) return top[0];
  }
  // 2. currency code embedded in the amount header ("Částka CZK")
  if (header && map.amount !== null) {
    const h = (header[map.amount] ?? "").toUpperCase();
    for (const code of KNOWN_CODES) if (h.includes(code)) return code;
    if (/KČ|KC/i.test(header[map.amount] ?? "")) return "CZK";
  }
  // 3. scraped tokens
  if (tokens.length) {
    const freq = new Map<string, number>();
    for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
    const top = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) return top[0];
  }
  // 4. hint / Strategie default
  const hint = (opts?.currencyHint ?? "").toUpperCase();
  if (KNOWN_CODES.has(hint)) return hint;
  return "CZK";
}

// ─── Noise + dedup ───────────────────────────────────────────────────────────────
function isSummaryRow(cells: string[]): boolean {
  const joined = foldAscii(cells.join(" "));
  return SUMMARY_KEYWORDS.some((kw) => joined.includes(kw));
}

function dedupeFees(txns: ParsedTxn[]): ParsedTxn[] {
  // Only collapse a fee line that immediately repeats the prior row's amount+date.
  // We deliberately do NOT drop generic same-day/same-amount duplicates: two real
  // coffees or two tram tickets are legitimate, and the Review step lets the user
  // exclude any row they consider redundant.
  const out: ParsedTxn[] = [];
  for (const t of txns) {
    const prev = out[out.length - 1];
    const feeLike = /poplat|fee|charge|provize/.test(foldAscii(t.description));
    if (prev && feeLike && prev.isoDate === t.isoDate && Math.abs(prev.amount) === Math.abs(t.amount)) continue;
    out.push(t);
  }
  return out;
}

// ─── Base conversion ─────────────────────────────────────────────────────────────
/** display value → USD-base (matches StatementEditor.toBase). No rounding. */
export function toBaseAmount(displayValue: number, currencyCode: string): number {
  const rate = CURRENCIES[currencyCode]?.rate;
  return Math.abs(displayValue) / (rate && rate > 0 ? rate : 1);
}

// ─── Row → IncomeRow / ExpenseRow ────────────────────────────────────────────────
let rowCounter = 1;
function rowId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* ignore */ }
  return "imp-" + Math.abs(Math.floor(Math.sin(rowCounter++) * 1e9)).toString(36);
}

/** Build the additive byMonth map from a set of transactions. */
export function buildMonthStatements(txns: ParsedTxn[]): Record<string, MonthStatement> {
  const out: Record<string, MonthStatement> = Object.create(null);
  for (const t of txns) {
    if (!/^\d{4}-\d{2}$/.test(t.monthKey)) continue;
    if (!out[t.monthKey]) out[t.monthKey] = { income: [], expenses: [] };
    const amt = toBaseAmount(t.amount, t.currencyCode);
    if (t.kind === "income") {
      const row: IncomeRow = { id: rowId(), label: t.description || t.counterparty || "Income", amt, kind: "other" };
      out[t.monthKey].income.push(row);
    } else {
      const row: ExpenseRow = { id: rowId(), label: t.description || t.counterparty || "Expense", amt, cat: t.cat, date: t.isoDate };
      out[t.monthKey].expenses.push(row);
    }
  }
  return out;
}

// ─── Orchestrator ────────────────────────────────────────────────────────────────
export function parseStatement(rawText: string, opts: ParseOptions = {}): StatementParseResult {
  const text = String(rawText ?? "").replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const allLines = text.split("\n").slice(0, MAX_LINES).map((l) => (l.length > MAX_LINE_LENGTH ? l.slice(0, MAX_LINE_LENGTH) : l));
  const lines = allLines.filter((l) => l.trim() !== "");

  const meta: StatementMeta = {
    delimiter: null, mode: "freeform", currency: opts.currencyHint?.toUpperCase() ?? "CZK",
    periodStart: null, periodEnd: null, columnMap: emptyMap(), headerCells: [],
    headerIndex: -1, rowsParsed: 0, rowsSkipped: 0, skippedLines: [], decimalSep: ",",
  };

  if (!lines.length) return { transactions: [], byMonth: {}, meta };

  const { delimiter, mode } = detectDelimiter(lines);
  meta.delimiter = delimiter;
  meta.mode = mode;

  // period scan runs over the full raw lines (header preamble included)
  const period = detectPeriod(allLines, []);

  let transactions: ParsedTxn[] = [];

  if (mode !== "freeform") {
    const matrix = toMatrix(lines, delimiter);
    const { headerIndex, header } = detectHeader(matrix);
    meta.headerIndex = headerIndex;
    const dataRows = matrix.filter((_, i) => i !== headerIndex);
    const map = autoMapColumns(header, dataRows, opts.columnMap);
    meta.columnMap = map;
    meta.headerCells = header
      ? header.map((c, i) => c.trim() || `Column ${i + 1}`)
      : Array.from({ length: Math.max(0, ...dataRows.map((r) => r.length)) }, (_, i) => `Column ${i + 1}`);

    const tokens: string[] = [];
    // Only trust a period scraped from a header banner here; deriving it from the
    // dates we are about to parse would be circular (and bias day/month order).
    const periodHint = period.start && period.end ? period : { start: null, end: null };
    // Decide slash-date day/month order from the whole column, not per cell
    // (e.g. 04/15 + 04/20 prove it's MM/DD even though 04/02 is ambiguous).
    const dayFirst = opts.dayFirst ?? (map.date >= 0 ? inferDayFirst(dataRows.map((r) => r[map.date] ?? "")) : undefined);

    let commaDecimal = 0, dotDecimal = 0;
    const isoDates: string[] = [];

    if (map.date >= 0) {
      for (const r of dataRows) {
        const dateCell = r[map.date] ?? "";
        const { iso, rawDate } = parseDate(dateCell, periodHint, dayFirst);

        // resolve amount + sign
        let signed: number | null = null;
        if (map.amountMode === "debitCredit") {
          const deb = map.debit !== null ? parseAmount(r[map.debit] ?? "") : { value: null, sign: 1 as const, currencyToken: null };
          const cre = map.credit !== null ? parseAmount(r[map.credit] ?? "") : { value: null, sign: 1 as const, currencyToken: null };
          const d = deb.value ?? 0, c = cre.value ?? 0;
          if (deb.value === null && cre.value === null) signed = null;
          else signed = c - d;
          if (deb.currencyToken) tokens.push(deb.currencyToken);
          if (cre.currencyToken) tokens.push(cre.currencyToken);
          for (const ci of [map.debit, map.credit]) {
            const cell = ci !== null ? (r[ci] ?? "") : "";
            if (/,\d{1,2}\b/.test(cell)) commaDecimal++;
            else if (/\.\d{1,2}\b/.test(cell) && !cell.includes(",")) dotDecimal++;
          }
        } else if (map.amount !== null) {
          const a = parseAmount(r[map.amount] ?? "");
          if (a.value !== null) signed = a.sign * a.value;
          if (a.currencyToken) tokens.push(a.currencyToken);
          const cell = r[map.amount] ?? "";
          if (/,\d{1,2}\b/.test(cell)) commaDecimal++;
          else if (/\.\d{1,2}\b/.test(cell) && !cell.includes(",")) dotDecimal++;
        }

        if (signed === null || iso === null || isSummaryRow(r)) {
          meta.rowsSkipped++;
          if (meta.skippedLines.length < MAX_SKIPPED_LINES) meta.skippedLines.push(r.join(delimiter ?? "  ").trim());
          continue;
        }

        const description = map.description !== null ? (r[map.description] ?? "").trim() : "";
        const counterparty = map.counterparty !== null ? (r[map.counterparty] ?? "").trim() : "";
        const nativeCategory = map.nativeCategory !== null ? (r[map.nativeCategory] ?? "").trim() || null : null;
        const rowCur = map.currency !== null ? normalizeCode(r[map.currency] ?? "") : null;
        const kind: TxnKind = signed >= 0 ? "income" : "expense";

        isoDates.push(iso);
        transactions.push({
          rawDate, isoDate: iso, description, counterparty, amount: signed,
          currencyCode: rowCur ?? "", nativeCategory,
          cat: guessCategory(`${description} ${counterparty}`, nativeCategory),
          kind, monthKey: iso.slice(0, 7),
        });
      }
    }

    meta.decimalSep = commaDecimal >= dotDecimal ? "," : ".";
    meta.currency = detectCurrency(dataRows, map, header, tokens, opts);
    // period: banner if present, otherwise the span of the dates we actually kept
    if (periodHint.start && periodHint.end) {
      meta.periodStart = periodHint.start;
      meta.periodEnd = periodHint.end;
    } else if (isoDates.length) {
      const sorted = [...isoDates].sort();
      meta.periodStart = sorted[0];
      meta.periodEnd = sorted[sorted.length - 1];
    }
  }

  // freeform fallback (or when structured parse found nothing)
  if (!transactions.length) {
    const ff = parseFreeform(lines, period, opts);
    transactions = ff.txns;
    meta.mode = "freeform";
    meta.delimiter = null;
    meta.rowsSkipped = ff.skipped;
    meta.skippedLines = ff.skippedLines;
    meta.periodStart = period.start ?? ff.period.start;
    meta.periodEnd = period.end ?? ff.period.end;
    meta.currency = ff.tokens.length ? mode2currency(ff.tokens, opts) : (opts.currencyHint?.toUpperCase() ?? "CZK");
    meta.headerCells = ["Date", "Description", "Amount"];
  }

  // resolve per-row currency: default to statement currency when no per-row code
  for (const t of transactions) if (!t.currencyCode) t.currencyCode = meta.currency;

  transactions = dedupeFees(transactions);
  meta.rowsParsed = transactions.length;

  const byMonth = buildMonthStatements(transactions);
  return { transactions, byMonth, meta };
}

function normalizeCode(raw: string): string | null {
  const up = raw.trim().toUpperCase();
  if (KNOWN_CODES.has(up)) return up;
  const tok = CURRENCY_TOKEN_TO_ISO[raw.trim().toLowerCase()];
  return tok ?? null;
}

function mode2currency(tokens: string[], opts?: ParseOptions): string {
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top) return top[0];
  const hint = (opts?.currencyHint ?? "").toUpperCase();
  return KNOWN_CODES.has(hint) ? hint : "CZK";
}

// per-line "date … amount" extraction for copied PDF text
function parseFreeform(
  lines: string[], period: { start: string | null; end: string | null }, opts: ParseOptions,
): { txns: ParsedTxn[]; skipped: number; skippedLines: string[]; tokens: string[]; period: { start: string | null; end: string | null } } {
  const txns: ParsedTxn[] = [];
  const tokens: string[] = [];
  const skippedLines: string[] = [];
  let skipped = 0;
  const skip = (line: string) => {
    skipped++;
    if (skippedLines.length < MAX_SKIPPED_LINES) skippedLines.push(line.trim());
  };
  const dateHead = /^\s*(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\.\s?\d{1,2}\.\s?\d{2,4}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/;
  // Anchored at the trimmed line-end and requires a real money shape: a 2-digit
  // decimal group (",dd"/".dd") OR a trailing currency token. This avoids
  // swallowing a long variable/reference integer as the amount. No trailing
  // \s* slack (line is trimEnd'd first) and a single grouping class → no
  // catastrophic backtracking on pathological input.
  const amountTail = /([+-]?\(?\d{1,3}(?:[.\s]?\d{3})*[.,]\d{2}\)?-?|[+-]?\d{1,3}(?:[.\s]?\d{3})*)\s?(kč|kc|czk|eur|usd|gbp|€|\$|£)?$/i;
  const hasMoneyShape = /[.,]\d{2}(?:[)\s-]|$)|(?:kč|kc|czk|eur|usd|gbp|€|\$|£)\s*$/i;

  for (const line of lines) {
    const dm = line.match(dateHead);
    if (!dm) { if (!period.start) { /* maybe period line */ } continue; }
    const { iso, rawDate } = parseDate(dm[1], period, opts.dayFirst);
    if (!iso) { skip(line); continue; }
    const rest = line.slice(dm[0].length).trimEnd();
    const am = rest.match(amountTail);
    // reject identifier-shaped tails (no decimals and no currency token)
    if (am && !hasMoneyShape.test(am[0])) { skip(line); continue; }
    if (!am) { skip(line); continue; }
    const a = parseAmount(am[1]);
    if (a.value === null) { skip(line); continue; }
    if (a.currencyToken) tokens.push(a.currencyToken);
    const description = rest.slice(0, rest.length - am[0].length).trim();
    if (isSummaryRow([description])) { skip(line); continue; }
    const signed = a.sign * a.value;
    txns.push({
      rawDate, isoDate: iso, description, counterparty: "", amount: signed,
      currencyCode: "", nativeCategory: null, cat: guessCategory(description),
      kind: signed >= 0 ? "income" : "expense", monthKey: iso.slice(0, 7),
    });
  }
  return { txns, skipped, skippedLines, tokens, period };
}
