// Snapshot ingestion CLI (ticket 011, ADR 012):
//   npm run ingest                         → today's UTC date
//   npm run ingest -- 2026-11-06           → one date
//   npm run ingest -- 2026-11-01 2026-11-30 → a range, inclusive (backfill)
// Reads DATABASE_URL from the environment or from .env. Every date and symbol
// is attempted; the exit code is 1 if anything failed.
import { existsSync } from "node:fs";
import { connect } from "../src/lib/db/postgres";
import { hasFailures, ingestRange, type IngestReport } from "../src/lib/ingest";
import { createMarketDataClient } from "../src/lib/market-data";

const args = process.argv.slice(2);
if (args.length > 2 || args.some((a) => !/^\d{4}-\d{2}-\d{2}$/.test(a))) {
  console.error("Usage: tsx scripts/ingest.mts [date | from to]   (dates as YYYY-MM-DD)");
  process.exit(1);
}
// The daily job runs at 22:30 UTC, when Berlin is already on the next day
// in summer, so the default is the UTC date (docs/STATUS.md → Known issues).
const from = args[0] ?? new Date().toISOString().slice(0, 10);
const to = args[1] ?? from;

if (existsSync(".env")) process.loadEnvFile(".env");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (see .env.example)");
  process.exit(1);
}

const db = connect(url);
try {
  const reports = await ingestRange(db, createMarketDataClient(), from, to);
  reports.forEach(print);
  if (hasFailures(reports)) {
    console.error("Some snapshots failed (see above).");
    process.exitCode = 1;
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await db.close();
}

function print(report: IngestReport): void {
  console.log(`${report.date}: ${report.prices.length} prices, ${report.fx.length} FX rates`);
  for (const p of report.prices) {
    if (p.status === "fetched") console.log(`  ok      ${p.symbol} ${p.close} ${p.currency}`);
    if (p.status === "carried") {
      console.log(`  carried ${p.symbol} ${p.close} ${p.currency} (from ${p.from})`);
    }
    if (p.status === "failed") console.error(`  FAILED  ${p.symbol}: ${p.error}`);
  }
  for (const f of report.fx) {
    if (f.status === "fetched") {
      console.log(`  ok      EUR/${f.currency} ${f.unitsPerEur} (ECB ${f.from})`);
    } else {
      console.error(`  FAILED  EUR/${f.currency}: ${f.error}`);
    }
  }
}
