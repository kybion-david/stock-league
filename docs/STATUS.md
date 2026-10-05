# Status

**Single source of truth for current state.** Read at the start of every
session; update at the end of every change. Last updated: 2026-10-05 (ticket 010 done: market-data client).

## Current state

- The repository is set up with AI context (`AGENTS.md`, this file, `SPEC.md`,
  ADRs), a ticket backlog, a PR template, and a CI docs-check.
- **App scaffolded (ticket 003, ADR 005):** Next.js 16 + TypeScript +
  Tailwind on Node 22. It's only a placeholder home page plus
  `formatEuroCents` (`src/lib/money.ts`) and its test. The `ci` workflow runs lint,
  typecheck, test and build on every PR. Nothing is deployed and there's no
  password gate yet.
- **Database schema done (ticket 004, ADR 008):** five tables in
  `db/migrations/001_initial_schema.sql`, a migration runner
  (`npm run db:migrate`) and a dev seed (`npm run db:seed`). It has been
  verified on PGlite only (in tests, and the CLI against a PGlite socket
  server), **not on Neon**: no Neon project exists yet. No page reads the
  database yet.
- **Ledger logic done (ticket 007, ADR 007):** `src/lib/ledger.ts` has
  `replay` (cash and holdings on any date) and `validate` (create, edit or
  delete, re-checked over the whole ledger at end of each day). It's pure
  and fully unit-tested, but nothing calls it yet: tickets 008/009 wire it to
  the DB (map integer ids with `String()`) and the form.
- Agents work in one git worktree per task. They merge their own PR once CI
  is green, then remove the worktree (`AGENTS.md` → Session workflow; the
  owner decided on 2026-10-05 not to review PRs). A Claude Code hook blocks
  edits in the main checkout.
- Game rules are confirmed by the owner (see SPEC). Only the end date and prizes are open.
- Hosting and database are chosen (ADR 004, owner-confirmed): Next.js on
  Azure Static Web Apps Free, with Neon Free Postgres and the daily job in
  GitHub Actions. Nothing is provisioned yet.
- **Market-data client done (ticket 010, ADR 003):** `src/lib/market-data.ts`
  wraps Yahoo (closes, symbol lookup and search) and Frankfurter/ECB (FX to
  EUR), with retries and typed errors. Unit-tested with mocks; the live test
  (`npm run test:live`) passes locally and on a GitHub Actions runner
  (RUNNER_RESULT). Nothing calls it yet: 011 stores snapshots with it, and
  008 can use `lookupSymbol` to check symbols. The PoC script is deleted.

## Deadline

The game starts on **2026-11-01**. By then, at minimum, players must be able
to enter their trades and prices must be fetched daily. The dashboard can follow shortly after, since history
accumulates either way, as long as daily snapshots are being stored from day one.

## Next up

Tickets live in `tickets/backlog/`, each sized for one AI session. Do the
lowest number whose dependencies are done. 001–004, 007 and 010 are done. 005
(password gate) is next; 008 needs it too. Do 006 (deploy) right after 005
because of the SWA preview risk below.

**Owner action needed (before or during 006):** create the Neon Free
project in an EU region, put its pooled connection string in `.env` as
`DATABASE_URL` (and later in GitHub/SWA secrets), then run
`npm run db:migrate`. Agents can't create the Neon account.

**Milestone A: must be live by 2026-11-01** (trades can be entered, prices
are captured daily from day one):
004, 005, 006, 007, 008, 009, 010, 011, 012, 013, 019, 018.
014 (leaderboard) is strongly wanted for launch too.

**Milestone B: shortly after launch** (history accumulates meanwhile):
015, 016, 017.

## Open questions (ask the project owner, don't guess)

1. **End date** of the game. Not blocking: the app runs open-ended until it's set.
2. **Prizes/penalties:** to be defined later. Not needed for the MVP.

Answered on 2026-10-05 (now in `docs/SPEC.md` → Game rules, and ADR 002):
start date, winner rule, entry method, allowed instruments, currency,
mid-game trading, fees, dividends, tolerance, access, update time, budget.

## Known issues

- Hybrid Next.js on Azure SWA is in **preview** (ADR 004). Ticket 006 should
  deploy early; if it blocks, switch to Vercel Hobby with a new ADR.
- Migrations have only run on PGlite (Postgres 17), never on Neon. The first
  `npm run db:migrate` against Neon is the real check.
- Neon Free keeps only 6 hours of point-in-time restore. Daily backups are
  needed before launch (ticket 019).
- **Yahoo's endpoint is unofficial** (ADR 003). It may change, rate-limit, or
  block GitHub Actions IPs. It worked from a runner on 2026-10-05
  (`market-data-live` workflow), but that's no guarantee. If the daily job
  starts failing with `RateLimitError` or HTTP 403, use the fallbacks in ADR 003.
- Yahoo's historical `close` is **split-adjusted**. After a split, a backfill
  of days before it would return prices that don't match the share counts
  in the ledger. Daily snapshots taken on the day are fine; only re-fetching
  old dates is affected. Not handled yet.
- **Day boundary for the daily job (011/013):** pass the client the trading
  date (the UTC date at 22:30 UTC), not "today in Berlin". During summer time
  22:30 UTC is already the next day in Berlin. Crypto's candle for that UTC
  date is still open at 22:30, so its close is the price at fetch time, as
  SPEC wants.
- Node 22 is pinned (ADR 005), but it hasn't been confirmed that SWA's managed
  backend runs it. Check in ticket 006, and drop to Node 20 if needed.
- `npm audit` reports 5 high-severity advisories in lint-only dev
  dependencies (via `eslint-config-next`). They're accepted until upstream
  fixes them (ADR 005).
