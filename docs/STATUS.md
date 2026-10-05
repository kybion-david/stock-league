# Status

**Single source of truth for current state.** Read at the start of every
session; update at the end of every change. Last updated: 2026-10-05 (ticket 006: Azure SWA provisioned, deploy on merge to `main`, ADR 009).

## Current state

- The repository is set up with AI context (`AGENTS.md`, this file, `SPEC.md`,
  ADRs), a ticket backlog, a PR template, and a CI docs-check.
- **App scaffolded (ticket 003, ADR 005):** Next.js 16 + TypeScript +
  Tailwind on Node 22. It's only a placeholder home page plus
  `formatEuroCents` (`src/lib/money.ts`) and its test. The `ci` workflow runs lint,
  typecheck, test and build on every PR.
- **Deploy pipeline (ticket 006, ADR 009):** `swa-stock-league` (SWA Free,
  `rg-stock-league`, Kybion Production subscription) is provisioned with
  Terraform (`infra/`; state in `~/.stock-league/` on the owner's machine).
  `.github/workflows/deploy.yml` deploys every push to `main`. The build is
  `output: "standalone"` (~50 MB, under SWA's 250 MB limit).
  **Live URL:** https://orange-grass-0fb3e1803.4.azurestaticapps.net
- **Ledger logic done (ticket 007, ADR 007):** `src/lib/ledger.ts` has
  `replay` (cash and holdings on any date) and `validate` (create, edit or
  delete, re-checked over the whole ledger at end of each day). It's pure
  and fully unit-tested, but nothing calls it yet: tickets 008/009 wire it to
  the DB and the form. The DB `shares` column must allow 8 decimal places.
- Agents work in one git worktree per task. They merge their own PR once CI
  is green, then remove the worktree (`AGENTS.md` → Session workflow; the
  owner decided on 2026-10-05 not to review PRs). A Claude Code hook blocks
  edits in the main checkout.
- Game rules are confirmed by the owner (see SPEC). Only the end date and prizes are open.
- Hosting and database are chosen (ADR 004, owner-confirmed): Next.js on
  Azure Static Web Apps Free, with Neon Free Postgres and the daily job in
  GitHub Actions. The SWA exists (ticket 006); Neon comes with ticket 004.
- **Market data decided (ADR 003):** Yahoo Finance chart API (prices, crypto,
  symbol search) + Frankfurter/ECB (FX). Keyless, so no env vars. Verified
  with `scripts/poc-market-data.mjs` against 2026-09-30.

## Deadline

The game starts on **2026-11-01**. By then, at minimum, players must be able
to enter their trades and prices must be fetched daily. The dashboard can follow shortly after, since history
accumulates either way, as long as daily snapshots are being stored from day one.

## Next up

Tickets live in `tickets/backlog/`, each sized for one AI session. Do the
lowest number whose dependencies are done. 001–003 and 007 are done; 004
(database schema and seed) is next. 005 (password gate) also only needs 003,
so it can run in parallel. Do 006 (deploy) right after 005 because of the
SWA preview risk below.

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
- Neon Free keeps only 6 hours of point-in-time restore. Daily backups are
  needed before launch (ticket 019).
- **Yahoo's endpoint is unofficial** (ADR 003). It may change, rate-limit, or
  block GitHub Actions IPs. That hasn't been tested from a runner yet: check
  it in ticket 010, and use the fallbacks listed in ADR 003 if it fails.
- Node 22 is pinned (ADR 005), but it hasn't been confirmed that SWA's managed
  backend runs it. Check in ticket 006, and drop to Node 20 if needed.
- `npm audit` reports 5 high-severity advisories in lint-only dev
  dependencies (via `eslint-config-next`). They're accepted until upstream
  fixes them (ADR 005).
