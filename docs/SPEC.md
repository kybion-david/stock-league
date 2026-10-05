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

- **App:** Next.js 16 (App Router) + TypeScript, mobile-first. Keep it plain
  Next.js, without host-specific features, so it stays portable.
- **Tooling (ADR 005):** Node 22 LTS (`.nvmrc`), npm, Tailwind CSS 4 for
  styling, ESLint 9 with `eslint-config-next`, Vitest for tests. CI runs
  lint, typecheck, test and build on every PR (`.github/workflows/ci.yml`).
- **Hosting:** Azure Static Web Apps, **Free** plan, with hybrid Next.js
  rendering (server components and API routes on SWA's managed backend).
  Deployed from GitHub Actions. Fallback if needed: Vercel Hobby.
- **Database:** Neon Free (serverless Postgres), EU region. Connected with
  `DATABASE_URL` from the app and from the daily job.
- **Daily job:** GitHub Actions scheduled workflow at 22:30 UTC.
- **Auth (ADR 006):** a shared-password gate built into the app, because
  SWA's built-in password protection isn't on the Free plan. `src/proxy.ts`
  guards every page and API route. `/login` sets a 90-day cookie signed with
  `SITE_PASSWORD`.
- **Charts:** to be chosen in ticket 015.
- **Market data (ADR 003):** Yahoo Finance chart API for stock, ETF and
  crypto prices and for symbol search. Frankfurter (ECB reference rates) for
  FX to EUR. Both are keyless and free.

## Structure

One Next.js app at the repo root. See also the repo map in `AGENTS.md`.
Work happens in sibling git worktrees (`../stock-league-<slug>`), never in
the main checkout; see `AGENTS.md` → Session workflow.

- `src/app/`: App Router routes (`page.tsx`, `layout.tsx`, later API
  `route.ts` files). Keep these thin; put logic in `src/lib/`.
- `src/proxy.ts`: the password gate (ADR 006). Next.js 16 calls
  middleware "proxy". Its matcher must keep excluding `/.swa/`.
- `src/app/login/`: login page and its server action.
- `src/lib/`: framework-free TypeScript (money formatting now; ledger,
  valuation and market-data clients later), unit-tested with Vitest.
- `scripts/`: standalone Node scripts. `poc-market-data.mjs` is the ADR 003
  proof of concept and can be deleted once ticket 010 exists.
- `.github/workflows/`: `ci.yml` (checks) and `docs-check.yml`.

## Commands

Requires Node 22 (`nvm use` reads `.nvmrc`).

- `npm install`: install dependencies (CI uses `npm ci`).
- `npm run dev`: dev server at http://localhost:3000.
- `npm run lint`: ESLint.
- `npm run typecheck`: generate Next route types, then `tsc --noEmit`.
- `npm test`: Vitest, run once (`npm run test:watch` to watch).
- `npm run build` / `npm start`: production build and serve.
- `node scripts/poc-market-data.mjs [YYYY-MM-DD]`: market-data PoC (no
  install). Prints AAPL, SAP.DE and EUR/USD for that date.

Deploy commands come with ticket 006.

## Configuration

Env vars are listed in `.env.example`. Document each one here once it's in use.

- `SITE_PASSWORD` (required): the shared password (ADR 002, 006). If it's
  unset, nobody can log in. Changing it logs every device out. Set it in
  `.env` locally, and as an app setting on SWA (ticket 006).

Market data needs no env vars: both sources are keyless (ADR 003).

## Conventions

- Money as integer euro cents; share counts as decimals (fractional shares
  and crypto quantities are allowed).
- "Game days" are dates in `Europe/Berlin`. A day's snapshot is taken after
  the US close of that day. Store timestamps in UTC.
- `Instrument.symbol` is the **Yahoo Finance symbol**: `AAPL` (US), `SAP.DE`
  (Xetra), `IWDA.AS` (Euronext Amsterdam), `BTC-EUR` (crypto, quoted in EUR).
  Find symbols with Yahoo's search (ADR 003).
- Format money only with `formatEuroCents` (`src/lib/money.ts`), which
  renders `€1,234.56`.
- Import from `src` with the `@/` alias (`@/lib/money`).
- Tests are `*.test.ts` files next to the code they test. Pure logic in
  `src/lib/` gets unit tests; pages don't need them yet.
- Style with Tailwind utility classes, designed for phone width first
  (~375 px). Colors come from the `--background` / `--foreground` tokens in
  `src/app/globals.css`, which also handle dark mode.
- Everything that CI runs (lint, typecheck, test, build) must pass before a PR
  is merged.
