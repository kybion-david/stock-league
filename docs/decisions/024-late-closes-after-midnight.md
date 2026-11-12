# 024. Late closes: last traded price as fallback, re-check carried rows

**Status:** Accepted
**Date:** 2026-11-12

## Context

From the first game week on, players holding European listings (Xetra,
Paris, Zurich: `6RJ0.DE` for Rocket Lab, `ALV.DE`, `MC.PA`, `CFR.SW`, …)
saw prices that lagged a day or more. The `daily-ingest` logs showed why:
GitHub starts the 22:30 UTC schedule hours late (01:40–04:15 UTC in the
first two weeks of November), when it's already the next day in Europe.
At that point Yahoo's daily candles for those listings usually leave out
the session that just ended, so `getClose` found no candle, threw
`NoDataError`, and ingestion carried the day before's close forward.
US and Toronto listings were fine: it's still the same day in New York.
Manual runs in European daytime fetched the same days without trouble.

The carried row then stayed for good: `fillGaps` (ADR 012) only adds
missing rows, and the weekend rows after a carried Friday copied it too.
Rocket Lab sat at €53.00 from 2026-11-09 to 2026-11-11, for example.

## Decision

- **`getClose` falls back to the last traded price.** When no candle (or a
  null close) matches the date, but the chart's `meta.regularMarketTime`
  falls on that date in the exchange's time zone, `meta.regularMarketPrice`
  is the close. It is never used for another day, so weekends and holidays
  still raise `NoDataError` and carry forward. This revises ADR 010's "no
  `regularMarketPrice`" consequence for this one case.
- **`fillGaps` re-checks carried-looking rows.** Besides missing rows, it
  re-fetches every stored price in its 7-day window whose close equals the
  stored close of the day before (which is what a carried row looks like;
  the table has no flag for it). A real close replaces the copy; otherwise
  the day is carried again from the day before, which may just have been
  corrected. The candidates are picked before anything changes, so the
  copies after a corrected day get corrected too. Only changed rows are
  reported.

## Consequences

- Wrong prices heal on the next nightly run, back to 7 days, without
  anyone re-running days by hand. Older ones still need a manual run of
  `daily-ingest` with the date.
- Each night costs a few more Yahoo calls: roughly two weekend days per
  held instrument (plus any real repeat close), well under a minute.
- A re-checked row can be rewritten with a split-adjusted close if a split
  happened within the last 7 days (STATUS → Known issues). Rows that
  differ from the day before are still never re-fetched.
- If Yahoo also stops reporting `regularMarketTime` for the ended session,
  the day is carried and fixed by the next night's re-check instead.
