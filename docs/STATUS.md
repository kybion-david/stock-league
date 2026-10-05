# Status

**Single source of truth for current state.** Read at the start of every
session; update at the end of every change. Last updated: 2026-10-05.

## Current state

- The repository is set up with AI context (`AGENTS.md`, this file, `SPEC.md`,
  ADRs), a ticket backlog, a PR template, and a CI docs-check.
- **No application code exists yet.**
- Tech stack is *proposed* (ADR 001), not confirmed.

## Deadline

The game starts at the **beginning of November 2026**. By then, at minimum,
players must be able to have their holdings recorded and prices must be
fetched daily. The dashboard can follow shortly after, since history
accumulates either way, as long as daily snapshots are being stored from day one.

## Next up

1. Ticket `001` — confirm stack and scaffold the app.
2. Ticket `002` — pick the market data source (research).
3. Then `003` → `007` in order (see `tickets/backlog/`).

## Open questions (ask the project owner, don't guess)

1. **Exact start date** and **end date** of the game. When is the winner decided?
2. **Winner rule:** highest total value at the end? Any prizes or penalties?
3. **How holdings are entered:** players enter EUR amount per stock and we
   derive shares from the buy-day price? Or they enter actual share count +
   buy price from their broker statement? (The latter is more accurate.)
4. **Allowed instruments:** stocks only? ETFs? Crypto? Which exchanges
   (US, XETRA, …)?
5. **Currency:** non-EUR instruments (e.g. US stocks in USD) need daily FX
   conversion. Which FX source, and which rate (close of day)?
6. **Mid-game changes:** can players sell or rebalance during the game? If yes,
   how is it recorded, and does it cost a "fee"?
7. **Dividends:** ignored, or added to value?
8. **Tolerance:** how far from €1,000 may a portfolio total be (e.g. ±€5)?
9. **Access/auth:** public-but-unlisted link, a shared password, or real
   logins? Who enters/edits holdings — each player, or only the admin?
10. **Refresh timing:** what time of day should the daily update run, given
    EU vs US market close?
11. **Hosting/budget:** is free tier only OK? Same Azure setup as other
    projects, or anything that's simplest?

## Known issues

None yet.
