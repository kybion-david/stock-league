# 002. Transaction ledger, in-app entry, shared password, free hosted DB

**Status:** Accepted
**Date:** 2026-10-05

## Context

The owner answered the open game-rule questions (see `docs/SPEC.md`):

- Players can buy, sell and rebalance at any time.
- Fees and dividends are entered manually.
- Players enter share counts, not just EUR splits.
- Access is through an unlisted link with one shared password. No accounts.
- Hosting must be free, or near-zero cost.

A one-time "how I split my €1,000" holdings list can't represent ongoing
trading. With frequent edits by the players themselves, ADR 001's leaning
option ("data in the repo, edited by PR") is no longer workable.

## Decision

1. **Data model = per-player transaction ledger** (`buy`, `sell`, `fee`,
   `dividend`) with starting cash of €1,000. Holdings and cash are derived.
   Each trade records share count + total EUR amount from the broker.
2. **Tolerance = cash may go to −€50** (5% of €1,000). This one rule covers
   "around €1,000" for the initial spend and for later trades.
3. **In-app entry** via a simple form. Anyone with the password can edit
   anything. Keep created/updated metadata as a lightweight audit trail.
4. **Auth = one shared password**, checked server-side, granting a long-lived
   cookie. No user accounts. Store the password in an env var/secret.
5. **Storage = a hosted database with a free tier.** The exact service is
   chosen in ticket 001. It must be free at our scale (~7 players, ~30
   instruments, one row per instrument per day) and reachable both from the
   app's server code and from the daily job.

## Consequences

- The app needs server-side code (API routes or functions), so a purely
  static export is no longer enough. Choose hosting accordingly in ticket 001.
- Check the hosting provider's free tier for built-in password protection
  before building our own. Some providers only offer it on paid plans; in
  that case, implement the shared-password check in the app.
- Trust is social, not technical: any friend can edit any entry. That's
  accepted.
- Reconstructing a portfolio for any past date is straightforward: replay
  the ledger up to that date.

## Amendment (2026-11-14): public viewing

The site is now public to view; the password only gates changes, in
each server action rather than in the proxy. See ADR 028.
