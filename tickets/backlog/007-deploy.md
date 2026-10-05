# 007. Deploy

**Type:** chore
**Depends on:** 001 (can start early with the placeholder page)

## Description

Get the app hosted and auto-deployed on merge to `main`, with whatever access
control the owner chose (open question 9 in STATUS).

## Acceptance criteria

- [ ] Hosting provisioned (IaC if following the owner's usual Terraform setup)
- [ ] Deploys automatically on push to `main`
- [ ] Access control as agreed with the owner
- [ ] URL and deploy steps documented in `docs/SPEC.md` → Commands; current URL in `docs/STATUS.md`
