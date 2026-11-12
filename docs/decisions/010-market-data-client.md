# 010. Market-data client: major-unit prices, same-day candles, live check on PRs

**Status:** Accepted
**Date:** 2026-10-05

## Context

Ticket 010 implements ADR 003 in `src/lib/market-data.ts`. Three details
weren't settled by ADR 003 or the schema (ADR 008):

- Yahoo quotes London listings in pence (`GBp`). `instruments.currency` keeps
  Yahoo's code, but `fx_snapshots.currency` only takes uppercase ISO codes,
  so a pence price can't be converted with a stored rate as-is.
- ADR 003 says crypto uses `meta.regularMarketPrice` at fetch time. The daily
  candle for the current date is still open, and its close is the latest
  price: on 2026-10-05 at 16:52 UTC it matched `regularMarketPrice` exactly
  for BTC-EUR and SAP.DE.
- Yahoo might block GitHub Actions IPs, and the client can break when Yahoo
  changes its response format. Unit tests use mocks, so they can't catch
  either problem.

## Decision

- `getClose` returns **major units with an ISO code**. `GBp`/`GBX` are
  divided by 100 and become `GBP` (likewise `ZAc`, `ILA`). The division is an
  exact decimal shift, not float math. Snapshots store the close's currency,
  so a snapshot can say `GBP` while its instrument says `GBp`.
- Prices are exact decimal strings, rounded to Yahoo's `priceHint` decimals
  (at least 2) to remove float32 noise.
- One code path for every date and type: the daily candle whose
  exchange-local date matches. For crypto on the current date, that is the
  price at fetch time, which is what ADR 003 intended. The client never works
  out "today" itself; the caller passes the date.
- The live test (`npm run test:live`) runs in the `market-data-live`
  workflow on demand and on every PR that touches `src/lib/market-data*.ts`.

## Consequences

- Valuation only ever divides by an ECB rate keyed by an ISO code. There's no
  special case for pence.
- A Yahoo outage or block turns a client PR red, and red PRs aren't merged.
  Re-run the check later. If it keeps failing, that's the signal to switch to
  the fallbacks in ADR 003. PRs that don't touch the client are unaffected.
- `regularMarketPrice` isn't used, so the client has no "now vs. close"
  special case. If Yahoo ever stops returning the open candle, `getClose`
  throws `NoDataError` for the current date, and the daily job will report it.

Revised on 2026-11-12 by ADR 024: when the day's candle is missing,
`getClose` uses `meta.regularMarketPrice` if `regularMarketTime` is on that day.
