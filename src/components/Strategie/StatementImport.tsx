import { Fragment, useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { CatKey, MonthStatement, IncomeRow, ExpenseRow, SavingsPlan } from "../../types/grid";
import { CURRENCIES, STMT_CATS, CAT_KEYS_BY_LABEL } from "./strategie";
import {
  parseStatement, toBaseAmount, foldAscii,
  type StatementParseResult, type ColumnMap, type TxnKind,
} from "./statementParse";
import {
  IcoX, IcoCheck, IcoUpload, IcoFile, IcoIn, IcoOut, IcoChev,
} from "./icons";

export interface StatementImportProps {
  currency: string;
  /** Current statement book (editor draft) — used to flag re-imported duplicates. */
  existing?: Record<string, MonthStatement>;
  /** Savings programs rows can be tagged as contributions to. */
  savingsPlans?: SavingsPlan[];
  /** Edit mode: review one month's existing expense rows instead of parsing a
   *  statement. Apply replaces the month's expenses (unchecked rows = removed). */
  editRows?: { monthKey: string; expenses: ExpenseRow[]; scopeLabel?: string };
  onApplyEdits?: (monthKey: string, expenses: ExpenseRow[]) => void;
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
  dup: boolean;          // duplicate of an existing/earlier row — excluded by default
  savingsPlanId?: string; // tagged as a contribution to a savings program
  srcId?: string;         // edit mode: id of the ExpenseRow this came from
}

// faint statement-text fragments scattered around the drop zone (decoration)
const ALTAR_FRAGMENTS: { left: string; top: string; text: string; em?: boolean }[] = [
  { left: "5%",  top: "14%", text: "−1 234,56" },
  { left: "84%", top: "10%", text: "CZK" },
  { left: "88%", top: "42%", text: "Datum;Částka" },
  { left: "3%",  top: "58%", text: "01.05.2026" },
  { left: "79%", top: "80%", text: "+42 000,00", em: true },
  { left: "9%",  top: "86%", text: "Protistrana" },
  { left: "56%", top: "4%",  text: "Měna" },
  { left: "32%", top: "92%", text: "Výpis 05/2026" },
];

const IS_MAC = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform ?? "");

type SortKey = "date" | "kind" | "label" | "cpty" | "cat" | "amount";

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

// resizable review-table columns (px) — "What" stays fluid and absorbs the rest
type ResizableCol = "date" | "dir" | "cpty" | "cat" | "amt";
const COL_DEFAULTS: Record<ResizableCol, number> = { date: 100, dir: 80, cpty: 130, cat: 160, amt: 140 };
const COL_MIN: Record<ResizableCol, number> = { date: 64, dir: 56, cpty: 72, cat: 96, amt: 84 };
const COL_MAX = 520;

const ROLE_FIELDS: { key: keyof ColumnMap; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "amount", label: "Amount" },
  { key: "description", label: "Description" },
  { key: "counterparty", label: "Counterparty" },
  { key: "currency", label: "Currency" },
];

