# 011. Snapshot ingestion and backfill

**Type:** feature
**Depends on:** 004, 010

## Description

For a given game day, fetch closes for every instrument any player holds,
plus the needed FX rates, and store them as snapshots. Must be idempotent per
day. On non-trading days, carry forward the last close. If one symbol fails,
the run continues and reports the failure. Include a CLI/script to backfill a
date range.

## Acceptance criteria

- [ ] Ingest command for one date and for a range
- [ ] Re-running a date updates rather than duplicates
- [ ] Weekend/holiday handling via carry-forward; partial failures reported, not fatal
- [ ] Tests with the mocked client
- [ ] Context docs updated per AGENTS.md (STATUS, SPEC, ADRs as relevant)
