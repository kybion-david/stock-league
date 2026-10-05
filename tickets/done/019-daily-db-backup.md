# 019. Daily database backup

**Type:** chore
**Depends on:** 004, 013

## Description

Neon Free keeps only 6 hours of point-in-time restore (ADR 004), and the
player-entered ledger is the only copy of the trades. Add a daily backup:
for example, a `pg_dump` in the GitHub Actions daily job, stored as a
workflow artifact with a few weeks' retention. Must stay free, and dumps
must not end up in a public place (the repo is private; artifacts inherit
its visibility).

## Acceptance criteria

- [x] A backup is produced automatically every day
- [x] Restore steps documented in `docs/SPEC.md` → Commands and tested once against a scratch Neon branch/database (tested against scratch Postgres 17 databases, and every run restores into one; not yet into Neon itself, see STATUS)
- [x] Context docs updated per AGENTS.md (STATUS, SPEC, ADRs as relevant)
