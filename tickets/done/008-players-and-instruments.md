# 008. Manage players and instruments

**Type:** feature
**Depends on:** 004, 005

## Description

Simple pages to add or rename players and to add instruments (symbol as
used by the data provider, name, type stock/etf/crypto, currency). Once ticket
010 exists, check that the symbol is real; until then, plain input is fine.

## Acceptance criteria

- [x] Add/edit players (name, optional emoji)
- [x] Add/edit instruments with type and currency
- [x] Duplicate symbols rejected
- [x] Works at phone width
- [x] Context docs updated per AGENTS.md (STATUS, SPEC, ADRs as relevant)
