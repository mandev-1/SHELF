import { useState, useEffect, useRef, useCallback } from "react";
import type { CatKey, MonthStatement, IncomeRow, ExpenseRow } from "../../types/grid";
import { CURRENCIES, STMT_CATS, CAT_KEYS } from "./strategie";
import {
  parseStatement, toBaseAmount,
  type StatementParseResult, type ColumnMap, type TxnKind,
} from "./statementParse";
import {
  IcoX, IcoCheck, IcoUpload, IcoFile, IcoIn, IcoOut, IcoChev,
} from "./icons";

export interface StatementImportProps {
  currency: string;
  onClose: () => void;
  onImport: (additions: Record<string, MonthStatement>) => void;
}

interface ReviewRow {
  key: string;
  include: boolean;
  isoDate: string;
  monthKey: string;
  label: string;
  counterparty: string;
  kind: TxnKind;
  cat: CatKey;
  magnitude: number;     // abs display value
  currencyCode: string;
}

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* ignore */ }
  return "imp-" + Math.random().toString(36).slice(2);
}

function fmtCur(value: number, code: string): string {
  const entry = CURRENCIES[code] ?? CURRENCIES["USD"];
  try {
    return new Intl.NumberFormat(entry.locale, {
      style: "currency", currency: entry.code, maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${Math.round(value)} ${code}`;
  }
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

const ROLE_FIELDS: { key: keyof ColumnMap; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "amount", label: "Amount" },
  { key: "description", label: "Description" },
  { key: "counterparty", label: "Counterparty" },
  { key: "currency", label: "Currency" },
];

export function StatementImport({ currency, onClose, onImport }: StatementImportProps) {
  const [rawText, setRawText] = useState("");
  const [result, setResult] = useState<StatementParseResult | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [override, setOverride] = useState<Partial<ColumnMap>>({});
  const [showCols, setShowCols] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [encoding, setEncoding] = useState<"utf-8" | "windows-1250">("utf-8");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const bytesRef = useRef<ArrayBuffer | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const runParse = useCallback((text: string, ov: Partial<ColumnMap>) => {
    const res = parseStatement(text, { currencyHint: currency, columnMap: ov });
    setResult(res);
    // Carry the user's review edits across a re-parse (encoding toggle, column
    // remap) by matching on the stable date+magnitude identity, so a re-decode
    // doesn't silently reset every include / in-out / label / category choice.
    setRows((prev) => {
      const idOf = (iso: string, mag: number) => `${iso}|${Math.round(mag * 100)}`;
      const prevByKey = new Map(prev.map((r) => [idOf(r.isoDate, r.magnitude), r]));
      return res.transactions.map((t, i) => {
        const mag = Math.abs(t.amount);
        const prevR = prevByKey.get(idOf(t.isoDate, mag));
        return {
          key: `${i}-${t.isoDate}-${t.amount}-${t.description.slice(0, 8)}`,
          include: prevR ? prevR.include : true,
          isoDate: t.isoDate,
          monthKey: t.monthKey,
          label: prevR ? prevR.label : (t.description || t.counterparty || ""),
          counterparty: t.counterparty,
          kind: prevR ? prevR.kind : t.kind,
          cat: prevR ? prevR.cat : t.cat,
          magnitude: mag,
          currencyCode: t.currencyCode,
        };
      });
    });
  }, [currency]);

  // single re-parse path: whenever the raw text or column override changes
  useEffect(() => {
    if (rawText.trim()) runParse(rawText, override);
    else { setResult(null); setRows([]); }
  }, [rawText, override, runParse]);

  // own Escape handling (StatementEditor defers while this is open)
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [onClose]);

  const decodeBytes = useCallback((buf: ArrayBuffer, enc: string) => {
    try { return new TextDecoder(enc).decode(buf); }
    catch { return new TextDecoder().decode(buf); }
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setOverride({});
    setFileName(file.name);
    setLoadError(null);
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (isPdf) {
      bytesRef.current = null; // a PDF can't be re-decoded as text by the encoding toggle
      setLoading(true);
      try {
        const { extractPdfText } = await import("./pdfText"); // lazy — pdfjs only loads for PDFs
        const text = await extractPdfText(file);
        setRawText(text);
        if (!text.trim()) setLoadError("This PDF has no extractable text — it may be a scan. Export CSV from your bank, or paste the text.");
      } catch {
        setRawText("");
        setLoadError("Couldn't read this PDF. Export a CSV from your bank, or paste the statement text instead.");
      } finally {
        setLoading(false);
      }
      return;
    }
    const buf = await file.arrayBuffer();
    bytesRef.current = buf;
    setEncoding("utf-8");
    setRawText(decodeBytes(buf, "utf-8"));
  }, [decodeBytes]);

  // re-decode an already-loaded file when the encoding toggle flips
  useEffect(() => {
    if (bytesRef.current) setRawText(decodeBytes(bytesRef.current, encoding));
  }, [encoding, decodeBytes]);

  const startOver = () => {
    bytesRef.current = null;
    setFileName(null);
    setRawText("");
    setOverride({});
    setResult(null);
    setRows([]);
    setShowCols(false);
    setLoadError(null);
    setLoading(false);
  };

  const setRow = (key: string, patch: Partial<ReviewRow>) =>
    setRows((rs) => rs.map((r) => r.key === key ? { ...r, ...patch } : r));

  const included = rows.filter((r) => r.include);
  const incRows = included.filter((r) => r.kind === "income");
  const expRows = included.filter((r) => r.kind === "expense");
  const incSum = incRows.reduce((a, r) => a + r.magnitude, 0);
  const expSum = expRows.reduce((a, r) => a + r.magnitude, 0);
  const months = [...new Set(included.map((r) => r.monthKey))].sort();
  const curCode = result?.meta.currency ?? currency;

  const doImport = () => {
    const additions: Record<string, MonthStatement> = {};
    for (const r of included) {
      if (!/^\d{4}-\d{2}$/.test(r.monthKey)) continue;
      if (!additions[r.monthKey]) additions[r.monthKey] = { income: [], expenses: [] };
      const amt = toBaseAmount(r.magnitude, r.currencyCode);
      if (r.kind === "income") {
        const row: IncomeRow = { id: newId(), label: r.label || r.counterparty || "Income", amt, kind: "other" };
        additions[r.monthKey].income.push(row);
      } else {
        const row: ExpenseRow = { id: newId(), label: r.label || r.counterparty || "Expense", amt, cat: r.cat, date: r.isoDate };
        additions[r.monthKey].expenses.push(row);
      }
    }
    onImport(additions);
  };

  const hasRows = rows.length > 0;
  const parsedEmpty = !!result && rows.length === 0 && rawText.trim().length > 0;

  return (
    <div className="se-backdrop si-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="se-modal si-modal" role="dialog" aria-modal="true" aria-label="Import bank statement">
        <div className="se-head">
          <div className="se-head-l">
            <div className="se-eyebrow"><IcoUpload /> Import</div>
            <h2 className="se-title">Bring in a bank statement</h2>
            <p className="se-lede">
              Paste your statement or drop a <code>.csv</code>/<code>.txt</code>/<code>.pdf</code> export.
              It's parsed right here on your device — nothing is uploaded, and nothing is saved until you hit Import.
            </p>
          </div>
          <button className="se-close" onClick={onClose} aria-label="Close"><IcoX /></button>
        </div>

        <div className="se-body si-body">
          {!hasRows && (
            <div
              className={"si-drop" + (dragOver ? " si-drop--over" : "")}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault(); setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
            >
              <textarea
                className="si-textarea"
                aria-label="Paste bank-statement transactions"
                placeholder={"Paste your transactions here…\n\nExample:\nDatum;Protistrana;Detaily;Částka;Měna\n01.05.2026;Albert;Nákup;-1 234,56;CZK\n03.05.2026;Mzda;Výplata;42 000,00;CZK"}
                value={rawText}
                onChange={(e) => { bytesRef.current = null; setFileName(null); setRawText(e.target.value); }}
                spellCheck={false}
              />
              <div className="si-drop-foot">
                <button className="si-filebtn" onClick={() => fileRef.current?.click()} disabled={loading}>
                  <IcoFile /> Choose .csv / .txt / .pdf file
                </button>
                {fileName && (
                  <span className="si-filename">
                    {fileName}
                    {bytesRef.current && (
                      <button
                        className="si-enc"
                        title="Toggle text encoding if Czech characters look garbled"
                        onClick={() => setEncoding((e) => e === "utf-8" ? "windows-1250" : "utf-8")}
                      >
                        {encoding === "utf-8" ? "UTF-8" : "CP1250"}
                      </button>
                    )}
                  </span>
                )}
                <span className="si-privacy">
                  <LockGlyph /> Stays on your device
                </span>
              </div>
              {loading && (
                <div className="si-loading"><span className="si-spinner" /> Reading PDF on your device…</div>
              )}
              {loadError && <div className="si-warn">{loadError}</div>}
              {parsedEmpty && !loadError && (
                <div className="si-warn">
                  Couldn't find any transactions. Check that rows have a date and an amount,
                  or use <b>Columns</b> after pasting to map them manually.
                </div>
              )}
            </div>
          )}

          {hasRows && result && (
            <>
              <div className="si-meta">
                <div className="si-meta-left">
                  <span className="si-chip"><b>{result.meta.currency}</b></span>
                  {result.meta.periodStart && result.meta.periodEnd && (
                    <span className="si-chip">{result.meta.periodStart} → {result.meta.periodEnd}</span>
                  )}
                  <span className="si-chip si-chip--dim">
                    {result.meta.rowsParsed} found
                    {result.meta.rowsSkipped > 0 ? ` · ${result.meta.rowsSkipped} skipped` : ""}
                  </span>
                  <span className="si-chip si-chip--dim">{result.meta.mode}</span>
                </div>
                <div className="si-meta-right">
                  {result.meta.mode !== "freeform" && (
                    <button
                      className={"si-link" + (showCols ? " on" : "")}
                      onClick={() => setShowCols((v) => !v)}
                      aria-expanded={showCols}
                    >
                      <IcoChev dir={showCols ? "down" : "right"} /> Columns
                    </button>
                  )}
                  {fileName && (
                    <button
                      className="si-link"
                      onClick={() => setEncoding((e) => e === "utf-8" ? "windows-1250" : "utf-8")}
                      title="Toggle text encoding if Czech characters look garbled"
                    >
                      {encoding === "utf-8" ? "UTF-8" : "CP1250"}
                    </button>
                  )}
                  <button className="si-link" onClick={startOver}>Start over</button>
                </div>
              </div>

              {showCols && result.meta.mode !== "freeform" && (
                <div className="si-cols">
                  {ROLE_FIELDS.map((f) => (
                    <label key={f.key} className="si-col-field">
                      <span className="si-col-lab">{f.label}</span>
                      <select
                        className="se-cat si-colsel"
                        value={String((override[f.key] ?? result.meta.columnMap[f.key]) ?? -1)}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setOverride((o) => ({ ...o, [f.key]: v < 0 ? null : v }));
                        }}
                      >
                        <option value="-1">— none —</option>
                        {result.meta.headerCells.map((h, i) => (
                          <option key={i} value={String(i)}>{h}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              )}

              <div className="si-summary">
                <div className="si-sum si-sum--in">
                  <span className="si-sum-lab"><span className="se-pill se-pill--in"><IcoIn /></span> {incRows.length} income</span>
                  <b>{fmtCur(incSum, curCode)}</b>
                  {incRows.length > 0 && <small className="si-sum-note">added as monthly income — adjust in the statement after import</small>}
                </div>
                <div className="si-sum si-sum--out">
                  <span className="si-sum-lab"><span className="se-pill se-pill--out"><IcoOut /></span> {expRows.length} spending</span>
                  <b>{fmtCur(expSum, curCode)}</b>
                </div>
                <div className="si-sum si-sum--net">
                  <span className="si-sum-lab">{months.length} month{months.length === 1 ? "" : "s"}</span>
                  <b className="si-months">{months.map(monthLabel).join(", ") || "—"}</b>
                </div>
              </div>

              <div className="si-table" role="table">
                <div className="si-thead" role="row">
                  <span className="si-th si-th--chk" role="columnheader"></span>
                  <span className="si-th si-th--date" role="columnheader">Date</span>
                  <span className="si-th si-th--dir" role="columnheader">In/Out</span>
                  <span className="si-th si-th--label" role="columnheader">What</span>
                  <span className="si-th si-th--cat" role="columnheader">Category</span>
                  <span className="si-th si-th--amt" role="columnheader">Amount</span>
                </div>
                {rows.map((r) => (
                  <div className={"si-trow" + (r.include ? "" : " si-trow--off")} role="row" key={r.key}>
                    <span className="si-td si-td--chk" role="cell">
                      <button
                        className={"si-chk" + (r.include ? " on" : "")}
                        onClick={() => setRow(r.key, { include: !r.include })}
                        aria-pressed={r.include} aria-label={r.include ? "Exclude row" : "Include row"}
                      >
                        {r.include ? <IcoCheck /> : null}
                      </button>
                    </span>
                    <span className="si-td si-td--date" role="cell" title={r.monthKey}>{r.isoDate}</span>
                    <span className="si-td si-td--dir" role="cell">
                      <button
                        className={"si-dir si-dir--" + r.kind}
                        onClick={() => setRow(r.key, { kind: r.kind === "income" ? "expense" : "income" })}
                        title="Toggle income / spending"
                      >
                        {r.kind === "income" ? <><IcoIn /> In</> : <><IcoOut /> Out</>}
                      </button>
                    </span>
                    <span className="si-td si-td--label" role="cell">
                      <input
                        className="se-label si-label"
                        value={r.label}
                        placeholder={r.counterparty || "Description"}
                        onChange={(e) => setRow(r.key, { label: e.target.value })}
                      />
                    </span>
                    <span className="si-td si-td--cat" role="cell">
                      {r.kind === "expense" ? (
                        <select
                          className="se-cat si-cat"
                          value={r.cat}
                          onChange={(e) => setRow(r.key, { cat: e.target.value as CatKey })}
                        >
                          {CAT_KEYS.map((k) => <option key={k} value={k}>{STMT_CATS[k].label}</option>)}
                        </select>
                      ) : <span className="si-dash">—</span>}
                    </span>
                    <span role="cell" className={"si-td si-td--amt " + (r.kind === "income" ? "si-pos" : "si-neg")}>
                      {r.kind === "income" ? "+" : "−"}{fmtCur(r.magnitude, r.currencyCode)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="se-foot si-foot">
          <div className="si-foot-note">
            {hasRows
              ? <><LockGlyph /> {included.length} of {rows.length} rows will merge into the editor — review &amp; Save there to keep them.</>
              : <><LockGlyph /> 100% local · nothing leaves this tab</>}
          </div>
          <div className="se-actions">
            <button className="se-btn se-btn--ghost" onClick={onClose}>Cancel</button>
            <button
              className="se-btn se-btn--primary"
              onClick={doImport}
              disabled={included.length === 0}
            >
              <IcoUpload /> Import {included.length || ""} {included.length === 1 ? "row" : "rows"}
            </button>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,.pdf,text/csv,text/plain,application/pdf"
          className="si-fileinput"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.currentTarget.value = "";
          }}
        />
      </div>
    </div>
  );
}

function LockGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <rect x="2.5" y="5.5" width="7" height="5" rx="1.4" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
