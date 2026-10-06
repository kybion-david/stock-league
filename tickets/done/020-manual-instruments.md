# 020. Manual instruments for things Yahoo can't price

**Type:** feature
**Depends on:** 009, 012

## Description

Requested by the owner on 2026-10-06. Let a player add something the app
can't track, such as an options trade: record what they went in with, and
keep what it's worth up to date by hand. Keep it simple; it won't be used
much. See ADR 022.

## Acceptance criteria

- [x] A manual instrument can be added on `/instruments` by name, without Yahoo
- [x] It's bought and sold through the normal trade form
- [x] The player can enter what their holding is worth on a day, including €0, on their trades page
- [x] Valuation, leaderboard, chart, player page and stats use the entered value; no ⏳ note for it
- [x] The daily job never fetches it, and its values don't move the leaderboard's day
- [x] Context docs updated per AGENTS.md (STATUS, SPEC, ADRs as relevant)
