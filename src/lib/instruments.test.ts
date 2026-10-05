import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/db/db";
import { InputError } from "@/lib/db/errors";
import { migrate } from "@/lib/db/migrate";
import { createTestDb } from "@/lib/db/pglite";
import {
  RateLimitError,
  UnknownSymbolError,
  UnsupportedInstrumentError,
  type InstrumentInfo,
} from "@/lib/market-data";
import { addInstrument, getInstrument, listInstruments, updateInstrument } from "./instruments";

let db: Db & { close(): Promise<void> };

beforeEach(async () => {
  db = await createTestDb();
  await migrate(db);
});

afterEach(async () => {
  await db.close();
});

const apple: InstrumentInfo = {
  symbol: "AAPL",
  name: "Apple Inc.",
  type: "stock",
  currency: "USD",
  exchange: "NasdaqGS",
};

function market(result: InstrumentInfo | Error) {
  return {
    lookupSymbol: vi.fn(async () => {
      if (result instanceof Error) throw result;
      return result;
    }),
  };
}

describe("addInstrument", () => {
  it("stores what Yahoo reports, under Yahoo's symbol", async () => {
    const m = market(apple);
    const added = await addInstrument(db, m, " aapl ");
    expect(m.lookupSymbol).toHaveBeenCalledWith("aapl");
    expect(added).toEqual({ id: 1, ...apple });
    expect(await listInstruments(db)).toEqual([added]);
  });

  it("keeps GBp as reported", async () => {
    const added = await addInstrument(
      db,
      market({ symbol: "VOD.L", name: "Vodafone", type: "stock", currency: "GBp", exchange: "LSE" }),
      "VOD.L",
    );
    expect(added.currency).toBe("GBp");
  });

  it("rejects duplicates in any case without asking Yahoo", async () => {
    await addInstrument(db, market(apple), "AAPL");
    const m = market(apple);
    await expect(addInstrument(db, m, "aapl")).rejects.toThrow("AAPL is already in the list.");
    expect(m.lookupSymbol).not.toHaveBeenCalled();
  });

  it("rejects a duplicate of Yahoo's canonical symbol", async () => {
    await addInstrument(db, market(apple), "AAPL");
    await expect(addInstrument(db, market(apple), "AAPL.X")).rejects.toThrow(
      "AAPL is already in the list.",
    );
  });

  it.each([
    [new UnknownSymbolError("nope"), "doesn't know"],
    [new UnsupportedInstrumentError('"^GSPC" is an index on Yahoo, not a stock'), "an index"],
    [new RateLimitError("429"), "Couldn't reach Yahoo"],
  ])("turns %s into a readable error", async (err, message) => {
    const result = addInstrument(db, market(err), "XYZ");
    await expect(result).rejects.toThrow(InputError);
    await expect(result).rejects.toThrow(message);
    expect(await listInstruments(db)).toEqual([]);
  });

  it("rethrows unexpected errors", async () => {
    await expect(addInstrument(db, market(new TypeError("bug")), "XYZ")).rejects.toThrow(TypeError);
  });

  it("rejects blank or odd symbols and a missing currency", async () => {
    await expect(addInstrument(db, market(apple), "  ")).rejects.toThrow(InputError);
    await expect(addInstrument(db, market(apple), "A B")).rejects.toThrow(InputError);
    await expect(addInstrument(db, market({ ...apple, currency: "" }), "AAPL")).rejects.toThrow(
      "usable currency",
    );
  });
});

describe("updateInstrument", () => {
  it("changes name, type, currency and exchange, but not the symbol", async () => {
    const { id } = await addInstrument(db, market(apple), "AAPL");
    await updateInstrument(db, id, { name: " Apple ", type: "etf", currency: "EUR", exchange: "" });
    expect(await getInstrument(db, id)).toEqual({
      id,
      symbol: "AAPL",
      name: "Apple",
      type: "etf",
      currency: "EUR",
      exchange: null,
    });
  });

  it("rejects bad input and unknown ids", async () => {
    const { id } = await addInstrument(db, market(apple), "AAPL");
    const ok = { name: "Apple", type: "stock", currency: "USD", exchange: "" };
    await expect(updateInstrument(db, id, { ...ok, name: " " })).rejects.toThrow(InputError);
    await expect(updateInstrument(db, id, { ...ok, type: "bond" })).rejects.toThrow(InputError);
    await expect(updateInstrument(db, id, { ...ok, currency: "EURO" })).rejects.toThrow(InputError);
    await expect(updateInstrument(db, 999, ok)).rejects.toThrow(InputError);
    expect(await getInstrument(db, 999)).toBeNull();
  });
});
