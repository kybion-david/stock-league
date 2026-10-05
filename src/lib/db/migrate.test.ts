import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Db } from "./db";
import { migrate } from "./migrate";
import { createTestDb } from "./pglite";

let db: Db & { close(): Promise<void> };

beforeEach(async () => {
  db = await createTestDb();
});

afterEach(async () => {
  await db.close();
});

async function tableNames(): Promise<string[]> {
  const rows = await db.query<{ table_name: string }>(
    `select table_name from information_schema.tables
     where table_schema = 'public' order by table_name`,
  );
  return rows.map((r) => r.table_name);
}

describe("migrate", () => {
  it("creates all tables from scratch", async () => {
    const ran = await migrate(db);
    expect(ran).toEqual(["001_initial_schema.sql"]);
    expect(await tableNames()).toEqual([
      "fx_snapshots",
      "instruments",
      "players",
      "price_snapshots",
      "schema_migrations",
      "transactions",
    ]);
  });

  it("is a no-op when re-run", async () => {
    await migrate(db);
    expect(await migrate(db)).toEqual([]);
  });

  it("rolls back a failing migration completely", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "migrations-"));
    await writeFile(path.join(dir, "001_ok.sql"), "create table a (id int);");
    await writeFile(
      path.join(dir, "002_bad.sql"),
      "create table b (id int); select * from missing_table;",
    );

    await expect(migrate(db, dir)).rejects.toThrow();
    expect(await tableNames()).toEqual(["a", "schema_migrations"]);
    const applied = await db.query<{ name: string }>("select name from schema_migrations");
    expect(applied.map((r) => r.name)).toEqual(["001_ok.sql"]);
  });
});

describe("schema", () => {
  let playerId: number;
  let instrumentId: number;

  beforeEach(async () => {
    await migrate(db);
    [{ id: playerId }] = await db.query<{ id: number }>(
      "insert into players (name) values ('Test') returning id",
    );
    [{ id: instrumentId }] = await db.query<{ id: number }>(
      `insert into instruments (symbol, name, type, currency)
       values ('BTC-EUR', 'Bitcoin', 'crypto', 'EUR') returning id`,
    );
  });

  function insertTransaction(t: {
    type: string;
    instrumentId?: number | null;
    shares?: string | null;
    amountCents: number | string;
  }) {
    return db.query(
      `insert into transactions
         (player_id, date, type, instrument_id, shares, amount_cents, created_by, updated_by)
       values ($1, '2026-11-02', $2, $3, $4, $5, 'test', 'test')
       returning date, shares, amount_cents`,
      [playerId, t.type, t.instrumentId ?? null, t.shares ?? null, t.amountCents],
    );
  }

  it("stores fractional shares exactly and maps types", async () => {
    const [row] = await insertTransaction({
      type: "buy",
      instrumentId,
      shares: "0.00012345",
      amountCents: 1234,
    });
    expect(row).toEqual({ date: "2026-11-02", shares: "0.00012345", amount_cents: 1234 });
  });

  it("rejects more than 8 decimal places of shares", async () => {
    await expect(
      insertTransaction({ type: "buy", instrumentId, shares: "0.000000001", amountCents: 100 }),
    ).rejects.toThrow();
  });

  it("rejects fractional cents", async () => {
    await expect(
      insertTransaction({ type: "fee", amountCents: "12.5" }),
    ).rejects.toThrow();
  });

  it("rejects zero or negative amounts and shares", async () => {
    await expect(insertTransaction({ type: "fee", amountCents: 0 })).rejects.toThrow();
    await expect(
      insertTransaction({ type: "buy", instrumentId, shares: "-1", amountCents: 100 }),
    ).rejects.toThrow();
  });

  it.each(["buy", "sell", "dividend"])("requires an instrument for %s", async (type) => {
    await expect(
      insertTransaction({ type, shares: type === "dividend" ? null : "1", amountCents: 100 }),
    ).rejects.toThrow();
  });

  it("requires shares for buy and sell, and forbids them otherwise", async () => {
    await expect(insertTransaction({ type: "buy", instrumentId, amountCents: 100 })).rejects.toThrow();
    await expect(
      insertTransaction({ type: "dividend", instrumentId, shares: "1", amountCents: 100 }),
    ).rejects.toThrow();
    await expect(insertTransaction({ type: "fee", shares: "1", amountCents: 100 })).rejects.toThrow();
  });

  it("allows a fee with or without an instrument", async () => {
    await insertTransaction({ type: "fee", amountCents: 100 });
    await insertTransaction({ type: "fee", instrumentId, amountCents: 100 });
  });

  it("rejects unknown transaction and instrument types", async () => {
    await expect(insertTransaction({ type: "gift", amountCents: 100 })).rejects.toThrow();
    await expect(
      db.query(
        "insert into instruments (symbol, name, type, currency) values ('X', 'X', 'bond', 'EUR')",
      ),
    ).rejects.toThrow();
  });

  it("rejects duplicate symbols and player names", async () => {
    await expect(
      db.query(
        "insert into instruments (symbol, name, type, currency) values ('BTC-EUR', 'Dup', 'crypto', 'EUR')",
      ),
    ).rejects.toThrow();
    await expect(db.query("insert into players (name) values ('Test')")).rejects.toThrow();
  });

  it("keeps one price per instrument and day", async () => {
    const insert = () =>
      db.query(
        "insert into price_snapshots (instrument_id, date, close, currency) values ($1, '2026-11-02', '94850.25', 'EUR')",
        [instrumentId],
      );
    await insert();
    await expect(insert()).rejects.toThrow();
    const [row] = await db.query("select date, close from price_snapshots");
    expect(row).toEqual({ date: "2026-11-02", close: "94850.25" });
  });

  it("keeps one FX rate per currency and day, and none for EUR", async () => {
    const insert = (currency: string) =>
      db.query(
        "insert into fx_snapshots (date, currency, units_per_eur) values ('2026-11-02', $1, '1.1612')",
        [currency],
      );
    await insert("USD");
    await expect(insert("USD")).rejects.toThrow();
    await expect(insert("EUR")).rejects.toThrow();
  });
});
