/* ShELF — Strategie (life + savings strategy) data + finance helpers.
   All monetary values are stored in a USD base; the UI converts for display.
   The model encodes a textbook personal-finance approach:
   a prioritized order-of-operations + low-cost broadly-diversified index compounding.

   Spending is stored as DATED transactions (each line has a real `date`), so the
   dashboard can roll it up by week and watch it evolve. Income stays per-month
   (monthly sources — salary, freelance), which is how most people actually get paid. */

/* ====================== date / week helpers (shared on window) ====================== */
const MONTH_ABBR_J = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function _strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function _mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function _daysInMonth(key) { const [y, m] = key.split("-").map(Number); return new Date(y, m, 0).getDate(); }
function _dstr(key, day) { const [y, m] = key.split("-"); return y + "-" + m + "-" + String(day).padStart(2, "0"); }

window.daysInMonth = _daysInMonth;
window.dayStr = _dstr;

/* weeks of a month, Monday-aligned, clamped to the month boundaries.
   → [{ idx, startDay, endDay, label, range }] */
window.monthWeeks = function (key) {
  const [y, m] = key.split("-").map(Number);
  const dim = _daysInMonth(key);
  const weeks = []; let idx = 0; let day = 1;
  while (day <= dim) {
    const dow = new Date(y, m - 1, day).getDay();   // 0=Sun … 6=Sat
    const isoDow = dow === 0 ? 7 : dow;             // 1=Mon … 7=Sun
    const end = Math.min(dim, day + (7 - isoDow));
    idx++;
    weeks.push({ idx, startDay: day, endDay: end, label: "W" + idx, range: MONTH_ABBR_J[m - 1] + " " + day + "–" + end });
    day = end + 1;
  }
  return weeks;
};

/* which week (1-indexed) a YYYY-MM-DD date falls in, for its own month */
window.weekOfDate = function (key, dateStr) {
  if (!dateStr) return 1;
  const day = Number(dateStr.split("-")[2]);
  const weeks = window.monthWeeks(key);
  for (const w of weeks) { if (day >= w.startDay && day <= w.endDay) return w.idx; }
  return weeks.length;
};

/* ====================== statement builder ====================== */
/* A compact spec → expanded dated transactions. Fixed bills land on a set day;
   variable categories are split into several dated lines spread across the month
   (deterministic per month+label) so the weekly view shows real movement. */
function _buildVariable(key, label, cat, total, n) {
  const rng = _mulberry32(_strHash(key + "|" + label));
  const dim = _daysInMonth(key);
  let days = [];
  for (let i = 0; i < n; i++) {
    const center = (i + 0.5) / n * dim;
    let d = Math.round(center + (rng() - 0.5) * (dim / n) * 0.8);
    d = Math.max(1, Math.min(dim, d));
    days.push(d);
  }
  days.sort((a, b) => a - b);
  for (let i = 1; i < days.length; i++) { if (days[i] <= days[i - 1]) days[i] = Math.min(dim, days[i - 1] + 1); }
  let w = days.map(() => 0.7 + rng() * 0.6);
  const ws = w.reduce((a, b) => a + b, 0);
  let amts = w.map((x) => Math.max(5, Math.round(total * x / ws / 5) * 5));
  let diff = total - amts.reduce((a, b) => a + b, 0);
  amts[amts.length - 1] = Math.max(5, amts[amts.length - 1] + diff);
  return days.map((d, i) => ({
    id: key.replace("-", "") + "_" + _strHash(label + i).toString(36).slice(0, 5),
    label, cat, amt: amts[i], date: _dstr(key, d),
  }));
}
function _buildMonth(key, spec) {
  const expenses = [];
  spec.fixed.forEach((b, i) => expenses.push({ id: key.replace("-", "") + "f" + i, label: b.label, cat: b.cat, amt: b.amt, date: _dstr(key, b.day) }));
  spec.variable.forEach((v) => _buildVariable(key, v.label, v.cat, v.total, v.n).forEach((t) => expenses.push(t)));
  expenses.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { income: spec.income.map((r, i) => ({ id: "in" + (i + 1), ...r })), expenses };
}

