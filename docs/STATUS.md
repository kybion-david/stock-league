# Status

**Single source of truth for current state.** Read at the start of every
session; update at the end of every change. Last updated: 2026-11-13 (repo prepared for going public, ADR 025, ticket 023 for the owner's steps; encrypted backups; stale European prices fixed, ADR 024; ticket 022 done: player strategies; migrations 002 and 003 applied to production; `db-migrate` workflow, ADR 023; demo season reverted, ticket 021 step 1; migration 002 still to apply to Neon; ticket 021 added: end the demo and apply migration 002; ticket 020 done: manual instruments, ADR 022, migration 002 not yet applied to Neon; demo season live in production, ADR 021; emoji picker on the player form, ADR 020; season simulation with three personas on `testing`, five fixes: weekend job failures, price gaps after late entries, 90-day logout, stale trade date, index wording; user-flow test of the integrated `testing` branch, three fixes; open PRs 24–27 and the player page merged into one branch, `feat/integrate-pending`, plus a review pass over the result; ticket 019 done: daily database backup; ticket 017 done: fun stats at `/stats`; ticket 016 done: player page at `/portfolio/<id>`; ticket 015 done: value chart at `/chart`; ticket 014 done: leaderboard on the home page; ticket 013 done: daily job; ticket 012 done: valuation; ticket 009 done: transaction entry at `/trades`; ticket 011 done: snapshot ingestion and backfill CLI; ticket 008 done: player and instrument pages; login button shows a pending state; ticket 006 done: live on Azure SWA; ticket 005 done; Neon provisioned).

## Current state

- **Ready to open-source (2026-11-13, ADR 025):** MIT `LICENSE`,
  `CONTRIBUTING.md` (fork + PR, own Docker or Neon dev database) and a
  README section. A scan of every commit on every branch found no
  secrets. `daily-backup` now encrypts each dump with the
  `BACKUP_PASSPHRASE` secret (added 2026-11-13) before upload, and fails
  if the secret is missing. The 39 older plain backups were deleted on
  2026-11-13, so the only backups are encrypted ones from that day on.
  The repo is still private: ticket 023 lists the owner's remaining
  GitHub-settings steps (history decision, branch protection, visibility).
- **Stale European prices fixed (2026-11-12, ADR 024):** the scheduled
  `daily-ingest` runs start hours late (01:40–04:15 UTC), and by then
  Yahoo's candles for Xetra, Paris and Zurich listings usually lack the
  day, so the day before's close was carried forward and never replaced.
  Rocket Lab (`6RJ0.DE`) showed €53.00 for 2026-11-09 to 11-11, and
  `ALV.DE`, `ENR.DE`, `KRN.DE`, `MC.PA`, `XDWD.DE` and `CFR.SW` were hit
  the same way. `getClose` now falls back to the last traded price of the
  day, and `fillGaps` re-checks carried-looking rows from the last 7 days.
  The first nightly run after the merge corrects 2026-11-05 onwards; days
  2026-11-02 to 11-04 are correct only if the owner's manual runs of
  2026-11-07/08 covered them (re-run `daily-ingest` with the date if not).
  Unit-tested; not yet seen against live Yahoo (cloud sessions can't
  reach it), so check the next `daily-ingest` log: European symbols
  should say `ok`, not `carried`, on weekdays.
- **Demo season ended (2026-10-07, ADR 021):** the demo PR (31) is
  reverted, so the site runs the real game on Neon again: an empty line-up
  and the kick-off countdown until players are added. Lint, typecheck,
  tests and the standalone build (~51 MB again) passed after the revert.
  Deployed on 2026-10-07 (deploy run 37643651813, green). Not yet checked
  on the live site (ticket 021, step 3): cloud sessions can't reach it.
- **Production migrations (ADR 023, 2026-10-07):** the `db-migrate`
  workflow applies pending migrations to Neon `production` when started by
  hand (`docs/SPEC.md` → Commands), so agents no longer need the owner's
  `.env` for it. Its first run (37665885949, 2026-10-07) applied 002 and
  003; production is up to date. The `dev` branch isn't yet.
- **Player strategies done (ticket 022, 2026-10-07):** players write how
  they're playing (≤ 1,000 characters) on `/portfolio/<id>/strategy`; it
  shows on their player page and on `/strategies`, linked from the home
  page (`src/lib/strategy.ts`, unit-tested on PGlite). Migration 003 is
  applied to production. Checked on 2026-10-07 with Playwright
  at 375 px, light and dark, against the standalone build on a local
  Postgres 16 with the dev seed plus a long-named player: write, edit, the
  1,001-character error (text kept), clearing, an unknown player (404),
  both pages. No horizontal scroll, no console errors.
- The repository is set up with AI context (`AGENTS.md`, this file, `SPEC.md`,
  ADRs), a ticket backlog, a PR template, and a CI docs-check.
- **App scaffolded (ticket 003, ADR 005):** Next.js 16 + TypeScript +
  Tailwind on Node 22. It's only a placeholder home page plus
  `formatEuroCents` (`src/lib/money.ts`) and its test. The `ci` workflow runs lint,
  typecheck, test and build on every PR.
- **Deploy pipeline done (ticket 006, ADR 009):** `swa-stock-league` (SWA Free,
  `rg-stock-league`, Kybion Production subscription) is provisioned with
  Terraform (`infra/`; state in `~/.stock-league/` on the owner's machine).
  `.github/workflows/deploy.yml` deploys every push to `main`. The build is
  `output: "standalone"` (~50 MB, under SWA's 250 MB limit).
  SWA runs Node 22. **Live URL:** https://orange-grass-0fb3e1803.4.azurestaticapps.net
  Live checks on 2026-10-05: `/.swa/` health 200, `/` redirects to `/login`
  without a valid cookie, `/api/*` returns 401, and a cookie signed with the
  real password gets in. They also found that SWA's edge cached the
  prerendered `/` and served it to everyone. Fixed by forcing dynamic
  rendering (ADR 006).
- **Password gate done (ticket 005, ADR 006):** `src/proxy.ts` sends every
  page to `/login` and returns 401 for `/api/*` until the shared password is
  entered. The cookie lasts 90 days. `SITE_PASSWORD` must be set (`.env`
  locally) or nobody can log in. The first login after idle time takes a
  few seconds (SWA cold start), so the button shows a spinner, and after 3 s
  a "waking up the server" hint (`SubmitButton`).
- **Database schema done (ticket 004, ADR 008):** five tables in
  `db/migrations/001_initial_schema.sql`, a migration runner
  (`npm run db:migrate`) and a dev seed (`npm run db:seed`).
- **Players and instruments done (ticket 008, ADR 011):** `/players` and
  `/instruments` list, add and edit them (linked from the home page). These
  are the first pages that read the database. Instruments are added by Yahoo
  symbol only and checked with `lookupSymbol`. Checked locally against the
  dev branch on 2026-10-05, at 375 px width with no horizontal scroll.
  Production has no players or instruments yet: the owner (or the players)
  add the real ones before 2026-11-01.
- **Emoji picker (2026-10-06, ADR 020):** the player form's emoji is
  picked from a grid of about 160 emojis (or "No emoji") instead of typed
  from the phone's keyboard. Own component, no library. Checked with
  Playwright at 375 px, light and dark, against a local Postgres: add with
  a picked emoji, the picker clearing after an add, outside tap and Escape
  closing it, the current emoji highlighted on the edit page, and clearing
  it. No horizontal scroll, no console errors. Not yet seen on the live site.
- **Manual instruments done (ticket 020, ADR 022, 2026-10-06):** for
  things Yahoo can't price, such as an options trade. "Something else" on
  `/instruments` adds one by name; it's bought and sold with the normal
  trade form, and each manual holding on `/trades/<player>` has a "Worth
  now" form that stores a hand-typed EUR price (`src/lib/manual.ts`,
  unit-tested on PGlite). The daily job skips it, and its values don't move
  the leaderboard's day. Needs **migration 002**, which isn't applied to
  Neon yet (ticket 021). Checked on 2026-10-06 with Playwright at 375 px
  against the standalone build in demo mode: add (and a duplicate), buy,
  enter a value, the trades page, the player page (✍️ note) and the edit
  page. No horizontal scroll, no console errors. Not seen on the live site.
- **Neon is provisioned (2026-10-05):** project in AWS eu-central-1
  (Frankfurt), Postgres 18 (the server reports 18.6; earlier docs said
  17). Branch `production` is the real database, and
  `dev` is branched from it for local work and seed data. Migration 001 is
  applied on both, and `dev` is seeded. The production pooled string is in
  the GitHub secret `DATABASE_URL`, and the dev string is in the owner's
  local `.env`. Never seed `production`.
- **Ledger logic done (ticket 007, ADR 007):** `src/lib/ledger.ts` has
  `replay` (cash and holdings on any date) and `validate` (create, edit or
  delete, re-checked over the whole ledger at end of each day). Pure and
  fully unit-tested. Used by transaction entry (009) and ingestion (011).
- **Transaction entry done (ticket 009, ADR 013):** `/trades` (linked from
  the home page as "Enter trades") lists players. `/trades/<id>` shows the
  player's cash, holdings and history, with a form to add a buy, sell, fee
  or dividend. Each history row opens an edit page with a delete button.
  Every change is validated against the whole ledger in a DB transaction
  that locks the player's row (`src/lib/transactions.ts`, unit-tested on
  PGlite). The "Entered by" name and timestamps are stored on every add and
  edit. Checked on 2026-10-05 with Playwright at 375 px against a local
  Postgres (migrated and seeded): add, overspend error, fee without shares,
  edit with audit line, cancelled and confirmed delete, refused delete of a
  buy a later sell needs. No horizontal scroll. Not yet tried on the live
  site.
- Agents work in one git worktree per task. They merge their own PR once CI
  is green, then remove the worktree (`AGENTS.md` → Session workflow; the
  owner decided on 2026-10-05 not to review PRs). A Claude Code hook blocks
  edits in the main checkout.
- Game rules are confirmed by the owner (see SPEC). Only the end date and prizes are open.
- Hosting and database are chosen (ADR 004, owner-confirmed): Next.js on
  Azure Static Web Apps Free, with Neon Free Postgres and the daily job in
  GitHub Actions. Both are provisioned (see below).
- **Market-data client done (ticket 010, ADRs 003 and 010):**
  `src/lib/market-data.ts` wraps Yahoo (closes, symbol lookup and search) and
  Frankfurter/ECB (FX to EUR), with retries and typed errors. Unit-tested
  with mocks. The live test (`npm run test:live`) passes locally and on a
  GitHub Actions runner (run 37343774152 on 2026-10-05, all 9 passed).
  `/instruments` uses `lookupSymbol` to check new symbols, and ingestion
  (011) stores snapshots with it. The PoC script is deleted.
- **Snapshot ingestion done (ticket 011, ADR 012):** `src/lib/ingest.ts`
  (`ingestDate`, `ingestRange`) and `npm run ingest [date | from to]`. It
  stores a price row per held instrument and an FX row per needed currency
  for every calendar day, carrying the last close forward on weekends and
  holidays. Re-runs upsert. Failures are reported and give exit code 1, but
  never stop the run. Unit-tested with a fake client. A live run on
  2026-10-05 (in-memory DB, AAPL/VOD.L/BTC-EUR/SAP.DE, 10-03 to 10-05)
  behaved as expected. It hasn't been run against Neon yet: nobody holds
  anything until the game starts. The daily job (013) runs it.
- **Daily job done (ticket 013, ADR 015):** `.github/workflows/daily-ingest.yml`
  runs `npm run ingest` against production every day at 22:30 UTC, with a
  manual trigger that takes an optional date. It passes the UTC date of 6
  hours before the run (so a late run still gets the right day), retries
  once after 10 minutes, and a failed run shows red in Actions and emails
  whoever last edited the cron line. Verified in production on 2026-10-05:
  a manual run for 2026-10-04 (run 37361561246) connected to Neon and
  reported "0 prices, 0 FX rates", as expected with no trades yet. The
  first scheduled run is 2026-10-05 22:30 UTC.
- **Valuation done (ticket 012, ADR 014):** `src/lib/valuation.ts` values
  every player on any day from the ledger and snapshots: cash, holdings in
  EUR, return, day change, per-holding gain (average cost) and realized
  gains, fee and dividend totals. A missing price or FX rate falls back to
  the last known one and is flagged (`priceStatus`, `stale`); a holding
  with no price yet is valued at cost. Entry points for the dashboard:
  `standings(db, date)` (ranked, with day change), `playerSeries(db, from,
  to)` (daily points for the chart) and `latestSnapshotDate(db)` ("last
  updated"). `GAME_START_DATE` is `2026-11-01`. Unit-tested with
  hand-calculated numbers, including the dev seed on PGlite. The
  leaderboard (014) uses `standings`; the chart (015) uses
  `playerSeries`.
- **Leaderboard done (ticket 014, ADR 016):** the home page ranks players
  by value on the latest day with prices, with total and day change, medals,
  a wooden spoon and ⏳ notes for old prices (`src/lib/leaderboard.ts`,
  unit-tested on PGlite). Before 2026-11-01 it shows a kick-off countdown
  and the line-up at €1,000. Checked on 2026-10-05 with Playwright at 375 px
  (light and dark, no horizontal scroll) against a local Postgres: the
  seeded data plus a long-named fourth player and a newer BTC price (stale
  notes, spoon, truncated name), and a pre-game database with players only.
  Not yet seen on the live site with real data. Trades entered today show
  on it only after tonight's run.
- **Value chart done (ticket 015, ADR 018):** `/chart` ("The race", linked
  from the home page) draws every player's value per day since 2026-11-01
  as plain SVG, with no chart library. Layout math is in `src/lib/chart.ts`
  (unit-tested). Tap, drag or arrow keys pick a day, and the list above the
  chart shows values and returns for it. Checked on 2026-10-05 with
  Playwright at 375 px (light and dark, no horizontal scroll, no console
  errors) against local Postgres databases: the dev seed, 7 players over 28
  synthetic days (with a long name, a player without emoji and stale
  prices), a single day, and a pre-game database. Not yet seen on the live
  site with real data. `ValueChart` takes any number of series; the player
  page (016) reuses it for one.
- **Player page done (ticket 016):** each leaderboard row links to
  `/portfolio/<id>`: place, value, total and day change, cash, invested,
  fees, dividends, gain booked by selling, holdings with per-holding gain
  and price notes, sold-out positions, the player's own chart and their
  whole history (rows open the edit pages). Data comes from
  `src/lib/portfolio.ts` (built on the leaderboard and valuation, so it
  always matches the home page; unit-tested on PGlite). The leaderboard's
  gain chip and medals moved to `src/app/_components/score.tsx`. Checked on
  2026-10-05 with Playwright at 375 px (light and dark, no horizontal
  scroll, no console errors) against local Postgres: the dev seed plus a
  full sell (sold-out list), a buy with no price yet, an old price and a
  long name without emoji, a pre-game database, and an unknown id (404).
  Not yet seen on the live site.
- **Fun stats done (ticket 017, ADR 019):** `/stats` (linked from the
  home page as "Fun stats") shows, for the leaderboard's day, today's top
  gainer and biggest loser, hottest and coldest pick, best and worst single
  day (from day 2), best and worst pick of the game and the fee champion.
  Anything that doesn't apply yet shows "n/a"; before 2026-11-01 the page
  just says when stats start. Logic in `src/lib/stats.ts`, unit-tested with
  hand-calculated seed numbers on PGlite. Checked on 2026-10-05 with
  Playwright at 375 px (light and dark, no horizontal scroll) against a
  local Postgres: the seed, and a one-day database (n/a states).
- **Review pass on the integrated site (2026-10-05):** after merging the
  leaderboard, chart, player page, fun stats and backup branches together,
  every page was checked with Playwright at 375 px and 1280 px, light and
  dark, against a local Postgres with 7 players over 34 synthetic days
  (stale prices, a London listing, a long name, a late joiner), the dev seed
  and a pre-game database. Fixed: page titles for `/stats`, player pages
  and trade pages (now the player's name); a styled 404 page with a way
  home; trade history on `/trades/<id>` shows days like the player page
  ("Sat 21 Nov") and both pages share one list component; leaderboard rows
  show a › so it's clear they open the player page; the stats section is
  "Movers on <day>" instead of "Today" (the day is often yesterday); the
  trade page links to the player's page; the player page's "Invested"
  card is now "In holdings" (it's the market value, not what was paid).
- **User-flow test of the integrated site (2026-10-05, branch `testing`):**
  every flow was driven with Playwright at 375 px against the production
  build and local Postgres, with the server clock moved to 2026-11-20, to
  kick-off day and to the day after: login (wrong password, deep link),
  players and instruments (add, duplicate, edit, Yahoo unreachable), trades
  (buy, sell, fee, dividend, overspend, oversell, future date, bad amounts
  and shares, edit with audit line, cancelled and confirmed delete, refused
  delete), the leaderboard, player pages (sell-out, buy without a price,
  ties), the chart (keys, tap, hover) and stats. Fixed: with prices stored
  before kick-off (an early buy), the home page said "0 days to go" all of
  2026-11-01 and "−1 days to go" if that night's run was skipped; it now
  shows the game as started (ADR 016). Dark mode now sets `color-scheme`, so
  the date picker icon is visible and select menus are dark. Player names
  are now unique regardless of case. The player page names the price day
  like the home page. Yahoo was unreachable from the test machine, so only
  the "couldn't reach Yahoo" path of adding an instrument was tried.
- **Season simulation with three personas (2026-10-05, branch `testing`):**
  the production build ran under a faked server clock, with a fake Yahoo
  and Frankfurter giving deterministic prices (weekends, US/EU/UK
  holidays, GBp listing, ECB days). Three personas used separate phones
  from setup on 2026-10-05 to 2027-04-06: Anna (careful ETF saver, comma
  decimals, separate fees, edits), Ben (crypto, dark mode, 8-decimal
  shares, cash at −€50, sell-out, delete, rename) and Chloé (US/UK stocks,
  next-morning and backdated entries, dividends, partial sell). The daily
  job ran as the workflow does, at 22:30 UTC every night, plus a Yahoo
  outage and a manual re-run, a run starting at 01:15 UTC, a late joiner,
  Thanksgiving, Christmas, New Year, Easter and both DST switches. Values
  were checked against the fake prices by hand (GBp → GBP → EUR included).
  Fixed:
  - **The daily job failed every weekend and holiday** (red run, no
    carried rows, ⏳ notes for everyone). Under `tsx` the CLI loads two
    copies of `market-data.ts`, so `instanceof NoDataError` missed the
    client's errors. Unit tests run in one module graph and couldn't see
    it. Now checked by name too (`isNoDataError`).
  - **Late-entered buys never got prices** for the days already ingested:
    they counted at cost there, and their first price landed as one big
    day change (and could top the best/worst day records). The daily job
    now fills rows still missing on the 7 days before its date (ADR 012).
  - **Everyone was logged out in early January**, 90 days after logging
    in before kick-off. The session now renews itself on visits (ADR 006).
  - **A trade tab left open overnight kept yesterday's date** and saved
    the next trade on the wrong day. The add form's date now moves to the
    new day when the page is shown again, unless the player picked a date.
  - Adding `^GSPC` said `"^GSPC" is a INDEX, …`; now "is an index on
    Yahoo, not a stock, ETF or crypto."
- **Daily backup done (ticket 019, ADR 017):** `.github/workflows/daily-backup.yml`
  dumps production at 03:17 UTC, restores the dump into a throwaway
  Postgres 18 in the same run to prove it works, and keeps it as an
  artifact for 90 days. Restore steps are in `docs/SPEC.md` → Commands. Tested
  locally on 2026-10-05 against a seeded Postgres 17: the dump, the
  in-run restore check, a restore into an empty database, an in-place
  `--clean` restore over a damaged database (migrations and inserts still
  worked afterwards), and the failure on an empty dump. The first run
  against production (PR 28, 2026-10-05) failed: Neon runs Postgres 18 and
  `pg_dump` 17 refuses a newer server, so every tool now uses `postgres:18`.
  A restore *into Neon* hasn't been tried yet: Neon is plain Postgres 18,
  so the documented steps should just work.

## Deadline

The game starts on **2026-11-01**. By then, at minimum, players must be able
to enter their trades and prices must be fetched daily. The dashboard can follow shortly after, since history
accumulates either way, as long as daily snapshots are being stored from day one.

## Next up

Tickets live in `tickets/backlog/`, each sized for one AI session. Do the
lowest number whose dependencies are done. 001–017, 019, 020 and 022 are done. 023 is owner-only.
**Owner: ticket 023** (make the repo public).
**First: finish ticket 021.** The demo is reverted and deployed, and
production has every migration (2026-10-07). Left: the owner migrates the
`dev` branch locally (`npm run db:migrate` with the dev `DATABASE_URL`;
until then dev lacks manual instruments and strategies), and someone checks
the live site: no demo banner, a manual instrument can be added, and a
player's strategy can be written.
Next: 018 (launch readiness, after 021). In the first days after 2026-11-01, check the
`daily-ingest` runs in the Actions tab: ingestion only fetches instruments
that someone holds, so those are the first runs that really fetch prices.

**Secrets in place (2026-10-05):**
- GitHub secrets: `AZURE_STATIC_WEB_APPS_API_TOKEN` and `DATABASE_URL`
  (production pooled string), and `BACKUP_PASSPHRASE` (ADR 025, added
  2026-11-13; the owner keeps a copy outside GitHub).
- SWA app settings on `swa-stock-league`: `SITE_PASSWORD` (the real shared
  password) and `DATABASE_URL` (production). Change one with
  `az staticwebapp appsettings set -n swa-stock-league -g rg-stock-league
  --setting-names NAME=value`.
- The shared password is written down in the owner's local `.env`
  (`SITE_PASSWORD`, in the main checkout). That file is gitignored and not
  shared between worktrees: copy it from the main checkout when a task needs
  the database or the password. The owner chose to keep the Neon password
  that was shared in an agent chat.

**Milestone A: must be live by 2026-11-01** (trades can be entered, prices
are captured daily from day one):
004, 006, 007, 008, 009, 010, 011, 012, 013, 014, 019, 018. Open: 018.

**Milestone B: shortly after launch** (history accumulates meanwhile):
015, 016, 017. All done.

## Open questions (ask the project owner, don't guess)

1. **End date** of the game. Not blocking: the app runs open-ended until it's set.
2. **Prizes/penalties:** to be defined later. Not needed for the MVP.
3. **Trades dated before 2026-11-01:** the app accepts them, so an early
   buy's gain or loss before kick-off counts (it shows on the pre-game
   line-up and in "best/worst pick"). 2026-11-01 is a Sunday, so stock and
   ETF buyers can only buy on Fri 30 Oct or Mon 2 Nov. Should trades before
   kick-off be refused, or the early days be ignored? Found in the season
   simulation; not changed.

Answered on 2026-10-05 (now in `docs/SPEC.md` → Game rules, and ADR 002):
start date, winner rule, entry method, allowed instruments, currency,
mid-game trading, fees, dividends, tolerance, access, update time, budget.

## Known issues

- **GitHub can start a scheduled run late or skip it** under load (ADR 015).
  In November 2026 runs started 3–6 hours late, after midnight in Europe
  (see ADR 024 for what that did to European closes).
  Late runs still ingest the right day. A skipped or twice-failed day has
  no rows until someone runs `daily-ingest` by hand with that date
  (`docs/SPEC.md` → Commands).
- Hybrid Next.js on Azure SWA is in **preview** (ADR 004). The first deploy
  works (2026-10-05), but SWA's edge caches prerendered pages past the
  proxy, so every page must stay dynamic (ADR 006). If SWA causes more
  trouble, switch to Vercel Hobby with a new ADR.
- Neon Free keeps only 6 hours of point-in-time restore. The daily backup
  (ADR 017) covers older losses, but anything entered since the last
  03:17 UTC backup is lost on a full restore and has to be re-entered.
- **Yahoo's endpoint is unofficial** (ADR 003). It may change, rate-limit, or
  block GitHub Actions IPs. It worked from a runner on 2026-10-05
  (`market-data-live` workflow), but that's no guarantee. If the daily job
  starts failing with `RateLimitError` or HTTP 403, use the fallbacks in ADR 003.
- Yahoo's historical `close` is **split-adjusted**. After a split, a backfill
  of days before it would return prices that don't match the share counts
  in the ledger. Daily snapshots taken on the day are fine. Only re-fetching
  old dates with `npm run ingest -- <from> <to>` (or re-running an old date)
  is affected, so avoid backfilling across a split. Not handled yet.
- **Day boundary for the daily job:** it ingests the trading date (the UTC
  date at 22:30 UTC), not "today in Berlin" (ADR 015). During summer time
  22:30 UTC is already the next day in Berlin. Crypto's candle for that UTC
  date is still open at 22:30, so its close is the price at fetch time
  (ADR 010).
- **Adding instruments needs Yahoo to answer from SWA's backend** (ADR 011).
  Yahoo has only been verified locally and from GitHub runners so far. If
  it blocks Azure, nobody can add instruments: add a manual-entry fallback.
- `npm audit` reports 5 high-severity advisories in lint-only dev
  dependencies (via `eslint-config-next`). They're accepted until upstream
  fixes them (ADR 005).
- **Deleted transactions leave no trace** (ADR 013): who deleted what
  isn't recorded. Recovery is re-entering it or a backup (ADR 017). Add a
  change-log table if a dispute ever needs it.
- The dev seed's trades are dated November 2026, so until then editing
  them in dev is refused ("can't be in the future"). Add new trades with
  today's date to try the edit page.
- **Chart colours with 6–7 players:** the palette (ADR 018) passes the
  colour checks for neighbouring slots, but not every pair is far apart
  (pink/orange, and green/aqua are the closest). The emoji at each line's
  end and the list above the chart carry identity, so this is accepted.
  If players mix lines up, add tap-to-highlight on the legend.
- The password gate's only brute-force protection is a 1 s delay per wrong
  attempt (ADR 006). Use a password that isn't trivially guessable.
