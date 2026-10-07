# Architecture Decision Records

One file per non-obvious decision: `NNN-short-slug.md`, numbered in order and
never renumbered. When a decision changes, add a new ADR that supersedes the
old one, and set the old one's status to `Superseded by NNN`. Don't delete it.

## Template

```markdown
# NNN. Title

**Status:** Proposed | Accepted | Superseded by NNN
**Date:** YYYY-MM-DD

## Context
What problem or question forced a choice.

## Decision
What we chose.

## Consequences
What gets easier, what gets harder, what we gave up.
```

## Index

| # | Title | Status |
|---|---|---|
| 001 | [Proposed tech stack](001-proposed-tech-stack.md) | Superseded by 004 |
| 002 | [Ledger, shared password, free hosted DB](002-ledger-shared-password-db.md) | Accepted |
| 003 | [Market data: Yahoo Finance + ECB/Frankfurter](003-market-data-source.md) | Accepted |
| 004 | [Hosting on Azure SWA Free, database on Neon Free](004-hosting-and-database.md) | Accepted |
| 005 | [App tooling: Node 22, Tailwind, ESLint, Vitest](005-app-tooling.md) | Accepted |
| 006 | [Password gate: Next.js proxy + password-signed cookie](006-password-gate.md) | Accepted |
| 007 | [Ledger validation: end-of-day checks, exact shares](007-ledger-validation-rules.md) | Accepted |
| 008 | [Database access: postgres.js, SQL migrations, PGlite tests](008-database-access-and-migrations.md) | Accepted |
| 009 | [Deploy pipeline: Terraform once, token deploy on merge](009-deploy-pipeline.md) | Accepted |
| 010 | [Market-data client: major-unit prices, same-day candles, live check on PRs](010-market-data-client.md) | Accepted |
| 011 | [Instruments are added by Yahoo symbol only, and the symbol is fixed](011-instruments-from-yahoo.md) | Accepted |
| 012 | [Snapshot ingestion: a row for every day, carry-forward, keep going on failure](012-snapshot-ingestion.md) | Accepted |
| 013 | [Transaction entry: pick-a-name audit label, hard delete, no future dates](013-transaction-entry.md) | Accepted |
| 014 | [Valuation: exact cents, last known price, average cost](014-valuation.md) | Accepted |
| 015 | [Daily job: GitHub Actions cron, date counted back 6 hours, one retry](015-daily-ingest-job.md) | Accepted |
| 016 | [Leaderboard: latest priced day, shared places, medals only when it matters](016-leaderboard-day-and-places.md) | Accepted |
| 017 | [Daily backup: pg_dump to a workflow artifact, restore-checked every run](017-daily-db-backup.md) | Accepted |
| 018 | [Value chart: plain SVG, no chart library](018-value-chart-plain-svg.md) | Accepted |
| 019 | [Fun stats: own page, € not %, records from day 2](019-fun-stats.md) | Accepted |
| 020 | [Emoji picker: a fixed grid of our own, no library](020-emoji-picker.md) | Accepted |
| 021 | [Demo season: in-memory fake game behind a build switch](021-demo-season.md) | Ended (2026-10-07) |
| 022 | [Manual instruments: a hand-typed price in the normal snapshot table](022-manual-instruments.md) | Accepted |
| 023 | [Production migrations through a manual workflow](023-manual-migrate-workflow.md) | Accepted |
