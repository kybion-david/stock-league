import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Db } from "@/lib/db/db";
import { loadSeason } from "./load";
import { demoSeason } from "./season";

let opening: Promise<Db> | undefined;

/**
 * The app's database in demo mode (ADR 020): an in-memory PGlite per server
 * instance, migrated and filled with the demo season on first use. The real
 * database is never touched. Changes made on the site live until the
 * instance restarts.
 */
export function demoDb(): Db {
  const db = () => (opening ??= open().catch((error) => {
    opening = undefined;
    throw error;
  }));
  return {
    async query<T>(text: string, params?: unknown[]) {
      return (await db()).query<T>(text, params);
    },
    async exec(text) {
      await (await db()).exec(text);
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      return (await db()).transaction(fn);
    },
  };
}

async function open(): Promise<Db> {
  // PGlite is only needed here, so a normal build never loads it.
  const { createTestDb } = await import("@/lib/db/pglite");
  const db = await createTestDb();
  // Not `migrate()`: its import.meta.url path breaks the Next bundle. The
  // migrations ship next to the server (next.config.ts), and a fresh
  // in-memory database just needs every file run once, in order.
  const dir = path.join(process.cwd(), "db", "migrations");
  for (const file of (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(await readFile(path.join(dir, file), "utf8"));
  }
  await loadSeason(db, demoSeason());
  return db;
}
