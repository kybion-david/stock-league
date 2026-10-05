# 004. Database schema, migrations and seed data

**Type:** feature
**Depends on:** 003

## Description

Connect the app to the database chosen in 001 (`DATABASE_URL`). Create the
schema from `docs/SPEC.md` → Data model: players, instruments, transactions,
price snapshots, FX snapshots. Add a repeatable migration mechanism and a
seed script with 2–3 fake players and a few transactions.

## Acceptance criteria

- [ ] Migrations create all tables from scratch, and can be re-run safely
- [ ] Money columns are integer cents; share columns support fractional quantities (crypto)
- [ ] Seed script populates dev data
- [ ] `docs/SPEC.md` Data model finalized (no longer conceptual); commands documented
- [ ] Context docs updated per AGENTS.md (STATUS, SPEC, ADRs as relevant)