/* per-month spec: income (monthly sources) + fixed bills (single day) + variable (split) */
const STMT_SPEC = {
  "2026-01": {
    income: [ { label: "Salary (net)", amt: 4200, kind: "Primary" }, { label: "Side projects", amt: 150, kind: "Freelance" } ],
    fixed: [
      { label: "Rent", cat: "housing", amt: 1300, day: 1 },
      { label: "Health & gym", cat: "health", amt: 150, day: 2 },
      { label: "Subscriptions", cat: "fun", amt: 90, day: 4 },
      { label: "Utilities & bills", cat: "home", amt: 260, day: 9 },
    ],
    variable: [
      { label: "Groceries", cat: "food", total: 540, n: 4 },
      { label: "Dining & coffee", cat: "food", total: 300, n: 6 },
      { label: "Transport", cat: "transport", total: 180, n: 5 },
      { label: "Shopping", cat: "shopping", total: 250, n: 3 },
      { label: "Everything else", cat: "other", total: 220, n: 3 },
    ],
  },
  "2026-02": {
    income: [ { label: "Salary (net)", amt: 4200, kind: "Primary" }, { label: "Side projects", amt: 250, kind: "Freelance" } ],
    fixed: [
      { label: "Rent", cat: "housing", amt: 1300, day: 1 },
      { label: "Health & gym", cat: "health", amt: 150, day: 2 },
      { label: "Subscriptions", cat: "fun", amt: 90, day: 4 },
      { label: "Utilities & bills", cat: "home", amt: 250, day: 9 },
    ],
    variable: [
      { label: "Groceries", cat: "food", total: 500, n: 4 },
      { label: "Dining & coffee", cat: "food", total: 230, n: 5 },
      { label: "Transport", cat: "transport", total: 170, n: 5 },
      { label: "Shopping", cat: "shopping", total: 180, n: 2 },
      { label: "Everything else", cat: "other", total: 190, n: 3 },
    ],
  },
  "2026-03": {
    income: [ { label: "Salary (net)", amt: 4200, kind: "Primary" }, { label: "Side projects", amt: 400, kind: "Freelance" } ],
    fixed: [
      { label: "Rent", cat: "housing", amt: 1300, day: 1 },
      { label: "Health & gym", cat: "health", amt: 150, day: 2 },
      { label: "Subscriptions", cat: "fun", amt: 90, day: 4 },
      { label: "Utilities & bills", cat: "home", amt: 210, day: 9 },
    ],
    variable: [
      { label: "Groceries", cat: "food", total: 520, n: 4 },
      { label: "Dining & coffee", cat: "food", total: 250, n: 6 },
      { label: "Transport", cat: "transport", total: 180, n: 5 },
      { label: "Shopping", cat: "shopping", total: 300, n: 3 },
      { label: "Everything else", cat: "other", total: 200, n: 3 },
    ],
  },
  "2026-04": {
    income: [ { label: "Salary (net)", amt: 4200, kind: "Primary" }, { label: "Side projects", amt: 300, kind: "Freelance" } ],
    fixed: [
      { label: "Rent", cat: "housing", amt: 1300, day: 1 },
      { label: "Health & gym", cat: "health", amt: 150, day: 2 },
      { label: "Subscriptions", cat: "fun", amt: 90, day: 4 },
      { label: "Utilities & bills", cat: "home", amt: 220, day: 9 },
    ],
    variable: [
      { label: "Groceries", cat: "food", total: 520, n: 4 },
      { label: "Dining & coffee", cat: "food", total: 260, n: 6 },
      { label: "Transport", cat: "transport", total: 180, n: 5 },
      { label: "Shopping", cat: "shopping", total: 380, n: 3 },
      { label: "Everything else", cat: "other", total: 200, n: 3 },
    ],
  },
};

