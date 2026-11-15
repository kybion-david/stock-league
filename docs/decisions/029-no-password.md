# 029. No password: anyone can view and change everything

**Status:** Accepted
**Date:** 2026-11-15
**Supersedes:** 006 (password gate), 028 (password only to make changes); amends 002 (shared password)

## Context

ADR 028 made the site public to view but kept the shared password on every
change. On 2026-11-15 the owner chose "Fully open, no password at all":
strangers should be able to add players and add, edit or delete trades
too, so anyone can join the league.

## Decision

- **No password anywhere.** `src/proxy.ts`, `src/lib/auth.ts`, the
  `/login` page and `requireEditor()` are deleted. Every server action runs
  for whoever calls it, as before ADR 006.
- **`SITE_PASSWORD` is no longer used.** It's gone from `.env.example`; the
  owner can delete the SWA app setting.
- Pages still render dynamically (root layout `force-dynamic`): SWA's edge
  would otherwise cache them for a year and never show new prices.

## Consequences

- Anyone with the URL (public in the repo) can add players and
  instruments, change any strategy, and add, edit or delete anyone's
  trades. Deletes leave no trace (ADR 013). The "Entered by" label is
  picked from a list, so it doesn't prove who made a change.
- The fix for vandalism or mistakes is a restore from the daily backup
  (ADR 017, `docs/SPEC.md` → Commands), losing anything entered since
  that 03:17 UTC run.
- Bring back an edit gate if that becomes a problem: ADR 028 describes
  one (a password checked first in each server action, plus a guard test).
- Search engines may index the pages.
