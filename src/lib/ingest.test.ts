import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/db";
import { migrate } from "@/lib/db/migrate";
import { createTestDb } from "@/lib/db/pglite";
import { addDays, hasFailures, ingestDate, ingestRange } from "@/lib/ingest";
import {
  MarketDataError,
  NoDataError,
  UnknownSymbolError,
  type Close,
  type FxRate,
  type MarketDataClient,
} from "@/lib/market-data";

let db: Db & { close(): Promise<void> };

beforeEach(async () => {
  db = await createTestDb();
  await migrate(db);
});

afterEach(async () => {
  await db.close();
});

type Closes = Record<string, Record<string, string | Error>>;

/**
 * A fake client. `closes[symbol][date]` is the close (or an error to throw);
 * a missing date throws NoDataError like a weekend does. FX rates are keyed
 * by currency, with ECB-style weekend fallback to the last weekday.
 */
function fakeClient(
  closes: Closes,
  currencies: Record<string, string> = {},
  fx: Record<string, string | Error> = {},
) {
  const calls: string[] = [];
  const client: MarketDataClient = {
    async getClose(symbol, date): Promise<Close> {
      calls.push(`close ${symbol} ${date}`);
      const value = closes[symbol]?.[date];
      if (value instanceof Error) throw value;
      if (value === undefined) throw new NoDataError(`No close for "${symbol}" on ${date}`);
      return { symbol, date, close: value, currency: currencies[symbol] ?? "EUR" };
    },
    async getFxToEur(currency, date): Promise<FxRate> {
      calls.push(`fx ${currency} ${date}`);
      const value = fx[currency];
      if (value instanceof Error) throw value;
      if (value === undefined) throw new NoDataError(`No rate for ${currency}`);
      let published = date;
      while ([0, 6].includes(new Date(`${published}T00:00:00Z`).getUTCDay())) {
        published = addDays(published, -1);
      }
      return { currency, date: published, unitsPerEur: value };
    },
    lookupSymbol: () => Promise.reject(new Error("not used")),
    searchSymbols: () => Promise.reject(new Error("not used")),
  };
  return { client, calls };
}

async function addInstrument(symbol: string, currency = "EUR"): Promise<number> {
  const [row] = await db.query<{ id: number }>(
    `insert into instruments (symbol, name, type, currency) values ($1, $1, 'stock', $2) returning id`,
    [symbol, currency],
  );
  return row.id;
}

async function addPlayer(name: string): Promise<number> {
  const [row] = await db.query<{ id: number }>(
    "insert into players (name) values ($1) returning id",
    [name],
  );
  return row.id;
}

async function trade(
  playerId: number,
  date: string,
  type: "buy" | "sell",
  instrumentId: number,
  shares: string,
  amountCents = 10_000,
): Promise<void> {
  await db.query(
    `insert into transactions (player_id, date, type, instrument_id, shares, amount_cents, created_by, updated_by)
     values ($1, $2, $3, $4, $5, $6, 'test', 'test')`,
    [playerId, date, type, instrumentId, shares, amountCents],
  );
}

async function prices() {
  return db.query<{ symbol: string; date: string; close: string; currency: string }>(
    `select i.symbol, p.date, p.close, p.currency
     from price_snapshots p join instruments i on i.id = p.instrument_id
     order by p.date, i.symbol`,
  );
}

async function fxRows() {
  return db.query<{ date: string; currency: string; units_per_eur: string }>(
    "select date, currency, units_per_eur from fx_snapshots order by date, currency",
  );
}

