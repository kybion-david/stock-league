// One-off fix (2026-11-03): Gucci or Die Trying's ENR.DE and ASML buys on
// 2026-11-02 have mistyped share counts. Keep the € amounts (they sum to
// €1,000) and set shares = amount / EUR price at the time she entered them.
import { connect } from "../src/lib/db/postgres";
import { getTransaction, updateTransaction } from "../src/lib/transactions";

async function priceAt(symbol: string, at: Date): Promise<{ price: number; currency: string; ts: string }> {
  const p1 = Date.parse("2026-11-02T07:00:00Z") / 1000, p2 = Date.parse("2026-11-02T22:00:00Z") / 1000;
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${p1}&period2=${p2}&interval=5m`, { headers: { "User-Agent": "Mozilla/5.0" } });
  const r = (await res.json()).chart.result[0];
  const q = r.indicators.quote[0];
  const bars = (r.timestamp as number[]).map((ts, i) => ({ ts, close: q.close[i] as number | null })).filter((b) => b.close != null && b.ts <= at.getTime() / 1000);
  const bar = bars.at(-1)!;
  return { price: bar.close!, currency: r.meta.currency, ts: new Date(bar.ts * 1000).toISOString() };
}

const fixes = [
  { id: 18, symbol: "ENR.DE", priceSymbol: "ENR.DE", oldShares: "0.948" },
  { id: 19, symbol: "ASML", priceSymbol: "ASML.AS", oldShares: "0.174" },
];

const db = connect(process.env.DATABASE_URL!);
try {
  for (const f of fixes) {
    const tx = await getTransaction(db, f.id);
    if (!tx || tx.playerId !== 6 || tx.symbol !== f.symbol || tx.shares !== f.oldShares) {
      console.log("SKIP", f.id, "not as expected:", JSON.stringify(tx));
      continue;
    }
    const p = await priceAt(f.priceSymbol, tx.createdAt);
    if (p.currency !== "EUR") throw new Error(`${f.priceSymbol} is in ${p.currency}`);
    const shares = (tx.amountCents / 100 / p.price).toFixed(4);
    const updated = await updateTransaction(db, f.id, {
      date: tx.date,
      type: tx.type,
      instrumentId: String(tx.instrumentId),
      shares,
      amount: (tx.amountCents / 100).toFixed(2),
      note: `Shares corrected 2026-11-03 (were ${f.oldShares}; ${f.priceSymbol} €${p.price.toFixed(2)} at ${p.ts.slice(11, 16)} UTC)`,
      by: "Gucci or Die Trying",
    });
    console.log("FIXED", JSON.stringify({ id: f.id, symbol: f.symbol, price: p, oldShares: f.oldShares, newShares: updated.shares, amountCents: updated.amountCents }));
  }
} finally {
  await db.close();
}
