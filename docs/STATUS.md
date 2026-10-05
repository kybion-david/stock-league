# Status

**Single source of truth for current state.** Read at the start of every
session; update at the end of every change. Last updated: 2026-10-05 (ticket 006 done: live on Azure SWA; fixed an edge-cache bypass of the password gate; ticket 005 done; Neon provisioned).

## Current state

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
  locally) or nobody can log in.
- **Database schema done (ticket 004, ADR 008):** five tables in
  `db/migrations/001_initial_schema.sql`, a migration runner
  (`npm run db:migrate`) and a dev seed (`npm run db:seed`). No page reads
  the database yet.
- **Neon is provisioned (2026-10-05):** project in AWS eu-central-1
  (Frankfurt), Postgres 17. Branch `production` is the real database, and
  `dev` is branched from it for local work and seed data. Migration 001 is
  applied on both, and `dev` is seeded. The production pooled string is in
  the GitHub secret `DATABASE_URL`, and the dev string is in the owner's
  local `.env`. Never seed `production`.
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
  GitHub Actions. Both are provisioned (see below).
- **Market-data client done (ticket 010, ADRs 003 and 010):**
  `src/lib/market-data.ts` wraps Yahoo (closes, symbol lookup and search) and
  Frankfurter/ECB (FX to EUR), with retries and typed errors. Unit-tested
  with mocks. The live test (`npm run test:live`) passes locally and on a
  GitHub Actions runner (run 37343774152 on 2026-10-05, all 9 passed).
  Nothing calls it yet: 011 stores snapshots with it, and 008 can use
  `lookupSymbol` to check symbols. The PoC script is deleted.

## Deadline

The game starts on **2026-11-01**. By then, at minimum, players must be able
to enter their trades and prices must be fetched daily. The dashboard can follow shortly after, since history
accumulates either way, as long as daily snapshots are being stored from day one.

## Next up

Tickets live in `tickets/backlog/`, each sized for one AI session. Do the
lowest number whose dependencies are done. 001–007 and 010 are done. Next: 008 (players and instruments) and 011
(snapshot ingestion), both unblocked.

**Secrets in place (2026-10-05):**
- GitHub secrets: `AZURE_STATIC_WEB_APPS_API_TOKEN` and `DATABASE_URL`
  (production pooled string).
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
004, 006, 007, 008, 009, 010, 011, 012, 013, 019, 018.
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

- Hybrid Next.js on Azure SWA is in **preview** (ADR 004). The first deploy
  works (2026-10-05), but SWA's edge caches prerendered pages past the
  proxy, so every page must stay dynamic (ADR 006). If SWA causes more
  trouble, switch to Vercel Hobby with a new ADR.
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
  date is still open at 22:30, so its close is the price at fetch time
  (ADR 010).
- `npm audit` reports 5 high-severity advisories in lint-only dev
  dependencies (via `eslint-config-next`). They're accepted until upstream
  fixes them (ADR 005).
- The password gate's only brute-force protection is a 1 s delay per wrong
  attempt (ADR 006). Use a password that isn't trivially guessable.
