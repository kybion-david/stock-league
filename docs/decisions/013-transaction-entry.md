# 013. Transaction entry: pick-a-name audit label, hard delete, no future dates

**Status:** Accepted
**Date:** 2026-10-05

## Context

Ticket 009 adds the form where players record buys, sells, fees and
dividends (`/trades`, `src/lib/transactions.ts`). There are no user
accounts (ADR 002, 006), yet the SPEC asks for an audit trail ("who/when
created or edited"). Several details weren't specified:

- What goes into the `created_by` / `updated_by` labels.
- Whether a delete should leave a trace.
- Which dates are allowed.
- How to keep two people editing one ledger at the same time from slipping
  past the ledger rules (ADR 007).

## Decision

- **The audit label is a player's name, picked on every change** ("Entered
  by", defaulting to the ledger's owner). The server only accepts a current
  player's name. It's honest-system tracing among friends, not
  authentication.
- **Deletes are hard deletes.** The row is gone, with no log of who
  deleted it. A soft delete or a change-log table would need a migration
  and a filter in every query (ingestion, valuation), and migrations aren't
  applied automatically on deploy. A delete is still checked against the
  ledger (deleting a buy that a later sell needs is refused) and asks for
  confirmation in the browser.
- **No dates in the future** (after today in `Europe/Berlin`). Dates before
  the game start are allowed: the SPEC doesn't forbid them, and testing
  needs them.
- **Each change runs in one database transaction that locks the player's
  row** (`select … for update`), re-reads that player's ledger, validates
  the change with `validate` (ADR 007), then writes. Two concurrent changes
  to one ledger run one after the other, so each is checked against the
  ledger it actually changes.
- **The form's ledger keys instruments by symbol**, not by id, so rule
  errors read "more AAPL shares would be sold than held". Symbols are unique
  and can't change (ADR 011), so this is equivalent.
- **Amounts are typed in euros** with a dot or a comma and at most 2
  decimals ("12,50" works on German phone keyboards). Thousands separators
  are rejected rather than guessed. Shares also accept a comma.
- **Buy and sell amounts exclude broker fees**, which are entered as
  separate fee transactions (the form says so). That keeps the fee total
  (ticket 016) meaningful and avoids counting a fee twice.

## Consequences

- A mistaken or malicious delete can't be traced to a person. Recovery is
  re-entering the trade, or a backup (Neon's 6-hour restore window, daily
  backups from ticket 019). Revisit with a change-log table if it happens.
- Anyone can pick any name as "Entered by". Acceptable under the shared
  password trust model (ADR 002).
- The dev seed's trades are dated November 2026, so before then they can be
  deleted in dev but not edited (an edit re-checks the date).
