# 018. Value chart: plain SVG, no chart library

**Status:** Accepted
**Date:** 2026-10-05

## Context

Ticket 015 adds a chart of every player's value over the game: one line per
player, a €1,000 reference line, readable on a phone and fine with a single
day of data. The ticket asked for a lightweight chart library. The chart
is small: 5–7 lines, one point per day, one value axis, with a few hundred
days at most.

Candidates: Recharts (~100 KB gzipped, plus a client-only React tree),
Chart.js (~70 KB, canvas), uPlot (~20 KB, canvas, imperative API), or no
library.

## Decision

- **No chart library.** `src/lib/chart.ts` does the layout as pure,
  unit-tested functions: a value domain rounded to a 1/2/2.5/5 step with at
  least €20 of range, date ticks, line paths and emoji end labels pushed
  apart so they don't overlap. `src/app/chart/value-chart.tsx` draws it as
  SVG in a fixed 340 × 220 viewBox that scales to the screen width.
- **Interaction is a crosshair.** Tapping, dragging (horizontal; vertical
  still scrolls) or the arrow keys pick a day. The list above the chart
  shows everyone's value and return on that day, ranked, and is the legend.
  It starts on the latest day.
- **Colours** are a fixed 8-slot categorical palette checked for colour-blind
  separation in light and dark mode (CSS tokens `--series-1`…`--series-8` in
  `globals.css`, with their own dark-mode steps). A player's colour comes from
  their id order, so it never changes when the ranking does or when someone
  joins. Past 8 players, the slots repeat with dashed lines. Emoji at the line
  ends and the list keep players apart without relying on colour alone.
- The chart lives on its own page, `/chart`, linked from the home page.
  It shows `GAME_START_DATE` to the latest day with prices (same day as the
  leaderboard, ADR 016), using `playerSeries` (ADR 014).

## Consequences

- No new dependency, nothing new for `npm audit`, and the client bundle only
  grows by the small chart component.
- Features a library gives for free (zoom, animation, many axis types) would
  have to be written by hand. The game doesn't need them; if it ever does,
  swap in uPlot behind the same page.
- The player detail page (ticket 016) can reuse `ValueChart` with one series.
- Every page load values every day from scratch (ADR 014). That's fine for a
  few hundred days; cache daily values if it ever gets slow.
