import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "./db";
import { validate, type LedgerTransaction } from "@/lib/ledger";
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

  it("produces a ledger that passes the game rules", async () => {
    await seed(db);
    const rows = await db.query<{
      id: number;
      player_id: number;
      date: string;
      type: LedgerTransaction["type"];
      instrument_id: number | null;
      shares: string | null;
      amount_cents: number;
    }>("select * from transactions order by id");
    const byPlayer = new Map<number, LedgerTransaction[]>();
    for (const r of rows) {
      const list = byPlayer.get(r.player_id) ?? [];
      list.push({
        id: String(r.id),
        date: r.date,
        type: r.type,
        instrumentId: r.instrument_id === null ? null : String(r.instrument_id),
        shares: r.shares,
        amountCents: r.amount_cents,
      });
      byPlayer.set(r.player_id, list);
    }
    expect(byPlayer.size).toBe(3);
    for (const ledger of byPlayer.values()) {
      // Adding the last row re-checks the whole ledger, day by day.
      const last = ledger[ledger.length - 1];
      const rest = ledger.slice(0, -1);
      expect(validate(rest, { kind: "create", transaction: last })).toEqual([]);
    }
  });

  it("refuses to run twice", async () => {
    await seed(db);
    await expect(seed(db)).rejects.toThrow(/already has 3 players/);
  });
});
