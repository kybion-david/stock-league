# 004. Hosting on Azure Static Web Apps Free, database on Neon Free

**Status:** Accepted (owner confirmed 2026-10-05)
**Date:** 2026-10-05
**Supersedes:** 001

## Context

ADR 002 requires server-side code, a hosted database reachable from both the
app and a GitHub Actions job, and a shared-password gate, all at **zero cost**.
ADR 001 proposed Azure Static Web Apps (the owner's usual setup) but left
persistence open. Scale is tiny: ~7 players, ~30 instruments, one price row
per instrument per day, a handful of page views a day.

Limits below were checked against the providers' docs on 2026-10-05.

### Hosting

| | Azure Static Web Apps Free | Vercel Hobby | Cloudflare Workers Free |
|---|---|---|---|
| Cost | Free | Free; personal non-commercial use only | Free |
| Free-tier limits | 100 GB bandwidth/month, 250 MB app, managed Functions only | 1M function invocations, 4 active-CPU hours, 100 GB transfer per month; 300 s max function duration; one function region (selectable, e.g. `fra1`) | 100k requests/day, 10 ms CPU per invocation |
| Next.js server features | **Hybrid Next.js support is in preview** (SSR, API routes); some SWA features unsupported | First-class (Vercel builds Next.js) | Needs the OpenNext adapter; 10 ms CPU is tight for SSR |
| Built-in password protection | Standard plan only | Pro plan, $20/month per project | None |
| Cold starts | Not published | Not published | Not published (isolates are fast in practice) |
| Built-in cron | No (use GitHub Actions) | Once per day, ±59 min precision | Yes, 5 triggers |
| Lock-in | Low (plain Next.js) | Low (plain Next.js, runs anywhere Node runs) | Medium (Workers runtime) |
| Owner familiarity | High (other projects, Terraform) | Low | Low |

### Database

| | Neon Free (Postgres) | Supabase Free (Postgres) | Turso Free (libSQL/SQLite) | Cloudflare D1 Free |
|---|---|---|---|---|
| Storage | 1 GB per project (20 GB per account) | 500 MB | 5 GB | 5 GB |
| Compute / ops | 100 CU-hours/project/month | n/a | 500M row reads, 10M writes/month | 5M reads, 100k writes/day |
| Inactivity | Scales to zero after 5 min (can't disable on Free) | **Project paused after 1 week of inactivity** | None stated | None |
| Cold start | "A few hundred milliseconds" to wake | n/a (paused needs manual restore) | n/a | n/a |
| Backups | 6 h point-in-time restore, 1 manual snapshot | No automatic backups | 1 day point-in-time restore | Time Travel |
| Reachable from GitHub Actions | Yes (standard Postgres connection string) | Yes | Yes (HTTP/libSQL client) | Only via Cloudflare's HTTP API |
| Lock-in | Low (plain Postgres) | Low–medium (Postgres + platform extras) | Medium (libSQL) | High (Cloudflare only) |

## Decision

The owner chose Azure SWA Free + Neon on 2026-10-05, over the agent's
recommendation of Vercel Hobby + Neon. The deciding factor is familiarity:
it matches the owner's other projects and their Azure/Terraform tooling.

- **Hosting: Azure Static Web Apps, Free plan.** Next.js (App Router) +
  TypeScript, mobile-first, deployed with hybrid rendering (server components
  and API routes run on SWA's managed backend). Deployed from GitHub Actions.
- **Database: Neon Free** (Postgres), in the EU region closest to the SWA
  resource. Accessed with a plain `DATABASE_URL` from both the app and the
  daily job.
- **Daily job: GitHub Actions** scheduled workflow at 22:30 UTC (carried over
  from ADR 001). Hosting-independent and easy to run by hand.
- **Password gate: built in the app** (ticket 005). SWA's built-in password
  protection needs the Standard plan, which isn't free.
- **Charts:** still picked in ticket 015 (carried over from ADR 001).

Alternatives considered:

- **Vercel Hobby** (agent's recommendation): first-class Next.js support. It
  stays the **fallback** if SWA's hybrid Next.js preview gets in the way: the
  app and Neon move over unchanged.
- **Cloudflare Workers + D1:** a 10 ms CPU budget per request and an adapter
  for Next.js, plus D1 is only reachable from Actions through Cloudflare's API.
- **Supabase:** pausing after a week without activity, and no free backups.
- **Turso:** fine technically, but SQLite dialect and smaller ecosystem bring
  no benefit over plain Postgres at our scale.

## Consequences

- **Preview risk:** hybrid Next.js on SWA is in preview. Ticket 006 deploys
  early so problems surface well before 2026-11-01. If it's blocked, switch
  to Vercel Hobby (new ADR) rather than fighting the preview.
- Keep the app plain Next.js: no SWA-specific features (SWA auth, linked
  APIs, `staticwebapp.config.json` routing). Middleware must exclude `/.swa`
  paths so SWA's deployment health check passes.
- Max app size 250 MB; use Next.js `output: "standalone"` if needed.
- Plain Next.js + plain Postgres: moving to another host or DB later is cheap.
- The first request after ~5 idle minutes waits a few hundred ms for Neon to
  wake. Acceptable for a hobby dashboard.
- Neon Free keeps only 6 hours of point-in-time restore, and the
  player-entered ledger is the only copy of the trades. A daily backup is
  needed before launch: ticket 019.
- SWA can be provisioned with Terraform like the owner's other projects
  (ticket 006). Neon is set up once in its dashboard.
- If either free tier changes, revisit with a new ADR.

Sources: learn.microsoft.com/azure/static-web-apps (plans, quotas,
password-protection, deploy-nextjs-hybrid); vercel.com/docs (plans/hobby,
limits/fair-use-guidelines, cron-jobs/usage-and-pricing,
functions/configuring-functions/region); neon.com/docs (introduction/plans,
connect/connection-latency); supabase.com/pricing; turso.tech/pricing;
developers.cloudflare.com/workers/platform (pricing, limits).
