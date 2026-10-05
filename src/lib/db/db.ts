/**
 * The minimal database interface the rest of the code talks to. Production
 * uses postgres.js (`./postgres.ts`); tests use in-memory PGlite
 * (`./pglite.ts`). Both map types the same way:
 *
 * - `integer` → number (ids, `amount_cents`)
 * - `numeric` → string, kept exact (shares, prices, FX rates)
 * - `date` → "YYYY-MM-DD" string (game days)
 * - `timestamptz` → Date
 */
export interface Db {
  /** Runs one parameterized statement ($1, $2, …) and returns its rows. */
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T[]>;
  /** Runs a script of one or more statements without parameters. */
  exec(text: string): Promise<void>;
  /** Runs `fn` in a transaction; it rolls back if `fn` throws. */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}