const STMT_ORDER = Object.keys(STMT_SPEC);
const STATEMENTS_BY_MONTH = {};
STMT_ORDER.forEach((k) => { STATEMENTS_BY_MONTH[k] = _buildMonth(k, STMT_SPEC[k]); });

window.STRAT = {
  // ---- cashflow (USD base, monthly) ----
  cashflow: {
    income: 4500,
    expenses: 3300,
    // of the 1,200 surplus: 1,000 invested, 200 to pots
    toInvest: 1000,
    toPots: 200,
    importedTx: 142,         // mock: transactions parsed from a bank statement
  },

  // ---- the editable statement: per-month income + DATED spending (USD base) ----
  // The "Import statement" editor reads & writes this. The dashboard's cashflow,
  // KPIs, savings ring, weekly breakdown and 5-year projection all derive from the
  // *active* month below. Income amounts are monthly; expenses carry a `date`.
  statements: {
    current: "2026-04",
    order: STMT_ORDER,
    byMonth: STATEMENTS_BY_MONTH,
  },

  // ---- positions (USD base) ----
  positions: {
    invested: 14000,          // already in the market
    emergencySaved: 9000,
    emergencyTarget: 18000,   // ~5.5 months of expenses
  },

  // ---- projection assumptions ----
  assumptions: {
    horizonYears: 5,
    returns: [
      { id: "cons", label: "Conservative", rate: 0.05 },
      { id: "bal",  label: "Balanced",     rate: 0.07 },
      { id: "growth", label: "Growth",     rate: 0.09 },
    ],
    defaultReturn: "bal",
    inflation: 0.025,
  },

  // ---- the order of operations (the "technically best" waterfall) ----
  // status: done | active | queued
  // each rung carries the detail shown when you click it:
  //   blurb   — why this step matters, in plain language
  //   accounts — where the money for this step actually sits (USD base balances)
  //   history  — the moves that got it here (USD base; +in / −out)
  ladder: [
    {
      id: 1, title: "Starter buffer", note: "1 month of expenses, instant-access", status: "done",
      icon: "shield", hue: "var(--hue-blue)",
      blurb: "A small cash cushion so a surprise bill never pushes you onto a credit card. One month of spending, somewhere you can reach it the same day.",
      accounts: [
        { name: "Air Bank — spořicí účet", tag: "Instant access", balance: 3250 },
      ],
      history: [
        { date: "2025-09-02", label: "Opened buffer account", amt: 1500 },
        { date: "2025-10-01", label: "Top-up from salary", amt: 900 },
        { date: "2025-11-01", label: "Top-up — reached 1 month", amt: 850 },
      ],
    },
    {
      id: 2, title: "Capture free money", note: "Employer pension match — never leave it", status: "done",
      icon: "gift", hue: "var(--hue-purple)",
      blurb: "Your employer matches pension contributions up to 3%. That's an instant, guaranteed 100% return — the only free lunch in finance. Contribute at least enough to take all of it.",
      accounts: [
        { name: "Penzijní fond — employer plan", tag: "Matched 3%", balance: 4100 },
      ],
      history: [
        { date: "2025-09-15", label: "Raised contribution to 3%", amt: 0 },
        { date: "2025-10-15", label: "Your contribution + match", amt: 520 },
        { date: "2025-11-15", label: "Your contribution + match", amt: 520 },
        { date: "2025-12-15", label: "Your contribution + match", amt: 520 },
      ],
    },
    {
      id: 3, title: "Kill high-interest debt", note: "Anything above ~8% APR first", status: "done",
      icon: "flame", hue: "var(--hue-orange)",
      blurb: "Expensive debt grows faster than any investment. Everything above ~8% APR got cleared before a single crown went into the market — paid off in full.",
      accounts: [
        { name: "Credit card — revolving", tag: "Cleared", balance: 0 },
      ],
      history: [
        { date: "2025-09-20", label: "Balance at start", amt: -2400 },
        { date: "2025-10-10", label: "Lump payment", amt: 1500 },
        { date: "2025-11-05", label: "Final payment — cleared", amt: 900 },
      ],
    },
    {
      id: 4, title: "Full emergency fund", note: "3–6 months, money-market account", status: "active", pct: 50,
      icon: "vault", hue: "var(--hue-green)", target: 18000,
      blurb: "The real safety net: 3–6 months of expenses so a job loss or big repair never derails the plan. Parked in a money-market fund so it keeps pace with inflation while staying liquid.",
      accounts: [
        { name: "Money-market fund — Fio", tag: "T+1 access", balance: 6500 },
        { name: "Air Bank — spořicí účet", tag: "Instant access", balance: 2500 },
      ],
      history: [
        { date: "2025-11-20", label: "Rolled buffer into fund", amt: 4000 },
        { date: "2025-12-20", label: "Monthly contribution", amt: 2500 },
        { date: "2026-01-20", label: "Monthly contribution", amt: 2500 },
      ],
    },
    {
      id: 5, title: "Tax-advantaged investing", note: "CZ: DIP / penzijní připojištění — deduct & compound", status: "active", pct: 35,
      icon: "leaf", hue: "var(--accent)",
      blurb: "Use the tax-advantaged wrappers first — DIP and penzijní připojištění cut your taxable income and the state chips in too. Same market, but more of the growth stays yours.",
      accounts: [
        { name: "DIP — investiční účet", tag: "Tax-deductible", balance: 3200 },
        { name: "Penzijní připojištění", tag: "State bonus", balance: 1800 },
      ],
      history: [
        { date: "2025-12-01", label: "Opened DIP account", amt: 1500 },
        { date: "2026-01-01", label: "Monthly contribution", amt: 1700 },
        { date: "2026-02-01", label: "Monthly contribution", amt: 1700 },
        { date: "2026-03-31", label: "State contribution bonus", amt: 100 },
      ],
    },
    {
      id: 6, title: "Broad index investing", note: "Low-cost all-world ETF, automate monthly", status: "active", pct: 100,
      icon: "growth", hue: "var(--accent)",
      blurb: "The engine of the whole plan: a single low-cost all-world ETF, bought automatically every month. No timing, no stock-picking — just steady contributions and decades of compounding.",
      accounts: [
        { name: "Brokerage — VWCE (all-world)", tag: "Auto-buy 1st", balance: 9000 },
      ],
      history: [
        { date: "2025-12-01", label: "Automated monthly buy", amt: 1500 },
        { date: "2026-01-01", label: "Automated monthly buy", amt: 1500 },
        { date: "2026-02-01", label: "Automated monthly buy", amt: 1500 },
        { date: "2026-03-01", label: "Automated monthly buy", amt: 1500 },
      ],
    },
    {
      id: 7, title: "Goal & taxable investing", note: "Sinking funds and beyond", status: "queued",
      icon: "target", hue: "var(--hue-rose)",
      blurb: "Once the wrappers are full and the safety net is solid, everything else flows here — sinking funds for near-term goals and a plain taxable account for the surplus. Unlocks when steps 4 & 5 are funded.",
      accounts: [],
      history: [],
    },
  ],

  // ---- asset allocation (long horizon → equity-heavy, textbook) ----
  allocation: {
    profile: "Long-horizon · equity-tilted",
    slices: [
      { id: "eq",   label: "Global equity index", pct: 82, hue: "var(--accent)" },
      { id: "bond", label: "Bonds / fixed income", pct: 12, hue: "var(--hue-blue)" },
      { id: "cash", label: "Cash / money market",  pct: 6,  hue: "var(--hue-zinc)" },
    ],
  },

  // ---- recurring memberships (USD base/mo) — the breakdown behind "Subscriptions" ----
  // each renders as a little square tile in the statement editor
  memberships: [
    { id: "m_net", name: "Netflix",        plan: "Standard",     price: 13, color: "#E50914", mono: "N" },
    { id: "m_spo", name: "Spotify",         plan: "Premium",      price: 6,  color: "#1DB954", mono: "S" },
    { id: "m_yt",  name: "YouTube Premium", plan: "Individual",   price: 12, color: "#FF0033", mono: "YT" },
    { id: "m_gpt", name: "ChatGPT",         plan: "Plus",         price: 20, color: "#10A37F", mono: "AI" },
    { id: "m_icl", name: "iCloud+",         plan: "200 GB",       price: 3,  color: "#3B82F6", mono: "iC" },
    { id: "m_dis", name: "Disney+",         plan: "Standard",     price: 9,  color: "#1A47BE", mono: "D+" },
    { id: "m_xbx", name: "Game Pass",       plan: "Ultimate",     price: 11, color: "#107C10", mono: "GP" },
    { id: "m_adb", name: "Adobe CC",        plan: "Photography",  price: 8,  color: "#DA1F26", mono: "Ae" },
    { id: "m_not", name: "Notion",          plan: "Plus",         price: 8,  color: "#8E8E93", mono: "No" },
  ],

  // ---- sinking-fund pots (USD base) ----
  pots: [
    { id: "po1", name: "Mýčka + instalace", target: 900,  saved: 280,  monthly: 80,  fromHopper: true },
    { id: "po2", name: "Apartment deposit", target: 12000, saved: 4500, monthly: 400, fromHopper: false },
    { id: "po3", name: "Japan, spring 2027", target: 6000, saved: 1750, monthly: 150, fromHopper: false },
    { id: "po4", name: "MacBook Pro", target: 2500, saved: 1900, monthly: 120, fromHopper: false },
  ],

  // ---- life pillars (the broader planner) ----
  pillars: [
    { id: "money",   label: "Money",    metric: "27%", note: "savings rate", state: "On plan",  tone: "good" },
    { id: "health",  label: "Health",   metric: "12d", note: "training streak", state: "Steady", tone: "good" },
    { id: "learn",   label: "Learning", metric: "98%", note: "Agentic RAG cert", state: "Almost", tone: "warn" },
    { id: "career",  label: "Career",   metric: "2/3", note: "quarter goals", state: "On track", tone: "good" },
  ],
};

