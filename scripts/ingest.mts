// Snapshot ingestion CLI (ticket 011, ADR 012):
//   npm run ingest                         → today's UTC date
//   npm run ingest -- 2026-11-06           → one date
//   npm run ingest -- 2026-11-01 2026-11-30 → a range, inclusive (backfill)
// First adds the market benchmark's instruments if needed and fills any of
// their days missing since kick-off (ADR 025), then fills rows still missing
// on the 7 days before the first date (a buy entered after its day's run). Reads DATABASE_URL from the environment or
// from .env. Every date and symbol is attempted; the exit code is 1 if
// anything failed.
import { existsSync } from "node:fs";
import { connect } from "../src/lib/db/postgres";
import { BENCHMARK_SYMBOLS, ensureBenchmarkInstruments } from "../src/lib/benchmark";
import {
  fillAlways,
  fillGaps,
  GAP_FILL_DAYS,
  hasFailures,
  ingestRange,
  type AlwaysFetch,
  type IngestReport,
} from "../src/lib/ingest";
import { createMarketDataClient } from "../src/lib/market-data";
import { GAME_START_DATE } from "../src/lib/valuation";

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
  const client = createMarketDataClient();
  const always: AlwaysFetch = { symbols: BENCHMARK_SYMBOLS, since: GAME_START_DATE };
  await ensureBenchmarkInstruments(db);
  const history = await fillAlways(db, client, from, always);
  history.forEach((report) => print(report, " (benchmark history)"));
  const gaps = await fillGaps(db, client, from, GAP_FILL_DAYS, always);
  gaps.forEach((report) => print(report, " (filled gap)"));
  const reports = await ingestRange(db, client, from, to, always);
  reports.forEach((report) => print(report));
  if (hasFailures([...history, ...gaps, ...reports])) {
    console.error("Some snapshots failed (see above).");
    process.exitCode = 1;
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await db.close();
}

function print(report: IngestReport, label = ""): void {
  console.log(`${report.date}${label}: ${report.prices.length} prices, ${report.fx.length} FX rates`);
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
