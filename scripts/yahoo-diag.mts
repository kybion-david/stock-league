// Temporary diagnostic (not for main): prints Yahoo's raw daily candles for
// European listings, to see why the daily job finds no close for the newest day.
import { createMarketDataClient } from "../src/lib/market-data";

const SYMBOLS = ["6RJ0.DE", "ALV.DE", "MC.PA", "CFR.SW", "RKLB", "GOOGL"];
const DAY = 86_400;
// The day the daily job would ingest now (the UTC date 6 hours ago), and the 4 before it.
const jobDate = new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10);
const back = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) - n * DAY * 1000).toISOString().slice(0, 10);
const dates = [4, 3, 2, 1, 0].map((n) => back(jobDate, n));
const winStart = Date.parse(`${jobDate}T00:00:00Z`) / 1000 - DAY;

console.log(`Now: ${new Date().toISOString()}  job date: ${jobDate}  Berlin: ${new Date().toLocaleString("sv-SE", { timeZone: "Europe/Berlin" })}  New York: ${new Date().toLocaleString("sv-SE", { timeZone: "America/New_York" })}`);
for (const symbol of SYMBOLS) {
  // The same window getClose uses for 2026-11-06, then a wider one.
  for (const [label, p1, p2] of [
    [`getClose window for ${jobDate}`, winStart, winStart + 3 * DAY],
    ["wide window", Date.parse("2026-10-28T00:00:00Z") / 1000, Math.floor(Date.now() / 1000) + DAY],
  ] as const) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (stock-league)", Accept: "application/json" } });
    const body = await res.json();
    const r = body?.chart?.result?.[0];
    console.log(`\n=== ${symbol} (${label}) HTTP ${res.status}`);
    if (!r) { console.log(JSON.stringify(body).slice(0, 500)); continue; }
    const m = r.meta;
    const tz = m.exchangeTimezoneName ?? "UTC";
    console.log(`meta: currency=${m.currency} exchange=${m.exchangeName} tz=${tz} regularMarketPrice=${m.regularMarketPrice} regularMarketTime=${m.regularMarketTime ? new Date(m.regularMarketTime * 1000).toISOString() : m.regularMarketTime} previousClose=${m.chartPreviousClose} granularity=${m.dataGranularity}`);
    const q = r.indicators?.quote?.[0] ?? {};
    (r.timestamp ?? []).forEach((t: number, i: number) => {
      const local = new Date(t * 1000).toLocaleString("sv-SE", { timeZone: tz });
      console.log(`  ${new Date(t * 1000).toISOString()}  local=${local}  open=${q.open?.[i]} close=${q.close?.[i]} volume=${q.volume?.[i]}`);
    });
    if (!r.timestamp) console.log("  (no timestamp array)");
  }
}

console.log("\n=== What our client's getClose says");
const client = createMarketDataClient();
for (const symbol of SYMBOLS) {
  for (const date of dates) {
    try {
      const c = await client.getClose(symbol, date);
      console.log(`${symbol} ${date}: ok ${c.close} ${c.currency}`);
    } catch (err) {
      console.log(`${symbol} ${date}: ${err instanceof Error ? `${err.name}: ${err.message}` : err}`);
    }
  }
}
