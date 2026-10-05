# 003. Data model and holdings input

**Type:** feature
**Depends on:** 001

## Description

Implement the data model from `docs/SPEC.md` (players, holdings, fees,
instruments) and the way holdings get into the system: a data file or an
admin form, depending on ADR 001. Validate each player's total against
€1,000 within the agreed tolerance.

## Acceptance criteria

- [ ] Players, holdings and fees can be recorded per the decided input method
- [ ] Validation: unknown instrument, negative amounts, and total outside tolerance are reported clearly
- [ ] Money stored as integer cents; shares as decimals
- [ ] Example/seed data with 2–3 fake players for development
- [ ] Unit tests for validation
- [ ] `docs/SPEC.md` Data model finalized (no longer "draft")
