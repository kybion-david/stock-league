# 025. Market benchmark: a 70/30 ETF pair valued like a player

**Status:** Accepted
**Date:** 2026-11-13

## Context

The owner asked (2026-11-13) for a "market baseline" on the scoreboard so
everyone can see who is above or below the general market, using the
usual 70% developed / 30% emerging markets split. The design was left to
us. SPEC already listed an S&P 500 benchmark line as a nice-to-have.

## Decision

- **What the market is:** €1,000 put in at kick-off, €700 in
  `EUNL.DE` (iShares Core MSCI World) and €300 in `IS3N.DE` (iShares Core
  MSCI EM IMI), bought at the last close on or before 2026-11-01 (the
  Friday 2026-10-30 close, since kick-off is a Sunday) and never
  rebalanced. Both are Xetra listings in EUR, so no FX is involved, and
  both are among the most traded European-listed ETFs for these indexes.
  Accumulating share classes, so dividends are in the price.
- **Valued as a pretend player** (`src/lib/benchmark.ts`): its ledger is
  two buys on 2026-11-01, and valuation (ADR 014) does the rest: same
  carry-forward, same ⏳ notes, same day change. Nothing is stored for it
  except the two instruments and their price rows.
- **Prices come from the normal daily job** (ADR 012, 015, 024): the CLI
  adds the two instruments if they're missing (`ensureBenchmarkInstruments`)
  and ingests them every day from kick-off whether anyone holds them or
  not (`AlwaysFetch`). Because the feature arrived mid-game, `fillAlways`
  fetches any of their days missing since kick-off, which on the first run
  backfills 2026-11-01 onwards; later runs find nothing missing. The ADR
  024 re-check of carried-looking rows covers them like any other symbol.
  No migration.
- **Where it shows:** on the leaderboard as its own row placed by value
  (dashed borders, grey, 🌍, no place or medal, not a link; it never
  changes the players' places), with a "vs 🌍" chip on each player's row
  and on the player page: the gap in € and as a share of the €1,000 stake
  (everyone started equal, so that's also the gap in return). On `/chart`
  and the player page's chart it's a dotted grey line with 🌍 at its end and
  a row in the readout.

## Consequences

- If a player buys `EUNL.DE` or `IS3N.DE` too, they share the instrument
  row; nothing changes for either.
- The two ETFs appear on `/instruments` like any added instrument.
- Until the first nightly run after this change, the market is hidden
  (no prices on or before kick-off yet).
- Yahoo couldn't be reached from the session that built this, so the
  symbols are checked by the `market-data-live` workflow, not by hand.
- Changing the mix later means editing `BENCHMARK` (and a backfill if the
  symbols change); weights are fixed cents, not a setting.
