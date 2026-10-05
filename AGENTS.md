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
| `.github/` | PR template and CI workflows (`ci` = lint/typecheck/test/build, `docs-check`). |
| `.claude/` | Claude Code hooks: read the spec before editing, and edit only inside a worktree. |
| `src/app/` | Next.js App Router pages and layouts. |
| `src/lib/` | Plain TypeScript logic (no React), with `*.test.ts` files next to the code. |
| `scripts/` | Standalone Node scripts (currently the market-data proof of concept from ADR 003). |
| `package.json`, `*.config.*`, `tsconfig.json`, `.nvmrc` | App tooling config (ADR 005). |

When you add folders, add them to this map **and** to the Structure section
of `docs/SPEC.md`.

## Session workflow

### 1. Start: create a worktree, then load context (mandatory)

**Every piece of work (ticket, feature, fix, PR) gets its own git worktree.**
Several agents work on this repo in parallel, so nobody switches branches or
edits files in the main checkout. The main checkout stays on `main`, clean,
and is only used to create and remove worktrees.

From the main checkout:

```sh
git fetch origin
git worktree add ../stock-league-<slug> -b <type>/<slug> origin/main
```

`<type>/<slug>` is the branch name (see *Work* below). Do everything for that
task inside `../stock-league-<slug>`. To continue an existing branch (for
example, review fixes on an open PR), drop the `-b`:
`git worktree add ../stock-league-<slug> <type>/<slug>`.

Then, inside the worktree, read:

1. `docs/SPEC.md`
2. `docs/STATUS.md`
3. The ticket you're working on, and any ADR it references.

Claude Code hooks block Edit/Write until `docs/SPEC.md` has been read, and
block Edit/Write on files in the main checkout. Other agents: the rules apply
to you too, there's just no hook to stop you.

### 2. Work

- Never commit directly to `main`. Branch as `feat/<slug>`, `fix/<slug>`,
  `docs/<slug>` or `chore/<slug>`, always in a fresh worktree (above). If
  you're already in a worktree on a suitable branch, keep using it.
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
- [ ] Worktree removed (see below).

**Remove the worktree** once everything is committed, pushed and the PR is
open. Run it from the main checkout, not from inside the worktree:

```sh
git worktree remove ../stock-league-<slug>
```

Never add `--force`: if git refuses because of uncommitted changes, commit or
deal with them first. The branch stays on GitHub; re-create the worktree from
it if the PR needs more work. After the PR is merged, `git branch -d
<type>/<slug>` and `git worktree prune` clean up the rest.

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
- Code conventions live in `docs/SPEC.md` → Conventions.
- The Next.js block below is maintained by `next dev`, which re-adds it if
  it's missing. Leave it in place.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
