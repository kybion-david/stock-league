# 022. Manual instruments: a hand-typed price in the normal snapshot table

**Status:** Accepted
**Date:** 2026-10-06

## Context

On 2026-10-06 the owner asked for a way to track things the app can't price,
such as an options trade: a player records what they went in with and keeps
typing in what it's worth now. It should be simple and is expected to be
used rarely.

## Decision

- **A new instrument type, `manual`** (migration 002). It's added on
  `/instruments` by a short name (≤ 32 characters), which is also its
  symbol, so it reads naturally in holdings. No Yahoo check, always EUR.
  The name can be edited later; the symbol, type and currency can't, and a
  priced instrument can't become manual.
- **Bought and sold like anything else**, through the normal ledger, so the
  cash rules, average cost, realized gains, history and audit trail all
  apply unchanged. The hint is to buy 1 share for what you put in.
- **"Worth now" is a per-unit price row in `price_snapshots`**, in EUR,
  entered on the player's trades page for a day (today or earlier, while
  they hold it). The form asks for the total worth of the player's holding
  and divides it by the shares held that day (8 decimals). Re-entering a
  day overwrites it. Because it's a normal price row, valuation, the chart,
  the player page and the fun stats need no special path.
- **Valuation treats a manual price as current, however old.** It never
  gets the ⏳ "old price" note; before the first value it counts at cost.
  The player page says when the value was last typed in (✍️).
- **Manual rows are kept out of the machinery for fetched prices:** the
  daily job never fetches manual instruments, and `latestSnapshotDate`
  ignores their rows, so a value typed in for today doesn't move the
  leaderboard past the last daily run.
- **A value can be €0** (an option that expired worthless), so migration
  002 relaxes `price_snapshots.close` to `>= 0`. Ingestion now refuses a
  fetched close of 0 itself, which the database used to do.

## Consequences

- Very little new code: one migration, `src/lib/manual.ts`, two small forms.
- Nobody checks a manual value. It's as honest as the player typing it,
  like the rest of the trust model (ADR 002).
- The per-unit price is shared: if two players held the same manual
  instrument, one's update would move the other's value. In practice each
  manual instrument belongs to one player.
- There's no history list or delete for manual values; a wrong one is fixed
  by entering the right one for the same day.
- A value entered for today shows on the leaderboard once that day's daily
  run has stored prices, like trades.
