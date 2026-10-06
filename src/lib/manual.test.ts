import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/db";
import { InputError } from "@/lib/db/errors";
import { migrate } from "@/lib/db/migrate";
import { createTestDb } from "@/lib/db/pglite";
import { ingestDate } from "@/lib/ingest";
import { addManualInstrument, getInstrument, updateInstrument } from "@/lib/instruments";
import type { MarketDataClient } from "@/lib/market-data";
import { createTransaction } from "@/lib/transactions";
import { latestSnapshotDate, standings } from "@/lib/valuation";
import {
  latestManualValues,
  parseWorthCents,
  setManualValue,
  unitValue,
  type ManualValueForm,
} from "./manual";

const TODAY = "2026-11-20";

let db: Db & { close(): Promise<void> };
let alice: number;
let calls: string;
let aapl: number;

beforeEach(async () => {
  db = await createTestDb();
  await migrate(db);
  [{ id: alice }] = await db.query<{ id: number }>(
    "insert into players (name) values ('Alice') returning id",
  );
  [{ id: aapl }] = await db.query<{ id: number }>(
    "insert into instruments (symbol, name, type, currency) values ('AAPL', 'Apple', 'stock', 'EUR') returning id",
  );
  calls = String((await addManualInstrument(db, "  NVDA  calls ")).id);
  // €200 into the calls on 11-02.
  await createTransaction(
    db,
    alice,
    { date: "2026-11-02", type: "buy", instrumentId: calls, shares: "1", amount: "200", note: "", by: "Alice" },
    TODAY,
  );
});

afterEach(async () => {
  await db.close();
});

const worth = (overrides: Partial<ManualValueForm>) =>
  setManualValue(db, alice, { instrumentId: calls, date: "2026-11-05", worth: "350", ...overrides }, TODAY);

describe("parseWorthCents", () => {
  it("allows €0, unlike a trade amount", () => {
    expect(parseWorthCents("0")).toBe(0);
    expect(parseWorthCents("0,00")).toBe(0);
    expect(parseWorthCents("€ 12,5")).toBe(1250);
    expect(() => parseWorthCents("-5")).toThrow(InputError);
  });
});

describe("unitValue", () => {
  it("divides the total over the units, to 8 decimals", () => {
    expect(unitValue(35_000, "1")).toBe("350");
    expect(unitValue(10_000, "3")).toBe("33.33333333");
    expect(unitValue(0, "2")).toBe("0");
  });
});

describe("addManualInstrument", () => {
  it("uses the name as the symbol, in EUR", async () => {
    expect(await getInstrument(db, Number(calls))).toMatchObject({
      symbol: "NVDA calls",
      name: "NVDA calls",
      type: "manual",
      currency: "EUR",
    });
  });

  it("rejects duplicates of any symbol, in any case", async () => {
    await expect(addManualInstrument(db, "aapl")).rejects.toThrow("already in the list");
    await expect(addManualInstrument(db, "nvda CALLS")).rejects.toThrow("already in the list");
  });

  it("rejects blank and long names", async () => {
    await expect(addManualInstrument(db, " ")).rejects.toThrow("Enter a name");
    await expect(addManualInstrument(db, "x".repeat(33))).rejects.toThrow("32 characters");
  });

  it("stays manual and in EUR when edited", async () => {
    const edited = await updateInstrument(db, Number(calls), {
      name: "Nvidia Dec calls",
      type: "stock",
      currency: "USD",
      exchange: "",
    });
    expect(edited).toMatchObject({ symbol: "NVDA calls", name: "Nvidia Dec calls", type: "manual", currency: "EUR" });
  });
});

describe("setManualValue", () => {
  it("stores the per-unit value and overwrites the same day", async () => {
    await worth({});
    expect(await worth({ worth: "400" })).toEqual({
      symbol: "NVDA calls",
      date: "2026-11-05",
      close: "400",
      worthCents: 40_000,
    });
    expect(await latestManualValues(db)).toEqual(
      new Map([["NVDA calls", { symbol: "NVDA calls", date: "2026-11-05", close: "400" }]]),
    );
  });

  it("refuses priced instruments, future dates and days it isn't held", async () => {
    await expect(worth({ instrumentId: String(aapl) })).rejects.toThrow("manual instrument");
    await expect(worth({ date: "2026-11-21" })).rejects.toThrow("future");
    await expect(worth({ date: "2026-11-01" })).rejects.toThrow("No NVDA calls is held on 2026-11-01");
    await expect(worth({ worth: "abc" })).rejects.toThrow(InputError);
  });
});

describe("valuation", () => {
  it("counts at cost before a value, then at the last value, never as stale", async () => {
    let [row] = await standings(db, "2026-11-04");
    expect(row.holdings[0]).toMatchObject({ valueCents: 20_000, priceStatus: "current", manual: true });
    expect(row.stale).toBe(false);

    await worth({ worth: "0" });
    [row] = await standings(db, "2026-11-19");
    expect(row.holdings[0]).toMatchObject({ valueCents: 0, gainCents: -20_000, priceDate: "2026-11-05" });
    expect(row.valueCents).toBe(80_000);
    expect(row.stale).toBe(false);
  });

  it("keeps manual values out of the leaderboard's day and the daily job", async () => {
    await worth({ date: "2026-11-20" });
    expect(await latestSnapshotDate(db)).toBeNull();

    const fetched: string[] = [];
    const client = {
      getClose: async (symbol: string) => {
        fetched.push(symbol);
        throw new Error("not expected");
      },
    } as unknown as MarketDataClient;
    expect(await ingestDate(db, client, "2026-11-20")).toEqual({ date: "2026-11-20", prices: [], fx: [] });
    expect(fetched).toEqual([]);
  });
});
