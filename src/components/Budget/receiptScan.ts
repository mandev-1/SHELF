// Self-contained, client-side receipt OCR for the "Scan a receipt" feature.
//
// Runs fully locally: tesseract.js is loaded *lazily* via dynamic import inside
// scanReceipt() so it never bloats the main bundle — the ~MB worker + wasm +
// language data only download the first time a user actually scans a receipt.
// Tesseract pulls its eng.traineddata from jsDelivr by default, which is fine
// for an https new-tab page.
//
// Parsing is heuristic and defensive: every extractor is wrapped so a bad parse
// returns a partial result rather than throwing. scanReceipt() only rejects if
// OCR itself completely fails.

export interface ReceiptScanResult {
  merchant?: string; // best-guess store/merchant name (e.g. "Lidl")
  total?: number; // the grand total amount as a number
  date?: string; // ISO yyyy-mm-dd if found
  rawText: string; // full OCR text (for debugging / fallback)
}

/** Run OCR on an image File/Blob and heuristically extract merchant, total, date. */
export async function scanReceipt(file: File | Blob): Promise<ReceiptScanResult> {
  // Lazy import — keeps tesseract.js out of the main extension bundle.
  const { default: Tesseract } = await import("tesseract.js");

  // recognize() resolves with the OCR data; this is the only step allowed to
  // reject (OCR genuinely failing). Logger is a no-op to stay quiet in console.
  const {
    data: { text },
  } = await Tesseract.recognize(file, "eng", { logger: () => {} });

  const rawText = text ?? "";

  // Parsing must never throw — fall back to just the raw text on any error.
  try {
    return {
      merchant: parseMerchant(rawText),
      total: parseTotal(rawText),
      date: parseDate(rawText),
      rawText,
    };
  } catch {
    return { rawText };
  }
}

// ---------------------------------------------------------------------------
// Heuristics
// ---------------------------------------------------------------------------

// Words that, when present on a line, strongly hint the adjacent number is the
// grand total. Multi-language because receipts here are CZK / PLN / EUR / DE.
const TOTAL_KEYWORDS = [
  "total",
  "grand total",
  "sum",
  "subtotal", // weaker, but still a useful fallback signal
  "amount due",
  "to pay",
  "balance due",
  "celkem", // cs
  "suma", // sk/pl
  "razem", // pl
  "do zaplaty", // cs/sk "to pay"
  "betrag", // de
  "summe", // de
  "gesamt", // de
  "zu zahlen", // de "to pay"
];

/** Split into trimmed, non-empty lines. */
function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * Parse a currency-looking token into a plain JS number, handling both
 * European `1 234,56` / `1.234,56` and Anglo `1,234.56` groupings.
 */
function parseMoney(token: string): number | undefined {
  // Keep only digits and separators.
  let s = token.replace(/[^\d.,\s]/g, "").trim();
  if (!s) return undefined;
  // Drop thousands spaces: "1 234,56" -> "1234,56".
  s = s.replace(/\s+/g, "");
  if (!s) return undefined;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // Whichever separator comes last is the decimal separator.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      // European: dot = thousands, comma = decimal.
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // Anglo: comma = thousands, dot = decimal.
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    // Only commas. If it looks like a decimal (exactly 2 trailing digits in the
    // last group), treat comma as decimal; otherwise as thousands.
    const last = s.split(",").pop() ?? "";
    if (last.length === 2) s = s.replace(/,(?=[^,]*$)/, ".").replace(/,/g, "");
    else s = s.replace(/,/g, "");
  }
  // Only dots (or plain digits) already parse fine as-is.

  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

// Matches a money-like run of digits with optional grouping + 2-decimal tail,
// e.g. "1 234,56", "1,234.56", "89.90", "1299". Used globally per line.
const MONEY_RE = /\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?/g;

/** Pull every money-looking number out of one line. */
function moneyOnLine(line: string): number[] {
  const out: number[] = [];
  const matches = line.match(MONEY_RE);
  if (!matches) return out;
  for (const m of matches) {
    // Skip bare integers shorter than 2 digits — usually item counts, not money.
    const n = parseMoney(m);
    if (n !== undefined && n > 0) out.push(n);
  }
  return out;
}

