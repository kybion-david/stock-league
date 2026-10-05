# 019. Fun stats: own page, € not %, records from day 2

**Status:** Accepted
**Date:** 2026-10-05

## Context

Ticket 017 adds the "game" extras: today's biggest gainer and loser
(player and pick), best and worst single day, best pick of the game, and
who paid the most fees. They must make sense with only one day of data.
Several readings were possible for each.

## Decision

- **Own page, `/stats`**, linked from the home page. The home page stays a
  short leaderboard that loads fast on a phone.
- **Same day as the leaderboard** (ADR 016): the latest day with prices.
  Nothing before 2026-11-01.
- **Players are ranked by change in €**, like the leaderboard, with % shown
  next to it. Everyone starts at €1,000, so € is easy to read.
- **Picks (instruments) are ranked by % change of their EUR price** since
  the day before, so a pick is judged by itself, not by how much of it
  someone held. FX moves count, because that's what players feel. A pick
  without a price on both days is left out.
- **Best/worst pick of the game** is per player and instrument, in €: the
  gain on shares still held plus what sold shares made, so a sold-out pick
  still counts.
- **A stat that doesn't apply shows "n/a"** with a reason: a "gainer" must
  have gone up and a "loser" down, the fee champion must have paid fees,
  and the best/worst day records start on day 2 (on day 1 they would just
  repeat today's movers).
- **Ties:** the fee champion names everyone tied. Other stats pick one, by
  earliest day, then name, then symbol.

## Consequences

- Stats are computed on every page load from the full ledger and snapshot
  history (`funStats`, one `loadGame` call), like the leaderboard. Fine at
  this size.
- Weekends and holidays carry prices forward (ADR 012), so on those days
  only crypto moves, and "today" may show n/a for stock picks.
