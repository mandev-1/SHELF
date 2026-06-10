// ─────────────────────────────────────────────────────────────────────────────
// airbankParse.ts — structural extractor for Czech-style multi-line bank
// statement PDFs (primarily Air Bank, but the heuristic is format-agnostic).
//
// Why this exists: pdf.js exposes positioned text fragments, not rows. The
// generic whitespace reconstruction in pdfReconstruct.ts produces one text
// line per visual line — but Air Bank packs each transaction across 2–3
// visual lines (Zaúčtování/Provedení dates, multi-line Typ/Detaily, account
// number on a second row). The downstream freeform parser then grabs the
// "Poplatky" fee column as the amount, returning every row as +0 Kč.
//
// Approach: work from row content, with header x-positions as column anchors.
//   • Group pdf.js items into lines by y-position.
//   • The stacked header (Zaúčtování/Provedení · Typ/Kód transakce ·
//     Název/Číslo účtu · Detaily · Částka CZK · Poplatky) gives us the x
//     anchor of each text column, so Typ / Název / Detaily stay separate
//     instead of collapsing into one description blob.
//   • A line that starts with DD.MM.YYYY *and* contains a signed money value
//     is a transaction-start. Rightmost money = fee, second-rightmost = amount,
//     the text cells between the date and the amount bucket into columns by x.
//   • Lines without a starting date (or with a date but no money — that's the
//     Provedení / value-date sub-row) attach to the current transaction.
//   • Page footers (`Pokračování na straně N`, branding strip) stop the page.
//   • The accumulated transactions are emitted as a semicolon-delimited CSV
//     whose Czech headers the generic parser's role detector maps natively.
//     Without header anchors (other Czech banks) everything lands in Detaily,
//     which matches the old single-blob behavior.
// ─────────────────────────────────────────────────────────────────────────────

import type { PdfTextItem } from "./pdfReconstruct";

interface Cell { x: number; w: number; str: string; }
interface Line { y: number; cells: Cell[]; }

/** x-positions of the left edges of the text columns, from the page header. */
interface ColAnchors { typ: number | null; name: number | null; detail: number | null; }

export interface AirBankRow {
  date: string;
  typ: string;
  name: string;
  detail: string;
  amount: string;
  fee: string;
}

const DATE_RE = /^\d{1,2}\.\s?\d{1,2}\.\s?\d{2,4}$/;
// Signed money with optional thousands grouping (space, NBSP, dot) and a
// 2-digit decimal group. Excludes pure integers (account numbers, codes).
const MONEY_RE = /^[+-]?\d{1,3}(?:[\s.   ]?\d{3})*[.,]\d{2}$/;
// 10+ pure digits = Air Bank "Kód transakce" reference — drop from description.
const TRANSACTION_CODE_RE = /^\d{10,}$/;