// 2026-11-06 is a Friday; 11-07/08 are the weekend; 11-09 is a Monday.
describe("ingestDate", () => {
  it("stores closes for held instruments and FX for their currencies", async () => {
    const alice = await addPlayer("Alice");
    await trade(alice, "2026-11-02", "buy", await addInstrument("AAPL", "USD"), "2");
    await trade(alice, "2026-11-02", "buy", await addInstrument("IWDA.AS"), "1.5");
    const { client } = fakeClient(
      { AAPL: { "2026-11-06": "231.55" }, "IWDA.AS": { "2026-11-06": "110.12" } },
      { AAPL: "USD" },
      { USD: "1.1612" },
    );

    const report = await ingestDate(db, client, "2026-11-06");

    expect(report).toEqual({
      date: "2026-11-06",
      prices: [
        { symbol: "AAPL", status: "fetched", close: "231.55", currency: "USD" },
        { symbol: "IWDA.AS", status: "fetched", close: "110.12", currency: "EUR" },
      ],
      fx: [{ currency: "USD", status: "fetched", unitsPerEur: "1.1612", from: "2026-11-06" }],
    });
    expect(await prices()).toEqual([
      { symbol: "AAPL", date: "2026-11-06", close: "231.55", currency: "USD" },
      { symbol: "IWDA.AS", date: "2026-11-06", close: "110.12", currency: "EUR" },
    ]);
    expect(await fxRows()).toEqual([
      { date: "2026-11-06", currency: "USD", units_per_eur: "1.1612" },
    ]);
  });

  it("updates rather than duplicates when a date is re-run", async () => {
    const alice = await addPlayer("Alice");
    await trade(alice, "2026-11-02", "buy", await addInstrument("AAPL", "USD"), "2");
    await ingestDate(
      db,
      fakeClient({ AAPL: { "2026-11-06": "231.55" } }, { AAPL: "USD" }, { USD: "1.16" }).client,
      "2026-11-06",
    );

    await ingestDate(
      db,
      fakeClient({ AAPL: { "2026-11-06": "232" } }, { AAPL: "USD" }, { USD: "1.17" }).client,
      "2026-11-06",
    );

    expect(await prices()).toEqual([
      { symbol: "AAPL", date: "2026-11-06", close: "232", currency: "USD" },
    ]);
    expect(await fxRows()).toEqual([
      { date: "2026-11-06", currency: "USD", units_per_eur: "1.17" },
    ]);
  });

  it("only fetches instruments someone holds at the end of the day", async () => {
    const alice = await addPlayer("Alice");
    const bob = await addPlayer("Bob");
    const sap = await addInstrument("SAP.DE");
    const btc = await addInstrument("BTC-EUR");
    await addInstrument("NEVER");
    await trade(alice, "2026-11-02", "buy", sap, "1");
    await trade(alice, "2026-11-04", "sell", sap, "1");
    await trade(bob, "2026-11-02", "buy", btc, "0.001");
    await trade(bob, "2026-11-09", "buy", sap, "3"); // after the day
    const { client, calls } = fakeClient({ "BTC-EUR": { "2026-11-06": "95000" } });

    const report = await ingestDate(db, client, "2026-11-06");

    expect(report.prices.map((p) => p.symbol)).toEqual(["BTC-EUR"]);
    expect(calls).toEqual(["close BTC-EUR 2026-11-06"]);
  });

  it("does nothing on a day before anyone holds anything", async () => {
    const { client, calls } = fakeClient({});
    expect(await ingestDate(db, client, "2026-11-01")).toEqual({
      date: "2026-11-01",
      prices: [],
      fx: [],
    });
    expect(calls).toEqual([]);
  });

  it("carries the last stored close forward on weekends, with the day's FX", async () => {
    const alice = await addPlayer("Alice");
    await trade(alice, "2026-11-02", "buy", await addInstrument("AAPL", "USD"), "2");
    const { client, calls } = fakeClient(
      { AAPL: { "2026-11-06": "231.55" } },
      { AAPL: "USD" },
      { USD: "1.1612" },
    );
    await ingestDate(db, client, "2026-11-06");
    calls.length = 0;

    const report = await ingestDate(db, client, "2026-11-07");

    expect(report.prices).toEqual([
      { symbol: "AAPL", status: "carried", close: "231.55", currency: "USD", from: "2026-11-06" },
    ]);
    expect(report.fx).toEqual([
      { currency: "USD", status: "fetched", unitsPerEur: "1.1612", from: "2026-11-06" },
    ]);
    // Stored carry-forward needs no extra provider calls.
    expect(calls).toEqual(["close AAPL 2026-11-07", "fx USD 2026-11-07"]);
    expect((await prices()).map((p) => p.date)).toEqual(["2026-11-06", "2026-11-07"]);
    expect((await fxRows()).map((r) => r.date)).toEqual(["2026-11-06", "2026-11-07"]);
  });

  it("walks back with the client when nothing is stored yet", async () => {
    const alice = await addPlayer("Alice");
    await trade(alice, "2026-11-01", "buy", await addInstrument("SAP.DE"), "1");
    // 2026-11-01 is a Sunday: the last close is Friday 10-30.
    const { client, calls } = fakeClient({ "SAP.DE": { "2026-10-30": "240.5" } });

    const report = await ingestDate(db, client, "2026-11-01");

    expect(report.prices).toEqual([
      { symbol: "SAP.DE", status: "carried", close: "240.5", currency: "EUR", from: "2026-10-30" },
    ]);
    expect(calls).toEqual([
      "close SAP.DE 2026-11-01",
      "close SAP.DE 2026-10-31",
      "close SAP.DE 2026-10-30",
    ]);
    expect(await prices()).toEqual([
      { symbol: "SAP.DE", date: "2026-11-01", close: "240.5", currency: "EUR" },
    ]);
  });

  it("fails a symbol with no close in the carry-forward window", async () => {
    const alice = await addPlayer("Alice");
    await trade(alice, "2026-11-02", "buy", await addInstrument("GONE"), "1");
    const report = await ingestDate(db, fakeClient({}).client, "2026-11-06");
    expect(report.prices).toEqual([
      { symbol: "GONE", status: "failed", error: "No close on 2026-11-06 or in the 10 days before" },
    ]);
    expect(await prices()).toEqual([]);
  });

  it("re-running a carried day picks up a corrected close from the day before", async () => {
    const alice = await addPlayer("Alice");
    await trade(alice, "2026-11-02", "buy", await addInstrument("SAP.DE"), "1");
    const outage = new MarketDataError("query1.finance.yahoo.com failed after 3 retries");
    // Friday fails, so Saturday carries Thursday's close.
    const first = fakeClient({ "SAP.DE": { "2026-11-05": "1", "2026-11-06": outage } }).client;
    await ingestRange(db, first, "2026-11-05", "2026-11-07");
    expect((await prices()).map((p) => [p.date, p.close])).toEqual([
      ["2026-11-05", "1"],
      ["2026-11-07", "1"],
    ]);

    // Yahoo is back: re-running Friday and Saturday fixes both.
    const fixed = fakeClient({ "SAP.DE": { "2026-11-05": "1", "2026-11-06": "2" } }).client;
    const reports = await ingestRange(db, fixed, "2026-11-06", "2026-11-07");

    expect(reports[1].prices[0]).toMatchObject({ status: "carried", close: "2", from: "2026-11-06" });
    expect((await prices()).map((p) => [p.date, p.close])).toEqual([
      ["2026-11-05", "1"],
      ["2026-11-06", "2"],
      ["2026-11-07", "2"],
    ]);
  });

  it("reports a failing symbol, stores the rest and keeps the old row", async () => {
    const alice = await addPlayer("Alice");
    await trade(alice, "2026-11-02", "buy", await addInstrument("AAPL", "USD"), "1");
    await trade(alice, "2026-11-02", "buy", await addInstrument("BAD"), "1");
    await trade(alice, "2026-11-02", "buy", await addInstrument("SAP.DE"), "1");
    await ingestDate(db, fakeClient({ BAD: { "2026-11-06": "5" } }).client, "2026-11-06");

    const { client } = fakeClient(
      {
        AAPL: { "2026-11-06": new MarketDataError("query1.finance.yahoo.com failed after 3 retries") },
        BAD: { "2026-11-06": new UnknownSymbolError('Unknown symbol "BAD"') },
        "SAP.DE": { "2026-11-06": "240" },
      },
      { AAPL: "USD" },
    );
    const report = await ingestDate(db, client, "2026-11-06");

    expect(report.prices).toEqual([
      {
        symbol: "AAPL",
        status: "failed",
        error: "MarketDataError: query1.finance.yahoo.com failed after 3 retries",
      },
      { symbol: "BAD", status: "failed", error: 'UnknownSymbolError: Unknown symbol "BAD"' },
      { symbol: "SAP.DE", status: "fetched", close: "240", currency: "EUR" },
    ]);
    // USD isn't fetched: the only USD price failed.
    expect(report.fx).toEqual([]);
    expect(hasFailures([report])).toBe(true);
    expect(await prices()).toEqual([
      { symbol: "BAD", date: "2026-11-06", close: "5", currency: "EUR" },
      { symbol: "SAP.DE", date: "2026-11-06", close: "240", currency: "EUR" },
    ]);
  });

  it("reports a failing FX rate without losing the prices", async () => {
    const alice = await addPlayer("Alice");
    await trade(alice, "2026-11-02", "buy", await addInstrument("AAPL", "USD"), "1");
    const { client } = fakeClient(
      { AAPL: { "2026-11-06": "231" } },
      { AAPL: "USD" },
      { USD: new MarketDataError("api.frankfurter.dev failed") },
    );

    const report = await ingestDate(db, client, "2026-11-06");

    expect(report.fx).toEqual([
      { currency: "USD", status: "failed", error: "MarketDataError: api.frankfurter.dev failed" },
    ]);
    expect(hasFailures([report])).toBe(true);
    expect(await prices()).toHaveLength(1);
    expect(await fxRows()).toEqual([]);
  });

  it("stores a pence listing's close in GBP and fetches GBP FX", async () => {
    const alice = await addPlayer("Alice");
    await trade(alice, "2026-11-02", "buy", await addInstrument("VOD.L", "GBp"), "100");
    const { client, calls } = fakeClient(
      { "VOD.L": { "2026-11-06": "1.2835" } },
      { "VOD.L": "GBP" },
      { GBP: "0.8712" },
    );

    await ingestDate(db, client, "2026-11-06");

    expect(await prices()).toEqual([
      { symbol: "VOD.L", date: "2026-11-06", close: "1.2835", currency: "GBP" },
    ]);
    expect(calls).toContain("fx GBP 2026-11-06");
    expect(await fxRows()).toEqual([
      { date: "2026-11-06", currency: "GBP", units_per_eur: "0.8712" },
    ]);
  });

  it("rejects malformed dates", async () => {
    await expect(ingestDate(db, fakeClient({}).client, "2026-02-30")).rejects.toThrow(TypeError);
    await expect(ingestDate(db, fakeClient({}).client, "6.11.2026")).rejects.toThrow(TypeError);
  });
});

