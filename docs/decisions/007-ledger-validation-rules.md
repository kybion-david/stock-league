# 007. Ledger validation: end-of-day checks, exact fixed-point shares

**Status:** Accepted
**Date:** 2026-10-05

## Context

Ticket 007 implements the ledger rules from `docs/SPEC.md`. Cash may not go
below −€50, and a player can't sell more shares than they hold. Two details
weren't specified:

- Transactions carry only a **date**, not a time, and players enter them in
  any order. A rebalance (sell A, buy B on the same day) may be entered
  buy-first, and for a moment that looks like overspending.
- Share counts are fractional (crypto, fractional shares). With floats,
  buying 0.1 and then 0.2 and selling 0.3 leaves a non-zero remainder. That
  rejects a legitimate "sell everything" or leaves dust in the holdings.

## Decision

- **Rules are checked at the end of each game day**, after all of that day's
  transactions are netted. The order of same-day entries never matters.
- **Every edit or delete re-checks the whole resulting ledger**, so changing
  an early transaction can be rejected because of a later one.
- **Share counts are exact decimals with at most 8 decimal places**
  (satoshi precision). They're passed around as decimal strings, matching
  Postgres `numeric`, and the ledger does its arithmetic in fixed-point
  `bigint`. More than 8 decimal places is rejected, not rounded.
- Dividends need an instrument but not a current holding, because a
  dividend can be paid after a full sell. A fee may optionally name the
  instrument it belongs to (e.g. a trade's commission); it only affects cash.

## Consequences

- Within one day, a player can briefly hold "negative" shares or cash beyond
  −€50 as long as the day nets out. That's fine for a game among friends.
- The DB `shares` column must reject more than 8 decimal places rather than
  round them (ticket 004 / ADR 008 do this with a `scale(shares) <= 8`
  check), and the form must not accept more decimals.
- Valuation (ticket 012) gets holdings as decimal strings. Converting them to
  a float for share × price is fine there, since it's display value and not
  a ledger rule.
