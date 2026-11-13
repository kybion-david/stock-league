# 027. News feed: computed on page load, weekly recap from templates

**Status:** Accepted
**Date:** 2026-11-13

## Context

The owner asked (2026-11-13) for a news section under the leaderboard
listing everyone's movements per day, plus a short written summary of what
happened. They first said "with the nightly run", then "a weekly run is
good enough", and asked for one covering the game so far so the section
isn't empty. Tone: a fun take on what everyone did, "can always be a bit
mean".

## Decision

- **Computed, not stored** (`src/lib/news.ts`): the feed and the recaps are
  worked out from the ledger and snapshots when the page loads, like the
  leaderboard and fun stats. No migration, no table, no change to the daily
  job. A recap "runs weekly" in effect: it appears as soon as the daily job
  has stored a Friday's prices, and every finished week since kick-off has
  one, so the feed starts full. Corrected prices or late-entered trades fix
  old entries automatically.
- **Days:** one card per game day on which anyone's value moved or anyone
  entered a transaction, listing every player (biggest gain first): day
  change in € and %, places won or lost (only once someone is ahead of
  someone), the day's trades, fees and dividends, and up to two holdings
  whose EUR price moved 3% or more that day. The 🌍 market's day % sits in
  the card's header.
- **Weeks end on Friday** (the last trading day): Saturday to Friday, the
  first week from kick-off (Sun 2026-11-01) to Fri 2026-11-06. Weekend
  crypto moves count towards the next week.
- **The recap is template text, not an LLM.** An LLM would need an API key
  and a paid account, which this project avoids (free, keyless). The
  templates tease: who leads (or snatched the lead), best and worst week,
  who lost to the 🌍 market, the wooden spoon, climbers and fallers, the
  hottest and coldest pick, overtrading, idle cash, and fees. Phrasing
  varies by week but is deterministic, so a page reload never changes it.
- **Where:** the home page shows the newest three days (and any recap
  among them) under the leaderboard, with "Older news →" to `/news`, which
  has the whole feed.

## Consequences

- Each home page load values every player for every game day. With 5–7
  players and a season of a few months that's milliseconds; revisit if it
  ever shows up.
- The recap can't comment on anything the data doesn't hold (why someone
  traded, their strategy text). An LLM-written recap could be added later
  behind a secret, stored per week; this ADR would then be superseded.
