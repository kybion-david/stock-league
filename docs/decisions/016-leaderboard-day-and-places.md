# 016. Leaderboard: latest priced day, shared places, medals only when it matters

**Status:** Accepted
**Date:** 2026-10-05

## Context

Ticket 014 puts the leaderboard on the home page, built on `standings(db,
date)` (ADR 014). Left open: which day to show, how to rank equal values,
and when medals make sense. Prices arrive once a day at 22:30 UTC
(ADR 015), and everyone starts level at €1,000.

## Decision

- **Show the latest day with prices** (`latestSnapshotDate`), not today.
  Valuing "today" before tonight's run would use yesterday's closes for
  everyone: every player flagged stale and a day change of about zero all
  day. Before the first run ever, show today's game day (Berlin), so the
  line-up shows before and on 2026-11-01. The header says which day the
  prices are from. Likewise, from 2026-11-01 on, if the latest prices are
  from before kick-off (someone bought early, so the job already stored
  prices in October), show today. Otherwise the board would sit on a
  pre-game day on kick-off day, with the countdown saying "0 days to go".
- **Equal values share a place** (1, 1, 3), in name order.
- **Medals** 🥇🥈🥉 for places 1–3 and a wooden spoon 🥄 for last place
  from 4th down. No awards before 2026-11-01, or while everyone is level, so
  nobody "wins" a tie at €1,000.
- **Old prices are shown per player**: a holding with no price yet ("counts
  at cost") or the oldest price or FX day used.

## Consequences

- Trades entered today show up on the leaderboard after tonight's run, not
  straight away. `/trades` shows the cash and holdings at once.
- If the daily job stops, the leaderboard stays on the last priced day, and
  the header date gives it away.
- The leaderboard is computed on every page load (ADR 014). Fine at this
  size.
