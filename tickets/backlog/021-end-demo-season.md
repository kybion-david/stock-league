# 021. End the demo season and bring production's database up to date

**Type:** chore
**Depends on:** none (do it once the owner says the demo can go)

## Description

Production shows a fake demo season (ADR 021) that must be switched off
before launch (ticket 018) and before 2026-11-01. While doing that, apply
the database migrations that landed while the demo hid the real database:
nothing applies migrations automatically, and the demo runs its own
in-memory copy, so production hasn't needed them yet. Right now that's
migration 002 (manual instruments, ADR 022); without it, adding a manual
instrument in production fails.

Both steps need the owner's production `DATABASE_URL` (in their local
`.env`, see `docs/STATUS.md` → Next up → Secrets), so do them together with
the owner.

1. Revert the demo season PR: a plain `git revert -m 1` of the merge
   commit of `feat/demo-season` (PR 31, merge commit `2c0659a`), as its
   own PR. Check that later
   changes (such as ticket 020) still build and pass after the revert.
2. Apply every pending migration to Neon: `npm run db:migrate` with the
   production `DATABASE_URL`, then with the `dev` branch's. It's safe to
   re-run and prints what it applied.
3. After the deploy, check the live site shows the real (empty) game.

## Acceptance criteria

- [ ] Demo season reverted and deployed; the live site shows the real game, no demo banner
- [ ] `npm run db:migrate` run on Neon `production` and `dev`; `select name from schema_migrations` lists every file in `db/migrations/` on both
- [ ] A manual instrument can be added on the live site (then left in place, or noted for the owner to ignore)
- [ ] Context docs updated per AGENTS.md (STATUS, SPEC, ADRs as relevant): demo mentions removed or marked as past, ADR 021 marked as ended
