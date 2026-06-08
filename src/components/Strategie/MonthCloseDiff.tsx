import type { MonthStatement, CatKey } from "../../types/grid";
import { fmtMoney, monthLabel, STMT_CATS, CAT_KEYS } from "./strategie";
import { totalIncome, totalExpenses, expensesByCat } from "./helpers";

type Props = {
  prevKey?: string;
  currKey: string;
  prevStmt?: MonthStatement;
  currStmt: MonthStatement;
  currency: string;
};

type Mover = { cat: CatKey; delta: number };

function topMovers(prev: MonthStatement, curr: MonthStatement, limit = 3): Mover[] {
  const p = expensesByCat(prev);
  const c = expensesByCat(curr);
  const movers: Mover[] = CAT_KEYS.map((cat) => ({ cat, delta: (c[cat] || 0) - (p[cat] || 0) }));
  return movers
    .filter((m) => Math.abs(m.delta) > 0.5)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, limit);
}

function DeltaPill({ value, currency, betterWhen }: { value: number; currency: string; betterWhen: "up" | "down" }) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const isBetter = (value > 0 && betterWhen === "up") || (value < 0 && betterWhen === "down");
  const isWorse  = (value > 0 && betterWhen === "down") || (value < 0 && betterWhen === "up");
  const cls = value === 0 ? "mcd-pill mcd-pill--flat" : isBetter ? "mcd-pill mcd-pill--good" : isWorse ? "mcd-pill mcd-pill--bad" : "mcd-pill";
  return (
    <span className={cls}>
      {sign}{fmtMoney(Math.abs(value), currency, { abbr: true })}
    </span>
  );
}

export function MonthCloseDiff({ prevKey, currKey, prevStmt, currStmt, currency }: Props) {
  if (!prevStmt || !prevKey) {
    return (
      <div className="card span-4">
        <div className="card-head">
          <div>
            <div className="card-eyebrow">Since last month</div>
            <div className="card-title">No prior month yet</div>
          </div>
        </div>
        <div className="mcd-empty">Save a second month statement and a diff will appear here — what changed, the biggest movers, the new net.</div>
      </div>
    );
  }

  const prevInc = totalIncome(prevStmt);
  const currInc = totalIncome(currStmt);
  const prevExp = totalExpenses(prevStmt);
  const currExp = totalExpenses(currStmt);
  const netDelta = (currInc - currExp) - (prevInc - prevExp);
  const movers = topMovers(prevStmt, currStmt);

  const headline = netDelta > 0
    ? "Better than last month"
    : netDelta < 0
    ? "Worse than last month"
    : "Same net as last month";

  return (
    <div className="card span-4">
      <div className="card-head">
        <div>
          <div className="card-eyebrow">Since {monthLabel(prevKey)}</div>
          <div className="card-title">{headline}</div>
        </div>
      </div>

      <div className="mcd-body">
        <div className="mcd-headline">
          <DeltaPill value={netDelta} currency={currency} betterWhen="up" />
          <span className="mcd-headline-sub">net change vs. {monthLabel(prevKey)}</span>
        </div>

        <div className="mcd-rows">
          <div className="mcd-row">
            <span className="mcd-row-lab">Income</span>
            <span className="mcd-row-vals">
              <span className="mcd-row-prev">{fmtMoney(prevInc, currency, { abbr: true })}</span>
              <span className="mcd-row-arrow">→</span>
              <span className="mcd-row-curr">{fmtMoney(currInc, currency, { abbr: true })}</span>
              <DeltaPill value={currInc - prevInc} currency={currency} betterWhen="up" />
            </span>
          </div>
          <div className="mcd-row">
            <span className="mcd-row-lab">Expenses</span>
            <span className="mcd-row-vals">
              <span className="mcd-row-prev">{fmtMoney(prevExp, currency, { abbr: true })}</span>
              <span className="mcd-row-arrow">→</span>
              <span className="mcd-row-curr">{fmtMoney(currExp, currency, { abbr: true })}</span>
              <DeltaPill value={currExp - prevExp} currency={currency} betterWhen="down" />
            </span>
          </div>
        </div>

        <div className="mcd-sec-head">
          <h4 className="mcd-sec-title">Biggest movers</h4>
          <span className="mcd-sec-sub">{currKey === prevKey ? "" : `${monthLabel(prevKey)} → ${monthLabel(currKey)}`}</span>
        </div>

        {movers.length > 0 ? (
          <ul className="mcd-movers">
            {movers.map((m) => (
              <li className="mcd-mover" key={m.cat}>
                <span className="mcd-mover-dot" style={{ background: STMT_CATS[m.cat].hue }} />
                <span className="mcd-mover-name">{STMT_CATS[m.cat].label}</span>
                <DeltaPill value={m.delta} currency={currency} betterWhen="down" />
              </li>
            ))}
          </ul>
        ) : (
          <div className="mcd-empty">No category moved more than rounding noise.</div>
        )}
      </div>
    </div>
  );
}
