# 018. Launch readiness for 2026-11-01

**Type:** chore
**Depends on:** 009, 013, 014

## Description

End-to-end check before the game starts, together with the owner. Remove
seed data from production, add the real players, confirm the daily job ran
successfully on at least 2 consecutive days, and walk through entering a
transaction on a phone. Write a one-page "how to use" for the friends.

## Acceptance criteria

- [ ] Production has real players only, no seed data
- [ ] Daily job verified on 2+ consecutive days
- [ ] Owner has done a full phone walkthrough (enter buy + fee, see leaderboard)
- [ ] Short player guide in `docs/` and linked from the site
- [ ] `docs/STATUS.md` says the game is live
- [ ] Context docs updated per AGENTS.md (STATUS, SPEC, ADRs as relevant)
