# 012. Valuation and returns

**Type:** feature
**Depends on:** 007, 011

## Description

Compute each player's value in EUR for any date:
cash + Σ(shares × close × FX), using ticket 007's replay and the stored
snapshots. Also compute return % vs €1,000, change vs the previous day, and
per-holding gain. The dashboard tickets build on this.

## Acceptance criteria

- [x] Value per player per date, plus time series over the game
- [x] Return %, day change, per-holding gain/loss
- [x] Clear behaviour when a price is missing (use last known, flag it)
- [x] Unit tests with hand-calculated expectations
- [x] Context docs updated per AGENTS.md (STATUS, SPEC, ADRs as relevant)
