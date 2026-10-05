# Architecture Decision Records

One file per non-obvious decision: `NNN-short-slug.md`, numbered in order and
never renumbered. When a decision changes, add a new ADR that supersedes the
old one, and set the old one's status to `Superseded by NNN`. Don't delete it.

## Template

```markdown
# NNN. Title

**Status:** Proposed | Accepted | Superseded by NNN
**Date:** YYYY-MM-DD

## Context
What problem or question forced a choice.

## Decision
What we chose.

## Consequences
What gets easier, what gets harder, what we gave up.
```

## Index

| # | Title | Status |
|---|---|---|
| 001 | [Proposed tech stack](001-proposed-tech-stack.md) | Proposed |
| 002 | [Ledger, shared password, free hosted DB](002-ledger-shared-password-db.md) | Accepted |
