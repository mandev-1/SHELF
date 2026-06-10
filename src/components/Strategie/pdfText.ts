// ─────────────────────────────────────────────────────────────────────────────
// pdfText.ts — local PDF → text extraction for the statement importer.
//
// Lazy-imported by StatementImport (only when a user drops a PDF), so pdfjs
// (~1 MB) never weighs down the main new-tab bundle. Fully local & security-
// first: the worker is bundled from the extension's own packaged assets (no
// CDN / no remote code), eval is disabled, streaming/auto-fetch are off, and no
// network request is made. We extract text only — we never render the PDF.
//
// PDF text comes as positioned fragments, not rows. reconstructPage groups them
// into visual lines by y-position and inserts column gaps (2+ spaces) from large
// x-gaps, so the output is whitespace-aligned text the parser can read.
// ─────────────────────────────────────────────────────────────────────────────

import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { reconstructPage, type PdfTextItem } from "./pdfReconstruct";
import { extractAirBankText } from "./airbankParse";

// Bundled, same-origin extension asset — satisfies MV3 CSP (script-src 'self').
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export async function extractPdfText(file: File): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({
    data,
    isEvalSupported: false,
    disableAutoFetch: true,
    disableStream: true,
  }).promise;
  try {
    const rawPages: PdfTextItem[][] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      rawPages.push(content.items as PdfTextItem[]);
      page.cleanup();
    }
    // Try format-specific extractors first (Air Bank packs transactions across
    // 2–3 lines under a stacked header — generic whitespace reconstruction
    // would break each transaction into multiple fake rows).
    const airBank = extractAirBankText(rawPages);
    if (airBank) return airBank;
    return rawPages.map(reconstructPage).join("\n");
  } finally {
    await doc.destroy();
  }
}
