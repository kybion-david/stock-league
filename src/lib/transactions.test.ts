import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/db";
import { InputError } from "@/lib/db/errors";
import { migrate } from "@/lib/db/migrate";
import { createTestDb } from "@/lib/db/pglite";
import {
  berlinToday,
  createTransaction,
  deleteTransaction,
  getTransaction,
  listTransactions,
  parseAmountCents,
  position,
  updateTransaction,
  type TransactionForm,
} from "./transactions";

const TODAY = "2026-11-20";

let db: Db & { close(): Promise<void> };
let alice: number;
let bob: number;
let aapl: string;
let btc: string;

beforeEach(async () => {
  db = await createTestDb();
  await migrate(db);
  [{ id: alice }, { id: bob }] = await db.query<{ id: number }>(
    "insert into players (name) values ('Alice'), ('Bob') returning id",
  );
  const instruments = await db.query<{ id: number }>(
    `insert into instruments (symbol, name, type, currency) values
       ('AAPL', 'Apple', 'stock', 'USD'), ('BTC-EUR', 'Bitcoin', 'crypto', 'EUR')
     returning id`,
  );
  [aapl, btc] = instruments.map((i) => String(i.id));
});

afterEach(async () => {
  await db.close();
});

function form(overrides: Partial<TransactionForm>): TransactionForm {
  return {
    date: "2026-11-02",
    type: "buy",
    instrumentId: aapl,
    shares: "2",
    amount: "400",
    note: "",
    by: "Alice",
    ...overrides,
  };
}

const add = (playerId: number, overrides: Partial<TransactionForm>) =>
  createTransaction(db, playerId, form(overrides), TODAY);

describe("parseAmountCents", () => {
  it("accepts euros with a dot or a comma and at most 2 decimals", () => {
    expect(parseAmountCents("12")).toBe(1200);
    expect(parseAmountCents("12.5")).toBe(1250);
    expect(parseAmountCents("12,05")).toBe(1205);
    expect(parseAmountCents(" € 1234.56 ")).toBe(123456);
  });

  it("rejects zero, extra decimals, thousands separators and junk", () => {
    for (const bad of ["0", "0.00", "1.234", "1,234.56", "-5", "abc", "", "1e3", "2000000"]) {
      expect(() => parseAmountCents(bad), bad).toThrow(InputError);
    }
  });
});

describe("berlinToday", () => {
  it("uses the Berlin date, not the UTC one", () => {
    expect(berlinToday(new Date("2026-11-01T23:30:00Z"))).toBe("2026-11-02");
    expect(berlinToday(new Date("2026-07-01T21:59:00Z"))).toBe("2026-07-01");
    expect(berlinToday(new Date("2026-07-01T22:00:00Z"))).toBe("2026-07-02");
  });
});

