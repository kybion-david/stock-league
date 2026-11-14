# 028. Public viewing, password only to make changes

**Status:** Accepted
**Date:** 2026-11-14
**Amends:** 002 (shared password), 006 (password gate), 026 ("the game stays private")

## Context

The owner asked on 2026-11-14 to remove the website's password "so anyone
can join": anyone should be able to open the league and follow it. Until
now `src/proxy.ts` sent every page to `/login` (ADR 006).

The password was also the only thing that kept strangers from changing
data. There are no accounts: every server action (add or edit a trade, a
player, an instrument, a manual value or a strategy, and delete a trade)
trusts whoever calls it. The repo and the live URL are public (ADR 026),
so with no gate at all anyone could rewrite or delete anyone's trades.

## Decision

- **Every page is public to view.** The proxy no longer redirects or
  returns 401; it only renews a valid session cookie once a day (the
  sliding 90-day expiry from ADR 006's amendment).
- **Changes still need the league password.** Each exported server action
  calls `requireEditor()` (`src/app/login/require-editor.ts`) as its first
  line, outside its `try`. Without a valid session it redirects to
  `/login?next=<the page the form was on>`, and the login sends the
  player back there. A server action can be called from any URL, so the
  check lives in the action, not in the proxy or the page.
- `src/app/login/require-editor.test.ts` fails if any `"use server"` file
  in `src/app/` (other than the login action) has an exported function
  whose first line isn't `await requireEditor();`.
- Forms stay visible to everyone. Submitting one without a session goes to
  the login page, and what was typed is lost. Fine for a few friends.
- The cookie, `SITE_PASSWORD` and the 1 s delay on a wrong password are
  unchanged (ADR 006).
- Pages still render dynamically: SWA's edge would otherwise cache them
  for a year and never show new prices.

## Consequences

- The leaderboard, holdings, trades, strategies and news are readable by
  anyone with the URL, and search engines may index them.
- If the owner later wants changes fully open too ("fully open"), delete
  the `requireEditor()` calls and this ADR's test. Anyone could then
  delete anyone's trades, and only a backup (ADR 017) could undo it.
- The password still protects every change, so it should stay long and
  unguessable (ADR 026).
