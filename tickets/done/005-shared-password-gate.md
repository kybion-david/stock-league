# 005. Shared-password gate

**Type:** feature
**Depends on:** 003

## Description

Protect the whole site (pages and API) with one shared password
(`SITE_PASSWORD`, ADR 002). Azure SWA Free has no built-in password
protection (ADR 004), so build a simple login page that sets a long-lived
signed cookie. If the gate is Next.js middleware, its matcher must exclude
`/.swa/*`, or SWA's deployment health check fails (ADR 004).

## Acceptance criteria

- [x] Every page and API route returns the login screen or 401 without the password
- [x] Correct password grants access for at least 30 days on that device
- [x] Password comes from env/secret only; `.env.example` and SPEC → Configuration updated
- [x] Test covering denied vs allowed access
- [x] Context docs updated per AGENTS.md (STATUS, SPEC, ADRs as relevant)
