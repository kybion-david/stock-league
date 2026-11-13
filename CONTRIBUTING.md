# Contributing

Thanks for helping out! Stock League is a hobby app for a small group of
friends, so contributions are welcome but the bar is "keep it simple".

## Before you start

- Read [`docs/SPEC.md`](docs/SPEC.md) (what we're building) and
  [`docs/STATUS.md`](docs/STATUS.md) (where we are). Open work is in
  [`tickets/backlog/`](tickets/backlog/).
- Got an idea that isn't a ticket yet? Open a GitHub issue first, or just
  ask in the group chat, so nobody builds the same thing twice.
- Using an AI coding agent? Point it at [`AGENTS.md`](AGENTS.md). The rules
  there (one worktree per task, docs updated in the same PR) apply to
  humans too.

## Running it locally

Setup is in the README under [Running locally](README.md#running-locally).
You need Node 22 and a Postgres database of your own. Two free options:

- **Docker:** `docker run -d --name stock-league-db -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:18`,
  then set `DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres`
  in `.env`.
- **Neon:** a free project at [neon.tech](https://neon.tech), using its
  pooled connection string.

Then `npm run db:migrate` and `npm run db:seed` give you fake players and
trades to click around with. You never need access to the real game's
database or passwords.

`npm test` needs no database at all (it uses an in-memory Postgres).

## Sending a change

1. Fork the repo (or, if you've been added as a collaborator, push a branch).
   Name it `feat/<slug>`, `fix/<slug>`, `docs/<slug>` or `chore/<slug>`.
2. Keep each PR to one thing. Commit messages follow
   [Conventional Commits](https://www.conventionalcommits.org/)
   (`feat: …`, `fix: …`).
3. Update the docs in the same PR: at least `docs/STATUS.md`, plus
   `docs/SPEC.md` or a new ADR in `docs/decisions/` if you changed rules,
   data, tooling or made a non-obvious choice. The **docs-check** CI job
   fails if a code change touches no docs. The table in `AGENTS.md` says
   which doc goes with which change.
4. Before pushing: `npm run lint`, `npm run typecheck` and `npm test`.
5. Open the PR against `main` and fill in the template. Every merge to
   `main` goes live for everyone, so the owner merges PRs from forks.

## Ground rules

- Never commit secrets: `.env` is gitignored, and new variables go in
  `.env.example` with an empty value.
- Money is stored as integer euro cents, never floats.
- Don't put real players' data (names, trades) in code, tests, issues or
  screenshots. Use the dev seed.
- No new paid services, accounts or infrastructure without talking to the
  owner first.

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).
