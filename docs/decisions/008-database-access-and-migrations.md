# 008. Database access: postgres.js, plain SQL migrations, PGlite in tests

**Status:** Accepted
**Date:** 2026-10-05

## Context

Ticket 004 connects the app to Neon Postgres (ADR 004) and needs a schema,
a repeatable migration mechanism and seed data. The schema is five small
tables, and AI agents maintain the code. CI has no database and no secrets.
(ADR numbers 006 and 007 were claimed by the parallel password-gate and
ledger tickets.)

## Decision

- **Driver: `postgres` (postgres.js).** It's plain TCP Postgres with no
  dependencies, so the same code runs against Neon, a local Postgres or a
  socket-served PGlite. It's created with `prepare: false` so it works through
  Neon's pooled (PgBouncer) endpoint. Neon's HTTP driver was rejected because
  it only talks to Neon.
- **No ORM or query builder.** Code talks to a three-method `Db` interface
  (`src/lib/db/db.ts`: `query`, `exec`, `transaction`) using plain SQL with
  `$1` parameters. Drizzle or Kysely would add a schema DSL and a migration
  generator, which is more than five tables need.
- **Migrations: numbered plain SQL files** in `db/migrations/`, applied in
  filename order by `src/lib/db/migrate.ts`. Applied names are recorded in
  `schema_migrations`. Each file runs in one transaction with its record, so
  re-running is safe and a failed file leaves nothing behind. Migrations
  only go forward; to fix one, add a new file.
- **Tests: PGlite** (`@electric-sql/pglite`, dev dependency), a real Postgres
  compiled to WASM that runs in memory inside Vitest. Tests run the real
  migration files, so constraints are tested without a database server or
  secrets in CI.
- **Scripts: `tsx`** runs `scripts/db.mts` (`npm run db:migrate`,
  `npm run db:seed`). It works the same on every Node 22 patch release,
  unlike Node's built-in type stripping.
- **Type mapping** is the same for both clients: `numeric` comes back as an
  exact string, `date` as `"YYYY-MM-DD"`, and `integer` as a number. Money is
  `integer` cents (up to about €21M), so it arrives as a JS number that
  `formatEuroCents` accepts.
- **Domain rules stay in code.** The €1,000 starting cash, the −€50 floor and
  "no selling more than you hold" are checked by ticket 007's ledger code,
  not by database constraints. The database only enforces shape: types,
  positive amounts, which fields each transaction type needs, and
  uniqueness.

## Consequences

- Queries are hand-written SQL with no compile-time checking against the
  schema; tests against PGlite catch mistakes.
- PGlite is Postgres 17. Neon may run a different major version. Stick to
  plain SQL and this won't matter.
- `getDb()` connects lazily, so `next build` and CI never need
  `DATABASE_URL`.
- There are no down-migrations. At this scale, a forward fix or a restore
  from backup (ticket 019) is enough.
