// One-off dry run: for each of Gucci or Die Trying's buys, fetch Yahoo's
// 5-minute bars for 2026-11-02 and print the price at the time it was entered,
// the price the entered shares imply, and the shares that would match.
import { connect } from "../src/lib/db/postgres";

const db = connect(process.env.DATABASE_URL!);
try {
  const txs = await db.query<{ id: number; symbol: string; currency: string; shares: string; amount_cents: number; created_at: Date }>(
    `select t.id, i.symbol, i.currency, t.shares, t.amount_cents, t.created_at
       from transactions t join instruments i on i.id = t.instrument_id
      where t.player_id = 6 and t.type = 'buy' order by t.id`,
  );
  const fx: Record<string, number> = { EUR: 1 };
  for (const r of await db.query<{ currency: string; units_per_eur: string }>(
    "select currency, units_per_eur from fx_snapshots where date = '2026-11-02'",
  )) fx[r.currency] = Number(r.units_per_eur);
  const p1 = Date.parse("2026-11-02T07:00:00Z") / 1000, p2 = Date.parse("2026-11-02T22:00:00Z") / 1000;
  for (const t of txs) {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${t.symbol}?period1=${p1}&period2=${p2}&interval=5m`, { headers: { "User-Agent": "Mozilla/5.0" } });
    const r = (await res.json()).chart.result[0];
    const q = r.indicators.quote[0];
    const bars = (r.timestamp as number[]).map((ts, i) => ({ ts, close: q.close[i] as number | null })).filter((b) => b.close != null);
    const at = t.created_at.getTime() / 1000;
    const before = bars.filter((b) => b.ts <= at);
    const bar = before.at(-1) ?? bars[0];
    console.log("BARS", t.symbol, "first", new Date(bars[0].ts * 1000).toISOString(), bars[0].close, "last", new Date(bars.at(-1)!.ts * 1000).toISOString(), bars.at(-1)!.close);
    const priceEur = bar.close! / fx[t.currency];
    const implied = t.amount_cents / 100 / Number(t.shares);
    console.log("TX", JSON.stringify({
      id: t.id, symbol: t.symbol, entered: t.created_at.toISOString(), bar: new Date(bar.ts * 1000).toISOString(),
      priceLocal: bar.close, priceEur: priceEur.toFixed(2), impliedEur: implied.toFixed(2),
      diffPct: ((implied / priceEur - 1) * 100).toFixed(1), shares: t.shares,
      suggestedShares: (t.amount_cents / 100 / priceEur).toFixed(4),
    }));
  }
} finally {
  await db.close();
}
