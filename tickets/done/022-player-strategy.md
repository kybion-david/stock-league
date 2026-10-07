# 022. Player strategies

**Type:** feature
**Depends on:** none

## Description

On 2026-10-07 the owner asked for a way for players to write about their
investment strategy on their profile, as a fun way to read how the others
are playing. A short free-text note per player, shown on their player page,
plus one page to read everyone's.

## Acceptance criteria

- [x] Migration 003 adds `strategy` and `strategy_updated_at` to `players`
- [x] The player page (`/portfolio/<id>`) shows the strategy with the day it last changed, or "No strategy yet", with a link to write or edit it
- [x] `/portfolio/<id>/strategy` edits it (up to 1,000 characters, line breaks kept, empty removes it); anyone can edit anyone's, like trades
- [x] `/strategies` (linked from the home page) lists everyone's, most recently changed first, then who hasn't written one
- [x] Unit tests for saving, clearing, the length limit and the order
- [ ] Migration 003 applied to Neon `production` and `dev` (production done on 2026-10-07 with the `db-migrate` workflow; `dev` is the owner's, see `docs/STATUS.md`)
- [x] Context docs updated per AGENTS.md (STATUS, SPEC, ADRs as relevant)