function fold(s: string): string {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function isMoneyStr(s: string): boolean {
  return MONEY_RE.test(s.trim());
}

/** A cell whose content is purely digits / sign / spaces / decimal punct —
 *  safe to glue to an adjacent cell when reconstructing a split money value. */
function isNumericish(s: string): boolean {
  const t = s.trim();
  return t !== "" && /^[+\-\s\d.,]+$/.test(t);
}

/** Scan from right to left and return up to `maxRanges` money values, each as
 *  a range of cell indices. pdf.js occasionally splits `-1 500,00` into
 *  pieces like ["-1", " ", "500,00"] — this function glues consecutive
 *  numeric-ish cells back together when the joined result looks like money. */
function rightmostMoneyRanges(
  cells: Cell[],
  maxRanges: number,
): { start: number; end: number; value: string }[] {
  const out: { start: number; end: number; value: string }[] = [];
  let cursor = cells.length - 1;
  while (cursor >= 0 && out.length < maxRanges) {
    let bestStart = -1;
    let bestValue = "";
    let probe = cursor;
    while (probe >= 0 && isNumericish(cells[probe].str)) {
      const joined = cells.slice(probe, cursor + 1).map((c) => c.str).join("").trim();
      if (isMoneyStr(joined)) {
        bestStart = probe;
        bestValue = joined;
      }
      probe--;
    }
    if (bestStart >= 0) {
      out.unshift({ start: bestStart, end: cursor, value: bestValue });
      cursor = bestStart - 1;
    } else {
      cursor--;
    }
  }
  return out;
}

/**
 * Returns a synthetic CSV when the PDF looks like a Czech-style dated/money
 * transaction table (Air Bank, ČSOB, KB exports often share this shape).
 * Returns null otherwise so the caller falls back to generic reconstruction.
 */
export function extractAirBankText(pages: PdfTextItem[][]): string | null {
  const rows: AirBankRow[] = [];
  // Column anchors persist across pages: continuation pages may repeat the
  // header, but if one doesn't, the previous page's geometry still applies.
  const anchors: ColAnchors = { typ: null, name: null, detail: null };
  for (const items of pages) rows.push(...parsePage(items, anchors));
  // Require a meaningful number of transactions before we trust this format —
  // otherwise a PDF with stray date-and-money lines (invoice, receipt) would
  // be hijacked.
  if (rows.length < 3) return null;
  return rowsToCsv(rows);
}

function groupLines(items: PdfTextItem[], yTol = 3): Line[] {
  const lines: Line[] = [];
  for (const it of items) {
    if (typeof it.str !== "string" || it.str === "" || !it.transform) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    const w = it.width ?? 0;
    let line = lines.find((l) => Math.abs(l.y - y) <= yTol);
    if (!line) { line = { y, cells: [] }; lines.push(line); }
    line.cells.push({ x, w, str: it.str });
  }
  for (const l of lines) l.cells.sort((a, b) => a.x - b.x);
  lines.sort((a, b) => b.y - a.y); // PDF y grows upward → top-to-bottom
  return lines;
}

function isFooter(text: string): boolean {
  const t = fold(text);
  return (
    t.includes("pokracovani na strane") ||
    t.includes("airbank.cz") ||
    t.includes("air bank a.s") ||
    t.includes("i banku muzete mit radi") ||
    t.includes("spolecnost zapsana")
  );
}

/** Try to read a leading date from the first few cells of a line. pdf.js can
 *  split `01.05.2026` into pieces like ["01", ".", "05", ".", "2026"], so we
 *  concatenate left-to-right until we match a date or run out. */
function leadingDate(cells: Cell[]): { match: string; consumed: number } | null {
  let acc = "";
  for (let i = 0; i < Math.min(cells.length, 5); i++) {
    acc += cells[i].str.trim();
    if (DATE_RE.test(acc)) return { match: acc, consumed: i + 1 };
    if (acc.length > 12) return null;
  }
  return null;
}

/** Learn column x-anchors from the stacked header rows. Header cells are
 *  left-aligned with their column's data, so the cell's own x is the anchor. */
function learnAnchors(cells: Cell[], anchors: ColAnchors): void {
  for (const c of cells) {
    const t = fold(c.str).trim();
    if (t === "typ") anchors.typ = c.x;
    else if (t === "nazev" || t.startsWith("nazev ") || t.startsWith("nazev/")) anchors.name = c.x;
    else if (t === "detaily") anchors.detail = c.x;
    // second header row — fallbacks in case the first row's cells came merged
    else if (t.startsWith("kod transakce") && anchors.typ === null) anchors.typ = c.x;
    else if (t.startsWith("cislo uctu") && anchors.name === null) anchors.name = c.x;
  }
}

// Data cells can start a hair left of the header glyphs — small tolerance.
const ANCHOR_TOL = 4;

/** Which text column a cell belongs to. Without full anchors, everything is
 *  "detail" (the old single-blob behavior). */
function bucketOf(x: number, a: ColAnchors): "typ" | "name" | "detail" {
  if (a.typ === null || a.name === null || a.detail === null) return "detail";
  if (x >= a.detail - ANCHOR_TOL) return "detail";
  if (x >= a.name - ANCHOR_TOL) return "name";
  return "typ";
}

function parsePage(items: PdfTextItem[], anchors: ColAnchors): AirBankRow[] {
  const lines = groupLines(items);
  const rows: AirBankRow[] = [];
  let cur: AirBankRow | null = null;

  const norm = (s: string) => s.replace(/\s+/g, " ").trim();

  const appendCell = (row: AirBankRow, cell: Cell) => {
    const key = bucketOf(cell.x, anchors);
    row[key] = norm(`${row[key]} ${cell.str}`);
  };

  for (const line of lines) {
    const joined = line.cells.map((c) => c.str).join(" ");
    if (isFooter(joined)) break;

    const cells = line.cells;
    if (!cells.length) continue;

    learnAnchors(cells, anchors);

    const lead = leadingDate(cells);
    const money = rightmostMoneyRanges(cells, 2);

    if (lead && money.length >= 1) {
      // New transaction. Rightmost money range = fee, second-rightmost = amount.
      if (cur) rows.push(cur);
      const amountRange = money.length >= 2 ? money[money.length - 2] : money[0];
      const feeRange = money.length >= 2 ? money[money.length - 1] : null;
      cur = {
        date: lead.match,
        typ: "", name: "", detail: "",
        amount: amountRange.value,
        fee: feeRange ? feeRange.value : "",
      };
      for (const cell of cells.slice(lead.consumed, amountRange.start)) {
        if (cell.str.trim()) appendCell(cur, cell);
      }
      continue;
    }

    if (!cur) continue;

    // Continuation. Pull non-date, non-money, non-trans-code text into the
    // current transaction's columns so categorization can use it.
    const moneyCellIdx = new Set<number>();
    for (const r of money) for (let i = r.start; i <= r.end; i++) moneyCellIdx.add(i);
    const skip = lead ? lead.consumed : 0;
    for (let i = skip; i < cells.length; i++) {
      if (moneyCellIdx.has(i)) continue;
      const s = cells[i].str.trim();
      if (!s) continue;
      if (DATE_RE.test(s)) continue;
      if (TRANSACTION_CODE_RE.test(s)) continue;
      appendCell(cur, cells[i]);
    }
  }
  if (cur) rows.push(cur);
  return rows;
}

function escapeCsv(s: string): string {
  if (/[;\n"]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows: AirBankRow[]): string {
  // Czech headers so the generic parser's role detector maps them: Datum→date,
  // "Název / číslo účtu"→counterparty, Detaily→description, "Částka CZK"→amount.
  // Typ and Poplatky stay unmapped but selectable in the Columns picker.
  const out: string[] = ["Datum;Typ;Název / číslo účtu;Detaily;Částka CZK;Poplatky"];
  for (const r of rows) {
    const typ = r.typ.trim();
    const detail = r.detail.trim();
    out.push([
      r.date.trim(),
      escapeCsv(typ),
      escapeCsv(r.name.trim()),
      // a row with no Detaily (e.g. "Obchodní úrok") still needs a description
      escapeCsv(detail || typ || "Transakce"),
      r.amount.trim(),
      r.fee.trim(),
    ].join(";"));
  }
  return out.join("\n");
}
