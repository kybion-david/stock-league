# 026. Open-source the code, keep the game private

**Status:** Accepted
**Date:** 2026-11-13

## Context

The owner wants the friends who play to be able to add features. The
repo was private, so contributing meant being added as a collaborator.
Making it public changes who can see everything in it and in its Actions:
code, docs, full git history, workflow logs and **workflow artifacts**,
which any signed-in GitHub user can download from a public repo. The daily
backup (ADR 017) stored plain `pg_dump` files there, with every player's
name and trades.

A scan of every commit on every branch on 2026-11-13 found no secrets:
credentials only ever lived in GitHub secrets, SWA app settings and the
owner's gitignored `.env`. The only connection strings in history are test
fixtures (`u:p@…`) and the backup workflow's throwaway `scratch` database.

## Decision

- **Make the whole repo public under the MIT License.** No split into a
  public and private part: nothing in the code is secret, and one repo
  keeps the AI docs workflow (`AGENTS.md`) intact.
- **The game stays private.** The live site keeps its shared-password gate
  (ADR 006), and contributors develop against their own database with the
  dev seed (`CONTRIBUTING.md`).
- **Backups are encrypted** with `gpg --symmetric` (AES-256) using a new
  GitHub secret, `BACKUP_PASSPHRASE`, before upload. The run fails early if
  the secret is missing, rather than upload a plain dump. The restore check
  still runs on the plain dump, inside the runner.
- **Fork PRs skip the backup job** (they get no secrets). The other
  secret-using workflows only run on schedule, by hand or on push to
  `main`, and no workflow uses `pull_request_target`, so a fork PR can't
  reach a secret.
- The history keeps the owner's commit email and the live site's URL; the
  owner decides whether to rewrite history before going public (ticket 023).

## Consequences

- Friends fork and open PRs; the owner merges PRs from forks, because every
  merge to `main` deploys.
- Restoring a backup needs the passphrase and `gpg --decrypt` first
  (`docs/SPEC.md` → Commands). Losing the passphrase makes every backup
  useless, so the owner keeps it outside GitHub too.
- Plain dumps made before this change must be deleted from Actions before
  the repo goes public (ticket 023).
- The live URL is public knowledge. The gate's only brute-force protection
  is a 1 s delay per wrong attempt (ADR 006), so the shared password must
  be long and unguessable.
