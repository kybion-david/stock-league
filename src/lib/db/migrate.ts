import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Db } from "./db";

/** `db/migrations/` at the repo root. */
export const MIGRATIONS_DIR = fileURLToPath(
  new URL("../../../db/migrations/", import.meta.url),
);

/**
 * Applies every `NNN_name.sql` file in `dir` that hasn't been applied yet, in
 * filename order. Each file runs in its own transaction together with its
 * `schema_migrations` row, so a failing file leaves nothing half-applied.
 * Safe to re-run: applied files are skipped. Returns the names it applied.
 */
export async function migrate(db: Db, dir = MIGRATIONS_DIR): Promise<string[]> {
  await db.exec(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const applied = new Set(
    (await db.query<{ name: string }>("select name from schema_migrations")).map(
      (r) => r.name,
    ),
  );

  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const script = await readFile(path.join(dir, file), "utf8");
    await db.transaction(async (tx) => {
      await tx.exec(script);
      await tx.query("insert into schema_migrations (name) values ($1)", [file]);
    });
    ran.push(file);
  }
  return ran;
}
