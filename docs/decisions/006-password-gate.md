# 006. Password gate: Next.js proxy + password-signed cookie

**Status:** Accepted
**Date:** 2026-10-05

## Context

ADR 002 requires one shared password for the whole site, and ADR 004 says
it has to live in the app because SWA Free has no password protection. It
must cover pages and API routes, last at least 30 days per device, and leave
`/.swa/*` reachable for SWA's health check. We want no extra libraries, no
session table and no new env vars.

## Decision

- **One `src/proxy.ts`** (Next.js 16's new name for middleware; it runs on
  the Node.js runtime) guards every path except `/login`, `/_next/static`,
  `/_next/image`, `/favicon.ico` and `/.swa/*`. Pages redirect to
  `/login?next=…`, and `/api/*` gets a JSON 401.
- **Login** is a server action on `/login`. A correct password sets the
  `sl_session` cookie (HttpOnly, SameSite=Lax, Secure in production) for
  **90 days**. A wrong one waits 1 s and goes back with an error.
- **Cookie = `v1.<expiry>.<HMAC-SHA256>`, signed with `SITE_PASSWORD`
  itself** using Web Crypto. It's stateless, so there's no session table and
  no separate signing secret.
- **Fail closed:** if `SITE_PASSWORD` is unset or empty, nobody gets in.

## Consequences

- Changing `SITE_PASSWORD` logs every device out. That's the only way to
  revoke access, which is fine for a group of friends.
- No logout button and no per-player identity. Players still pick their name
  when entering a transaction (SPEC → Features).
- The only brute-force protection is the 1 s delay. That's acceptable for an
  unlisted hobby site, so pick a password that isn't trivially guessable.
- **Every page must render dynamically** (`export const dynamic =
  "force-dynamic"` in the root layout, added 2026-10-05). Azure SWA caches
  prerendered pages at its edge (`s-maxage` of a year) and serves them
  without running the proxy. The first deploy did this: after one logged-in
  visit, `/` was served to anyone. `src/app/layout.test.ts` guards the line.
  Never add `force-static`, `revalidate` or `generateStaticParams` to a
  gated page.
- Server components and route handlers don't re-check the cookie: the proxy
  is the only gate. Any new top-level path is covered automatically unless
  it's added to the matcher's exclusions.
- Matcher tests use `unstable_doesMiddlewareMatch` from
  `next/experimental/testing/server`. In Next 16.3 the docs call it
  `unstable_doesProxyMatch`, but the package doesn't export that name yet.

## Amendment (2026-10-05): sliding expiry

A cookie set once for 90 days logged out every player who logged in before
the 2026-11-01 kick-off in early January, mid-game (found in the season
simulation, STATUS). The proxy now re-issues the cookie for another 90
days when a valid one is more than a day old (`sessionNeedsRenewal`), so it
only expires after 90 days without a visit. Cookie settings live in
`sessionCookieOptions()` for both the login and the renewal.
