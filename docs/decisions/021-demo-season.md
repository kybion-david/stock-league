# 021. Demo season: in-memory fake game behind a build switch

**Status:** Ended (reverted on 2026-10-07, ticket 021)
**Date:** 2026-10-06

The demo season was switched off by reverting its PR (31) on 2026-10-07.
The code described below is gone from `main`; this record stays for the
reasoning.

## Context

Before kick-off on 2026-11-01 the live site only shows a countdown and an
empty line-up, so the owner can't see what the leaderboard, chart, player
pages and stats will look like mid-game. On 2026-10-06 the owner asked for
production to look like the game is well past kick-off, with fake players
who each have their own investing style, and for it to be easy to turn off
again with a revert PR.

## Decision

- **Demo mode replaces the database and the clock in the web app only.**
  `getDb()` returns an in-memory PGlite (`src/lib/demo/db.ts`), migrated
  and filled with a generated season on the first request of each server
  instance. `berlinToday()` returns `DEMO_TODAY` (2027-01-29), so every page
  shows day 90 of the game. Everything else (valuation, leaderboard, stats,
  trade entry) runs unchanged on top.
- **The season is generated, not stored** (`src/lib/demo/season.ts`): seven
  players with traits, 14 instruments (US, German, Dutch and London stocks,
  two world ETFs, four cryptos; USD and GBp included), seeded random-walk
  prices with a few scripted shocks, ECB-style FX, and each player's trades
  from a script. The same input always gives the same season, so every
  instance shows the same game. A unit test checks every ledger passes the
  real ledger rules.
- **The switch is build-time:** `next.config.ts` sets
  `STOCK_LEAGUE_DEMO` to `1` unless it's set, which Next inlines into the
  server code. Tests and the `tsx` scripts (`npm run ingest`, `db:*`) never
  see it, so the daily job and backups keep working on the real, empty
  database. `STOCK_LEAGUE_DEMO=0 npm run dev` gives the normal app locally.
- **A banner on every page** says it's a demo and links to `/demo`, which
  introduces the cast.
- `@electric-sql/pglite` moves to `dependencies` and is kept out of the
  bundle (`serverExternalPackages`); its files and `db/migrations/` are
  shipped with the standalone server (`outputFileTracingIncludes`). The
  standalone build grows from ~50 MB to ~75 MB, still under SWA's 250 MB.

Rejected:

- **Fake rows in the production Neon database:** the daily job would fetch
  prices for them, backups would carry them, real players may be added
  before kick-off, and a revert PR wouldn't remove them.
- **A separate Neon branch for the demo:** needs the SWA app setting
  `DATABASE_URL` changed and changed back by hand, which a revert PR can't
  do, and still needs a faked clock.

## Consequences

- Turning it off is reverting the demo PR (or setting the default in
  `next.config.ts` to `"0"`). Nothing in the real database needs cleaning.
- Changes made on the demo site (trades, players) live in one server
  instance's memory: they vanish when SWA recycles it after idle time, and
  two instances could briefly differ. Fine for a demo.
- New trades in instruments without demo prices count at cost (⏳ note),
  since no ingestion runs in demo mode. Adding an instrument still asks
  Yahoo.
- The first request after idle time takes a few seconds longer (PGlite
  start plus loading ~1,300 price rows).
- The browser's trade form keeps using the real date for its overnight
  date update; since the real date is before `DEMO_TODAY`, it never moves.
