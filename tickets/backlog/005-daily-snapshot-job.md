# 005. Daily scheduled update

**Type:** feature
**Depends on:** 004

## Description

Run the ingestion automatically once a day, e.g. as a GitHub Actions cron job.
The run time is set by the owner's answer to the "refresh timing" open
question. A failed run must be visible: the Action fails, and optionally
notifies.

## Acceptance criteria

- [ ] Scheduled job runs daily and can be triggered manually
- [ ] Results persist (committed data or DB, per ADR 001) and the site reflects them
- [ ] Secrets stored as GitHub Actions secrets, documented in SPEC → Configuration
- [ ] **Running before the game start date in November 2026**
