# 009. Deploy pipeline: Terraform once, token deploy on merge

**Status:** Accepted
**Date:** 2026-10-05

## Context

Ticket 006 puts the app on Azure Static Web Apps Free (ADR 004) and deploys
it on every merge to `main`. The owner chose (2026-10-05) the
**Kybion Production** subscription, which is the only one available, with
its own resource group, and **local** Terraform state. Several agents merge
PRs in parallel. Secrets must never be in git.

## Decision

- **Terraform (`infra/`)** creates `rg-stock-league` and `swa-stock-league`
  (Free, `westeurope`) and nothing else. It is run by hand when the infra
  changes, not in CI.
- **State is local, outside the repo**, at `~/.stock-league/terraform.tfstate`
  (passed with `-backend-config`). Inside the repo it would be lost when the
  worktree is removed. Remote state in a storage account would add cost and
  setup for two resources. If the state is lost, `terraform import` the two
  resources.
- **The subscription ID isn't in git.** The provider reads it from
  `ARM_SUBSCRIPTION_ID`.
- **No GitHub link on the resource** (`repository_url` unset), so Azure never
  commits its own workflow. **Preview environments are off.** Free has only a
  few slots, and per-PR previews from parallel agents would fill them and turn
  other PRs' checks red.
- **Deploy:** `.github/workflows/deploy.yml` runs
  `Azure/static-web-apps-deploy@v1` on push to `main` (and by hand). It
  authenticates with the SWA deployment token in the
  `AZURE_STATIC_WEB_APPS_API_TOKEN` GitHub secret. No Azure service principal
  is needed.
- **Runtime secrets** (`SITE_PASSWORD`, later `DATABASE_URL`) are SWA **app
  settings**, set with `az staticwebapp appsettings set`. Terraform ignores
  `app_settings`, so secrets never land in Terraform state or git.
- **`output: "standalone"`**: `next` plus its SWC binaries are about 300 MB,
  over SWA's 250 MB app limit. The standalone build is about 50 MB.
  `scripts/copy-standalone-assets.mjs` copies `.next/static` (and `public/`,
  if present) into it, and `npm start` runs the standalone server.
- **Node:** `engines` is `22.x`, so SWA's builder (Oryx) uses Node 22.

## Consequences

- Every merge to `main` is a production deploy. A broken build fails the
  deploy run, and the previous version keeps serving.
- Only someone with the local state file can run `terraform apply` safely.
  That's fine with one owner.
- Rotating the deploy token: `az staticwebapp secrets reset-api-key`, then
  update the GitHub secret.
- No preview sites: changes are checked by CI, and on the live site after
  merge.
- Cost: SWA Free is €0. The private repo's Actions minutes come out of the
  free monthly allowance, and one deploy takes a few minutes.
