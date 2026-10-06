import { PGlite, types, type Transaction } from "@electric-sql/pglite";
import type { Db } from "./db";

function wrap(pg: PGlite | Transaction): Db {
  return {
    async query<T>(text: string, params: unknown[] = []) {
      return (await pg.query<T>(text, params)).rows;
    },
    async exec(text) {
      await pg.exec(text);
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      if (!("transaction" in pg)) {
        throw new Error("Nested transactions are not supported");
      }
      return pg.transaction((tx) => fn(wrap(tx)));
    },
  };
}

/**
 * A fresh in-memory Postgres for tests and demo mode (ADR 021), with the same
 * type mapping as the postgres.js client.
 */
export async function createTestDb(): Promise<Db & { close(): Promise<void> }> {
  const pg = await PGlite.create({
    parsers: {
      [types.DATE]: (x: string) => x,
      [types.NUMERIC]: (x: string) => x,
    },
  });
  return { ...wrap(pg), close: () => pg.close() };
}
