import postgres from "postgres";
import type { Db } from "./db";

const DATE_OID = 1082;

type Sql = postgres.Sql | postgres.TransactionSql;

function wrap(sql: Sql): Db {
  return {
    async query<T>(text: string, params: unknown[] = []) {
      return (await sql.unsafe(text, params as postgres.ParameterOrJSON<never>[])) as unknown as T[];
    },
    async exec(text) {
      // Without parameters postgres.js uses the simple protocol, which allows
      // several statements in one call.
      await sql.unsafe(text);
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      if (!("begin" in sql)) {
        throw new Error("Nested transactions are not supported");
      }
      return (await sql.begin((tx) => fn(wrap(tx)))) as T;
    },
  };
}

/** Opens a connection pool. Call `close()` when a script is done. */
export function connect(url: string): Db & { close(): Promise<void> } {
  const sql = postgres(withoutUnsupportedParams(url), {
    // Neon's pooled endpoint runs PgBouncer in transaction mode, which
    // doesn't support named prepared statements.
    prepare: false,
    // Keep game days as "YYYY-MM-DD" strings instead of local-time Dates.
    types: {
      date: {
        to: DATE_OID,
        from: [DATE_OID],
        serialize: (x: string) => x,
        parse: (x: string) => x,
      },
    },
    onnotice: () => {},
  });
  return { ...wrap(sql), close: () => sql.end() };
}

/**
 * postgres.js sends URL params it doesn't know to the server as settings.
 * Neon's copy-paste URL includes `channel_binding=require`, which the server
 * would reject as an unknown setting, so drop it.
 */
export function withoutUnsupportedParams(url: string): string {
  const parsed = new URL(url);
  if (!parsed.searchParams.has("channel_binding")) return url;
  parsed.searchParams.delete("channel_binding");
  return parsed.toString();
}

let shared: Db | undefined;

/**
 * The app's shared connection, created on first use so that importing this
 * module (e.g. during `next build`) never needs `DATABASE_URL`.
 */
export function getDb(): Db {
  if (!shared) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
    shared = connect(url);
  }
  return shared;
}
