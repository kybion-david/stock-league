# 023. Make the repo public (owner steps)

**Type:** chore
**Depends on:** none

## Description

The repo is ready to be open-sourced (ADR 025): MIT `LICENSE`,
`CONTRIBUTING.md`, encrypted backups. What's left are GitHub settings only
the owner can change, in this order. Agents can't do these steps.

## Acceptance criteria

- [x] `BACKUP_PASSPHRASE` added as a repo secret (Settings → Secrets and
      variables → Actions), and also kept somewhere outside GitHub (a
      password manager). A `daily-backup` run after that is green and its
      artifact is a `.dump.gpg`.
- [x] Every older `daily-backup` artifact (plain `.dump`, made before ADR
      025) deleted from the Actions tab, so they don't become downloadable.
      Done 2026-11-13: secret added, PR 38's backup run was the first
      encrypted one, and the 39 plain artifacts (2026-10-05 to 11-12) were
      deleted through the API with the owner's OK.
- [x] Owner decided on the git history: it shows the owner's commit email
      and the live site URL. Either accept that, or rewrite history first
      (needs a force-push to every branch, and every clone and open PR
      breaks). No secrets were found in history on 2026-11-13.
- [ ] `SITE_PASSWORD` is long and unguessable (the live URL will be public).
- [ ] Branch protection on `main`: require a pull request and the `ci` and
      `docs-check` checks. Leave approvals off, or agents can't merge their
      own PRs (`AGENTS.md`).
- [ ] Actions → General → "Require approval for first-time contributors"
      (the default) kept on, so fork PRs don't run CI until approved.
- [x] Visibility switched to public (Settings → General → Danger Zone).
- [ ] Friends know how to contribute (`CONTRIBUTING.md`).
- [ ] `docs/STATUS.md` updated: the repo is public; ticket moved to `done/`.
