# 023. Production migrations through a manual workflow

**Status:** Accepted
**Date:** 2026-10-07

## Context

Nothing applied migrations to Neon `production` automatically (ADR 008):
`npm run db:migrate` needed the production `DATABASE_URL`, which only the
owner's machine and the GitHub secret hold. Agents in cloud sessions have
neither, so migrations 002 and 003 were stuck waiting for the owner. On
2026-10-07 the owner asked an agent to apply them.

## Decision

- **A `db-migrate` workflow** (`.github/workflows/db-migrate.yml`) runs
  `npm run db:migrate` with the `DATABASE_URL` secret. It only runs when
  started by hand (`workflow_dispatch`), never on push or on a schedule.
- **A branch's migrations go in before its code:** start the workflow on
  the PR's branch (`--ref <branch>`), check it, then merge. Migrations only
  add things, so the old code keeps working on the new schema.
- The `dev` branch is still migrated from the owner's machine; its
  connection string isn't a secret in GitHub.

Rejected:

- **Migrating in `deploy.yml` on every merge:** hands-off, but every merge
  would change the production database without anyone choosing to. A
  manual run keeps that a deliberate step.

## Consequences

- Agents can apply migrations without the owner's `.env`, but only by
  explicitly starting a workflow, which shows in the Actions tab.
- A PR that adds a migration must have it applied (this workflow on its
  branch) before it merges, or the deployed code fails on the missing
  schema.
