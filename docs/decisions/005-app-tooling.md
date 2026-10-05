# 005. App tooling: Node 22, Tailwind, ESLint, Vitest

**Status:** Accepted
**Date:** 2026-10-05

## Context

Ticket 003 scaffolds the Next.js app (ADR 004) and needs a Node version,
styling, linting and a test runner, plus CI that runs them. AI agents do all
the maintenance, so the defaults they know best are worth more than
anything clever.

## Decision

- **Scaffold:** `create-next-app` 16.3 defaults: TypeScript, App Router,
  `src/` directory, `@/*` import alias, Turbopack.
- **Node 22 LTS**, pinned in `.nvmrc` and `engines`, and used by CI.
  Next 16 needs ≥ 20.9. 22 is the newest LTS that's widely supported, and
  `@types/node` is pinned to 22 to match. Whether SWA's managed backend runs
  22 gets confirmed in ticket 006; if it doesn't, drop to 20.
- **npm**, with `package-lock.json` committed. No extra package manager to
  install.
- **Tailwind CSS 4**, the scaffold's default. It makes mobile-first layouts
  quick, needs no component library, and agents know it well.
- **ESLint 9** (flat config) with `eslint-config-next` (core-web-vitals +
  TypeScript). Next 16 removed `next lint`, so the script calls `eslint`
  directly.
- **Typecheck:** `next typegen && tsc --noEmit`. `next-env.d.ts` and route
  types are generated and gitignored, so they have to be created before `tsc`
  runs on a clean CI checkout.
- **Vitest** for unit tests. It needs no config for TypeScript/ESM and is
  fast. No component or end-to-end testing for now; add Playwright if the UI
  ever needs it.
- **CI:** one `ci` workflow on PRs and pushes to `main`: `npm ci`, lint,
  typecheck, test, build.

## Consequences

- Agents can rely on stock Next.js docs. Next 16 also writes an agent-rules
  block into `AGENTS.md` on `next dev`; we keep it committed so the tree
  stays clean.
- `npm audit` reports high-severity advisories in `eslint-config-next`'s
  transitive dev dependencies (`braces`/`micromatch` via `fast-glob`). They
  are lint-time only and never shipped. The suggested `--force` fix
  downgrades to Next 14's config, so we accept them until upstream updates.
- No test coverage for React components. Logic belongs in `src/lib/`, where
  it can be tested.
