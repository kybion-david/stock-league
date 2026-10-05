# 004. Price and FX ingestion

**Type:** feature
**Depends on:** 002, 003

## Description

Write the code that, for a given date, fetches closing prices for every held
instrument and the needed FX rates, then stores them as snapshots. It must be
idempotent (re-running a date doesn't duplicate) and must tolerate market
holidays and weekends by carrying forward the last known close.

## Acceptance criteria

- [ ] Fetches and stores PriceSnapshot + FxSnapshot for a given date
- [ ] Idempotent per date; can backfill a date range
- [ ] Handles non-trading days and one failed symbol without aborting the run
- [ ] Valuation function: player value in EUR for any date, with unit tests
- [ ] Docs updated (SPEC data flow, STATUS)
