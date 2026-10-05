// Proof of concept for ADR 003 (ticket 002): fetch one US stock, one EU stock
// and EUR/USD for a past date from the chosen keyless sources.
// Usage: node scripts/poc-market-data.mjs [YYYY-MM-DD]   (default 2026-09-30)
// Throwaway: the real client is built in ticket 010.

const date = process.argv[2] ?? "2026-09-30";
const UA = { "User-Agent": "Mozilla/5.0 (stock-league PoC)" };

// Yahoo Finance chart API: daily candles; pick the one whose exchange-local date matches.
async function yahooClose(symbol, day) {
  const start = Date.parse(`${day}T00:00:00Z`) / 1000 - 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`
    + `?period1=${start}&period2=${start + 3 * 86400}&interval=1d`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`Yahoo ${symbol}: HTTP ${res.status}`);
  const r = (await res.json()).chart.result[0];
  const tz = r.meta.exchangeTimezoneName;
  const i = r.timestamp.findIndex(
    (t) => new Date(t * 1000).toLocaleDateString("en-CA", { timeZone: tz }) === day,
  );
  if (i < 0) throw new Error(`Yahoo ${symbol}: no candle on ${day}`);
  return { symbol, close: r.indicators.quote[0].close[i], currency: r.meta.currency, exchange: r.meta.fullExchangeName };
}

// Frankfurter (ECB reference rates): EUR -> currency on a date.
async function ecbRate(currency, day) {
  const res = await fetch(`https://api.frankfurter.dev/v1/${day}?from=EUR&to=${currency}`);
  if (!res.ok) throw new Error(`Frankfurter ${currency}: HTTP ${res.status}`);
  const body = await res.json();
  return { rate: body.rates[currency], rateDate: body.date };
}

const [aapl, sap, usd] = await Promise.all([
  yahooClose("AAPL", date),
  yahooClose("SAP.DE", date),
  ecbRate("USD", date),
]);

console.log(`Date: ${date}`);
console.log(`AAPL   ${aapl.close.toFixed(2)} ${aapl.currency} (${aapl.exchange})`);
console.log(`SAP.DE ${sap.close.toFixed(2)} ${sap.currency} (${sap.exchange})`);
console.log(`EUR/USD ${usd.rate} (ECB, ${usd.rateDate})`);
console.log(`AAPL in EUR: €${(aapl.close / usd.rate).toFixed(2)}`);
