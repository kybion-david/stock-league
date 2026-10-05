# Stock League — Spec

The source of truth for **what** we're building. For where we are, see
`docs/STATUS.md`. For why, see `docs/decisions/`.

## Purpose

A fun, private investment game among friends. Everyone puts in the same
amount at the same time. The app tracks each person's portfolio daily and
shows who's winning. There's no real-money integration: players buy through
their own brokers and enter what they did here.

## Game rules

Confirmed with the project owner (2026-10-05):

- **Players:** about 5–7 friends.
- **Stake:** each player starts with **€1,000** of game cash.
- **Start:** **2026-11-01**. **End:** not decided yet (see STATUS).
- **Winner:** highest total portfolio value at the end. Prizes for the winner
  and penalties for the worst will be defined later; the app doesn't need
  them yet.
- **Allowed investments:** anything players can buy on typical exchanges. The
  app must support **stocks, ETFs and crypto**. Exotic instruments are out of
  scope until someone needs them.
- **Trading:** players can buy, sell and rebalance **at any time** during the
  game. Every trade is recorded in the app (see *Data model*).
- **Fees:** entered **manually** by players, as their own amount. They reduce
  the player's cash, so they cost value.
- **Dividends:** entered **manually** by players. They add to the player's cash.
- **Tolerance:** a player may overspend the €1,000 by up to **5%**. Cash may
  go down to **−€50** to allow for rounding and broker quirks. Anything beyond
  that is rejected.
- **Currency:** everything is shown in **EUR**. Non-EUR instruments are
  converted with a daily end-of-day FX rate. Approximately right is good
  enough.
- **Tracking:** values update **once a day at 22:30 UTC**, after the US market closes.
- **Goal:** a dashboard where everyone can see how they're doing and how they
  compare. It should be fun, not a professional finance tool.

## Features (MVP)

1. **Transaction entry (in-app):** players record their own buys, sells,
   fees and dividends through a simple mobile-friendly form. Anyone who has
   the shared password can edit anyone's entries; that's an accepted trust
   trade-off among friends. Keep an audit trail (who/when created or edited)
   so mistakes can be traced.
2. **Daily price ingestion:** once a day, after US market close, fetch closing
   prices for every instrument held by anyone, plus EUR FX rates, and store
   them as history. Crypto trades 24/7, so it uses the price at fetch time.
3. **Valuation:** for each player and day,
   value = cash + Σ(shares held × close price in EUR).
   Return % = (value − €1,000) / €1,000.
4. **Dashboard:**
   - Leaderboard ranked by current value / return %.
   - Chart of each player's value over time.
   - Per-player breakdown of current holdings, their performance, total fees
     and dividends.
   - Daily movers: best and worst day, for fun.
5. **Access:** an unlisted URL protected by **one shared password**. No user
   accounts. When entering a transaction, players pick their name from a list.

Nice-to-have (not MVP): prizes/penalties display, fun badges/titles,
notifications to a group chat, "what if everyone bought the S&P 500"
benchmark line.

## Data model

A **transaction ledger** per player (ADR 002). Holdings and cash are derived
from it, never stored as the source of truth. Finalize details in ticket 004.

- **Player:** id, name, (optional) avatar/emoji.
- **Instrument:** symbol (as used by the data provider), name, type
  (stock | etf | crypto), currency, exchange.
- **Transaction:** player, date, type (`buy | sell | fee | dividend`),
  instrument (buy/sell/dividend), shares (buy/sell, decimal),
  EUR amount (cents; what the broker charged or paid), note,
  created/updated at + by-whom label.
  - `buy`: cash −= amount, shares += n
  - `sell`: cash += amount, shares −= n (can't sell more than held)
  - `fee`: cash −= amount
  - `dividend`: cash += amount
- **PriceSnapshot:** instrument, date, close price, currency.
- **FxSnapshot:** date, currency, rate to EUR.

Players enter **share count + total EUR paid/received** for each trade, which
is what their broker shows. That gives exact cash tracking and per-holding
gain without needing historical intraday prices.

## Tech stack

Confirmed by the owner on 2026-10-05 (ADR 004). Everything is on free tiers.

- **App:** Next.js (App Router) + TypeScript, mobile-first. Keep it plain
  Next.js, without host-specific features, so it stays portable.
- **Hosting:** Azure Static Web Apps, **Free** plan, with hybrid Next.js
  rendering (server components and API routes on SWA's managed backend).
  Deployed from GitHub Actions. Fallback if needed: Vercel Hobby.
- **Database:** Neon Free (serverless Postgres), EU region. Connected with
  `DATABASE_URL` from the app and from the daily job.
- **Daily job:** GitHub Actions scheduled workflow at 22:30 UTC.
- **Auth:** the shared-password gate is implemented in the app (ADR 002),
  because SWA's built-in password protection isn't on the Free plan.
- **Charts:** to be chosen in ticket 015.
- **Market data:** to be chosen in ticket 002.

## Structure

Nothing beyond docs and agent tooling yet. See the repo map in `AGENTS.md`.
Work happens in sibling git worktrees (`../stock-league-<slug>`), never in
the main checkout; see `AGENTS.md` → Session workflow.

## Commands

None yet. Add install, dev, test, build and deploy commands here once they exist.

## Configuration

Env vars are listed in `.env.example`. Document each one here once it's in use.

## Conventions

- Money as integer euro cents; share counts as decimals (fractional shares
  and crypto quantities are allowed).
- "Game days" are dates in `Europe/Berlin`. A day's snapshot is taken after
  the US close of that day. Store timestamps in UTC.
- More to be added with the scaffold.
