# Stock League — Spec

The source of truth for **what** we're building. For where we are, see
`docs/STATUS.md`. For why, see `docs/decisions/`.

## Purpose

A fun, private investment game among friends. Everyone puts in the same
amount at the same time. The app tracks each person's portfolio daily and
shows who's winning. There's no real-money integration: players buy through
their own brokers and enter what they bought here.

## Game rules

Confirmed with the project owner:

- **Players:** about 5–7 friends.
- **Stake:** each player invests **€1,000**.
- **Start:** beginning of **November 2026** (exact date: open question).
- **Portfolio entry:** each player records how their €1,000 was split across
  investments, e.g. `€200 Apple`, `€300 Google`, … plus **fees** as their own
  line (e.g. `€3 fees`). Entries should total about €1,000.
- **Fees count:** they're part of the €1,000 but buy nothing, so they lower
  the player's value from day one.
- **Tracking:** portfolio values update **daily** from market prices.
- **Goal:** a dashboard where everyone can see how they're doing and how they
  compare. It should be fun, not a professional finance tool.

Still undecided: end date, winner rule, trading mid-game, dividends, allowed
assets, and more. See **Open questions** in `docs/STATUS.md`. Once one is
decided, move it here.

## Features (MVP)

1. **Players & holdings:** store each player and their holdings (instrument,
   amount invested in EUR, and whatever's needed to derive the share count).
   Fees are stored per player.
2. **Daily price ingestion:** once a day, fetch closing prices for every held
   instrument, plus the FX rates needed to convert to EUR, and store them as
   history.
3. **Valuation:** for each player and day, value = Σ(shares × price in EUR).
   Return % = (value − €1,000) / €1,000.
4. **Dashboard:**
   - Leaderboard ranked by current value / return %.
   - Chart of each player's value over time.
   - Per-player breakdown of holdings and their performance.
   - Daily movers: best and worst day, for fun.
5. **Access:** friends can view it easily on their phones. The auth model is an
   open question.

Nice-to-have (not MVP): fun badges/titles, notifications to a group chat,
"what if everyone bought the S&P 500" benchmark line.

## Data model (draft)

Conceptual; finalize in ticket 002.

- **Player:** id, name, (optional) avatar/emoji.
- **Holding:** player, instrument, invested amount (EUR cents), shares
  (decimal), buy date, buy price & currency.
- **Fee:** player, amount (EUR cents), note.
- **Instrument:** symbol, exchange, name, currency.
- **PriceSnapshot:** instrument, date, close price, currency.
- **FxSnapshot:** date, currency pair, rate.

Portfolio values are **derived** from holdings plus snapshots. Don't store them
as the source of truth, though caching them is fine.

## Tech stack

**Proposed, not yet confirmed.** See `docs/decisions/001-proposed-tech-stack.md`.
Update this section once ticket 001 is done.

## Structure

Nothing beyond docs yet. See the repo map in `AGENTS.md`.

## Commands

None yet. Add install, dev, test, build and deploy commands here once they exist.

## Configuration

Env vars are listed in `.env.example`. Document each one here once it's in use.

## Conventions

- Money as integer euro cents; share counts as decimals (fractional shares
  are allowed).
- Dates in `Europe/Berlin` for "game days"; store timestamps in UTC.
- More to be added with the scaffold.
