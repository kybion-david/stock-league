# Status

**Single source of truth for current state.** Read at the start of every
session; update at the end of every change. Last updated: 2026-10-05 (owner answered open questions).

## Current state

- The repository is set up with AI context (`AGENTS.md`, this file, `SPEC.md`,
  ADRs), a ticket backlog, a PR template, and a CI docs-check.
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

1. Ticket `001` — confirm stack and scaffold the app.
2. Ticket `002` — pick the market data source (research).
3. Then `003` → `007` in order (see `tickets/backlog/`).

## Open questions (ask the project owner, don't guess)

1. **End date** of the game. Not blocking: the app runs open-ended until it's set.
2. **Prizes/penalties:** to be defined later. Not needed for the MVP.

Answered on 2026-10-05 (now in `docs/SPEC.md` → Game rules, and ADR 002):
start date, winner rule, entry method, allowed instruments, currency,
mid-game trading, fees, dividends, tolerance, access, update time, budget.

## Known issues

None yet.