describe("ingestRange", () => {
  it("ingests every day in order, carrying across the weekend", async () => {
    const alice = await addPlayer("Alice");
    await trade(alice, "2026-11-02", "buy", await addInstrument("SAP.DE"), "1");
    const { client } = fakeClient({
      "SAP.DE": { "2026-11-06": "240", "2026-11-09": "245" },
    });

    const reports = await ingestRange(db, client, "2026-11-06", "2026-11-09");

    expect(reports.map((r) => [r.date, r.prices[0].status])).toEqual([
      ["2026-11-06", "fetched"],
      ["2026-11-07", "carried"],
      ["2026-11-08", "carried"],
      ["2026-11-09", "fetched"],
    ]);
    expect(hasFailures(reports)).toBe(false);
    expect((await prices()).map((p) => [p.date, p.close])).toEqual([
      ["2026-11-06", "240"],
      ["2026-11-07", "240"],
      ["2026-11-08", "240"],
      ["2026-11-09", "245"],
    ]);
  });

  it("crosses month ends and rejects a backwards range", async () => {
    const { client } = fakeClient({});
    const reports = await ingestRange(db, client, "2026-11-29", "2026-12-02");
    expect(reports.map((r) => r.date)).toEqual([
      "2026-11-29",
      "2026-11-30",
      "2026-12-01",
      "2026-12-02",
    ]);
    await expect(ingestRange(db, client, "2026-11-09", "2026-11-06")).rejects.toThrow(RangeError);
  });
});
