# 014. Valuation: exact cents, last known price, average cost

**Status:** Accepted
**Date:** 2026-10-05

## Context

Ticket 012 turns the ledger and the daily snapshots into each player's
value (`src/lib/valuation.ts`). The spec gives the formula
(cash + Σ shares × close in EUR) but leaves open:

- How to do the arithmetic. Closes, FX rates and share counts are exact
  decimal strings, and money is integer cents.
- What to do when a held instrument has no price (or no FX rate) for the
  day. Ingestion stores a row every calendar day (ADR 012), so a gap means
  a failed fetch, or the job hasn't run yet for a new holding.
- What "per-holding gain" measures, since players sell and rebuy.

## Decision

- **Exact arithmetic, rounded once per holding.** shares × close ÷
  units_per_eur is computed with BigInt and rounded half up to a cent per
  holding. The player's value is cash plus the sum of those cents.
- **Missing price: last known, flagged.** A holding uses the latest close
  and FX rate on or before the day, however old. Each holding has a
  `priceStatus`: `current` (both from the day), `stale` (an earlier row was
  used; `priceDate` / `fxDate` say which) or `missing` (nothing known yet).
  A `missing` holding is valued **at its cost**, so a new buy counts as
  break-even until its first price arrives, not as a €0 crash. A player is
  `stale` if any holding is.
- **Gain uses average cost.** A buy adds its amount to the instrument's
  cost. A sell removes cost in proportion to the shares sold (rounded to a
  cent; selling everything removes all of it) and books the difference as
  `realizedCents`. Holding gain = value − remaining cost. Within one day,
  buys are applied before sells, matching the ledger's end-of-day rule
  (ADR 007). Fees and dividends are reported as player totals, not
  folded into any instrument's gain.
- **Day change** is value at the end of the day minus value at the end of
  the day before, valued the same way. There are no deposits or
  withdrawals, so nothing needs adjusting. Before the first trade a player
  is worth €1,000.
- **Compute on read.** No valuation table: the database functions load all
  transactions and snapshots up to the requested day, then value in memory.
  The game is ~7 players, ~20 instruments and a few hundred days, so that's
  a few thousand rows.

## Consequences

- No schema change.
- A failed fetch shows yesterday's value with a flag instead of a hole or
  a jump. The dashboard should show the flag (e.g. "price from 11-03").
- Valuing at cost hides a real move for the day or two until a price is
  stored. Fine for a game.
- Average cost is simple and order-independent within a day, but differs
  from what a broker using FIFO shows for partial sells.
- If page loads ever get slow, cache or materialize daily values then.
