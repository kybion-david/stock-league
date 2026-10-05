# 001. Confirm stack and scaffold the app

**Type:** chore
**Depends on:** none

## Description

ADR 001 proposes a stack, but persistence isn't decided. Confirm the stack with
the project owner. In particular, decide between "data in the repo" and a
managed DB, and walk through the open questions in `docs/STATUS.md`. Then
scaffold the app so later tickets have somewhere to land.

## Acceptance criteria

- [ ] Owner confirmed the stack; ADR 001 set to Accepted (or superseded by a new ADR)
- [ ] As many open questions as possible answered by the owner and moved into `docs/SPEC.md` → Game rules
- [ ] App scaffolded (lint + typecheck + a trivial test running locally and in CI)
- [ ] Mobile-friendly placeholder home page renders
- [ ] `docs/SPEC.md` Tech stack, Structure, Commands, Conventions filled in; `AGENTS.md` repo map updated
- [ ] `README.md` "Running locally" updated
