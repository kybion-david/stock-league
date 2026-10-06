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

1. **Transaction entry (in-app, `/trades`, ADR 013):** players record their
   own buys, sells, fees and dividends through a simple mobile-friendly form.
   `/trades` lists the players; `/trades/<player>` shows that player's cash,
   holdings and history and has the add form; each history row opens an
   edit page with a delete button. Anyone who has the shared password can
   edit anyone's entries; that's an accepted trust trade-off among friends.
   Every add or edit stores who ("Entered by", a player's name picked on the
   form) and when, so mistakes can be traced. Deletes are permanent and
   leave no trace. Every change is checked against the player's whole
   ledger (see *Data model*). Dates can't be in the future. The add form's
   date starts at today and moves on to the new day if the page is left
   open past midnight, unless the player picked a date. Amounts are the
   EUR total without broker fees; fees are entered as their own fee
   transactions.
2. **Daily price ingestion:** once a day, after US market close, fetch closing
   prices for every instrument held by anyone, plus EUR FX rates, and store
   them as history. Crypto trades 24/7, so it uses the price at fetch time.
   Each run first fills rows still missing on the 7 days before (a buy
   entered the next morning or backdated), so those days get real prices.
3. **Valuation (ADR 014, `src/lib/valuation.ts`):** for each player and day,
   value = cash + Σ(shares held × close price in EUR).
   Return % = (value − €1,000) / €1,000. Day change = value − the previous
   day's value. Per-holding gain = value − cost, with cost tracked as
   average cost (sells remove cost pro rata and book a realized gain). A
   missing price or FX rate uses the last known one and is flagged
   `stale`; a holding with no price at all yet is valued at its cost and
   flagged `missing`.
4. **Dashboard:**
   - **Leaderboard (home page `/`, ADR 016, `src/lib/leaderboard.ts`):**
     players ranked by value on the latest day with prices (before the
     first daily run, or from 2026-11-01 while the latest prices are still
     from before it: today), with total return and day change in € and %,
     green ▲ for up and red ▼ for down. Equal values share a place. 🥇🥈🥉
     for places 1–3 and 🥄 for last place from 4th down, but no awards before
     the game starts or while everyone is level. The header says which day
     the prices are from; a player whose value uses an old price, or a new
     buy without a price yet, gets a ⏳ note. Before 2026-11-01 the page shows
     a kick-off countdown and the line-up instead. Each row opens that
     player's page (› on the right).
   - **Chart (`/chart`, ADR 018):** every player's value per day from
     2026-11-01 to the latest day with prices, one coloured line per player
     with their emoji at the end, and a dashed €1,000 line. Tap, drag or use
     the arrow keys to pick a day; the list above shows everyone's value and
     return on it, and is the legend. Before the first prices it says when
     the chart starts.
   - **Player page (`/portfolio/<id>`, `src/lib/portfolio.ts`):** tap a
     leaderboard row to open it. It shows the player's place ("2nd of 5"),
     value, total and day change on the leaderboard's day; cash, invested
     value, fees paid, dividends and the gain or loss booked by selling;
     each holding (biggest first) with shares, average cost, share of the
     player's value, gain or loss in € and %, and a ⏳ note if its price is
     old or missing; instruments sold out of with what they made; their own
     line of the value chart; and their whole transaction history (each row
     opens its edit page). Before 2026-11-01 it shows the kick-off date and
     €1,000 instead of a place.
   - **Fun stats (`/stats`, ADR 019, `src/lib/stats.ts`):** for the
     leaderboard's day: today's top gainer and biggest loser (players, in €
     and %), hottest and coldest pick (instruments, % change of the EUR
     price, with who holds them), best and worst single day so far (from day
     2), best and worst pick of the game (player and instrument, € gain
     including sold shares), and the fee champion. A stat that doesn't apply
     yet shows "n/a". Linked from the home page.
5. **Access:** an unlisted URL protected by **one shared password**. No user
   accounts. When entering a transaction, players pick their name from a list.
6. **Players and instruments** (`/players`, `/instruments`): anyone can add
   or rename players (name, optional emoji) and add instruments. The emoji
   is picked from a grid of about 160 in the form, or left empty (ADR 020).
   An instrument is added by its Yahoo symbol alone: it's checked with Yahoo, which also
   supplies name, type, currency and exchange. Name, type, currency and
   exchange can be edited afterwards; the symbol can't (ADR 011). Duplicate
   names and symbols are rejected, whatever their case ("dave" next to
   "Dave"). Nothing can be deleted.

