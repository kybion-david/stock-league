# 007. Deploy

**Type:** chore
**Depends on:** 001 (can start early with the placeholder page)

## Description

Get the app hosted and auto-deployed on merge to `main`, on a **free** tier,
behind the shared password (ADR 002).

## Acceptance criteria

- [ ] Hosting provisioned (IaC if following the owner's usual Terraform setup)
- [ ] Deploys automatically on push to `main`
- [ ] Site unusable without the shared password; password stored as a secret, not in git
- [ ] Confirmed zero (or near-zero) running cost
- [ ] URL and deploy steps documented in `docs/SPEC.md` → Commands; current URL in `docs/STATUS.md`
