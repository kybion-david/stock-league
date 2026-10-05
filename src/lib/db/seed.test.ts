import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "./db";
import { migrate } from "./migrate";
import { createTestDb } from "./pglite";
import { seed } from "./seed";

let db: Db & { close(): Promise<void> };

beforeEach(async () => {
  db = await createTestDb();
  await migrate(db);
});

afterEach(async () => {
  await db.close();
});

describe("seed", () => {
  it("populates every table", async () => {
    await seed(db);
    for (const table of ["players", "instruments", "transactions", "price_snapshots", "fx_snapshots"]) {
      const [{ count }] = await db.query<{ count: number }>(
        `select count(*)::int as count from ${table}`,
      );
      expect(count, table).toBeGreaterThan(0);
    }
  });

  it("produces a valid ledger: cash never below −€50", async () => {
    await seed(db);
    // Running cash per player, in date order (buys and fees cost, sells and dividends pay).
    const rows = await db.query<{ name: string; cash: number }>(`
      select p.name,
             100000 + sum(case when t.type in ('sell', 'dividend') then t.amount_cents
                               else -t.amount_cents end)
                      over (partition by t.player_id order by t.date, t.id) as cash
      from transactions t join players p on p.id = t.player_id
    `);
    expect(Math.min(...rows.map((r) => Number(r.cash)))).toBeGreaterThanOrEqual(-5000);
  });

  it("refuses to run twice", async () => {
    await seed(db);
    await expect(seed(db)).rejects.toThrow(/already has 3 players/);
  });
});
