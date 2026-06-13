/* ShELF — StatementImport modal. Port of src/components/Strategie/StatementImport.tsx.
   The parser is a working, simplified equivalent of statementParse.ts:
   delimited (; , tab) or freeform lines, Czech number/date formats, category guessing. */

/* ─── mini statement parser ─── */
const SI_DATE_RES = [
  { re: /(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})/, ord: "dmy" },
  { re: /(\d{4})-(\d{2})-(\d{2})/, ord: "ymd" },
  { re: /(\d{1,2})\/(\d{1,2})\/(\d{4})/, ord: "dmy" },
];
function siParseDate(s) {
  for (const { re, ord } of SI_DATE_RES) {
    const m = re.exec(s);
    if (!m) continue;
    const [y, mo, d] = ord === "ymd" ? [m[1], m[2], m[3]] : [m[3], m[2], m[1]];
    const yy = Number(y), mm = Number(mo), dd = Number(d);
    if (yy < 1990 || yy > 2100 || mm < 1 || mm > 12 || dd < 1 || dd > 31) continue;
    const iso = yy + "-" + String(mm).padStart(2, "0") + "-" + String(dd).padStart(2, "0");
    return { iso, monthKey: iso.slice(0, 7) };
  }
  return null;
}
function siParseAmount(s) {
  if (!s) return null;
  const t = s.replace(/[\s\u00a0\u202f]/g, "").replace(/Kč|CZK|EUR|USD|€|\$/gi, "");
  if (!/^[-+−]?\d+([.,]\d+)?$/.test(t)) return null;
  const n = parseFloat(t.replace("−", "-").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
const SI_CAT_RULES = [
  ["food", /albert|billa|tesco|lidl|kaufland|rohlik|zabka|penny|globus|potraviny/],
  ["taxi", /wolt|bolt|uber|foodora|liftago|damejidlo/],
  ["transport", /pid|litacka|jizdenka|cd\b|dpp|regiojet|flixbus|benzina|shell|omv/],
  ["eating", /restaura|kavarna|cafe|coffee|pizza|bistro|bageterie|mcdonald|kfc/],
  ["fun", /netflix|spotify|hbo|disney|kino|cinema|steam|playstation/],
  ["electronics", /alza|datart|czc|mall\.cz|electro/],
  ["health", /lekarna|dr\.?max|benu|gym|fitness|multisport/],
  ["home", /ikea|obi|hornbach|bauhaus|sipo|cez|pre\b|innogy|vodafone|o2|t-mobile/],
  ["clothing", /zara|h&m|about you|zalando|reserved|deichmann/],
  ["cash", /atm|vyber|bankomat/],
  ["fees", /poplatek|fee\b|urok/],
  ["housing", /najem|rent\b|hypoteka|nemovitost/],
  ["shopping", /amazon|aliexpress|temu|dm\b|rossmann/],
];
function siGuessCat(hay) {
  const h = window.foldAscii(hay);
  for (const [cat, re] of SI_CAT_RULES) if (re.test(h)) return cat;
  return "other";
}
function siDetectDelim(lines) {
  const counts = { ";": 0, "\t": 0, ",": 0 };
  for (const l of lines.slice(0, 12)) {
    counts[";"] += (l.match(/;/g) || []).length;
    counts["\t"] += (l.match(/\t/g) || []).length;
    counts[","] += (l.match(/,/g) || []).length;
  }
  if (counts[";"] >= 2) return ";";
  if (counts["\t"] >= 2) return "\t";
  if (counts[","] >= 2) return ",";
  return null;
}
function parseStatement(text, opts) {
  opts = opts || {};
  const currencyHint = opts.currencyHint || "CZK";
  const ov = opts.columnMap || {};
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const delim = siDetectDelim(lines);
  const mode = delim ? "delimited" : "freeform";
  const transactions = [];
  const skippedLines = [];
  let rowsSkipped = 0;
  let headerCells = [];
  let columnMap = { date: null, amount: null, description: null, counterparty: null, currency: null };
  let detectedCur = null;

  if (delim) {
    const rows = lines.map((l) => l.split(delim).map((c) => c.trim().replace(/^"|"$/g, "")));
    // header = first row with no date and no amount
    let start = 0;
    const r0 = rows[0];
    const r0HasData = r0.some((c) => siParseDate(c)) && r0.some((c) => siParseAmount(c) !== null);
    if (!r0HasData) { headerCells = r0; start = 1; }
    // auto-detect columns from the first data rows
    const sample = rows.slice(start, start + 8);
    const nCols = Math.max(...rows.map((r) => r.length));
    const scores = Array.from({ length: nCols }, () => ({ date: 0, amount: 0, text: 0, cur: 0 }));
    for (const r of sample) {
      r.forEach((c, i) => {
        if (!scores[i]) return;
        if (siParseDate(c)) scores[i].date++;
        if (siParseAmount(c) !== null) scores[i].amount++;
        if (/^[A-Z]{3}$/.test(c)) scores[i].cur++;
        if (c && siParseAmount(c) === null && !siParseDate(c)) scores[i].text += c.length;
      });
    }
    const best = (key, exclude) => {
      let bi = null, bv = 0;
      scores.forEach((s, i) => { if (exclude.includes(i)) return; if (s[key] > bv) { bv = s[key]; bi = i; } });
      return bi;
    };
    const dateCol = best("date", []);
    const amtCol = best("amount", [dateCol]);
    const curCol = best("cur", [dateCol, amtCol]);
    const descCol = best("text", [dateCol, amtCol, curCol]);
    const cptyCol = best("text", [dateCol, amtCol, curCol, descCol]);
    columnMap = { date: dateCol, amount: amtCol, description: descCol, counterparty: cptyCol, currency: curCol };
    for (const k of Object.keys(ov)) if (ov[k] !== undefined) columnMap[k] = ov[k];

    for (const r of rows.slice(start)) {
      const dc = columnMap.date, ac = columnMap.amount;
      const date = dc != null && r[dc] != null ? siParseDate(r[dc]) : null;
      const amt = ac != null && r[ac] != null ? siParseAmount(r[ac]) : null;
      if (!date || amt === null) {
        rowsSkipped++;
        if (skippedLines.length < 8) skippedLines.push(r.join(delim === "\t" ? "  " : delim));
        continue;
      }
      const desc = columnMap.description != null ? (r[columnMap.description] || "") : "";
      const cpty = columnMap.counterparty != null ? (r[columnMap.counterparty] || "") : "";
      const rowCur = columnMap.currency != null && /^[A-Z]{3}$/.test(r[columnMap.currency] || "") ? r[columnMap.currency] : null;
      if (rowCur && !detectedCur) detectedCur = rowCur;
      transactions.push({
        isoDate: date.iso, monthKey: date.monthKey,
        amount: amt, description: desc, counterparty: cpty,
        kind: amt > 0 ? "income" : "expense",
        cat: siGuessCat(desc + " " + cpty),
        currencyCode: rowCur || detectedCur || currencyHint,
      });
    }
  } else {
    // freeform: date + amount anywhere on the line
    for (const l of lines) {
      const date = siParseDate(l);
      // last number-looking token on the line
      const nums = l.match(/[-+−]?\d[\d\s\u00a0\u202f]*([.,]\d{1,2})?(?=\s|$|Kč|CZK)/g);
      const amt = nums ? siParseAmount(nums[nums.length - 1]) : null;
      if (!date || amt === null) {
        rowsSkipped++;
        if (skippedLines.length < 8) skippedLines.push(l);
        continue;
      }
      const desc = l.replace(SI_DATE_RES[0].re, "").replace(/[-+−]?\d[\d\s\u00a0\u202f]*([.,]\d{1,2})?/g, "").replace(/Kč|CZK/g, "").trim().replace(/^[;,\s]+|[;,\s]+$/g, "");
      transactions.push({
        isoDate: date.iso, monthKey: date.monthKey,
        amount: amt, description: desc, counterparty: "",
        kind: amt > 0 ? "income" : "expense",
        cat: siGuessCat(desc),
        currencyCode: detectedCur || currencyHint,
      });
    }
  }

  const dates = transactions.map((t) => t.isoDate).sort();
  return {
    transactions,
    meta: {
      currency: detectedCur || currencyHint,
      periodStart: dates[0] || null,
      periodEnd: dates[dates.length - 1] || null,
      rowsSkipped, skippedLines, mode, headerCells, columnMap,
    },
  };
}

/* ─── component ─── */
const ALTAR_FRAGMENTS = [
  { left: "5%",  top: "14%", text: "−1 234,56" },
  { left: "84%", top: "10%", text: "CZK" },
  { left: "88%", top: "42%", text: "Datum;Částka" },
  { left: "3%",  top: "58%", text: "01.05.2026" },
  { left: "79%", top: "80%", text: "+42 000,00", em: true },
  { left: "9%",  top: "86%", text: "Protistrana" },
  { left: "56%", top: "4%",  text: "Měna" },
  { left: "32%", top: "92%", text: "Výpis 05/2026" },
];
const SI_IS_MAC = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform || "");

function siNewId() { return "imp-" + Math.random().toString(36).slice(2); }
function siFmtCur(value, code) {
  const entry = window.CURRENCIES[code] || window.CURRENCIES.USD;
  try {
    return new Intl.NumberFormat(entry.locale, { style: "currency", currency: entry.code, maximumFractionDigits: 0 }).format(value);
  } catch (e) { return Math.round(value) + " " + code; }
}
function siMonthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

const SI_COL_DEFAULTS = { date: 100, dir: 80, cpty: 130, cat: 160, amt: 140 };
const SI_COL_MIN = { date: 64, dir: 56, cpty: 72, cat: 96, amt: 84 };
const SI_COL_MAX = 520;
const SI_ROLE_FIELDS = [
  { key: "date", label: "Date" },
  { key: "amount", label: "Amount" },
  { key: "description", label: "Description" },
  { key: "counterparty", label: "Counterparty" },
  { key: "currency", label: "Currency" },
];

function SiResizeHandle(props) {
  return (
    <span className="si-resize" role="separator" aria-orientation="vertical"
      title="Drag to resize · double-click to reset"
      onPointerDown={props.onPointerDown} onDoubleClick={props.onDoubleClick} />
  );
}

function StatementImport({ currency, existing, savingsPlans = [], debts = [], editRows, onApplyEdits, onClose, onImport }) {
  const { useState, useEffect, useMemo, useRef, useCallback } = React;
  const editMode = !!editRows;
  const [rawText, setRawText] = useState("");
  const [result, setResult] = useState(null);
  const [rows, setRows] = useState(() => {
    if (!editRows) return [];
    const rate = (window.CURRENCIES[currency] || window.CURRENCIES.USD).rate;
    return editRows.expenses.map((e) => ({
      key: e.id,
      srcId: e.id,
      include: true,
      isoDate: e.date || "",
      monthKey: editRows.monthKey,
      label: e.label,
      counterparty: "",
      kind: "expense",
      cat: e.cat,
      magnitude: e.amt * rate, // base → display; toBaseAmount round-trips on apply
      currencyCode: currency,
      dup: false,
      savingsPlanId: e.savingsPlanId,
      debtId: e.debtId,
    }));
  });
  const [override, setOverride] = useState({});
  const [showCols, setShowCols] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [encoding, setEncoding] = useState("utf-8");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [sort, setSort] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [bulkLabel, setBulkLabel] = useState("");
  const [bulkCat, setBulkCat] = useState("");
  const lastSelIdxRef = useRef(null);
  const [colW, setColW] = useState({ ...SI_COL_DEFAULTS });
  const bytesRef = useRef(null);
  const fileRef = useRef(null);

  const startResize = useCallback((key) => (e) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const startW = colW[key];
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const move = (ev) => {
      const w = Math.max(SI_COL_MIN[key], Math.min(SI_COL_MAX, startW + (ev.clientX - startX)));
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
  const resetCol = (key) => setColW((c) => ({ ...c, [key]: SI_COL_DEFAULTS[key] }));

  // identity keys of rows already in the statement book
  const existingKeys = useMemo(() => {
    const set = new Set();
    if (!existing) return set;
    for (const mk of Object.keys(existing)) {
      for (const e of existing[mk].expenses) set.add("e|" + e.date + "|" + Math.round(e.amt * 100) + "|" + window.foldAscii(e.label));
      for (const inc of existing[mk].income) set.add("i|" + Math.round(inc.amt * 100) + "|" + window.foldAscii(inc.label));
    }
    return set;
  }, [existing]);

  const runParse = useCallback((text, ov) => {
    const res = parseStatement(text, { currencyHint: currency, columnMap: ov });
    setResult(res);
    setSelected(new Set());
    lastSelIdxRef.current = null;
    setRows((prev) => {
      const idOf = (iso, mag) => iso + "|" + Math.round(mag * 100);
      const prevByKey = new Map(prev.map((r) => [idOf(r.isoDate, r.magnitude), r]));
      const seen = new Set();
      return res.transactions.map((t, i) => {
        const mag = Math.abs(t.amount);
        const prevR = prevByKey.get(idOf(t.isoDate, mag));
        const label = prevR ? prevR.label : (t.description || t.counterparty || "");
        const innerKey = t.isoDate + "|" + Math.round(mag * 100) + "|" + window.foldAscii(label);
        const baseCents = Math.round(window.toBaseAmount(mag, t.currencyCode) * 100);
        const bookKey = t.kind === "expense" || (prevR && prevR.kind === "expense")
          ? "e|" + t.isoDate + "|" + baseCents + "|" + window.foldAscii(label)
          : "i|" + baseCents + "|" + window.foldAscii(label);
        const dup = seen.has(innerKey) || existingKeys.has(bookKey);
        seen.add(innerKey);
        const hay = window.foldAscii(t.description + " " + t.counterparty);
        const planAuto = t.kind === "expense"
          ? (savingsPlans.find((p) => hay.includes(window.foldAscii(p.name))) || {}).id
          : undefined;
        const debtAuto = t.kind === "expense" && !planAuto
          ? (debts.find((d) => hay.includes(window.foldAscii(d.name))) || {}).id
          : undefined;
        return {
          key: i + "-" + t.isoDate + "-" + t.amount + "-" + t.description.slice(0, 8),
          include: prevR ? prevR.include : !dup,
          isoDate: t.isoDate, monthKey: t.monthKey,
          label, counterparty: t.counterparty,
          kind: prevR ? prevR.kind : t.kind,
          cat: prevR ? prevR.cat : t.cat,
          magnitude: mag, currencyCode: t.currencyCode,
          dup,
          savingsPlanId: prevR ? prevR.savingsPlanId : planAuto,
          debtId: prevR ? prevR.debtId : debtAuto,
        };
      });
    });
  }, [currency, existingKeys, savingsPlans, debts]);

  useEffect(() => {
    if (editMode) return;
    if (rawText.trim()) runParse(rawText, override);
    else { setResult(null); setRows([]); }
  }, [rawText, override, runParse, editMode]);

  // own Escape handling
  useEffect(() => {
    const h = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation(); e.preventDefault();
      if (window.confirm("Are you sure you want to leave? Any unsaved changes will be lost.")) onClose();
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [onClose]);

  // "paste anywhere" while empty
  useEffect(() => {
    if (editMode || rows.length > 0) return;
    const h = (e) => {
      const t = e.target;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT")) return;
      const text = e.clipboardData ? e.clipboardData.getData("text") : "";
      if (text.trim()) { bytesRef.current = null; setFileName(null); setRawText(text); }
    };
    window.addEventListener("paste", h);
    return () => window.removeEventListener("paste", h);
  }, [rows.length]);

  const decodeBytes = useCallback((buf, enc) => {
    try { return new TextDecoder(enc).decode(buf); }
    catch (e) { return new TextDecoder().decode(buf); }
  }, []);

  const handleFile = useCallback(async (file) => {
    setOverride({});
    setFileName(file.name);
    setLoadError(null);
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (isPdf) {
      bytesRef.current = null;
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        setRawText("");
        setLoadError("PDF text extraction isn't wired up in this design prototype — export a CSV from your bank, or paste the statement text instead.");
      }, 900);
      return;
    }
    const buf = await file.arrayBuffer();
    bytesRef.current = buf;
    setEncoding("utf-8");
    setRawText(decodeBytes(buf, "utf-8"));
  }, [decodeBytes]);

  useEffect(() => {
    if (bytesRef.current) setRawText(decodeBytes(bytesRef.current, encoding));
  }, [encoding, decodeBytes]);

  const startOver = () => {
    const edits = rows.length > 0 || rawText.trim() !== "";
    if (edits && !window.confirm("Start over? This discards the " + rows.length + " parsed row" + (rows.length === 1 ? "" : "s") + " and any edits you've made here.")) return;
    bytesRef.current = null;
    setFileName(null); setRawText(""); setOverride({});
    setResult(null); setRows([]); setShowCols(false);
    setLoadError(null); setLoading(false); setSort(null); setShowManual(false);
    setSelected(new Set()); setBulkLabel(""); setBulkCat("");
    lastSelIdxRef.current = null;
  };

  const setRow = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const included = rows.filter((r) => r.include);
  const incRows = included.filter((r) => r.kind === "income");
  const expRows = included.filter((r) => r.kind === "expense");
  const incSum = incRows.reduce((a, r) => a + r.magnitude, 0);
  const expSum = expRows.reduce((a, r) => a + r.magnitude, 0);
  const netSum = incSum - expSum;
  const months = [...new Set(included.map((r) => r.monthKey))].sort();
  const curCode = result ? result.meta.currency : currency;

  const allOn = rows.length > 0 && rows.every((r) => r.include);
  const toggleAll = () => setRows((rs) => rs.map((r) => ({ ...r, include: !allOn })));

  const cycleSort = (key) => setSort((s) => (!s || s.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null));
  const sortGlyph = (key) => (sort && sort.key === key ? (sort.dir === 1 ? " ↑" : " ↓") : "");
  const sortVal = (r, key) => {
    switch (key) {
      case "date": return r.isoDate;
      case "amount": return r.magnitude;
      case "kind": return r.kind;
      case "label": return r.label;
      case "cpty": return r.counterparty;
      case "cat":
        if (r.kind === "income") return "";
        if (r.debtId) return (debts.find((d) => d.id === r.debtId) || {}).name || "";
        if (r.savingsPlanId) return (savingsPlans.find((p) => p.id === r.savingsPlanId) || {}).name || "";
        return (window.STMT_CATS[r.cat] || window.STMT_CATS.other).label;
      default: return "";
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

  // click-and-drag selection
  const dragAnchorRef = useRef(null);
  const dragStartedRef = useRef(false);
  const dragBaseRef = useRef(new Set());
  const suppressClickRef = useRef(false);

  useEffect(() => {
    const up = () => {
      if (dragStartedRef.current) {
        suppressClickRef.current = true;
        setTimeout(() => { suppressClickRef.current = false; }, 0);
        document.body.style.userSelect = "";
      }
      dragAnchorRef.current = null;
      dragStartedRef.current = false;
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  const onRowPointerDown = (e, displayIdx) => {
    if (e.button !== 0) return;
    const t = e.target;
    if (t.closest("button, input, select, label, a")) return;
    dragAnchorRef.current = displayIdx;
    dragStartedRef.current = false;
    dragBaseRef.current = new Set(selected);
    e.preventDefault();
  };
  const onRowPointerEnter = (e, displayIdx) => {
    if (dragAnchorRef.current === null) return;
    if (!(e.buttons & 1)) { dragAnchorRef.current = null; return; }
    if (!dragStartedRef.current && displayIdx !== dragAnchorRef.current) {
      dragStartedRef.current = true;
      document.body.style.userSelect = "none";
    }
    if (!dragStartedRef.current) return;
    const a = Math.min(dragAnchorRef.current, displayIdx), b = Math.max(dragAnchorRef.current, displayIdx);
    const next = new Set(dragBaseRef.current);
    for (let i = a; i <= b; i++) next.add(displayRows[i].key);
    setSelected(next);
    lastSelIdxRef.current = displayIdx;
  };
  const onRowClick = (e, key, displayIdx) => {
    if (suppressClickRef.current) return;
    const t = e.target;
    if (t.closest("button, input, select, label, a")) return;
    if (e.shiftKey && window.getSelection) window.getSelection().removeAllRanges();
    setSelected((prev) => {
      const next = new Set(prev);
      if (e.shiftKey && lastSelIdxRef.current !== null) {
        const a = Math.min(lastSelIdxRef.current, displayIdx), b = Math.max(lastSelIdxRef.current, displayIdx);
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
      const patch = {};
      if (label) patch.label = label;
      if (bulkCat) {
        if (bulkCat.startsWith("plan:")) { patch.savingsPlanId = bulkCat.slice(5); patch.debtId = undefined; }
        else if (bulkCat.startsWith("debt:")) { patch.debtId = bulkCat.slice(5); patch.savingsPlanId = undefined; }
        else { patch.cat = bulkCat; patch.savingsPlanId = undefined; patch.debtId = undefined; }
      }
      return { ...r, ...patch };
    }));
    setBulkLabel(""); setBulkCat("");
  };

  const hasCpty = rows.some((r) => r.counterparty.trim() !== "");
  const dupCount = rows.filter((r) => r.dup).length;
  const showDividers = months.length > 1 && (!sort || sort.key === "date");

  const doImport = () => {
    const additions = {};
    for (const r of included) {
      if (!/^\d{4}-\d{2}$/.test(r.monthKey)) continue;
      if (!additions[r.monthKey]) additions[r.monthKey] = { income: [], expenses: [] };
      const amt = window.toBaseAmount(r.magnitude, r.currencyCode);
      if (r.kind === "income") {
        additions[r.monthKey].income.push({ id: siNewId(), label: r.label || r.counterparty || "Income", amt, kind: "other" });
      } else {
        additions[r.monthKey].expenses.push({
          id: siNewId(), label: r.label || r.counterparty || "Expense", amt, cat: r.cat, date: r.isoDate,
          savingsPlanId: r.savingsPlanId || undefined,
          debtId: r.debtId || undefined,
        });
      }
    }
    onImport(additions);
  };

  // edit mode: replace the month's expenses with the (kept) edited rows
  const doApplyEdits = () => {
    if (!editRows || !onApplyEdits) return;
    const out = included.map((r) => ({
      id: r.srcId || siNewId(),
      label: r.label || "Expense",
      amt: window.toBaseAmount(r.magnitude, r.currencyCode),
      cat: r.cat,
      date: r.isoDate || undefined,
      savingsPlanId: r.savingsPlanId || undefined,
      debtId: r.debtId || undefined,
    }));
    onApplyEdits(editRows.monthKey, out);
  };

  const hasRows = rows.length > 0;
  const parsedEmpty = !!result && rows.length === 0 && rawText.trim().length > 0;

  return (
    <div className="se-backdrop si-backdrop">
      <div className={"se-modal si-modal" + (hasRows ? " si-modal--review" : "") + (editMode ? " si-modal--edit" : "")} role="dialog" aria-modal="true" aria-label={editMode ? "Bulk edit expenses" : "Import bank statement"}>
        <div className="se-head">
          <div className="se-head-l">
            <div className="se-eyebrow"><IcoUpload /> {editMode ? "Bulk edit" : "Import"}</div>
            <h2 className="se-title">{editMode ? (editRows.scopeLabel ? "Review the selected expenses" : "Review this month's expenses") : "Bring in a bank statement"}</h2>
            {editMode ? (
              <p className="se-lede">
                Sort, drag-select and bulk-rewrite the expense rows of {editRows.scopeLabel || siMonthLabel(editRows.monthKey)}.
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
          {!hasRows && !editMode && (
            <div className="si-stage"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault(); setDragOver(false);
                const f = e.dataTransfer.files && e.dataTransfer.files[0];
                if (f) handleFile(f);
              }}>
              {ALTAR_FRAGMENTS.map((f, i) => (
                <span key={i} className={"si-frag" + (f.em ? " si-frag--em" : "")} style={{ left: f.left, top: f.top }} aria-hidden="true">
                  {f.text}
                </span>
              ))}

              {loading ? (
                <div className="si-parsing" role="status" aria-label="Parsing statement">
                  <div className="si-parsebar"><span></span></div>
                  <div className="si-skel-rows">
                    <span className="si-skel" style={{ width: 34 }}></span><span className="si-skel" style={{ width: "72%" }}></span><span className="si-skel" style={{ width: 52 }}></span>
                    <span className="si-skel" style={{ width: 34 }}></span><span className="si-skel" style={{ width: "57%" }}></span><span className="si-skel" style={{ width: 52 }}></span>
                    <span className="si-skel" style={{ width: 34 }}></span><span className="si-skel" style={{ width: "84%" }}></span><span className="si-skel" style={{ width: 52 }}></span>
                    <span className="si-skel" style={{ width: 34 }}></span><span className="si-skel" style={{ width: "63%" }}></span><span className="si-skel" style={{ width: 52 }}></span>
                  </div>
                  <div className="si-parsing-cap">reading your statement on device…</div>
                </div>
              ) : (
                <button type="button"
                  className={"si-altar" + (dragOver ? " si-altar--over" : "")}
                  onClick={() => fileRef.current && fileRef.current.click()}
                  aria-label="Drop, paste, or choose a statement file">
                  <span className="si-tick si-tick--tl" aria-hidden="true"></span>
                  <span className="si-tick si-tick--tr" aria-hidden="true"></span>
                  <span className="si-tick si-tick--bl" aria-hidden="true"></span>
                  <span className="si-tick si-tick--br" aria-hidden="true"></span>
                  <span className="si-orb"><IcoUpload /></span>
                  <span className="si-altar-title">{dragOver ? "Release to parse" : "Drop your statement"}</span>
                  <span className="si-altar-sub">
                    or paste anywhere — <kbd className="si-kbd">{SI_IS_MAC ? "⌘V" : "Ctrl+V"}</kbd> · click to browse
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
                    <button className="si-enc" title="Toggle text encoding if Czech characters look garbled"
                      onClick={() => setEncoding((e) => (e === "utf-8" ? "windows-1250" : "utf-8"))}>
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
                <textarea className="si-textarea" aria-label="Paste bank-statement transactions"
                  placeholder={"Paste your transactions here…\n\nExample:\nDatum;Protistrana;Detaily;Částka;Měna\n01.05.2026;Albert;Nákup;-1 234,56;CZK\n03.05.2026;Mzda;Výplata;42 000,00;CZK"}
                  value={rawText}
                  onChange={(e) => { bytesRef.current = null; setFileName(null); setRawText(e.target.value); }}
                  spellCheck={false} autoFocus />
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
            <React.Fragment>
              {result && (
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
                      <button className={"si-link" + (showCols ? " on" : "")} onClick={() => setShowCols((v) => !v)} aria-expanded={showCols}>
                        <IcoChev dir={showCols ? "down" : "right"} /> Columns
                      </button>
                    )}
                    {fileName && (
                      <button className="si-link" onClick={() => setEncoding((e) => (e === "utf-8" ? "windows-1250" : "utf-8"))}
                        title="Toggle text encoding if Czech characters look garbled">
                        {encoding === "utf-8" ? "UTF-8" : "CP1250"}
                      </button>
                    )}
                    <button className="si-link" onClick={startOver}>Start over</button>
                  </div>
                </div>
              )}

              {showCols && result && result.meta.mode !== "freeform" && (
                <div className="si-cols">
                  {SI_ROLE_FIELDS.map((f) => (
                    <label key={f.key} className="si-col-field">
                      <span className="si-col-lab">{f.label}</span>
                      <select className="se-cat si-colsel"
                        value={String((override[f.key] !== undefined ? override[f.key] : result.meta.columnMap[f.key]) ?? -1)}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setOverride((o) => ({ ...o, [f.key]: v < 0 ? null : v }));
                        }}>
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
                  <b>{siFmtCur(incSum, curCode)}</b>
                  {incRows.length > 0 && <small className="si-sum-note">added as monthly income — adjust in the statement after import</small>}
                </div>
                <div className="si-sum si-sum--out">
                  <span className="si-sum-lab"><span className="se-pill se-pill--out"><IcoOut /></span> {expRows.length} spending</span>
                  <b>{siFmtCur(expSum, curCode)}</b>
                </div>
                <div className="si-sum si-sum--bal">
                  <span className="si-sum-lab">Net</span>
                  <b className={netSum >= 0 ? "pos" : "neg"}>
                    {netSum >= 0 ? "+" : "−"}{siFmtCur(Math.abs(netSum), curCode)}
                  </b>
                </div>
                <div className="si-sum si-sum--net">
                  <span className="si-sum-lab">{months.length} month{months.length === 1 ? "" : "s"}</span>
                  <b className="si-months">{months.map(siMonthLabel).join(", ") || "—"}</b>
                </div>
              </div>

              {selected.size > 0 && (
                <div className="si-bulk">
                  <span className="si-bulk-count">{selected.size} selected</span>
                  <input className="si-bulk-input" placeholder="Rewrite 'What' for all selected rows…"
                    value={bulkLabel}
                    onChange={(e) => setBulkLabel(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") applyBulk(); }} />
                  <select className="se-cat si-bulk-cat" value={bulkCat} onChange={(e) => setBulkCat(e.target.value)}>
                    <option value="">Category — keep as is</option>
                    {window.CAT_KEYS_BY_LABEL.map((k) => <option key={k} value={k}>{window.STMT_CATS[k].label}</option>)}
                    {savingsPlans.length > 0 && (
                      <optgroup label="Savings plans">
                        {savingsPlans.map((p) => <option key={p.id} value={"plan:" + p.id}>→ {p.name}</option>)}
                      </optgroup>
                    )}
                    {debts.length > 0 && (
                      <optgroup label="Debt payments">
                        {debts.map((d) => <option key={d.id} value={"debt:" + d.id}>↓ {d.name}</option>)}
                      </optgroup>
                    )}
                  </select>
                  <button className="se-btn se-btn--primary si-bulk-apply" onClick={applyBulk} disabled={!bulkLabel.trim() && !bulkCat}>
                    Apply to {selected.size}
                  </button>
                  <button className="si-link" onClick={() => { setSelected(new Set()); lastSelIdxRef.current = null; }}>
                    Clear selection
                  </button>
                </div>
              )}

              <div className={"si-table" + (hasCpty ? " si-table--cpty" : "")} role="table"
                style={{
                  "--si-c-date": colW.date + "px",
                  "--si-c-dir": colW.dir + "px",
                  "--si-c-cpty": colW.cpty + "px",
                  "--si-c-cat": colW.cat + "px",
                  "--si-c-amt": colW.amt + "px",
                }}>
                <div className="si-thead" role="row">
                  <span className="si-th si-th--chk" role="columnheader">
                    <button className={"si-chk si-chk--all" + (allOn ? " on" : "")} onClick={toggleAll}
                      aria-pressed={allOn} aria-label={allOn ? "Exclude all rows" : "Include all rows"}
                      title={allOn ? "Exclude all" : "Include all"}>
                      {allOn ? <IcoCheck /> : null}
                    </button>
                  </span>
                  <span className="si-th si-th--date" role="columnheader">
                    <button className="si-th-sort" onClick={() => cycleSort("date")} title="Sort by date">Date{sortGlyph("date")}</button>
                    <SiResizeHandle onPointerDown={startResize("date")} onDoubleClick={() => resetCol("date")} />
                  </span>
                  <span className="si-th si-th--dir" role="columnheader">
                    <button className="si-th-sort" onClick={() => cycleSort("kind")} title="Sort by in/out">In/Out{sortGlyph("kind")}</button>
                    <SiResizeHandle onPointerDown={startResize("dir")} onDoubleClick={() => resetCol("dir")} />
                  </span>
                  <span className="si-th si-th--label" role="columnheader">
                    <button className="si-th-sort" onClick={() => cycleSort("label")} title="Sort A–Z by description">What{sortGlyph("label")}</button>
                  </span>
                  {hasCpty && (
                    <span className="si-th si-th--cpty" role="columnheader">
                      <button className="si-th-sort" onClick={() => cycleSort("cpty")} title="Sort A–Z by counterparty">Who{sortGlyph("cpty")}</button>
                      <SiResizeHandle onPointerDown={startResize("cpty")} onDoubleClick={() => resetCol("cpty")} />
                    </span>
                  )}
                  <span className="si-th si-th--cat" role="columnheader">
                    <button className="si-th-sort" onClick={() => cycleSort("cat")} title="Sort A–Z by category">Category{sortGlyph("cat")}</button>
                    <SiResizeHandle onPointerDown={startResize("cat")} onDoubleClick={() => resetCol("cat")} />
                  </span>
                  <span className="si-th si-th--amt" role="columnheader">
                    <button className="si-th-sort" onClick={() => cycleSort("amount")} title="Sort by amount">Amount{sortGlyph("amount")}</button>
                    <SiResizeHandle onPointerDown={startResize("amt")} onDoubleClick={() => resetCol("amt")} />
                  </span>
                </div>
                {displayRows.map((r, i) => {
                  const prev = displayRows[i - 1];
                  const divider = showDividers && (!prev || prev.monthKey !== r.monthKey);
                  const out = [];
                  if (divider) out.push(<div className="si-mdiv" key={"mdiv-" + r.monthKey + "-" + i} role="presentation">{siMonthLabel(r.monthKey)}</div>);
                  out.push(
                      <div key={r.key} className={"si-trow" + (r.include ? "" : " si-trow--off") + (r.dup ? " si-trow--dup" : "") + (selected.has(r.key) ? " si-trow--sel" : "")}
                        role="row"
                        title="Click or drag to select for bulk edit · Shift-click selects a range"
                        onClick={(e) => onRowClick(e, r.key, i)}
                        onPointerDown={(e) => onRowPointerDown(e, i)}
                        onPointerEnter={(e) => onRowPointerEnter(e, i)}>
                        <span className="si-td si-td--chk" role="cell">
                          <button className={"si-chk" + (r.include ? " on" : "")}
                            onClick={() => setRow(r.key, { include: !r.include })}
                            aria-pressed={r.include} aria-label={r.include ? "Exclude row" : "Include row"}>
                            {r.include ? <IcoCheck /> : null}
                          </button>
                        </span>
                        <span className="si-td si-td--date" role="cell" title={r.monthKey}>
                          {r.isoDate}
                          {r.dup && <em className="si-dupbadge" title="Same date, amount and description as an existing or earlier row">dup</em>}
                        </span>
                        <span className="si-td si-td--dir" role="cell">
                          <button className={"si-dir si-dir--" + r.kind}
                            onClick={() => setRow(r.key, { kind: r.kind === "income" ? "expense" : "income" })}
                            title="Toggle income / spending">
                            {r.kind === "income" ? <React.Fragment><IcoIn /> In</React.Fragment> : <React.Fragment><IcoOut /> Out</React.Fragment>}
                          </button>
                        </span>
                        <span className="si-td si-td--label" role="cell">
                          <input className="se-label si-label" value={r.label}
                            placeholder={r.counterparty || "Description"}
                            onChange={(e) => setRow(r.key, { label: e.target.value })} />
                        </span>
                        {hasCpty && (
                          <span className="si-td si-td--cpty" role="cell" title={r.counterparty}>
                            {r.counterparty || <span className="si-dash">—</span>}
                          </span>
                        )}
                        <span className="si-td si-td--cat" role="cell">
                          {r.kind === "expense" ? (
                            <React.Fragment>
                              <span className="si-catdot"
                                style={{
                                  background: r.debtId
                                    ? window.debtHue(debts.find((d) => d.id === r.debtId))
                                    : r.savingsPlanId
                                    ? ((savingsPlans.find((p) => p.id === r.savingsPlanId) || {}).hue || "var(--accent)")
                                    : (window.STMT_CATS[r.cat] || window.STMT_CATS.other).hue,
                                }} />
                              <select className="se-cat si-cat"
                                value={r.debtId ? "debt:" + r.debtId : r.savingsPlanId ? "plan:" + r.savingsPlanId : r.cat}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (v.startsWith("plan:")) setRow(r.key, { savingsPlanId: v.slice(5), debtId: undefined });
                                  else if (v.startsWith("debt:")) setRow(r.key, { debtId: v.slice(5), savingsPlanId: undefined });
                                  else setRow(r.key, { cat: v, savingsPlanId: undefined, debtId: undefined });
                                }}>
                                {window.CAT_KEYS_BY_LABEL.map((k) => <option key={k} value={k}>{window.STMT_CATS[k].label}</option>)}
                                {savingsPlans.length > 0 && (
                                  <optgroup label="Savings plans">
                                    {savingsPlans.map((p) => (
                                      <option key={p.id} value={"plan:" + p.id}>→ {p.name}</option>
                                    ))}
                                  </optgroup>
                                )}
                                {debts.length > 0 && (
                                  <optgroup label="Debt payments">
                                    {debts.map((d) => (
                                      <option key={d.id} value={"debt:" + d.id}>↓ {d.name}</option>
                                    ))}
                                  </optgroup>
                                )}
                              </select>
                            </React.Fragment>
                          ) : <span className="si-dash">—</span>}
                        </span>
                        <span role="cell" className={"si-td si-td--amt " + (r.kind === "income" ? "si-pos" : "si-neg")}>
                          {r.kind === "income" ? "+" : "−"}{siFmtCur(r.magnitude, r.currencyCode)}
                        </span>
                      </div>
                  );
                  return out;
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
            </React.Fragment>
          )}
        </div>

        <div className="se-foot si-foot">
          <div className="si-foot-note">
            {editMode
              ? <React.Fragment><LockGlyph /> {included.length} of {rows.length} rows kept — unchecked rows are removed. Save the statement afterwards to persist.</React.Fragment>
              : hasRows
                ? <React.Fragment><LockGlyph /> {included.length} of {rows.length} rows will merge into the editor — review &amp; Save there to keep them.</React.Fragment>
                : <React.Fragment><LockGlyph /> 100% local · nothing leaves this tab</React.Fragment>}
          </div>
          <div className="se-actions">
            <button className="se-btn se-btn--ghost" onClick={onClose}>Cancel</button>
            {editMode ? (
              <button className="se-btn se-btn--primary" onClick={doApplyEdits}>
                <IcoCheck /> Apply {included.length} {included.length === 1 ? "row" : "rows"}
              </button>
            ) : (
              <button className="se-btn se-btn--primary" onClick={doImport} disabled={included.length === 0}>
                <IcoUpload /> Import {included.length || ""} {included.length === 1 ? "row" : "rows"}
              </button>
            )}
          </div>
        </div>

        <input ref={fileRef} type="file" accept=".csv,.txt,.pdf,text/csv,text/plain,application/pdf"
          className="si-fileinput"
          onChange={(e) => {
            const f = e.target.files && e.target.files[0];
            if (f) handleFile(f);
            e.currentTarget.value = "";
          }} />
      </div>
    </div>
  );
}

Object.assign(window, { StatementImport, parseStatement });