export function StatementImport({ currency, existing, savingsPlans = [], editRows, onApplyEdits, onClose, onImport }: StatementImportProps) {
  const editMode = !!editRows;
  const [rawText, setRawText] = useState("");
  const [result, setResult] = useState<StatementParseResult | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>(() => {
    if (!editRows) return [];
    const rate = CURRENCIES[currency]?.rate ?? 1;
    return editRows.expenses.map((e) => ({
      key: e.id,
      srcId: e.id,
      include: true,
      isoDate: e.date || "",
      // derive each row's month from its own date so a cross-month chart band
      // groups correctly in the review table (falls back to the scope month)
      monthKey: /^\d{4}-\d{2}/.test(e.date || "") ? e.date.slice(0, 7) : editRows.monthKey,
      label: e.label,
      counterparty: "",
      kind: "expense" as TxnKind,
      cat: e.cat,
      magnitude: e.amt * rate, // base → display; toBaseAmount round-trips on apply
      currencyCode: currency,
      dup: false,
      savingsPlanId: e.savingsPlanId,
    }));
  });
  const [override, setOverride] = useState<Partial<ColumnMap>>({});
  const [showCols, setShowCols] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [encoding, setEncoding] = useState<"utf-8" | "windows-1250">("utf-8");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  // bulk-edit selection — separate from the include checkbox (which means
  // "import this row"); click a row to select, shift-click for a range
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLabel, setBulkLabel] = useState("");
  const [bulkCat, setBulkCat] = useState("");
  // in-app leave confirmation (replaces the browser confirm on Esc / close)
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const lastSelIdxRef = useRef<number | null>(null);
  const [colW, setColW] = useState<Record<ResizableCol, number>>({ ...COL_DEFAULTS });

  const startResize = useCallback((key: ResizableCol) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = colW[key];
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const move = (ev: PointerEvent) => {
      const w = Math.max(COL_MIN[key], Math.min(COL_MAX, startW + (ev.clientX - startX)));
      setColW((c) => ({ ...c, [key]: w }));
    };
    const up = () => {
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [colW]);

  const resetCol = (key: ResizableCol) => setColW((c) => ({ ...c, [key]: COL_DEFAULTS[key] }));

  const bytesRef = useRef<ArrayBuffer | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // identity keys of rows already in the statement book — re-imports match these
  const existingKeys = useMemo(() => {
    const set = new Set<string>();
    if (!existing) return set;
    for (const mk of Object.keys(existing)) {
      for (const e of existing[mk].expenses) set.add(`e|${e.date}|${Math.round(e.amt * 100)}|${foldAscii(e.label)}`);
      for (const inc of existing[mk].income) set.add(`i|${Math.round(inc.amt * 100)}|${foldAscii(inc.label)}`);
    }
    return set;
  }, [existing]);

  const runParse = useCallback((text: string, ov: Partial<ColumnMap>) => {
    const res = parseStatement(text, { currencyHint: currency, columnMap: ov });
    setResult(res);
    setSelected(new Set()); // row keys change on re-parse
    lastSelIdxRef.current = null;
    // Carry the user's review edits across a re-parse (encoding toggle, column
    // remap) by matching on the stable date+magnitude identity, so a re-decode
    // doesn't silently reset every include / in-out / label / category choice.
    setRows((prev) => {
      const idOf = (iso: string, mag: number) => `${iso}|${Math.round(mag * 100)}`;
      const prevByKey = new Map(prev.map((r) => [idOf(r.isoDate, r.magnitude), r]));
      const seen = new Set<string>();
      return res.transactions.map((t, i) => {
        const mag = Math.abs(t.amount);
        const prevR = prevByKey.get(idOf(t.isoDate, mag));
        const label = prevR ? prevR.label : (t.description || t.counterparty || "");
        // duplicate = same (date, amount, label) seen earlier in this paste,
        // or already sitting in the statement book (matched in base currency)
        const innerKey = `${t.isoDate}|${Math.round(mag * 100)}|${foldAscii(label)}`;
        const baseCents = Math.round(toBaseAmount(mag, t.currencyCode) * 100);
        const bookKey = t.kind === "expense" || (prevR && prevR.kind === "expense")
          ? `e|${t.isoDate}|${baseCents}|${foldAscii(label)}`
          : `i|${baseCents}|${foldAscii(label)}`;
        const dup = seen.has(innerKey) || existingKeys.has(bookKey);
        seen.add(innerKey);
        // best-effort auto-tag: plan name appearing in the row's text
        const hay = foldAscii(`${t.description} ${t.counterparty}`);
        const planAuto = t.kind === "expense"
          ? savingsPlans.find((p) => hay.includes(foldAscii(p.name)))?.id
          : undefined;
        return {
          key: `${i}-${t.isoDate}-${t.amount}-${t.description.slice(0, 8)}`,
          include: prevR ? prevR.include : !dup,
          isoDate: t.isoDate,
          monthKey: t.monthKey,
          label,
          counterparty: t.counterparty,
          kind: prevR ? prevR.kind : t.kind,
          cat: prevR ? prevR.cat : t.cat,
          magnitude: mag,
          currencyCode: t.currencyCode,
          dup,
          savingsPlanId: prevR ? prevR.savingsPlanId : planAuto,
        };
      });
    });
  }, [currency, existingKeys, savingsPlans]);

  // single re-parse path: whenever the raw text or column override changes
  useEffect(() => {
    if (editMode) return; // edit mode rows come from the editor draft, not a parse
    if (rawText.trim()) runParse(rawText, override);
    else { setResult(null); setRows([]); }
  }, [rawText, override, runParse, editMode]);

  // own Escape handling (StatementEditor defers while this is open).
  // Esc opens the in-app leave dialog; a second Esc dismisses that dialog.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      setLeaveConfirm((open) => !open);
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, []);

  // "paste anywhere" — while the modal is in its empty state, a global ⌘V/Ctrl+V
  // drops the clipboard text straight into the parser (unless the user is
  // pasting into the manual textarea, which handles itself).
  useEffect(() => {
    if (editMode || rows.length > 0) return;
    const h = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT")) return;
      const text = e.clipboardData?.getData("text") ?? "";
      if (text.trim()) { bytesRef.current = null; setFileName(null); setRawText(text); }
    };
    window.addEventListener("paste", h);
    return () => window.removeEventListener("paste", h);
  }, [editMode, rows.length]);

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
    const edits = rows.length > 0 || rawText.trim() !== "";
    if (edits && !window.confirm(`Start over? This discards the ${rows.length} parsed row${rows.length === 1 ? "" : "s"} and any edits you've made here.`)) return;
    bytesRef.current = null;
    setFileName(null);
    setRawText("");
    setOverride({});
    setResult(null);
    setRows([]);
    setShowCols(false);
    setLoadError(null);
    setLoading(false);
    setSort(null);
    setShowManual(false);
    setSelected(new Set());
    setBulkLabel("");
    setBulkCat("");
    lastSelIdxRef.current = null;
  };

  const setRow = (key: string, patch: Partial<ReviewRow>) =>
    setRows((rs) => rs.map((r) => r.key === key ? { ...r, ...patch } : r));

  const included = rows.filter((r) => r.include);
  const incRows = included.filter((r) => r.kind === "income");
  const expRows = included.filter((r) => r.kind === "expense");
  const incSum = incRows.reduce((a, r) => a + r.magnitude, 0);
  const expSum = expRows.reduce((a, r) => a + r.magnitude, 0);
  const netSum = incSum - expSum;
  const months = [...new Set(included.map((r) => r.monthKey))].sort();
  const curCode = result?.meta.currency ?? currency;

  const allOn = rows.length > 0 && rows.every((r) => r.include);
  const toggleAll = () => setRows((rs) => rs.map((r) => ({ ...r, include: !allOn })));

  const cycleSort = (key: SortKey) =>
    setSort((s) => (s?.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null));
  const sortGlyph = (key: SortKey) => (sort?.key === key ? (sort.dir === 1 ? " ↑" : " ↓") : "");

  const sortVal = (r: ReviewRow, key: SortKey): string | number => {
    switch (key) {
      case "date": return r.isoDate;
      case "amount": return r.magnitude;
      case "kind": return r.kind;
      case "label": return r.label;
      case "cpty": return r.counterparty;
      case "cat":
        if (r.kind === "income") return "";
        if (r.savingsPlanId) return savingsPlans.find((p) => p.id === r.savingsPlanId)?.name ?? "";
        return (STMT_CATS[r.cat] || STMT_CATS.other).label;
    }
  };
  const displayRows = sort
    ? [...rows].sort((a, b) => {
        const va = sortVal(a, sort.key);
        const vb = sortVal(b, sort.key);
        const v = typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), undefined, { sensitivity: "base" });
        return v * sort.dir;
      })
    : rows;

  // click-and-drag selection: pointerdown on a row arms a drag; entering other
  // rows with the button held paints base-selection ∪ anchor..current range
  const dragAnchorRef = useRef<number | null>(null);
  const dragStartedRef = useRef(false);
  const dragBaseRef = useRef<Set<string>>(new Set());
  const suppressClickRef = useRef(false);

  useEffect(() => {
    const up = () => {
      if (dragStartedRef.current) {
        suppressClickRef.current = true; // swallow the click that follows a drag
        setTimeout(() => { suppressClickRef.current = false; }, 0);
        document.body.style.userSelect = "";
      }
      dragAnchorRef.current = null;
      dragStartedRef.current = false;
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  const onRowPointerDown = (e: React.PointerEvent, displayIdx: number) => {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest("button, input, select, label, a")) return;
    dragAnchorRef.current = displayIdx;
    dragStartedRef.current = false;
    dragBaseRef.current = new Set(selected);
    e.preventDefault(); // no native text-selection drag
  };

  const onRowPointerEnter = (e: React.PointerEvent, displayIdx: number) => {
    if (dragAnchorRef.current === null) return;
    if (!(e.buttons & 1)) { dragAnchorRef.current = null; return; }
    if (!dragStartedRef.current && displayIdx !== dragAnchorRef.current) {
      dragStartedRef.current = true;
      document.body.style.userSelect = "none";
    }
    if (!dragStartedRef.current) return;
    const [a, b] = [Math.min(dragAnchorRef.current, displayIdx), Math.max(dragAnchorRef.current, displayIdx)];
    const next = new Set(dragBaseRef.current);
    for (let i = a; i <= b; i++) next.add(displayRows[i].key);
    setSelected(next);
    lastSelIdxRef.current = displayIdx;
  };

  const onRowClick = (e: React.MouseEvent, key: string, displayIdx: number) => {
    if (suppressClickRef.current) return; // drag already did the selecting
    const t = e.target as HTMLElement;
    if (t.closest("button, input, select, label, a")) return; // interactive cells keep their behavior
    if (e.shiftKey) window.getSelection()?.removeAllRanges();
    setSelected((prev) => {
      const next = new Set(prev);
      if (e.shiftKey && lastSelIdxRef.current !== null) {
        const [a, b] = [Math.min(lastSelIdxRef.current, displayIdx), Math.max(lastSelIdxRef.current, displayIdx)];
        for (let i = a; i <= b; i++) next.add(displayRows[i].key);
      } else if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    lastSelIdxRef.current = displayIdx;
  };

  const applyBulk = () => {
    const label = bulkLabel.trim();
    if (!label && !bulkCat) return;
    setRows((rs) => rs.map((r) => {
      if (!selected.has(r.key)) return r;
      const patch: Partial<ReviewRow> = {};
      if (label) patch.label = label;
      if (bulkCat) {
        if (bulkCat.startsWith("plan:")) patch.savingsPlanId = bulkCat.slice(5);
        else { patch.cat = bulkCat as CatKey; patch.savingsPlanId = undefined; }
      }
      return { ...r, ...patch };
    }));
    setBulkLabel("");
    setBulkCat("");
  };

  const hasCpty = rows.some((r) => r.counterparty.trim() !== "");
  const dupCount = rows.filter((r) => r.dup).length;
  // month dividers only make sense in chronological-ish order
  const showDividers = months.length > 1 && (!sort || sort.key === "date");

  // edit mode: replace the month's expenses with the (kept) edited rows
  const doApplyEdits = () => {
    if (!editRows || !onApplyEdits) return;
    const out: ExpenseRow[] = included.map((r) => ({
      id: r.srcId ?? newId(),
      label: r.label || "Expense",
      amt: toBaseAmount(r.magnitude, r.currencyCode),
      cat: r.cat,
      date: r.isoDate,
      savingsPlanId: r.savingsPlanId || undefined,
    }));
    onApplyEdits(editRows.monthKey, out);
  };

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
        const row: ExpenseRow = {
          id: newId(), label: r.label || r.counterparty || "Expense", amt, cat: r.cat, date: r.isoDate,
          savingsPlanId: r.savingsPlanId || undefined,
        };
        additions[r.monthKey].expenses.push(row);
      }
    }
    onImport(additions);
  };

  const hasRows = rows.length > 0;
  const parsedEmpty = !!result && rows.length === 0 && rawText.trim().length > 0;

  // Blocking modal: backdrop clicks are inert — only Cancel / Import / X / Esc close it.
  return (
    <div className="se-backdrop si-backdrop">
      <div className={"se-modal si-modal" + (hasRows ? " si-modal--review" : "")} role="dialog" aria-modal="true" aria-label="Import bank statement">
        <div className="se-head">
          <div className="se-head-l">
            <div className="se-eyebrow"><IcoUpload /> {editMode ? "Bulk edit" : "Import"}</div>
            <h2 className="se-title">{editMode ? (editRows?.scopeLabel ? "Review the selected expenses" : "Review this month's expenses") : "Bring in a bank statement"}</h2>
            {editMode ? (
              <p className="se-lede">
                Sort, drag-select and bulk-rewrite the expense rows of {editRows?.scopeLabel ?? monthLabel(editRows!.monthKey)}.
                Unchecking a row removes it when you apply. Nothing is saved until you Save the statement.
              </p>
            ) : (
              <p className="se-lede">
                Paste your statement or drop a <code>.csv</code>/<code>.txt</code>/<code>.pdf</code> export.
                It's parsed right here on your device — nothing is uploaded, and nothing is saved until you hit Import.
              </p>
            )}
          </div>
          <button className="se-close" onClick={onClose} aria-label="Close"><IcoX /></button>
        </div>

        <div className="se-body si-body">
          {!hasRows && (
            <div
              className="si-stage"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault(); setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
            >
              {ALTAR_FRAGMENTS.map((f, i) => (
                <span
                  key={i}
                  className={"si-frag" + (f.em ? " si-frag--em" : "")}
                  style={{ left: f.left, top: f.top }}
                  aria-hidden="true"
                >
                  {f.text}
                </span>
              ))}

              {loading ? (
                <div className="si-parsing" role="status" aria-label="Parsing statement">
                  <div className="si-parsebar"><span /></div>
                  <div className="si-skel-rows">
                    <span className="si-skel" style={{ width: 34 }} /><span className="si-skel" style={{ width: "72%" }} /><span className="si-skel" style={{ width: 52 }} />
                    <span className="si-skel" style={{ width: 34 }} /><span className="si-skel" style={{ width: "57%" }} /><span className="si-skel" style={{ width: 52 }} />
                    <span className="si-skel" style={{ width: 34 }} /><span className="si-skel" style={{ width: "84%" }} /><span className="si-skel" style={{ width: 52 }} />
                    <span className="si-skel" style={{ width: 34 }} /><span className="si-skel" style={{ width: "63%" }} /><span className="si-skel" style={{ width: 52 }} />
                  </div>
                  <div className="si-parsing-cap">reading your statement on device…</div>
                </div>
              ) : (
                <button
                  type="button"
                  className={"si-altar" + (dragOver ? " si-altar--over" : "")}
                  onClick={() => fileRef.current?.click()}
                  aria-label="Drop, paste, or choose a statement file"
                >
                  <span className="si-tick si-tick--tl" aria-hidden="true" />
                  <span className="si-tick si-tick--tr" aria-hidden="true" />
                  <span className="si-tick si-tick--bl" aria-hidden="true" />
                  <span className="si-tick si-tick--br" aria-hidden="true" />
                  <span className="si-orb"><IcoUpload /></span>
                  <span className="si-altar-title">{dragOver ? "Release to parse" : "Drop your statement"}</span>
                  <span className="si-altar-sub">
                    or paste anywhere — <kbd className="si-kbd">{IS_MAC ? "⌘V" : "Ctrl+V"}</kbd> · click to browse
                  </span>
                  <span className="si-ftypes">
                    <span className="si-ftype">.csv</span>
                    <span className="si-ftype">.txt</span>
                    <span className="si-ftype">.pdf</span>
                  </span>
                </button>
              )}

              <div className="si-trust">
                <LockGlyph /> parsed on device <i>·</i> nothing uploaded <i>·</i> review before saving
              </div>

              {fileName && !loading && (
                <div className="si-filename">
                  <IcoFile /> {fileName}
                  {bytesRef.current && (
                    <button
                      className="si-enc"
                      title="Toggle text encoding if Czech characters look garbled"
                      onClick={() => setEncoding((e) => e === "utf-8" ? "windows-1250" : "utf-8")}
                    >
                      {encoding === "utf-8" ? "UTF-8" : "CP1250"}
                    </button>
                  )}
                </div>
              )}

              {!loading && (
                <button className="si-link si-manual-link" onClick={() => setShowManual((v) => !v)}>
                  <IcoChev dir={showManual ? "down" : "right"} /> type or edit as text
                </button>
              )}
              {showManual && !loading && (
                <textarea
                  className="si-textarea"
                  aria-label="Paste bank-statement transactions"
                  placeholder={"Paste your transactions here…\n\nExample:\nDatum;Protistrana;Detaily;Částka;Měna\n01.05.2026;Albert;Nákup;-1 234,56;CZK\n03.05.2026;Mzda;Výplata;42 000,00;CZK"}
                  value={rawText}
                  onChange={(e) => { bytesRef.current = null; setFileName(null); setRawText(e.target.value); }}
                  spellCheck={false}
                  autoFocus
                />
              )}

              {loadError && <div className="si-warn">{loadError}</div>}
              {parsedEmpty && !loadError && (
                <div className="si-warn">
                  Couldn't find any transactions. Check that rows have a date and an amount,
                  or open <b>type or edit as text</b> to fix the input manually.
                </div>
              )}
            </div>
          )}

          {hasRows && (
            <>
              {result && !editMode && (
              <div className="si-meta">
                <div className="si-meta-left">
                  <span className="si-chip"><b>{result.meta.currency}</b></span>
                  {result.meta.periodStart && result.meta.periodEnd && (
                    <span className="si-chip">{result.meta.periodStart} → {result.meta.periodEnd}</span>
                  )}
                  <span className="si-chip si-chip--ok"><IcoCheck /> {rows.length} recognized</span>
                  {dupCount > 0 && (
                    <span className="si-chip" title="Same date, amount and description as an existing or earlier row — excluded by default">
                      {dupCount} duplicate{dupCount === 1 ? "" : "s"}
                    </span>
                  )}
                  {result.meta.rowsSkipped > 0 && (
                    <span className="si-chip si-chip--warn">{result.meta.rowsSkipped} skipped</span>
                  )}
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
              )}

              {showCols && result && result.meta.mode !== "freeform" && (
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
                <div className="si-sum si-sum--bal">
                  <span className="si-sum-lab">Net</span>
                  <b className={netSum >= 0 ? "pos" : "neg"}>
                    {netSum >= 0 ? "+" : "−"}{fmtCur(Math.abs(netSum), curCode)}
                  </b>
                </div>
                <div className="si-sum si-sum--net">
                  <span className="si-sum-lab">{months.length} month{months.length === 1 ? "" : "s"}</span>
                  <b className="si-months">{months.map(monthLabel).join(", ") || "—"}</b>
                </div>
              </div>

              {selected.size > 0 && (
                <div className="si-bulk">
                  <span className="si-bulk-count">{selected.size} selected</span>
                  <input
                    className="si-bulk-input"
                    placeholder="Rewrite 'What' for all selected rows…"
                    value={bulkLabel}
                    onChange={(e) => setBulkLabel(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") applyBulk(); }}
                  />
                  <select className="se-cat si-bulk-cat" value={bulkCat} onChange={(e) => setBulkCat(e.target.value)}>
                    <option value="">Category — keep as is</option>
                    {CAT_KEYS_BY_LABEL.map((k) => <option key={k} value={k}>{STMT_CATS[k].label}</option>)}
                    {savingsPlans.length > 0 && (
                      <optgroup label="Savings plans">
                        {savingsPlans.map((p) => <option key={p.id} value={`plan:${p.id}`}>→ {p.name}</option>)}
                      </optgroup>
                    )}
                  </select>
                  <button
                    className="se-btn se-btn--primary si-bulk-apply"
                    onClick={applyBulk}
                    disabled={!bulkLabel.trim() && !bulkCat}
                  >
                    Apply to {selected.size}
                  </button>
                  <button className="si-link" onClick={() => { setSelected(new Set()); lastSelIdxRef.current = null; }}>
                    Clear selection
                  </button>
                </div>
              )}

              <div
                className={"si-table" + (hasCpty ? " si-table--cpty" : "")}
                role="table"
                style={{
                  "--si-c-date": `${colW.date}px`,
                  "--si-c-dir": `${colW.dir}px`,
                  "--si-c-cpty": `${colW.cpty}px`,
                  "--si-c-cat": `${colW.cat}px`,
                  "--si-c-amt": `${colW.amt}px`,
                } as React.CSSProperties}
              >
                <div className="si-thead" role="row">
                  <span className="si-th si-th--chk" role="columnheader">
                    <button
                      className={"si-chk si-chk--all" + (allOn ? " on" : "")}
                      onClick={toggleAll}
                      aria-pressed={allOn}
                      aria-label={allOn ? "Exclude all rows" : "Include all rows"}
                      title={allOn ? "Exclude all" : "Include all"}
                    >
                      {allOn ? <IcoCheck /> : null}
                    </button>
                  </span>
                  <span className="si-th si-th--date" role="columnheader">
                    <button className="si-th-sort" onClick={() => cycleSort("date")} title="Sort by date">
                      Date{sortGlyph("date")}
                    </button>
                    <ResizeHandle onPointerDown={startResize("date")} onDoubleClick={() => resetCol("date")} />
                  </span>
                  <span className="si-th si-th--dir" role="columnheader">
                    <button className="si-th-sort" onClick={() => cycleSort("kind")} title="Sort by in/out">
                      In/Out{sortGlyph("kind")}
                    </button>
                    <ResizeHandle onPointerDown={startResize("dir")} onDoubleClick={() => resetCol("dir")} />
                  </span>
                  <span className="si-th si-th--label" role="columnheader">
                    <button className="si-th-sort" onClick={() => cycleSort("label")} title="Sort A–Z by description">
                      What{sortGlyph("label")}
                    </button>
                  </span>
                  {hasCpty && (
                    <span className="si-th si-th--cpty" role="columnheader">
                      <button className="si-th-sort" onClick={() => cycleSort("cpty")} title="Sort A–Z by counterparty">
                        Who{sortGlyph("cpty")}
                      </button>
                      <ResizeHandle onPointerDown={startResize("cpty")} onDoubleClick={() => resetCol("cpty")} />
                    </span>
                  )}
                  <span className="si-th si-th--cat" role="columnheader">
                    <button className="si-th-sort" onClick={() => cycleSort("cat")} title="Sort A–Z by category">
                      Category{sortGlyph("cat")}
                    </button>
                    <ResizeHandle onPointerDown={startResize("cat")} onDoubleClick={() => resetCol("cat")} />
                  </span>
                  <span className="si-th si-th--amt" role="columnheader">
                    <button className="si-th-sort" onClick={() => cycleSort("amount")} title="Sort by amount">
                      Amount{sortGlyph("amount")}
                    </button>
                    <ResizeHandle onPointerDown={startResize("amt")} onDoubleClick={() => resetCol("amt")} />
                  </span>
                </div>
                {displayRows.map((r, i) => {
                  const prev = displayRows[i - 1];
                  const divider = showDividers && (!prev || prev.monthKey !== r.monthKey);
                  return (
                    <Fragment key={r.key}>
                      {divider && <div className="si-mdiv" role="presentation">{monthLabel(r.monthKey)}</div>}
                      <div
                        className={"si-trow" + (r.include ? "" : " si-trow--off") + (r.dup ? " si-trow--dup" : "") + (selected.has(r.key) ? " si-trow--sel" : "")}
                        role="row"
                        title="Click or drag to select for bulk edit · Shift-click selects a range"
                        onClick={(e) => onRowClick(e, r.key, i)}
                        onPointerDown={(e) => onRowPointerDown(e, i)}
                        onPointerEnter={(e) => onRowPointerEnter(e, i)}
                      >
                        <span className="si-td si-td--chk" role="cell">
                          <button
                            className={"si-chk" + (r.include ? " on" : "")}
                            onClick={() => setRow(r.key, { include: !r.include })}
                            aria-pressed={r.include} aria-label={r.include ? "Exclude row" : "Include row"}
                          >
                            {r.include ? <IcoCheck /> : null}
                          </button>
                        </span>
                        <span className="si-td si-td--date" role="cell" title={r.monthKey}>
                          {r.isoDate}
                          {r.dup && <em className="si-dupbadge" title="Same date, amount and description as an existing or earlier row">dup</em>}
                        </span>
                        <span className="si-td si-td--dir" role="cell">
                          {editMode ? (
                            <span className={"si-dir si-dir--" + r.kind}><IcoOut /> Out</span>
                          ) : (
                            <button
                              className={"si-dir si-dir--" + r.kind}
                              onClick={() => setRow(r.key, { kind: r.kind === "income" ? "expense" : "income" })}
                              title="Toggle income / spending"
                            >
                              {r.kind === "income" ? <><IcoIn /> In</> : <><IcoOut /> Out</>}
                            </button>
                          )}
                        </span>
                        <span className="si-td si-td--label" role="cell">
                          <input
                            className="se-label si-label"
                            value={r.label}
                            placeholder={r.counterparty || "Description"}
                            onChange={(e) => setRow(r.key, { label: e.target.value })}
                          />
                        </span>
                        {hasCpty && (
                          <span className="si-td si-td--cpty" role="cell" title={r.counterparty}>
                            {r.counterparty || <span className="si-dash">—</span>}
                          </span>
                        )}
                        <span className="si-td si-td--cat" role="cell">
                          {r.kind === "expense" ? (
                            <>
                              <span
                                className="si-catdot"
                                style={{
                                  background: r.savingsPlanId
                                    ? (savingsPlans.find((p) => p.id === r.savingsPlanId)?.hue ?? "var(--accent)")
                                    : (STMT_CATS[r.cat] || STMT_CATS.other).hue,
                                }}
                              />
                              <select
                                className="se-cat si-cat"
                                value={r.savingsPlanId ? `plan:${r.savingsPlanId}` : r.cat}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (v.startsWith("plan:")) setRow(r.key, { savingsPlanId: v.slice(5) });
                                  else setRow(r.key, { cat: v as CatKey, savingsPlanId: undefined });
                                }}
                              >
                                {CAT_KEYS_BY_LABEL.map((k) => <option key={k} value={k}>{STMT_CATS[k].label}</option>)}
                                {savingsPlans.length > 0 && (
                                  <optgroup label="Savings plans">
                                    {savingsPlans.map((p) => (
                                      <option key={p.id} value={`plan:${p.id}`}>→ {p.name}</option>
                                    ))}
                                  </optgroup>
                                )}
                              </select>
                            </>
                          ) : <span className="si-dash">—</span>}
                        </span>
                        <span role="cell" className={"si-td si-td--amt " + (r.kind === "income" ? "si-pos" : "si-neg")}>
                          {r.kind === "income" ? "+" : "−"}{fmtCur(r.magnitude, r.currencyCode)}
                        </span>
                      </div>
                    </Fragment>
                  );
                })}
              </div>

              {result && result.meta.skippedLines.length > 0 && (
                <details className="si-skipped">
                  <summary>
                    <span className="si-skipped-mark">!</span>
                    {result.meta.rowsSkipped} line{result.meta.rowsSkipped === 1 ? "" : "s"} couldn't be parsed — view
                  </summary>
                  <div className="si-skipped-list">
                    {result.meta.skippedLines.map((l, i) => <code key={i}>{l}</code>)}
                    {result.meta.rowsSkipped > result.meta.skippedLines.length && (
                      <span className="si-skipped-more">…and {result.meta.rowsSkipped - result.meta.skippedLines.length} more</span>
                    )}
                  </div>
                </details>
              )}
            </>
          )}
        </div>

        <div className="se-foot si-foot">
          <div className="si-foot-note">
            {editMode
              ? <><LockGlyph /> {included.length} of {rows.length} rows kept — unchecked rows are removed. Save the statement afterwards to persist.</>
              : hasRows
                ? <><LockGlyph /> {included.length} of {rows.length} rows will merge into the editor — review &amp; Save there to keep them.</>
                : <><LockGlyph /> 100% local · nothing leaves this tab</>}
          </div>
          <div className="se-actions">
            <button className="se-btn se-btn--ghost" onClick={onClose}>Cancel</button>
            {editMode ? (
              <button className="se-btn se-btn--primary" onClick={doApplyEdits}>
                <IcoCheck /> Apply {included.length === rows.length ? "changes" : `(keep ${included.length} of ${rows.length})`}
              </button>
            ) : (
              <button
                className="se-btn se-btn--primary"
                onClick={doImport}
                disabled={included.length === 0}
              >
                <IcoUpload /> Import {included.length || ""} {included.length === 1 ? "row" : "rows"}
              </button>
            )}
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

        {leaveConfirm && (
          <div className="si-leave-veil" onMouseDown={(e) => { if (e.target === e.currentTarget) setLeaveConfirm(false); }}>
            <div className="si-leave-card" role="alertdialog" aria-modal="true" aria-label="Leave without saving">
              <div className="si-leave-title">Leave without saving?</div>
              <div className="si-leave-body">
                {editMode
                  ? "Your edits here haven't been applied yet. Leaving discards them — the statement won't change."
                  : "Anything you've parsed or edited here will be discarded. Nothing has been saved yet."}
              </div>
              <div className="si-leave-actions">
                <button className="se-btn se-btn--ghost" onClick={() => setLeaveConfirm(false)} autoFocus>Keep editing</button>
                <button className="se-btn se-btn--danger" onClick={() => { setLeaveConfirm(false); onClose(); }}>Discard &amp; leave</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResizeHandle(props: { onPointerDown: (e: React.PointerEvent) => void; onDoubleClick: () => void }) {
  return (
    <span
      className="si-resize"
      role="separator"
      aria-orientation="vertical"
      title="Drag to resize · double-click to reset"
      onPointerDown={props.onPointerDown}
      onDoubleClick={props.onDoubleClick}
    />
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