describe("transactions", () => {
  it("adds all four types with audit fields and lists them newest first", async () => {
    await add(alice, {});
    await add(alice, { type: "fee", instrumentId: "", shares: "", amount: "1,50", note: " Broker " });
    await add(alice, { date: "2026-11-10", type: "dividend", shares: "9", amount: "0.40" });
    await add(alice, { date: "2026-11-12", type: "sell", shares: "1.50000000", amount: "310", by: "Bob" });
    await add(bob, { by: "Bob" });

    const list = await listTransactions(db, alice);
    expect(list.map((t) => [t.date, t.type, t.symbol, t.shares, t.amountCents, t.note])).toEqual([
      ["2026-11-12", "sell", "AAPL", "1.5", 31000, null],
      ["2026-11-10", "dividend", "AAPL", null, 40, null],
      ["2026-11-02", "fee", null, null, 150, "Broker"],
      ["2026-11-02", "buy", "AAPL", "2", 40000, null],
    ]);
    expect(list[0]).toMatchObject({ createdBy: "Bob", updatedBy: "Bob" });
    expect(list[0].createdAt).toBeInstanceOf(Date);
    expect(list[0].updatedAt).toBeInstanceOf(Date);

    // €1,000 − 400 − 1.50 + 0.40 + 310 = €908.90, with 0.5 AAPL left.
    expect(position(list)).toEqual({
      cashCents: 90890,
      holdings: [{ symbol: "AAPL", shares: "0.5" }],
    });
  });

  it("rejects bad input with readable messages", async () => {
    await expect(add(alice, { type: "swap" })).rejects.toThrow("Pick buy, sell, fee or dividend.");
    await expect(add(alice, { instrumentId: "" })).rejects.toThrow("A buy needs an instrument.");
    await expect(add(alice, { instrumentId: "999" })).rejects.toThrow("doesn't exist");
    await expect(add(alice, { shares: "" })).rejects.toThrow("needs a number of shares");
    await expect(add(alice, { shares: "0.123456789" })).rejects.toThrow("at most 8 decimal places");
    await expect(add(alice, { date: "2026-02-30" })).rejects.toThrow("real date");
    await expect(add(alice, { date: "2026-11-21" })).rejects.toThrow("can't be in the future");
    await expect(add(alice, { by: "Mallory" })).rejects.toThrow("Pick who is making this change.");
    await expect(add(alice, { note: "x".repeat(201) })).rejects.toThrow("Keep the note");
    await expect(add(alice, { amount: "12.345" })).rejects.toThrow("at most 2 decimals");
    expect(await listTransactions(db, alice)).toEqual([]);
  });

  it("accepts a comma in shares and ignores shares on fees and dividends", async () => {
    await add(alice, { instrumentId: btc, shares: "0,0105", amount: "999" });
    const fee = await add(alice, { type: "fee", shares: "3", amount: "1" });
    expect(fee).toMatchObject({ shares: null, symbol: "AAPL" });
    expect(position(await listTransactions(db, alice)).holdings).toEqual([
      { symbol: "BTC-EUR", shares: "0.0105" },
    ]);
  });

  it("enforces the cash floor and overselling, per player", async () => {
    await expect(add(alice, { amount: "1050.01" })).rejects.toThrow(
      "On 2026-11-02 cash would be -€50.01, below the -€50.00 limit.",
    );
    await add(alice, { amount: "1050" });
    await expect(add(alice, { type: "sell", shares: "3", amount: "600" })).rejects.toThrow(
      "more AAPL shares would be sold than held",
    );
    // Bob's ledger is separate: he holds nothing.
    await expect(add(bob, { type: "sell", by: "Bob" })).rejects.toThrow("more AAPL shares");
  });

  it("edits a transaction, re-checking the whole ledger", async () => {
    const buy = await add(alice, {});
    await add(alice, { date: "2026-11-05", type: "sell", shares: "2", amount: "420" });

    await expect(updateTransaction(db, buy.id, form({ shares: "1" }), TODAY)).rejects.toThrow(
      "On 2026-11-05 more AAPL shares would be sold than held",
    );
    const edited = await updateTransaction(
      db,
      buy.id,
      form({ shares: "3", amount: "600", note: "fixed", by: "Bob" }),
      TODAY,
    );
    expect(edited).toMatchObject({ shares: "3", amountCents: 60000, note: "fixed" });
    expect(edited).toMatchObject({ createdBy: "Alice", updatedBy: "Bob" });
    expect(edited.updatedAt.getTime()).toBeGreaterThanOrEqual(edited.createdAt.getTime());

    await expect(updateTransaction(db, 999, form({}), TODAY)).rejects.toThrow(InputError);
  });

  it("deletes a transaction unless a later one depends on it", async () => {
    const buy = await add(alice, {});
    const sell = await add(alice, { date: "2026-11-05", type: "sell", shares: "2", amount: "420" });

    await expect(deleteTransaction(db, buy.id)).rejects.toThrow("more AAPL shares");
    await deleteTransaction(db, sell.id);
    await deleteTransaction(db, buy.id);
    expect(await getTransaction(db, buy.id)).toBeNull();
    await expect(deleteTransaction(db, buy.id)).rejects.toThrow("doesn't exist anymore");
  });

  it("rejects transactions for unknown players", async () => {
    await expect(add(999, {})).rejects.toThrow("That player doesn't exist.");
  });
});
