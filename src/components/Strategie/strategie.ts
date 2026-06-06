import type { CatKey, MonthStatement, IncomeRow, ExpenseRow } from "../../types/grid";

// ─── Currency table ───────────────────────────────────────────────────────────
export const CURRENCIES: Record<string, { code: string; locale: string; rate: number }> = {
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

// ─── Date helpers ─────────────────────────────────────────────────────────────
export function daysInMonth(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function dayStr(key: string, day: number): string {
  const [y, m] = key.split("-");
  return `${y}-${m}-${String(day).padStart(2, "0")}`;
}

/** Monday-aligned weeks, clamped to the month */
export function monthWeeks(
  key: string
): { idx: number; startDay: number; endDay: number; label: string; range: string }[] {
  const [y, m] = key.split("-").map(Number);
  const days = daysInMonth(key);
  const dow1 = ((new Date(y, m - 1, 1).getDay() + 6) % 7); // Mon=0
  const weeks: { idx: number; startDay: number; endDay: number; label: string; range: string }[] = [];
  let cursor = 1;
  let wIdx = 1;
  while (cursor <= days) {
    const dayOfWeek = (cursor + dow1 - 1) % 7; // Mon=0
    const daysToSunday = 6 - dayOfWeek;
    const end = Math.min(cursor + daysToSunday, days);
    weeks.push({
      idx: wIdx++,
      startDay: cursor,
      endDay: end,
      label: `Wk ${wIdx - 1}`,
      range: `${cursor}–${end}`,
    });
    cursor = end + 1;
  }
  return weeks;
}

export function weekOfDate(key: string, dateStr: string): number {
  const weeks = monthWeeks(key);
  const d = parseInt(dateStr.split("-")[2], 10);
  for (const w of weeks) {
    if (d >= w.startDay && d <= w.endDay) return w.idx;
  }
  return 1;
}

export function stepMonth(key: string, dir: 1 | -1): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + dir, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function monthAbbr(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function cloneMonth(mo: MonthStatement, newKey: string): MonthStatement {
  const days = daysInMonth(newKey);
  return {
    income: mo.income.map((r) => ({ ...r, id: crypto.randomUUID() })),
    expenses: mo.expenses.map((r) => {
      const oldDay = parseInt(r.date.split("-")[2], 10);
      const newDay = Math.min(oldDay, days);
      return { ...r, id: crypto.randomUUID(), date: dayStr(newKey, newDay) };
    }),
  };
}

// ─── Projection ──────────────────────────────────────────────────────────────
export function project(
  principal: number,
  monthly: number,
  annualReturn: number,
  months: number
): { m: number; bal: number; contrib: number; growth: number }[] {
  const r = annualReturn / 12 / 100;
  const result: { m: number; bal: number; contrib: number; growth: number }[] = [];
  let bal = principal;
  let totalContrib = 0;
  for (let i = 1; i <= months; i++) {
    bal = bal * (1 + r) + monthly;
    totalContrib += monthly;
    result.push({
      m: i,
      bal: Math.round(bal),
      contrib: Math.round(principal + totalContrib),
      growth: Math.round(bal - principal - totalContrib),
    });
  }
  return result;
}

// ─── Formatting ──────────────────────────────────────────────────────────────
export function fmtMoney(
  usd: number,
  cur: string,
  opts?: { abbr?: boolean; cents?: boolean }
): string {
  const entry = CURRENCIES[cur] ?? CURRENCIES["USD"];
  const val = usd * entry.rate;
  if (opts?.abbr && Math.abs(val) >= 1000) {
    const k = val / 1000;
    const formatted = k.toFixed(Math.abs(k) >= 100 ? 0 : 1) + "k";
    try {
      const sym = new Intl.NumberFormat(entry.locale, {
        style: "currency",
        currency: entry.code,
        maximumFractionDigits: 0,
      })
        .format(0)
        .replace(/[\d,.\s]+/, "")
        .trim();
      return sym + formatted;
    } catch {
      return formatted;
    }
  }
  try {
    return new Intl.NumberFormat(entry.locale, {
      style: "currency",
      currency: entry.code,
      maximumFractionDigits: opts?.cents ? 2 : 0,
      minimumFractionDigits: opts?.cents ? 2 : 0,
    }).format(val);
  } catch {
    return String(Math.round(val));
  }
}

export function niceCeil(x: number): number {
  if (x <= 0) return 1000;
  const mag = Math.pow(10, Math.floor(Math.log10(x)));
  const nice = [1, 2, 2.5, 5, 10];
  for (const n of nice) {
    if (mag * n >= x) return mag * n;
  }
  return mag * 10;
}

// ─── Category metadata ───────────────────────────────────────────────────────
export const STMT_CATS: Record<CatKey, { label: string; hue: string }> = {
  housing:   { label: "Housing",    hue: "#6366f1" },
  food:      { label: "Food",       hue: "#f59e0b" },
  transport: { label: "Transport",  hue: "#3b82f6" },
  home:      { label: "Home",       hue: "#14b8a6" },
  fun:       { label: "Fun",        hue: "#ec4899" },
  health:    { label: "Health",     hue: "#22c55e" },
  shopping:  { label: "Shopping",   hue: "#f97316" },
  other:     { label: "Other",      hue: "#94a3b8" },
};

export const CAT_KEYS: CatKey[] = [
  "housing", "food", "transport", "home", "fun", "health", "shopping", "other",
];

// ─── Scenarios / constants ───────────────────────────────────────────────────
export const RETURN_SCENARIOS: { id: string; label: string; rate: number }[] = [
  { id: "conservative", label: "Conservative",  rate: 4 },
  { id: "balanced",     label: "Balanced",      rate: 7 },
  { id: "aggressive",   label: "Aggressive",    rate: 10 },
  { id: "sp500",        label: "S&P 500 avg",   rate: 10.5 },
];

export interface LadderAccount {
  name: string;
  tag: string;
  balance: number;
  target?: number;
}
export interface LadderHistoryEntry {
  date: string;
  label: string;
  amt: number;
}
export interface LadderRung {
  id: number;
  title: string;
  note: string;
  status: "done" | "active" | "queued";
  pct?: number;
  icon?: string;
  hue?: string;
  blurb?: string;
  accounts?: LadderAccount[];
  history?: LadderHistoryEntry[];
  target?: number;
}

export const DEFAULT_LADDER: LadderRung[] = [
  {
    id: 1, title: "Emergency fund", note: "3–6 months of expenses",
    status: "active", pct: 50,
    icon: "shield", hue: "#f59e0b",
    blurb: "A liquid buffer that covers 3–6 months of living costs. Kept in a high-yield savings account, never invested. This is your financial immune system — it lets you weather job loss or unexpected expenses without derailing everything else.",
    accounts: [
      { name: "High-yield savings", tag: "HYSA", balance: 4200, target: 8400 },
    ],
    history: [
      { date: "2026-05", label: "Monthly top-up", amt: 300 },
      { date: "2026-04", label: "Monthly top-up", amt: 300 },
      { date: "2026-03", label: "Initial deposit", amt: 3600 },
    ],
  },
  {
    id: 2, title: "Pay off bad debt", note: "Credit cards & high APR",
    status: "queued",
    icon: "flame", hue: "#ef4444",
    blurb: "High-interest debt (credit cards, personal loans above 7%) destroys compounding. Eliminate the most expensive balances first using the avalanche method before redirecting cash to investments.",
    accounts: [],
    history: [],
  },
  {
    id: 3, title: "Employer match", note: "Free money — capture it",
    status: "done",
    icon: "gift", hue: "#22c55e",
    blurb: "Employer pension / 401k matching is an instant 50–100% return on your contribution. Always contribute at least enough to capture the full match before allocating elsewhere.",
    accounts: [
      { name: "Company pension", tag: "401k", balance: 12400 },
    ],
    history: [
      { date: "2025-01", label: "Match threshold reached", amt: 0 },
    ],
  },
  {
    id: 4, title: "Tax-advantaged acc", note: "IRA / 401k / ISA top-up",
    status: "queued",
    icon: "vault", hue: "#6366f1",
    blurb: "After capturing the employer match, maximise tax-sheltered wrappers. Every euro/dollar of growth inside an ISA or Roth IRA compounds tax-free. Priority: fill these before taxable brokerage.",
    accounts: [
      { name: "Roth IRA", tag: "IRA", balance: 3200, target: 7000 },
    ],
    history: [],
  },
  {
    id: 5, title: "Invest surplus", note: "Low-cost index funds",
    status: "queued",
    icon: "growth", hue: "#3b82f6",
    blurb: "Any surplus after the above steps goes into low-cost, broadly diversified index funds. A simple three-fund portfolio (global equities, bonds, cash) is sufficient for most investors. Automate and ignore short-term noise.",
    accounts: [],
    history: [],
  },
];

export const DEFAULT_ALLOCATION: {
  profile: string;
  slices: { id: string; label: string; pct: number; hue: string }[];
} = {
  profile: "Balanced growth",
  slices: [
    { id: "eq-dev",  label: "Dev. Equities",   pct: 55, hue: "#6366f1" },
    { id: "eq-em",   label: "Emerg. Markets",  pct: 15, hue: "#3b82f6" },
    { id: "bonds",   label: "Bonds",           pct: 20, hue: "#14b8a6" },
    { id: "alt",     label: "Alternatives",    pct: 10, hue: "#f59e0b" },
  ],
};

export const DEFAULT_PILLARS: {
  id: string; label: string; metric: string;
  note: string; state: string; tone: string;
}[] = [
  { id: "savings-rate", label: "Savings rate",    metric: "~18 %",      note: "Target ≥ 20 %",    state: "Close",    tone: "warn" },
  { id: "e-fund",       label: "Emergency fund",  metric: "5 mo",       note: "Target 6 months",  state: "Almost",   tone: "ok"   },
  { id: "invest",       label: "Monthly invest",  metric: "€300",       note: "Regular DCA plan", state: "On track", tone: "ok"   },
  { id: "net-worth",    label: "Net worth trend", metric: "+€1 200/mo", note: "12-month avg",     state: "Growing",  tone: "ok"   },
];

// ─── Default statements seed ─────────────────────────────────────────────────
function _buildVariable(
  id: string,
  label: string,
  total: number,
  cat: CatKey,
  key: string,
  days: number[]
): ExpenseRow[] {
  const perTx = Math.round(total / days.length);
  return days.map((d, i) => ({
    id: `${id}-${i}`,
    label,
    amt: i < days.length - 1 ? perTx : total - perTx * (days.length - 1),
    cat,
    date: dayStr(key, d),
  }));
}

function _buildMonth(key: string): MonthStatement {
  const income: IncomeRow[] = [
    { id: "inc-salary", label: "Salary (net)",  amt: 4200, kind: "salary"   },
    { id: "inc-side",   label: "Side projects", amt: 300,  kind: "freelance" },
  ];

  const expenses: ExpenseRow[] = [
    { id: "exp-rent",   label: "Rent",             amt: 1300, cat: "housing",   date: dayStr(key, 1)  },
    { id: "exp-health", label: "Health & gym",     amt: 150,  cat: "health",    date: dayStr(key, 2)  },
    { id: "exp-subs",   label: "Subscriptions",    amt: 90,   cat: "fun",       date: dayStr(key, 4)  },
    { id: "exp-util",   label: "Utilities & bills",amt: 220,  cat: "home",      date: dayStr(key, 9)  },
    ..._buildVariable("exp-groc",  "Groceries",       520, "food",      key, [3, 10, 17, 24]),
    ..._buildVariable("exp-dine",  "Dining & coffee", 260, "food",      key, [5, 8, 12, 15, 19, 22]),
    ..._buildVariable("exp-trans", "Transport",       180, "transport", key, [2, 7, 14, 21, 28]),
    ..._buildVariable("exp-shop",  "Shopping",        380, "shopping",  key, [6, 13, 20]),
    ..._buildVariable("exp-other", "Everything else", 200, "other",     key, [11, 18, 25]),
  ];

  return { income, expenses };
}

export const DEFAULT_STATEMENTS: Record<string, MonthStatement> = {
  "2026-04": _buildMonth("2026-04"),
};
