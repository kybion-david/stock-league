# 006. Deploy pipeline

**Type:** chore
**Depends on:** 003, 005

## Description

Get the app live early, even with only the placeholder page, so deployment
problems surface before the deadline. Provision hosting (IaC if following the
owner's Terraform setup) and deploy automatically on merge to `main`.

## Acceptance criteria

- [ ] Merge to `main` deploys automatically
- [ ] Live site is behind the shared password; secrets stored in GitHub/hosting secrets, not git
- [ ] Running cost confirmed as zero (or near-zero)
- [ ] Deploy steps in SPEC → Commands; live URL in `docs/STATUS.md`
- [ ] Context docs updated per AGENTS.md (STATUS, SPEC, ADRs as relevant)
