# 012. Snapshot ingestion: a row for every day, carry-forward, keep going on failure

**Status:** Accepted
**Date:** 2026-10-05

## Context

Ticket 011 stores daily price and FX snapshots (`src/lib/ingest.ts`). The
schema (ADR 008) and the client (ADR 010) left a few questions open:

- On weekends and exchange holidays the client throws `NoDataError`, and the
  ECB publishes no rate. Should those days have rows at all?
- Which instruments count as "held" on a day?
- The game starts on Sunday 2026-11-01, so the first snapshot day has no
  close and nothing stored to carry forward from.
- What should one failing symbol do to the run and to rows already stored?

## Decision

- **Every calendar day gets a row** for each held instrument and each
  non-EUR currency those closes need. On `NoDataError`, the last close is
  copied to the day (carry-forward). It comes from the database (last row
  in the 10 days before, so re-running a carried day after fixing an
  earlier one picks up the fix), or else from the client, walking back day
  by day for up to 10 days. Re-run a range oldest first to repair it. FX rows are stored under the day with whatever
  rate the ECB gives for it (its last published one on weekends). There is
  no column marking a row as carried; the run's report says so.
- **Held** means net shares > 0 at the end of the day for some player,
  using the ledger's `replay`. Fully sold instruments stop being fetched.
- **Upserts, no transaction around the run.** Each row is upserted on its
  own (`on conflict … do update`), so re-runs update, and a failure only
  skips its own row. Only `NoDataError` triggers carry-forward. Any other
  error (unknown symbol, rate limit, outage) is reported as `failed`, leaves
  any stored row untouched, and makes the CLI exit with code 1 after
  everything else has been attempted.
- The CLI's default date is the **UTC** date (STATUS → Known issues).

## Consequences

- Valuation (ticket 012) can join on exact dates. A missing row only means
  a failure, never a weekend, so "missing price" is a real signal there.
- No schema change was needed, and production only has migration 001.
- A carried row can't be told apart from a real close by looking at the
  database. If the dashboard ever needs that, compare with the previous
  day's row or add a column then.
- Instruments are fetched one at a time to stay gentle with Yahoo. With
  ~20 instruments that's well under a minute.
- A range backfill re-fetches old closes, which Yahoo has split-adjusted
  (STATUS → Known issues).

## Amendment (2026-10-05): fill gaps from the week before

The season simulation (STATUS) showed that players often enter a trade the
next morning or backdate it, after that day's run. Nothing ever fetched
the missed days, so the holding counted at cost there and its first price
landed as one big day change. Each CLI run now first calls `fillGaps`: for
the 7 days before its first date, oldest first, it adds the price rows of
held instruments and the FX rows that are still **missing**. Stored rows
are never re-fetched, so a split after the day can't rewrite them (STATUS
→ Known issues). Older gaps still need `npm run ingest -- <from> <to>`.

The same simulation found that only carry-forward on `NoDataError` had
never worked from the CLI: under `tsx`, the script and `ingest.ts` load two
copies of `market-data.ts`, so `instanceof` failed and every weekend and
holiday was reported as failed. Errors are now recognised by name too
(`isNoDataError`).
