# 011. Instruments are added by Yahoo symbol only, and the symbol is fixed

**Status:** Accepted
**Date:** 2026-10-05

## Context

Ticket 008 adds pages to manage players and instruments. Every instrument
needs a symbol the daily job can price (ticket 011), plus a name, type and
currency. Players typing these by hand would make mistakes: a symbol Yahoo
doesn't know, a USD stock marked EUR, or `GBP` where Yahoo quotes `GBp`
(pence). Each of these silently breaks valuation.

## Decision

- **Adding an instrument takes only its Yahoo symbol.** The server calls
  `lookupSymbol` (ADR 010) and stores Yahoo's spelling of the symbol, name,
  type, currency and exchange. Symbols Yahoo doesn't know, or that aren't a
  stock, ETF or crypto, are rejected. If Yahoo is unreachable, the user is
  asked to try again. There's no manual-entry fallback.
- **Duplicates are rejected case-insensitively**, both for what was typed and
  for Yahoo's canonical symbol, before the database's unique constraint.
- **The symbol can't be edited.** Name, type, currency and exchange can, to
  fix what Yahoo got wrong. A wrong symbol means adding the right one as a
  new instrument. Currency is never case-normalized (`GBp` ≠ `GBP`).
- **No delete** for players or instruments. Transactions and snapshots
  reference them, and the ticket doesn't need it.

## Consequences

- Adding an instrument depends on Yahoo answering from SWA's backend. If
  Yahoo blocks Azure IPs, nobody can add instruments; the fix would be a
  manual-entry fallback (ADR 003 lists alternative sources).
- A mistyped instrument that's already used in trades stays in the list.
  Harmless, since nothing values an instrument nobody holds.
