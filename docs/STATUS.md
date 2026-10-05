# Status

**Single source of truth for current state.** Read at the start of every
session; update at the end of every change. Last updated: 2026-10-05 (one-worktree-per-task workflow added).

## Current state

- The repository is set up with AI context (`AGENTS.md`, this file, `SPEC.md`,
  ADRs), a ticket backlog, a PR template, and a CI docs-check.
- Agents work in one git worktree per task, removed when the PR is open
  (`AGENTS.md` → Session workflow). A Claude Code hook blocks edits in the
  main checkout.
- **No application code exists yet.**
- Game rules are confirmed by the owner (see SPEC). Only the end date and prizes are open.
- Tech stack is *proposed* (ADR 001). ADR 002 (accepted) rules out
  "data in the repo": the app needs a free hosted database, because players
  enter trades themselves at any time.

## Deadline

The game starts on **2026-11-01**. By then, at minimum, players must be able
to enter their trades and prices must be fetched daily. The dashboard can follow shortly after, since history
accumulates either way, as long as daily snapshots are being stored from day one.

## Next up

The backlog has 18 tickets (`tickets/backlog/`), each sized for one AI
session. Do the lowest number whose dependencies are done. 001 and 002 are
research and can run in parallel.

**Milestone A: must be live by 2026-11-01** (trades can be entered, prices
are captured daily from day one):
001, 002, 003, 004, 005, 006, 007, 008, 009, 010, 011, 012, 013, 018.
014 (leaderboard) is strongly wanted for launch too.

**Milestone B: shortly after launch** (history accumulates meanwhile):
015, 016, 017.

## Open questions (ask the project owner, don't guess)

1. **End date** of the game. Not blocking: the app runs open-ended until it's set.
2. **Prizes/penalties:** to be defined later. Not needed for the MVP.

Answered on 2026-10-05 (now in `docs/SPEC.md` → Game rules, and ADR 002):
start date, winner rule, entry method, allowed instruments, currency,
mid-game trading, fees, dividends, tolerance, access, update time, budget.

## Known issues

None yet.
