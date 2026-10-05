# 005. Shared-password gate

**Type:** feature
**Depends on:** 003

## Description

Protect the whole site (pages and API) with one shared password
(`SITE_PASSWORD`, ADR 002). Use the hosting provider's built-in protection if
001 found it to be free; otherwise build a simple login page that sets a
long-lived signed cookie.

## Acceptance criteria

- [ ] Every page and API route returns the login screen or 401 without the password
- [ ] Correct password grants access for at least 30 days on that device
- [ ] Password comes from env/secret only; `.env.example` and SPEC → Configuration updated
- [ ] Test covering denied vs allowed access
- [ ] Context docs updated per AGENTS.md (STATUS, SPEC, ADRs as relevant)
