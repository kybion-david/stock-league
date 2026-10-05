# AGENTS.md

Instructions for **every** AI agent (Claude Code, Cursor, Codex, Copilot, …)
working in this repository. This project is built entirely by AI, so the docs
are the only memory that survives between sessions. Treat them as part of the
product.

`CLAUDE.md` just imports this file — edit rules **here**, never there.

## What this project is

**Stock League** — a small private web app for 5–7 friends who each invest
€1,000 at the start of November 2026. It records each player's holdings,
pulls market prices daily, and shows a fun dashboard/leaderboard comparing
everyone. Full product definition and game rules: `docs/SPEC.md`.

It is a **hobby project**. Prefer simple, cheap (ideally free), low-maintenance
choices. Don't add accounts, microservices, or infrastructure the game doesn't
need. If something looks under-engineered, that may be intentional — check
`docs/decisions/` before "fixing" it.

## Repository map

| Path | Contents |
|---|---|
| `AGENTS.md` | This file. Rules for agents. Canonical. |
| `CLAUDE.md` | One line: imports `AGENTS.md` for Claude Code. |
| `README.md` | Human front door. No status in here. |
| `docs/SPEC.md` | **What** we're building: game rules, features, data model, tech stack, structure, conventions. |
| `docs/STATUS.md` | **Where we are**: current state, next steps, open questions, known issues. |
| `docs/decisions/` | **Why**: numbered ADRs (`NNN-slug.md`). See `docs/decisions/README.md`. |
| `tickets/` | Work items. `backlog/` = open, `done/` = finished. Format: `tickets/TEMPLATE.md`. |
| `.github/` | PR template and CI (incl. the docs-check workflow). |
| `.claude/` | Claude Code hook that enforces reading the spec before editing. |

No application code exists yet. When it does, add its folders to this map
**and** to the Structure section of `docs/SPEC.md`.

## Session workflow

### 1. Start: load context (mandatory)

Before changing anything, read:

1. `docs/SPEC.md`
2. `docs/STATUS.md`
3. The ticket you're working on, and any ADR it references.

A Claude Code hook blocks Edit/Write until `docs/SPEC.md` has been read. Other
agents: the rule applies to you too, there's just no hook to stop you.

### 2. Work

- Never commit directly to `main`. Branch as `feat/<slug>`, `fix/<slug>`,
  `docs/<slug>` or `chore/<slug>`. If you're already on a suitable branch,
  keep using it.
- Pick tickets from `tickets/backlog/` lowest number first, unless told
  otherwise. Work on one ticket at a time.
- If the user tells you something that contradicts the docs, the user wins —
  and you update the docs to match in the same change.
- Don't silently decide an **open question** listed in `docs/STATUS.md`. Ask the
  user, or, if you must pick to make progress, pick the simplest option, write
  an ADR, and say so clearly in the PR description.

### 3. Finish: update the context (mandatory — the work is not done without it)

**Definition of done** for any change:

- [ ] Code works and any tests pass.
- [ ] `docs/STATUS.md` reflects reality (current state, next steps, open questions).
- [ ] Every doc affected by the change is updated (table below) **in the same PR**.
- [ ] Ticket moved from `tickets/backlog/` to `tickets/done/` if its acceptance criteria are met.
- [ ] PR opened to `main` with the template's docs checklist filled in.

| If you changed… | …then update |
|---|---|
| Anything at all | `docs/STATUS.md` (at minimum "Current state" / "Next up") |
| Game rules, scoring, features | `docs/SPEC.md` → Game rules / Features |
| Data model, storage, data source | `docs/SPEC.md` → Data model / Tech stack, plus an ADR if it was a choice |
| Folders, new top-level files | `docs/SPEC.md` → Structure, and the repo map above |
| Libraries, frameworks, hosting, services | `docs/SPEC.md` → Tech stack, plus an ADR |
| How to run, build, test or deploy | `docs/SPEC.md` → Commands, and `README.md` "Running locally" |
| Env vars / secrets | `.env.example` and `docs/SPEC.md` → Configuration |
| A non-obvious choice or trade-off | New ADR in `docs/decisions/` |
| These agent rules themselves | `AGENTS.md` (only here) |
| Found a bug/limitation you didn't fix | `docs/STATUS.md` → Known issues, or a new ticket |

CI enforces a minimum: a PR that changes non-doc files without touching
`docs/` fails the **docs-check** workflow. Only bypass it (label
`no-docs-needed`) for changes that truly have no doc impact, such as a typo
fix or a dependency bump with no behavior change.

Before you hand off, re-read `docs/STATUS.md` as if you were the next agent
arriving cold. Could they continue without asking you anything? If not, fix
the doc.

## Writing the docs

- **One fact, one place.** Status lives only in `docs/STATUS.md`; rules and
  design only in `docs/SPEC.md`; reasons only in ADRs. Link, don't copy.
  Duplicated facts drift apart.
- Keep them lean: facts and context, not code snippets or changelogs (git has
  the history).
- Write dates as absolute (`2026-11-01`), never "next week".
- Delete things that stop being true. Stale docs are worse than none.

## Conventions

- Commit messages: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`,
  `refactor:`, `test:`).
- Money: store amounts as **integer euro cents**, never floats. Display as
  `€1,234.56`.
- Never commit secrets. Use `.env` (gitignored) and document variable names
  in `.env.example`.
- More conventions appear in `docs/SPEC.md` → Conventions once code exists.
