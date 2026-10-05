# 015. Daily job: GitHub Actions cron, date counted back 6 hours, one retry

**Status:** Accepted
**Date:** 2026-10-05

## Context

Ticket 013 runs snapshot ingestion (ADR 012) every day at 22:30 UTC against
the production database. ADR 004 already put the job on GitHub Actions. Left
open: which date a run ingests, what happens when a run fails, and how anyone
finds out.

GitHub's `schedule` trigger is best effort. Runs often start several minutes
late, and under load an hour or more late, which can push a 22:30 run past
midnight UTC. The CLI's default date (UTC today) would then ingest the wrong
day.

## Decision

- `.github/workflows/daily-ingest.yml`: cron `30 22 * * *` plus
  `workflow_dispatch` with an optional `date` input. It runs `npm ci` and
  `npm run ingest -- <date>` with the `DATABASE_URL` secret.
- **The workflow always passes a date.** Without an input it uses the UTC
  date 6 hours before the run starts. A run that starts anywhere from 22:30
  to 06:00 UTC the next morning ingests the intended trading date.
- **One retry.** If ingestion exits non-zero, the job waits 10 minutes and
  runs it again (re-runs only upsert, ADR 012). If the retry also fails, the
  run fails.
- **Notification is GitHub's default:** a failed scheduled run emails the
  person who last changed the cron line, and shows red in the Actions tab.
  No chat bot or extra service.
- Runs never overlap (`concurrency: daily-ingest`). Timeout: 30 minutes.

## Consequences

- A day that failed twice needs a manual run with that date. Later days
  still run, and valuation falls back to the last known price meanwhile
  (ADR 014).
- If GitHub skips a scheduled run entirely (it can under heavy load), that
  day has no rows until someone runs it by hand. Watch the Actions tab in
  the first weeks.
- A manual run with no date between 06:00 and 22:00 UTC ingests the current
  day before the US close, with mid-session prices. Pass yesterday's date
  instead, or let the 22:30 run overwrite it.
- The repo is private, so GitHub won't disable the schedule after 60 days
  without commits (it only does that for public repos). Each run takes about
  a minute of the 2,000 free private-repo minutes a month.
- The workflow doesn't run migrations. A migration that ingestion needs must
  be applied to production before the PR that needs it is merged.
