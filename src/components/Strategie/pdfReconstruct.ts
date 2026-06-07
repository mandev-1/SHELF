// Pure (pdfjs-free, DOM-free) reconstruction of PDF text fragments into
// whitespace-aligned rows the statement parser can read. Split out from
// pdfText.ts so it can be unit-tested without loading pdfjs.
//
// PDF text arrives as positioned fragments, not rows. We group fragments into
// visual lines by y-position and turn large x-gaps into column breaks (≥2
// spaces), which the parser's whitespace mode splits on.

export interface PdfTextItem {
  str?: string;
  transform?: number[]; // [a, b, c, d, e=x, f=y]
  width?: number;
}

export function reconstructPage(items: PdfTextItem[]): string {
  const Y_TOL = 3;
  const rows: { y: number; cells: { x: number; w: number; str: string }[] }[] = [];
  let totalW = 0, totalChars = 0;

  for (const it of items) {
    if (typeof it.str !== "string" || it.str === "" || !it.transform) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    const w = it.width ?? 0;
    totalW += w;
    totalChars += it.str.length || 1;
    let row = rows.find((r) => Math.abs(r.y - y) <= Y_TOL);
    if (!row) { row = { y, cells: [] }; rows.push(row); }
    row.cells.push({ x, w, str: it.str });
  }

  const avgChar = totalChars > 0 ? totalW / totalChars : 4;
  rows.sort((a, b) => b.y - a.y); // PDF y grows upward → render top-to-bottom

  const lines: string[] = [];
  for (const row of rows) {
    const cells = row.cells.sort((a, b) => a.x - b.x);
    let line = "";
    let prevEnd: number | null = null;
    for (const c of cells) {
      if (prevEnd !== null) {
        const gap = c.x - prevEnd;
        if (gap > avgChar * 1.8) line += "   ";      // column break → ≥2 spaces
        else if (gap > avgChar * 0.4) line += " ";    // inter-word space
      }
      line += c.str;
      prevEnd = c.x + c.w;
    }
    const trimmed = line.replace(/\s+$/, "");
    if (trimmed) lines.push(trimmed);
  }
  return lines.join("\n");
}
