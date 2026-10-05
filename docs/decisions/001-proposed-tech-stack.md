# 001. Proposed tech stack

**Status:** Proposed (to confirm with the owner in ticket 001)
**Date:** 2026-10-05

## Context

We need a small web app that a handful of friends open on their phones, plus
a job that runs once a day to fetch prices. It must be cheap (ideally free),
easy for AI agents to build and maintain, and live before November 2026.

The owner's other projects use Next.js + TypeScript, Azure Static Web Apps
(Free tier), Terraform, and GitHub Actions. Reusing that stack keeps their
tooling and deploy knowledge consistent.

## Decision (proposed)

- **App:** Next.js (App Router) + TypeScript, mobile-first.
- **Charts:** a lightweight React chart library (pick in ticket 015).
- **Daily job:** GitHub Actions scheduled workflow (`cron`) that fetches prices
  and FX and writes snapshots.
- **Hosting:** Azure Static Web Apps (Free tier), deployed from GitHub Actions,
  matching the owner's other projects. Must support server-side code (ADR 002)
  and be **free**. Any free alternative that fits better is fine.
- **Persistence: unresolved, and this is the real open piece.** A purely
  static export can't hold editable holdings or growing price history. Options
  to weigh in ticket 001:
  1. **Data in the repo:** holdings as a JSON/YAML file edited by PR; the daily
     Action commits price snapshots as JSON and triggers a rebuild. Zero infra,
     fully auditable, fits a static site. Downside: no in-app editing.
  2. **Managed DB with a free tier** (e.g. a hosted Postgres/SQLite service)
     plus API routes or SWA managed functions. More flexible, more moving parts.

  ~~Leaning: option 1 for the MVP.~~ **Update 2026-10-05: option 1 is ruled
  out by ADR 002.** Players trade at any time and enter trades in the app, so
  option 2 (free-tier hosted DB) is required.

## Consequences

- GitHub Actions cron is "best effort" timing (can run minutes late). That's
  fine for daily closes.
- See ADR 002 for auth (shared password) and data model (ledger).