/* ---- currencies (display only; base is USD) ---- */
window.CURRENCIES = {
  USD: { code: "USD", locale: "en-US", rate: 1 },
  EUR: { code: "EUR", locale: "de-DE", rate: 0.92 },
  CZK: { code: "CZK", locale: "cs-CZ", rate: 23.2 },
};

/* convert a USD-base amount and format it in the chosen currency */
window.fmtMoney = (usd, cur, opts = {}) => {
  const c = window.CURRENCIES[cur] || window.CURRENCIES.USD;
  const v = usd * c.rate;
  if (opts.abbr) {
    const abs = Math.abs(v);
    const sign = v < 0 ? "-" : "";
    const sym = { USD: "$", EUR: "€", CZK: "" }[c.code];
    const suffix = c.code === "CZK" ? " Kč" : "";
    let body;
    if (abs >= 1e6) body = (abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1) + "M";
    else if (abs >= 1e3) body = (abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1) + "k";
    else body = Math.round(abs).toString();
    return sign + sym + body + suffix;
  }
  return new Intl.NumberFormat(c.locale, {
    style: "currency", currency: c.code,
    maximumFractionDigits: opts.cents ? 2 : 0,
  }).format(v);
};

/* month-by-month compound projection of an initial principal + fixed monthly contribution */
window.project = (principal, monthly, annualReturn, months) => {
  const r = annualReturn / 12;
  const pts = [];
  let bal = principal, contrib = principal;
  for (let m = 0; m <= months; m++) {
    if (m > 0) { bal = bal * (1 + r) + monthly; contrib += monthly; }
    pts.push({ m, bal, contrib, growth: Math.max(0, bal - contrib) });
  }
  return pts;
};
