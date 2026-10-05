# 003. Market data: Yahoo Finance chart API + ECB rates via Frankfurter

**Status:** Accepted
**Date:** 2026-10-05

## Context

Ticket 002. We need daily closes for ~30 instruments (stocks, ETFs, crypto;
SPEC → Game rules) plus EUR FX rates, at no cost. The players are euro-based,
so they will likely hold **European listings** (e.g. Xetra, Euronext, UCITS
ETFs like VWCE/IWDA), not just US ones. That one requirement decides the
choice: most free tiers are US-only.

Free tiers checked against the providers' own pricing pages on 2026-10-05:

| Option | Key? | EU stocks/ETFs free? | Limits (free) | Notes |
|---|---|---|---|---|
| **Yahoo Finance chart API** (unofficial) | No | **Yes** (tested SAP.DE, VWCE.DE, IWDA.AS) | Undocumented | Also crypto (BTC-EUR), FX (EURUSD=X), symbol search. Not a supported public API. |
| Twelve Data Basic | Yes | No: "US equities and ETFs", forex, crypto only | 8/min, 800/day | Good US + FX + crypto fallback. |
| Financial Modeling Prep Basic | Yes | No: "US data only", personal use | 250/day | |
| Tiingo Free | Yes | No: US & Chinese stocks | 50/h, 1,000/day | "Internal use… may not display or share the data with another person", which our app does. |
| EODHD Free | Yes | No: demo key "AAPL.US only", 20 calls/day | 20/day, 1 yr history | Good paid option if we ever pay. |
| Alpha Vantage Free | Yes | Not verified | **25/day** | Ruled out on limits alone: too few calls for ~30 symbols + backfill. |
| Stooq CSV | No | Not verified | n/a | Ruled out: now behind a JavaScript proof-of-work challenge, so a script can't use it. |
| **Frankfurter** v2 | No | n/a (FX only) | "No quotas", abuse rate-limit | Blends many central banks by default; `providers=ecb` pins ECB reference rates. v1 is deprecated ("remains available indefinitely"). |
| CoinGecko public | No (demo key optional) | n/a (crypto only) | History limited to past 365 days keyless | Possible crypto fallback. |

## Decision

- **Prices (stocks, ETFs, crypto):** Yahoo Finance chart endpoint
  `query1.finance.yahoo.com/v8/finance/chart/{symbol}` with daily interval.
  Symbol lookup via `/v1/finance/search`. No API key.
- **FX to EUR:** Frankfurter v2, pinned to ECB reference rates:
  `api.frankfurter.dev/v2/rates?date={date}&base=EUR&quotes={ccy}&providers=ecb`.
  No API key. ECB covers ~30 major currencies (USD, GBP, CHF, SEK, …), which
  is enough for us. On weekends and holidays it returns the last published
  rate (tested: 2026-10-03, a Saturday, returns 2026-10-02). Check `date`
  in the response.
- **Symbol convention:** `Instrument.symbol` is the Yahoo symbol: `AAPL` (US),
  `SAP.DE` (Xetra), `IWDA.AS` (Euronext Amsterdam), `BTC-EUR` (crypto quoted
  in EUR, so no FX step is needed). The instrument's currency comes from
  Yahoo's `meta.currency`.
- **Timing vs the 22:30 UTC job:** Xetra/Euronext close at 17:30 CET, the US
  closes at 16:00 ET (20:00–21:00 UTC), and the ECB rate comes out in the
  afternoon CET, so all of that day's data is final by 22:30 UTC. Crypto uses
  `meta.regularMarketPrice` at fetch time (SPEC). Backfill uses the daily candle.
- Proof of concept: `scripts/poc-market-data.mjs`.

## Consequences

- Zero cost, no keys, no signup, and one source covers US, EU and crypto.
  No env var is needed for market data.
- **Risk: Yahoo's endpoint is unofficial and undocumented.** Its terms don't
  grant personal use, it can change or rate-limit without notice, and it may
  block datacenter IPs (e.g. GitHub Actions runners). That hasn't been tested
  yet. Ticket 010 must test it from a runner. Mitigations: ticket 010 hides the provider behind a small interface, and
  ticket 011 reports per-symbol failures and supports backfill, so a missed
  day can be re-fetched. The fallback is Twelve Data (free, key) for US
  stocks, FX and crypto, plus a paid EODHD plan or manual price entry for EU
  listings.
- Gotchas for ticket 010: London listings quote in `GBp` (pence, divide by
  100). Yahoo's own `EURUSD=X` rate differs slightly from the ECB rate. We use
  the ECB rate only.