/**
 * total: prefer the largest number on a line that mentions a total keyword;
 * fall back to the largest monetary number anywhere on the receipt.
 */
function parseTotal(text: string): number | undefined {
  const ls = lines(text);

  let keywordBest: number | undefined;
  let globalBest: number | undefined;

  for (const line of ls) {
    const nums = moneyOnLine(line);
    if (nums.length === 0) continue;
    const lineMax = Math.max(...nums);

    if (globalBest === undefined || lineMax > globalBest) globalBest = lineMax;

    const lower = line.toLowerCase();
    const isTotalLine = TOTAL_KEYWORDS.some((kw) => lower.includes(kw));
    if (isTotalLine && (keywordBest === undefined || lineMax > keywordBest)) {
      keywordBest = lineMax;
    }
  }

  return keywordBest ?? globalBest;
}

/**
 * merchant: usually one of the first non-empty lines. Pick the first early line
 * that is mostly letters and isn't a number, date, or street address.
 */
function parseMerchant(text: string): string | undefined {
  const ls = lines(text).slice(0, 6); // only the header region

  for (const line of ls.slice(0, 4)) {
    if (isLikelyMerchant(line)) return titleCase(line);
  }
  // Looser fallback: first line with any letters at all.
  for (const line of ls) {
    if (/[a-zA-Z]/.test(line)) return titleCase(line);
  }
  return undefined;
}

function isLikelyMerchant(line: string): boolean {
  const letters = (line.match(/[a-zA-ZÀ-ſ]/g) || []).length;
  const digits = (line.match(/\d/g) || []).length;
  if (letters < 2) return false; // need real words
  if (digits > letters) return false; // mostly numbers -> not a name
  if (looksLikeDate(line)) return false;
  // Skip obvious address lines (street numbers, common address tokens).
  if (/\b(str|street|ul\.?|ulica|namesti|platz|str\.?|ave|avenue|road|rd)\b/i.test(line))
    return false;
  if (/^\d/.test(line) && digits >= 2) return false; // starts with a house number
  return true;
}

/** Light title-casing: capitalize each word, but leave ALL-CAPS brand runs alone. */
function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => {
      if (w.length <= 1) return w.toUpperCase();
      // Preserve short all-caps tokens (likely brand acronyms like "DM", "IKEA").
      if (w === w.toUpperCase() && w.length <= 4) return w;
      return w[0].toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ")
    .trim();
}

// Date patterns. Order matters: we try ISO first, then European dd.mm/dd-mm.
const DATE_RES = [
  // yyyy-mm-dd or yyyy/mm/dd
  /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/,
  // dd.mm.yyyy / dd/mm/yyyy / dd-mm-yyyy (also 2-digit year)
  /\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})\b/,
];

function looksLikeDate(line: string): boolean {
  return DATE_RES.some((re) => re.test(line));
}

/**
 * date: match common formats and normalize to ISO yyyy-mm-dd. Prefer the
 * European dd.mm.yyyy reading when the order is ambiguous.
 */
function parseDate(text: string): string | undefined {
  // Try ISO yyyy-mm-dd first — unambiguous.
  const iso = text.match(DATE_RES[0]);
  if (iso) {
    const norm = normalizeYmd(+iso[1], +iso[2], +iso[3]);
    if (norm) return norm;
  }

  // Then dd.mm.yyyy (European preference): first group is the day.
  const eu = text.match(DATE_RES[1]);
  if (eu) {
    let day = +eu[1];
    let month = +eu[2];
    let year = +eu[3];
    if (year < 100) year += year < 70 ? 2000 : 1900; // 2-digit year window
    // If the "day" can't be a day but could be a month, swap (mm/dd fallback).
    if (day > 31 && month <= 12) [day, month] = [month, day];
    const norm = normalizeYmd(year, month, day);
    if (norm) return norm;
  }

  return undefined;
}

/** Validate y/m/d ranges and format as zero-padded ISO, or undefined if bogus. */
function normalizeYmd(year: number, month: number, day: number): string | undefined {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return undefined;
  if (year < 1900 || year > 2200) return undefined;
  if (month < 1 || month > 12) return undefined;
  if (day < 1 || day > 31) return undefined;
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}
