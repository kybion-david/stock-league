# 001. Choose free hosting and database

**Type:** research
**Depends on:** none

## Description

ADR 002 requires server-side code, a hosted database, and a shared-password
gate, all at **zero cost**. ADR 001 proposes Azure Static Web Apps (the
owner's usual setup). Check whether it, or a better free alternative, meets
the requirements. Pick a free-tier database reachable from both the app and
a GitHub Actions job. Verify limits and pricing against the providers'
current docs, not memory. No code in this ticket.

## Acceptance criteria

- [x] New ADR (004) comparing at least 2 hosting and 2 DB options (free-tier limits, cold starts, built-in password protection, lock-in)
- [x] Owner has confirmed the choice; ADR 001 marked superseded
- [x] `docs/SPEC.md` → Tech stack filled in
- [x] Context docs updated per AGENTS.md (STATUS, SPEC, ADRs as relevant)
