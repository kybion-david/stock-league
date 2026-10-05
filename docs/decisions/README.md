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
| 010 | [Market-data client: major-unit prices, same-day candles, live check on PRs](010-market-data-client.md) | Accepted |
