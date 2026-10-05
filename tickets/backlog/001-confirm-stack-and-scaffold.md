# 001. Confirm stack and scaffold the app

**Type:** chore
**Depends on:** none

## Description

ADR 001 proposes a stack. ADR 002 adds requirements: a hosted DB, server-side
code, and a shared-password gate, all at **zero cost**. Pick concrete hosting
and database services that meet these on their free tiers. Verify against the
providers' current docs, not memory. Confirm the choice with the owner, then
scaffold the app so later tickets have somewhere to land.

## Acceptance criteria

- [ ] Hosting + DB chosen (free tier confirmed), owner agreed; new ADR supersedes ADR 001
- [ ] Shared-password gate in place (provider feature if free, else in-app; `SITE_PASSWORD`)
- [ ] App connects to the DB (`DATABASE_URL`) locally
- [ ] App scaffolded (lint + typecheck + a trivial test running locally and in CI)
- [ ] Mobile-friendly placeholder home page renders
- [ ] `docs/SPEC.md` Tech stack, Structure, Commands, Conventions filled in; `AGENTS.md` repo map updated
- [ ] `README.md` "Running locally" updated
