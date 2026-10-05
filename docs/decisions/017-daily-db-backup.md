# 017. Daily backup: pg_dump to a workflow artifact, restore-checked every run

**Status:** Accepted
**Date:** 2026-10-05

## Context

Neon Free keeps only 6 hours of point-in-time restore (ADR 004), and the
ledger that players type in is the only copy of the trades. Deletes are
permanent (ADR 013). Ticket 019 asks for a free daily backup that never
lands anywhere public.

## Decision

- A separate workflow, `.github/workflows/daily-backup.yml`, runs at
  03:17 UTC every day, can be started by hand, and also runs on PRs that edit
  it. It's separate from `daily-ingest` so a failed ingestion never skips a
  backup, and the other way round. At 03:17 the day's ingestion (and its
  retry) is long done, and nobody is likely to be entering trades.
- **`pg_dump --format=custom`** (compressed, restorable table by table) of
  the production database, without owners or grants, so it restores into
  any database or role.
- **Every tool runs from the `postgres:17` Docker image.** pg_dump must be
  at least the server's major version, and the runner's own client is older.
- **Connect directly, not through the pooler.** The workflow removes
  `-pooler` from the `DATABASE_URL` secret's host to get the same endpoint's
  direct host, so no new secret is needed. Neon advises against pg_dump
  through PgBouncer.
- **Every run proves its dump restores.** The dump is restored in one
  transaction into a throwaway Postgres 17 service container. The run fails
  if that fails or the restored `schema_migrations` is empty, and it writes
  per-table row counts to the run summary.
- **Stored as a workflow artifact** named `stock-league-YYYY-MM-DD`, kept
  for 90 days, uncompressed by the upload (the dump already is). Artifacts
  are only visible to people with access to the private repo.

Alternatives considered:

- **A step in `daily-ingest`:** couples the two jobs' failures and re-runs.
- **Neon's own snapshot/branch:** Free has a single manual snapshot, not a
  daily history.
- **Committing dumps to the repo or a release:** permanent in git history,
  and releases are easier to expose by accident. Cloud storage (Azure Blob)
  would need another resource and credentials.

## Consequences

- The newest backup is at most about a day old. Losing the whole database
  loses at most that day's trades, which players can re-enter.
- The dump is a few kB to a few MB. 90 of them fit easily in the free
  private-repo artifact storage, and a run takes about a minute of Actions
  time.
- Backups older than 90 days are gone. Download one by hand to keep it longer.
- When Neon moves production to Postgres 18, the dump step fails with a
  version mismatch. Bump the image tag in the workflow.
- A failed scheduled run shows red in Actions and emails whoever last
  edited the cron line, like the daily job (ADR 015).
- Restoring is manual: `docs/SPEC.md` → Commands.