Nice-to-have (not MVP): prizes/penalties display, fun badges/titles,
notifications to a group chat, "what if everyone bought the S&P 500"
benchmark line.

## Data model

A **transaction ledger** per player (ADR 002). Holdings and cash are derived
from it, never stored as the source of truth. Postgres tables, created by
`db/migrations/` (ADR 008; the SQL file is the exact definition):

- **`players`:** `id`, `name` (unique, non-blank), `emoji` (optional),
  `created_at`.
- **`instruments`:** `id`, `symbol` (unique; the Yahoo symbol), `name`,
  `type` (`stock | etf | crypto`), `currency` (as Yahoo reports it: usually
  ISO 4217, but London listings report `GBp`, pence), `exchange` (optional),
  `created_at`.
- **`transactions`:** `id`, `player_id`, `date` (game day), `type`
  (`buy | sell | fee | dividend`), `instrument_id`, `shares`, `amount_cents`,
  `note`, `created_at` / `created_by`, `updated_at` / `updated_by` (free-text
  labels such as the player's name, used as the audit trail).
  - `amount_cents`: integer > 0, what the broker charged or paid in EUR. The
    sign comes from `type`.
  - `shares`: decimal > 0 with at most 8 significant decimal places
    (trailing zeros are fine). Required for
    buy/sell, and must be empty for fee/dividend.
  - `instrument_id`: required for buy/sell/dividend, optional for fee (e.g. a
    fee belonging to a trade).
  - `buy`: cash −= amount, shares += n
  - `sell`: cash += amount, shares −= n (can't sell more than held)
  - `fee`: cash −= amount
  - `dividend`: cash += amount
  - The cash and selling rules are checked at the **end of each day**, over
    the whole ledger, on every create, edit or delete (ADR 007). Logic:
    `src/lib/ledger.ts` (`replay`, `validate`). Ledger ids are strings, so
    map DB integer ids with `String()`. The entry form
    (`src/lib/transactions.ts`) keys instruments by symbol instead, so rule
    errors name the symbol. It checks and writes each change in one database
    transaction that locks the player's row (ADR 013).
- **`price_snapshots`:** `instrument_id`, `date`, `close` (decimal, in the
  instrument's currency), `currency`, `fetched_at`. One row per instrument
  and day. The market-data client returns closes in **major units** with an
  ISO code (a `GBp` listing's close comes back in `GBP`; ADR 010), so store its
  `currency`, not the instrument's, and look FX up by it.
- **`fx_snapshots`:** `date`, `currency`, `units_per_eur`, `fetched_at`. One
  row per currency and day. The rate is the ECB quote with base EUR
  (1 EUR = `units_per_eur` USD), so EUR value = amount / `units_per_eur`.
  EUR has no rows.
- **How snapshots are filled (ADR 012, `src/lib/ingest.ts`):** every
  calendar day gets a price row for each instrument someone holds (net
  shares > 0 at the end of the day) and an FX row for each non-EUR currency
  those prices are in. Weekends and holidays carry the last close forward
  (and the ECB's last published rate), so a missing row means a failed
  fetch, not a closed market. Rows are upserted: re-running a day updates
  it, and a failed symbol leaves its stored row alone. `fillGaps` adds
  rows still missing on the 7 days before a run's date (late-entered
  trades, a failed day) without re-fetching stored ones.
- **`schema_migrations`:** applied migration file names (managed by the
  migration runner).

The database enforces only shape (types, positive amounts, required fields
per type, uniqueness). Game rules such as €1,000 starting cash, the −€50
floor and no overselling are checked in code (ticket 007), not with database
constraints.

In TypeScript, rows come back as: `integer` → number, `numeric` → exact
string (never parse it to a float for storage or comparison), `date` →
`"YYYY-MM-DD"` string, `timestamptz` → `Date`.

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
  Built as `output: "standalone"` to stay under SWA's 250 MB limit.
  Provisioned with Terraform (`infra/`) and deployed from GitHub Actions on
  every merge to `main` (ADR 009). Fallback if needed: Vercel Hobby.
- **Database:** Neon Free (serverless Postgres), EU region. Connected with
  `DATABASE_URL` from the app and from the daily job.
- **Database access (ADR 008):** `postgres` (postgres.js) driver, no ORM,
  plain SQL migrations, PGlite (in-memory Postgres) for tests, and `tsx`
  to run TypeScript scripts.
- **Daily job (ADR 015):** GitHub Actions scheduled workflow
  (`.github/workflows/daily-ingest.yml`) at 22:30 UTC. It runs
  `npm run ingest` against production with the `DATABASE_URL` secret,
  retries once after 10 minutes, and a failed run shows red in Actions and
  emails whoever last edited the schedule.
- **Backups (ADR 017):** `.github/workflows/daily-backup.yml` dumps
  production with `pg_dump` (from the `postgres:18` image, over Neon's
  direct host) at 03:17 UTC, restores the dump into a throwaway Postgres to
  check it, and keeps it as a workflow artifact for 90 days.
- **Auth (ADR 006):** a shared-password gate built into the app, because
  SWA's built-in password protection isn't on the Free plan. `src/proxy.ts`
  guards every page and API route. `/login` sets a 90-day cookie signed with
  `SITE_PASSWORD`, and the proxy renews it on visits once it's a day old,
  so active players stay logged in.
- **Charts (ADR 018):** no library. Plain SVG laid out by `src/lib/chart.ts`.
- **Market data (ADRs 003, 010):** Yahoo Finance chart API for stock, ETF and
  crypto prices and for symbol search. Frankfurter (ECB reference rates) for
  FX to EUR. Both are keyless and free. Code depends only on the
  `MarketDataClient` interface in `src/lib/market-data.ts`
  (`createMarketDataClient()`): `getClose`, `getFxToEur`, `lookupSymbol`,
  `searchSymbols`. It retries 429/5xx/timeouts with backoff and throws typed
  errors (`UnknownSymbolError`, `NoDataError`, `RateLimitError`, …).

## Structure

One Next.js app at the repo root. See also the repo map in `AGENTS.md`.
Work happens in sibling git worktrees (`../stock-league-<slug>`), never in
the main checkout; see `AGENTS.md` → Session workflow.

- `src/app/`: App Router routes (`page.tsx`, `layout.tsx`, later API
  `route.ts` files). Keep these thin; put logic in `src/lib/`.
- `src/proxy.ts`: the password gate (ADR 006). Next.js 16 calls
  middleware "proxy". Its matcher must keep excluding `/.swa/`.
- `src/app/login/`: login page and its server action.
- `src/app/_components/`: shared components and helpers (`_` keeps the
  folder out of routing). `SubmitButton` gives any server-action form a
  pending state; `ui.tsx` has the page shell (`Page`), `Field` and
  `FormMessage`; `form-state.ts` is the `useActionState` result shape;
  `score.tsx` has the green/red gain chip (`Change`, `tone`) and the
  medal emojis (`AWARDS`).
- `src/app/players/`, `src/app/instruments/`: list + add pages, `[id]` edit
  pages, their server actions (`actions.ts`) and client forms. The player
  form's emoji field is `players/emoji-picker.tsx` (ADR 020).
- `src/app/trades/`: transaction entry. `page.tsx` picks a player,
  `[playerId]/` shows their position, history and add form,
  `[playerId]/[id]/` edits or deletes one transaction. `actions.ts`,
  `transaction-forms.tsx`, `format.ts` (signed amounts) and `history.tsx`
  (the transaction list, also used by the player page) sit alongside.
- `src/app/page.tsx`: the home page with the leaderboard.
- `src/app/not-found.tsx`: the 404 page for unknown URLs and missing
  players, instruments or transactions.
- `src/app/chart/`: the value chart page and its client component
  (`value-chart.tsx`), which the player page reuses for one player.
- `src/app/portfolio/[id]/`: the player page.
- `src/app/stats/`: the fun stats page.
- `src/lib/`: framework-free TypeScript, unit-tested with Vitest. Now:
  money and signed gain/percent formatting (`money.ts`), ledger replay/validation (`ledger.ts`),
  the market-data client (`market-data.ts`), player and instrument data
  access (`players.ts`, `instruments.ts`), the emoji picker's list
  (`emoji.ts`), transaction entry
  (`transactions.ts`: list, create, edit, delete, position, amount
  parsing), snapshot ingestion (`ingest.ts`), and valuation
  (`valuation.ts`: `standings` for one day, `playerSeries` for a range,
  `latestSnapshotDate`; `loadGame` + `standingsFrom` to value several ways
  from one load; pure `valuePlayer` / `valueSeries` underneath),
  the leaderboard (`leaderboard.ts`: day to show, places, awards,
  old-price notes, day formatting), chart layout (`chart.ts`: scales,
  ticks, line paths, end labels, colour slots), the player page's data
  (`portfolio.ts`: one player's leaderboard row, holdings, sold positions,
  series and history), and fun stats (`stats.ts`: `funStats` plus a pure
  function per stat).
- `src/lib/db/`: the `Db` interface (`db.ts`), the postgres.js client
  (`postgres.ts`, with `getDb()` for the app), the PGlite test client
  (`pglite.ts`), the migration runner, the dev seed, and `errors.ts`
  (`InputError`, `isUniqueViolation`, `parseId`).
- `db/migrations/`: numbered SQL migrations (`NNN_name.sql`). Never edit
  one that has been merged; add a new file instead.
- `scripts/`: standalone Node scripts. `db.mts` is the database CLI;
  `ingest.mts` is the snapshot ingestion CLI.
  `copy-standalone-assets.mjs` is part of `npm run build` (ADR 009).
- `.github/workflows/`: `ci.yml` (checks), `deploy.yml` (deploy `main` to
  Azure SWA), `daily-ingest.yml` (the daily job, ADR 015),
  `daily-backup.yml` (daily database backup, ADR 017), `docs-check.yml`,
  and `market-data-live.yml` (live market-data test on a runner; runs on
  demand and on PRs that touch `src/lib/market-data*.ts`).
- `infra/`: Terraform for the Azure resource group and Static Web App
  (ADR 009). State is kept outside the repo.

## Commands

Requires Node 22 (`nvm use` reads `.nvmrc`).

- `npm install`: install dependencies (CI uses `npm ci`).
- `npm run dev`: dev server at http://localhost:3000.
- `npm run lint`: ESLint.
- `npm run typecheck`: generate Next route types, then `tsc --noEmit`.
- `npm test`: Vitest, run once (`npm run test:watch` to watch).
- `npm run build` / `npm start`: production build (standalone, ADR 009)
  and serve it at http://localhost:3000.
- `npm run db:migrate`: apply pending migrations to `DATABASE_URL` (from
  the environment or `.env`). Safe to re-run.
- `npm run db:seed`: insert fake dev players, trades and snapshots. Refuses
  if any players exist, so it can't touch real data.
- `npm run ingest`: fetch and store snapshots in `DATABASE_URL` for
  today's **UTC** date. `npm run ingest -- 2026-11-06` does one date, and
  `npm run ingest -- 2026-11-01 2026-11-30` backfills a range (inclusive).
  Safe to re-run. Every symbol is attempted, and the exit code is 1 if any
  failed (ADR 012). Before the first date it fills rows still missing on
  the 7 days before it.
- **Run the daily job by hand** (to redo or fill a day in production):
  `gh workflow run daily-ingest -f date=2026-11-06`, or *Run workflow* on
  the Actions tab. Without a date it ingests the UTC date 6 hours ago, so
  between 06:00 and 22:00 UTC pass yesterday's date (ADR 015). For a range,
  run `npm run ingest -- <from> <to>` locally with the production
  `DATABASE_URL`.
- `npm run test:live`: live calls to Yahoo and Frankfurter
  (`src/lib/market-data.integration.test.ts`). `npm test` skips them; unit
  tests never touch the network.

### Backups (ADR 017)

- **Back up now:** `gh workflow run daily-backup`, or *Run workflow* on the
  Actions tab. Each run's summary lists the row count of every table.
- **Download a backup:** open a `daily-backup` run in the Actions tab and
  download the `stock-league-YYYY-MM-DD` artifact, or
  `gh run download <run-id>`. Both unzip to `stock-league-YYYY-MM-DD.dump`.
- **Restore** needs `pg_restore` 18 or newer. Without a local install, run
  it as `docker run --rm -it -v "$PWD:/work" -w /work postgres:18 pg_restore …`.
  Use Neon's **direct** connection string (the host without `-pooler`).
  1. Try it on a scratch database first: in the Neon console, add an empty
     database (for example `restore_test`) to the `dev` branch, then
     `pg_restore --no-owner --no-acl --single-transaction --dbname="<its
     connection string>" stock-league-YYYY-MM-DD.dump`. Check
     `select count(*) from transactions`.
  2. Replace production with it:
     `pg_restore --clean --if-exists --no-owner --no-acl --single-transaction
     --dbname="<production connection string>" stock-league-YYYY-MM-DD.dump`.
     This drops and recreates every table in one transaction, so it either
     fully works or changes nothing. Then re-run `daily-ingest` for any
     days after the backup.
  3. Drop the scratch database.

### Deploy (ADR 009)

- **Normal deploys are automatic:** every push to `main` (every merged PR)
  runs `.github/workflows/deploy.yml`. Re-run it by hand with
  `gh workflow run deploy`.
- **Infra changes** (rare, by the owner, logged in with `az login`):

  ```sh
  cd infra
  export ARM_SUBSCRIPTION_ID=$(az account show --query id -o tsv)
  terraform init -backend-config="path=$HOME/.stock-league/terraform.tfstate"
  terraform plan    # then: terraform apply
  ```

- **Set or change a runtime secret:**
  `az staticwebapp appsettings set -n swa-stock-league -g rg-stock-league --setting-names NAME=value`.
- **Deploy token:** after a rotation (`az staticwebapp secrets reset-api-key
  -n swa-stock-league -g rg-stock-league`), store
  `terraform output -raw api_key` as the `AZURE_STATIC_WEB_APPS_API_TOKEN`
  GitHub secret.

## Configuration

Env vars are listed in `.env.example`. Document each one here once it's in use.

- `SITE_PASSWORD` (required): the shared password (ADR 002, 006). If it's
  unset, nobody can log in. Changing it logs every device out. Set it in
  `.env` locally, and as an app setting on SWA.
- `DATABASE_URL`: Postgres connection string. For Neon, use the **pooled**
  connection string (host contains `-pooler`) with `sslmode=require`, as
  copied from Neon (`connect()` drops `channel_binding`, which postgres.js
  can't handle). For local development, use a separate Neon branch (free)
  or any local Postgres, never the production database. The app reads it lazily via
  `getDb()`, so builds and tests don't need it.

Market data needs no env vars: both sources are keyless (ADR 003).

Where production values live (ADR 009); never in git:

- **SWA app settings** (runtime env for the live app): `SITE_PASSWORD` and
  `DATABASE_URL`.
- **GitHub Actions secrets:** `AZURE_STATIC_WEB_APPS_API_TOKEN` (SWA
  deployment token, used by `deploy.yml`) and `DATABASE_URL` (for the daily
  job, ticket 013).
- **Owner's machine:** Terraform state at `~/.stock-league/terraform.tfstate`.

## Conventions

- Money as integer euro cents. Share counts are exact decimals with at most
  **8 decimal places**, passed as decimal strings like `"0.5"` (Postgres
  `numeric`). Never do share arithmetic in floats where the ledger
  rules depend on it (ADR 007).
- "Game days" are dates in `Europe/Berlin`. A day's snapshot is taken after
  the US close of that day. Store timestamps in UTC.
- `Instrument.symbol` is the **Yahoo Finance symbol**: `AAPL` (US), `SAP.DE`
  (Xetra), `IWDA.AS` (Euronext Amsterdam), `BTC-EUR` (crypto, quoted in EUR).
  Find symbols with Yahoo's search (ADR 003).
- Format money only with `formatEuroCents` (`src/lib/money.ts`), which
  renders `€1,234.56`. Gains and losses use `formatSignedEuroCents`
  (`+€12.34`, `−€0.50`) and `formatSignedPercent` (`+5.23%`), with a real
  minus sign (−). Chart axes are the one exception: they show whole euros
  (`formatAxisEuros` in `src/lib/chart.ts`, `€1,050`).
- Import from `src` with the `@/` alias (`@/lib/money`).
- Forms that can fail use `useActionState`. The lib function throws
  `InputError` (`@/lib/db/errors`) with a message for the user, and the
  action turns it into `{ error, values }` (`inputErrorState`) so the form
  shows the error and keeps what was typed. Never call `redirect()` inside
  that `try`: it works by throwing.
- Every form that submits to a server action uses `SubmitButton`
  (`@/app/_components/submit-button`), so a slow request (cold start) shows a
  spinner instead of looking dead. Pass `danger` for a destructive action
  such as a delete.
- Every page renders dynamically (root layout `dynamic = "force-dynamic"`).
  Never make a page static or revalidated: SWA's edge would cache it and
  serve it past the password gate (ADR 006).
- Data-access functions take a `Db` argument (`@/lib/db/db`) instead of
  importing the client, so tests can pass a PGlite `createTestDb()` loaded
  with the real migrations. Write plain SQL with `$1` parameters, and never
  build SQL by concatenating strings.
- Tests are `*.test.ts` files next to the code they test. Pure logic in
  `src/lib/` gets unit tests; pages don't need them yet.
- Style with Tailwind utility classes, designed for phone width first
  (~375 px). Colors come from the `--background` / `--foreground` tokens in
  `src/app/globals.css`, which also handle dark mode. Per-player chart colours
  are the `--series-1`…`--series-8` tokens there (ADR 018); keep their order.
- Everything that CI runs (lint, typecheck, test, build) must pass before a PR
  is merged.
