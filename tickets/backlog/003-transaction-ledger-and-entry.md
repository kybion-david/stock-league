# 003. Transaction ledger and in-app entry

**Type:** feature
**Depends on:** 001

## Description

Implement the transaction-ledger model from `docs/SPEC.md` → Data model and
ADR 002: players, instruments, and transactions (`buy`, `sell`, `fee`,
`dividend`), stored in the database chosen in ticket 001. Build a simple
mobile-friendly form where a player picks their name and records a
transaction. Derive each player's current holdings and cash from the ledger.

## Acceptance criteria

- [ ] Players can add, edit and delete their transactions in the app (behind the shared password)
- [ ] Instruments can be added (symbol, name, type stock/etf/crypto, currency); symbol checked against the data provider if feasible
- [ ] Validation: cash may not go below −€50 (ADR 002); can't sell more shares than held; amounts positive
- [ ] Holdings + cash derived by replaying the ledger, for "now" and for any past date
- [ ] Created/updated timestamps and a "by" label stored per transaction
- [ ] Money stored as integer cents; shares as decimals
- [ ] Seed data with 2–3 fake players for development
- [ ] Unit tests for ledger replay and validation
- [ ] `docs/SPEC.md` Data model finalized
