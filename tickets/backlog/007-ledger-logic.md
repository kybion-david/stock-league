# 007. Ledger logic: holdings, cash and validation

**Type:** feature
**Depends on:** 003

## Description

Pure, framework-free domain functions. Given a player's transactions, replay
them up to any date to get cash and holdings (shares per instrument).
Validate a new or edited transaction: cash may not go below −€50, you can't
sell more shares than you hold, amounts must be positive, and buy, sell and
dividend transactions need an instrument. No DB or UI work.

## Acceptance criteria

- [ ] `replay(transactions, date)` → { cash, holdings } with integer-cent cash
- [ ] `validate(existingTransactions, change)` returns clear error messages; edits and deletes are re-validated against the whole ledger (e.g. deleting a buy that a later sell depends on)
- [ ] Thorough unit tests, including edge cases at exactly −€50 and fractional shares
- [ ] Context docs updated per AGENTS.md (STATUS, SPEC, ADRs as relevant)
