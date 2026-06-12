/* ShELF — Strategie data + helpers. Plain-JS port of src/components/Strategie/strategie.ts
   (branch mandev-1/strategie-savings-and-import). All monetary values are USD-base;
   the UI converts for display. Everything exports to window. */

/* ─── Currency table ─── */
const CURRENCIES = {
  USD: { code: "USD", locale: "en-US", rate: 1 },
  EUR: { code: "EUR", locale: "de-DE", rate: 0.92 },
  GBP: { code: "GBP", locale: "en-GB", rate: 0.79 },
  CZK: { code: "CZK", locale: "cs-CZ", rate: 23.5 },
  JPY: { code: "JPY", locale: "ja-JP", rate: 149.5 },
  CHF: { code: "CHF", locale: "de-CH", rate: 0.91 },
  PLN: { code: "PLN", locale: "pl-PL", rate: 4.0 },
  HUF: { code: "HUF", locale: "hu-HU", rate: 358 },
  CAD: { code: "CAD", locale: "en-CA", rate: 1.36 },
  AUD: { code: "AUD", locale: "en-AU", rate: 1.53 },
};

/* ─── Date helpers ─── */
function daysInMonth(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}
function dayStr(key, day) {
  const [y, m] = key.split("-");
  return y + "-" + m + "-" + String(day).padStart(2, "0");
}
/** Monday-aligned weeks, clamped to the month */
function monthWeeks(key) {
  const [y, m] = key.split("-").map(Number);
  const days = daysInMonth(key);
  const dow1 = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Mon=0
  const weeks = [];
  let cursor = 1, wIdx = 1;
  while (cursor <= days) {
    const dayOfWeek = (cursor + dow1 - 1) % 7;
    const end = Math.min(cursor + (6 - dayOfWeek), days);
    weeks.push({ idx: wIdx, startDay: cursor, endDay: end, label: "Wk " + wIdx, range: cursor + "–" + end });
    wIdx++; cursor = end + 1;
  }
  return weeks;
}
function weekOfDate(key, dateStr) {
  const weeks = monthWeeks(key);
  const d = parseInt((dateStr || "").split("-")[2], 10);
  for (const w of weeks) if (d >= w.startDay && d <= w.endDay) return w.idx;
  return 1;
}
function stepMonth(key, dir) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + dir, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}
function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
function monthAbbr(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/* ─── Projection ─── */
function project(principal, monthly, annualReturn, months) {
  const r = annualReturn / 12 / 100;
  const result = [];
  let bal = principal, totalContrib = 0;
  for (let i = 1; i <= months; i++) {
    bal = bal * (1 + r) + monthly;
    totalContrib += monthly;
    result.push({ m: i, bal: Math.round(bal), contrib: Math.round(principal + totalContrib), growth: Math.round(bal - principal - totalContrib) });
  }
  return result;
}

/* ─── Formatting ─── */
function fmtMoney(usd, cur, opts) {
  const entry = CURRENCIES[cur] || CURRENCIES.USD;
  const val = usd * entry.rate;
  if (opts && opts.abbr && Math.abs(val) >= 1000) {
    const k = val / 1000;
    const formatted = k.toFixed(Math.abs(k) >= 100 ? 0 : 1) + "k";
    try {
      const sym = new Intl.NumberFormat(entry.locale, { style: "currency", currency: entry.code, maximumFractionDigits: 0 })
        .format(0).replace(/[\d,.\s]+/, "").trim();
      return sym + formatted;
    } catch (e) { return formatted; }
  }
  try {
    const cents = opts && opts.cents;
    return new Intl.NumberFormat(entry.locale, {
      style: "currency", currency: entry.code,
      maximumFractionDigits: cents ? 2 : 0, minimumFractionDigits: cents ? 2 : 0,
    }).format(val);
  } catch (e) { return String(Math.round(val)); }
}
function niceCeil(x) {
  if (x <= 0) return 1000;
  const mag = Math.pow(10, Math.floor(Math.log10(x)));
  const nice = [1, 2, 2.5, 5, 10];
  for (const n of nice) if (mag * n >= x) return mag * n;
  return mag * 10;
}
/** strip diacritics + lowercase — duplicate matching, plan auto-tag */
function foldAscii(s) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
/** display value in `code` → USD base */
function toBaseAmount(val, code) {
  const entry = CURRENCIES[code] || CURRENCIES.USD;
  return val / entry.rate;
}

/* ─── Category metadata (fixed hues) ─── */
const STMT_CATS = {
  housing:     { label: "Housing",         hue: "#6366f1" },
  food:        { label: "Groceries",       hue: "#f59e0b" },
  eating:      { label: "Eating out",      hue: "#eab308" },
  taxi:        { label: "Taxi & delivery", hue: "#d946ef" },
  transport:   { label: "Transport",       hue: "#3b82f6" },
  home:        { label: "Home",            hue: "#14b8a6" },
  electronics: { label: "Electronics",     hue: "#06b6d4" },
  clothing:    { label: "Clothing",        hue: "#2dd4bf" },
  fun:         { label: "Fun",             hue: "#ec4899" },
  health:      { label: "Health",          hue: "#22c55e" },
  shopping:    { label: "Shopping",        hue: "#f97316" },
  vending:     { label: "Vending",         hue: "#a78bfa" },
  cash:        { label: "Cash (ATM)",      hue: "#84cc16" },
  fees:        { label: "Fees",            hue: "#ef4444" },
  charity:     { label: "Charity",         hue: "#f43f5e" },
  credit:      { label: "Credit card",     hue: "#0ea5e9" },
  other:       { label: "Other",           hue: "#94a3b8" },
};
const CAT_KEYS = ["housing", "food", "eating", "taxi", "transport", "home", "electronics", "clothing", "fun", "health", "shopping", "vending", "cash", "fees", "charity", "credit", "other"];
const CAT_KEYS_BY_LABEL = (() => {
  const rest = CAT_KEYS.filter((k) => k !== "other");
  rest.sort((a, b) => STMT_CATS[a].label.localeCompare(STMT_CATS[b].label));
  return rest.concat(["other"]);
})();

/* ─── Scenarios / constants ─── */
const RETURN_SCENARIOS = [
  { id: "conservative", label: "Conservative", rate: 4 },
  { id: "balanced",     label: "Balanced",     rate: 7 },
  { id: "aggressive",   label: "Aggressive",   rate: 10 },
  { id: "sp500",        label: "S&P 500 avg",  rate: 10.5 },
];

const SAVINGS_PLAN_KINDS = [
  { id: "savings",  label: "Savings acct" },
  { id: "building", label: "Building savings" },
  { id: "pension",  label: "Pension" },
  { id: "dip",      label: "DIP" },
  { id: "etf",      label: "ETF plan" },
  { id: "other",    label: "Other" },
];

const DEFAULT_LADDER = [
  {
    id: 1, title: "Starter buffer", note: "1 month of expenses, instant-access",
    status: "done", icon: "shield", hue: "var(--hue-blue)",
    blurb: "A small cash cushion so a surprise bill never pushes you onto a credit card. One month of spending, somewhere you can reach it the same day.",
    accounts: [{ name: "Air Bank — spořicí účet", tag: "Instant access", balance: 3250 }],
    history: [
      { date: "2025-09-02", label: "Opened buffer account", amt: 1500 },
      { date: "2025-10-01", label: "Top-up from salary", amt: 900 },
      { date: "2025-11-01", label: "Top-up — reached 1 month", amt: 850 },
    ],
  },
  {
    id: 2, title: "Capture free money", note: "Employer pension match — never leave it",
    status: "done", icon: "gift", hue: "var(--hue-purple)",
    blurb: "Your employer matches pension contributions up to 3%. That's an instant, guaranteed 100% return — the only free lunch in finance. Contribute at least enough to take all of it.",
    accounts: [{ name: "Penzijní fond — employer plan", tag: "Matched 3%", balance: 4100 }],
    history: [
      { date: "2025-09-15", label: "Raised contribution to 3%", amt: 0 },
      { date: "2025-10-15", label: "Your contribution + match", amt: 520 },
      { date: "2025-11-15", label: "Your contribution + match", amt: 520 },
      { date: "2025-12-15", label: "Your contribution + match", amt: 520 },
    ],
  },
  {
    id: 3, title: "Kill high-interest debt", note: "Anything above ~8% APR first",
    status: "done", icon: "flame", hue: "var(--hue-orange)",
    blurb: "Expensive debt grows faster than any investment. Everything above ~8% APR got cleared before a single crown went into the market — paid off in full.",
    accounts: [{ name: "Credit card — revolving", tag: "Cleared", balance: 0 }],
    history: [
      { date: "2025-09-20", label: "Balance at start", amt: -2400 },
      { date: "2025-10-10", label: "Lump payment", amt: 1500 },
      { date: "2025-11-05", label: "Final payment — cleared", amt: 900 },
    ],
  },
  {
    id: 4, title: "Full emergency fund", note: "3–6 months, money-market account",
    status: "active", pct: 50, icon: "vault", hue: "var(--hue-green)", target: 18000,
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
    id: 5, title: "Tax-advantaged investing", note: "CZ: DIP / penzijní připojištění — deduct & compound",
    status: "active", pct: 35, icon: "leaf", hue: "var(--accent)",
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
    id: 6, title: "Broad index investing", note: "Low-cost all-world ETF, automate monthly",
    status: "active", pct: 100, icon: "growth", hue: "var(--accent)",
    blurb: "The engine of the whole plan: a single low-cost all-world ETF, bought automatically every month. No timing, no stock-picking — just steady contributions and decades of compounding.",
    accounts: [{ name: "Brokerage — VWCE (all-world)", tag: "Auto-buy 1st", balance: 9000 }],
    history: [
      { date: "2025-12-01", label: "Automated monthly buy", amt: 1500 },
      { date: "2026-01-01", label: "Automated monthly buy", amt: 1500 },
      { date: "2026-02-01", label: "Automated monthly buy", amt: 1500 },
      { date: "2026-03-01", label: "Automated monthly buy", amt: 1500 },
    ],
  },
  {
    id: 7, title: "Goal & taxable investing", note: "Sinking funds and beyond",
    status: "queued", icon: "target", hue: "var(--hue-rose)",
    blurb: "Once the wrappers are full and the safety net is solid, everything else flows here — sinking funds for near-term goals and a plain taxable account for the surplus. Unlocks when steps 4 & 5 are funded.",
    accounts: [], history: [],
  },
];

const DEFAULT_PILLARS = [
  { id: "savings-rate", label: "Savings rate",    metric: "~18 %",      note: "Target ≥ 20 %",   state: "Close",    tone: "warn" },
  { id: "e-fund",       label: "Emergency fund",  metric: "5 mo",       note: "Target 6 months", state: "Almost",   tone: "ok" },
  { id: "invest",       label: "Monthly invest",  metric: "€300",       note: "Regular DCA plan",state: "On track", tone: "ok" },
  { id: "net-worth",    label: "Net worth trend", metric: "+€1 200/mo", note: "12-month avg",    state: "Growing",  tone: "ok" },
];

/* ─── Default statements seed (USD base) ─── */
function _buildVariable(id, label, total, cat, key, days) {
  const perTx = Math.round(total / days.length);
  return days.map((d, i) => ({
    id: id + "-" + key + "-" + i, label,
    amt: i < days.length - 1 ? perTx : total - perTx * (days.length - 1),
    cat, date: dayStr(key, d),
  }));
}
function _buildMonth(key, v) {
  // v = variation factor so consecutive months differ (feeds MonthCloseDiff)
  v = v || 1;
  const income = [
    { id: "inc-salary-" + key, label: "Salary (net)",  amt: 4200, kind: "salary" },
    { id: "inc-side-" + key,   label: "Side projects", amt: Math.round(300 * v), kind: "freelance" },
  ];
  const expenses = [
    { id: "exp-rent-" + key,   label: "Rent",              amt: 1300, cat: "housing", date: dayStr(key, 1) },
    { id: "exp-health-" + key, label: "Health & gym",      amt: 150,  cat: "health",  date: dayStr(key, 2) },
    { id: "exp-subs-" + key,   label: "Subscriptions",     amt: 90,   cat: "fun",     date: dayStr(key, 4) },
    { id: "exp-util-" + key,   label: "Utilities & bills", amt: 220,  cat: "home",    date: dayStr(key, 9) },
    { id: "exp-bs-" + key,  label: "Building savings ČS", amt: 200, cat: "other", date: dayStr(key, 5),  savingsPlanId: "sp-bs" },
    { id: "exp-dip-" + key, label: "DIP contribution",    amt: 150, cat: "other", date: dayStr(key, 1),  savingsPlanId: "sp-dip" },
  ]
    .concat(_buildVariable("exp-groc", "Groceries", Math.round(520 * v), "food", key, [3, 10, 17, 24]))
    .concat(_buildVariable("exp-dine", "Dining & coffee", Math.round(260 * (2 - v)), "eating", key, [5, 8, 12, 15, 19, 22]))
    .concat(_buildVariable("exp-trans", "Transport", 180, "transport", key, [2, 7, 14, 21, 28]))
    .concat(_buildVariable("exp-shop", "Shopping", Math.round(380 * v), "shopping", key, [6, 13, 20]))
    .concat(_buildVariable("exp-taxi", "Wolt & Bolt", Math.round(90 * (2 - v)), "taxi", key, [9, 16, 23]))
    .concat(_buildVariable("exp-other", "Everything else", 200, "other", key, [11, 18, 25]));
  return { income, expenses };
}
const DEFAULT_STATEMENTS = {
  "2026-03": _buildMonth("2026-03", 1.18),
  "2026-04": _buildMonth("2026-04", 1),
};

/* ─── helpers.ts ─── */
function totalIncome(stmt) { return stmt.income.reduce((s, r) => s + (r.amt || 0), 0); }
function totalExpenses(stmt) { return stmt.expenses.reduce((s, r) => s + (r.amt || 0), 0); }
function expensesByCat(stmt) {
  const by = {};
  for (const e of stmt.expenses) {
    if (e.savingsPlanId) continue;
    by[e.cat] = (by[e.cat] || 0) + (e.amt || 0);
  }
  return by;
}

/* ─── StrategieState seed (matches the real useShelfStorage slice shape) ─── */
const STRAT_STATE = {
  statements: { byMonth: DEFAULT_STATEMENTS, order: ["2026-03", "2026-04"], current: "2026-04" },
  positions: { invested: 18100, emergencySaved: 9000, emergencyTarget: 18000 },
  pots: [
    { id: "pot-desk",   name: "Standing desk",      saved: 260, target: 480,  monthly: 60,  fromHopper: true },
    { id: "pot-japan",  name: "Japan trip · spring", saved: 900, target: 2600, monthly: 180, fromHopper: false },
    { id: "pot-buffer", name: "New laptop",          saved: 640, target: 1500, monthly: 120, fromHopper: true },
  ],
  savingsPlans: [
    { id: "sp-bs",  name: "Building savings ČS", kind: "building", hue: "#6595ee" },
    { id: "sp-dip", name: "DIP — investiční účet", kind: "dip",    hue: "#34c891" },
  ],
  memberships: [],
  accountsDirectory: [
    { name: "Air Bank — běžný účet", kind: "checking", tag: "Everyday", balance: 2050, url: "https://www.airbank.cz" },
    { name: "Air Bank — spořicí účet", kind: "savings", tag: "Instant access", balance: 3940, url: "https://www.airbank.cz" },
    { name: "Money-market fund — Fio", kind: "savings", tag: "T+1 access", balance: 5100 },
    { name: "DIP — investiční účet", kind: "brokerage", tag: "Tax-deductible", balance: 3200 },
    { name: "Penzijní připojištění", kind: "pension", tag: "State bonus", balance: 5890 },
    { name: "Brokerage — VWCE (all-world)", kind: "brokerage", tag: "Auto-buy 1st", balance: 9000 },
    { name: "Coinbase — BTC/ETH", kind: "crypto", tag: "Long-term", balance: 1780 },
  ],
  acctSchemaV: 3,
  rungAccounts: {},
  secondaryCurrency: "EUR",
  compareCurrencyOn: false,
};

/* ─── Account kinds (for the Accounts card) ─── */
const ACCOUNT_KINDS = [
  { id: "checking",  label: "Checking",  hue: "#5b9cff" },
  { id: "savings",   label: "Savings",   hue: "#34c891" },
  { id: "brokerage", label: "Brokerage", hue: "#a384df" },
  { id: "pension",   label: "Pension",   hue: "#e0905a" },
  { id: "building",  label: "Building",  hue: "#6595ee" },
  { id: "crypto",    label: "Crypto",    hue: "#e0a020" },
  { id: "cash",      label: "Cash",      hue: "#8b8b95" },
];

Object.assign(window, {
  CURRENCIES, daysInMonth, dayStr, monthWeeks, weekOfDate, stepMonth,
  monthLabel, monthAbbr, project, fmtMoney, niceCeil, foldAscii, toBaseAmount,
  STMT_CATS, CAT_KEYS, CAT_KEYS_BY_LABEL, RETURN_SCENARIOS, SAVINGS_PLAN_KINDS,
  DEFAULT_LADDER, DEFAULT_PILLARS, DEFAULT_STATEMENTS,
  totalIncome, totalExpenses, expensesByCat, STRAT_STATE, ACCOUNT_KINDS,
});
