# 005. Daily scheduled update

**Type:** feature
**Depends on:** 004

## Description

Run the ingestion automatically once a day, e.g. as a GitHub Actions cron job,
**after the US market closes** (owner decision). US close is 20:00 UTC in US
summer time and 21:00 UTC in winter. The job runs at **22:30 UTC**
(owner-confirmed 2026-10-05), which covers both. A failed run must be visible: the Action fails, and optionally
notifies.

## Acceptance criteria

- [ ] Scheduled job runs daily and can be triggered manually
- [ ] Results persist in the DB (ADR 002) and the site reflects them
- [ ] Secrets stored as GitHub Actions secrets, documented in SPEC → Configuration
- [ ] **Running before the game start date in November 2026**
