# 013. Daily scheduled job at 22:30 UTC

**Type:** feature
**Depends on:** 006, 011

## Description

Run ingestion automatically every day at **22:30 UTC** (owner-confirmed),
e.g. as a GitHub Actions cron job, writing to the production DB. Allow
manual triggering for a given date. A failed run must be visible.

## Acceptance criteria

- [x] Scheduled run at 22:30 UTC plus manual trigger with optional date
- [x] Uses production secrets stored as GitHub secrets
- [x] Failed run fails the workflow (visible in Actions); optional notification
- [ ] **Running in production before 2026-11-01**
- [x] Context docs updated per AGENTS.md (STATUS, SPEC, ADRs as relevant)
