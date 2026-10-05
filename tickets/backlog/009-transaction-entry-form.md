# 009. Transaction entry form

**Type:** feature
**Depends on:** 007, 008

## Description

The main input screen. A player picks their name, then adds, edits or
deletes transactions (buy, sell, fee, dividend): date, instrument, share count,
total EUR amount, note. Show the player's resulting cash and holdings. Use
ticket 007's validation. Store created/updated time and a "by" label.

## Acceptance criteria

- [ ] Add/edit/delete all four transaction types, validated with clear errors
- [ ] Player page lists their transactions and current cash + holdings
- [ ] Audit fields saved on every change
- [ ] Usable on a phone with no horizontal scrolling
- [ ] Context docs updated per AGENTS.md (STATUS, SPEC, ADRs as relevant)
