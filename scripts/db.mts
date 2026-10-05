// Database CLI: `npm run db:migrate` or `npm run db:seed`.
// Reads DATABASE_URL from the environment or from .env.
import { existsSync } from "node:fs";
import { connect } from "../src/lib/db/postgres";
import { migrate } from "../src/lib/db/migrate";
import { seed } from "../src/lib/db/seed";

const command = process.argv[2];
if (command !== "migrate" && command !== "seed") {
  console.error("Usage: tsx scripts/db.mts migrate|seed");
  process.exit(1);
}

if (existsSync(".env")) process.loadEnvFile(".env");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (see .env.example)");
  process.exit(1);
}

const db = connect(url);
try {
  if (command === "migrate") {
    const ran = await migrate(db);
    console.log(ran.length ? `Applied: ${ran.join(", ")}` : "Already up to date.");
  } else {
    await seed(db);
    console.log("Seeded dev data.");
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await db.close();
}
