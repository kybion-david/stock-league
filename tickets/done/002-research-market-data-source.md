# 002. Choose a market data source (prices + FX)

**Type:** research
**Depends on:** none (can run in parallel with 001)

## Description

We need daily closing prices for the instruments players hold, which may span
US and European exchanges, plus daily FX rates to convert them to EUR.
Compare free or cheap options on:

- Coverage of US and EU exchanges (and ETFs/crypto, if allowed)
- Historical closes (needed to backfill and to price the buy date)
- Rate limits vs. our needs (~30 symbols × 1 call/day)
- Terms of use for a private, non-commercial app
- Reliability, and whether an API key is needed

Verify against the providers' current docs. Don't rely on memory, since free
tiers change often.

## Acceptance criteria

- [x] ADR written comparing at least 3 options, with the choice and its reasons
- [x] Small proof-of-concept script fetches one US stock, one EU stock and EUR/USD for a past date
- [x] Env var names added to `.env.example` and `docs/SPEC.md` → Configuration
  (both sources are keyless, so the `MARKET_DATA_API_KEY` placeholder was removed
  and SPEC → Configuration says so)
- [x] `docs/SPEC.md` Tech stack updated
