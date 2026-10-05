import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/db";
import { migrate } from "@/lib/db/migrate";
import { createTestDb } from "@/lib/db/pglite";
import { seed } from "@/lib/db/seed";
import type { LedgerTransaction } from "@/lib/ledger";
import {
  createPriceBook,
  dayChange,
  eurCents,
  latestSnapshotDate,
  playerSeries,
  standings,
  valuePlayer,
  valueSeries,
  type FxRow,
  type PriceRow,
} from "@/lib/valuation";

let nextId = 1;
function tx(
  date: string,
  type: LedgerTransaction["type"],
  amountCents: number,
  instrumentId: string | null = null,
  shares: string | null = null,
): LedgerTransaction {
  return { id: String(nextId++), date, type, instrumentId, shares, amountCents };
}
const buy = (date: string, symbol: string, shares: string, cents: number) =>
  tx(date, "buy", cents, symbol, shares);
const sell = (date: string, symbol: string, shares: string, cents: number) =>
  tx(date, "sell", cents, symbol, shares);
const price = (instrument: string, date: string, close: string, currency = "EUR"): PriceRow => ({
  instrument,
  date,
  close,
  currency,
});
const usd = (date: string, unitsPerEur: string): FxRow => ({ date, currency: "USD", unitsPerEur });

describe("eurCents", () => {
  it("converts exactly and rounds half up to a cent", () => {
    // 2 × 231.55 USD = 463.10 USD; / 1.1612 = €398.8116 → 39881 cents.
    expect(eurCents("2", "231.55", "1.1612")).toBe(39881);
    expect(eurCents("0.5", "100")).toBe(5000);
    expect(eurCents("1", "0.005")).toBe(1); // exactly half a cent
    expect(eurCents("1", "0.0049")).toBe(0);
    // 0.01052631 × 96120.80 = €1,011.797… → 101180 cents.
    expect(eurCents("0.01052631", "96120.80")).toBe(101180);
  });

  it("rejects a zero FX rate", () => {
    expect(() => eurCents("1", "1", "0")).toThrow(RangeError);
  });
});

describe("valuePlayer", () => {
  const book = createPriceBook(
    [
      price("AAPL", "2026-11-02", "231.55", "USD"),
      price("AAPL", "2026-11-03", "233.10", "USD"),
      price("IWDA.AS", "2026-11-02", "110.12"),
      price("IWDA.AS", "2026-11-03", "109.87"),
    ],
    [usd("2026-11-02", "1.1612"), usd("2026-11-03", "1.1590")],
  );
  const alice = [
    buy("2026-11-02", "AAPL", "2", 40_000),
    buy("2026-11-02", "IWDA.AS", "5", 55_000),
    tx("2026-11-02", "fee", 300),
  ];

  it("is €1,000 cash with no transactions", () => {
    expect(valuePlayer([], "2026-11-01", book)).toEqual({
      date: "2026-11-01",
      cashCents: 100_000,
      holdingsValueCents: 0,
      valueCents: 100_000,
      returnCents: 0,
      returnRate: 0,
      feesCents: 0,
      dividendsCents: 0,
      holdings: [],
      closedPositions: [],
      stale: false,
    });
  });

  it("adds cash and holdings at the day's closes in EUR", () => {
    const v = valuePlayer(alice, "2026-11-02", book);
    // Cash 1000 − 400 − 550 − 3 = €47.00. AAPL €398.81, IWDA 5 × 110.12 = €550.60.
    expect(v.cashCents).toBe(4_700);
    expect(v.holdingsValueCents).toBe(39_881 + 55_060);
    expect(v.valueCents).toBe(99_641);
    expect(v.returnCents).toBe(-359);
    expect(v.returnRate).toBeCloseTo(-0.00359, 10);
    expect(v.feesCents).toBe(300);
    expect(v.stale).toBe(false);
    expect(v.holdings).toEqual([
      {
        instrument: "AAPL",
        shares: "2",
        costCents: 40_000,
        valueCents: 39_881,
        gainCents: -119,
        gainRate: -119 / 40_000,
        realizedCents: 0,
        priceStatus: "current",
        priceDate: "2026-11-02",
        fxDate: "2026-11-02",
      },
      {
        instrument: "IWDA.AS",
        shares: "5",
        costCents: 55_000,
        valueCents: 55_060,
        gainCents: 60,
        gainRate: 60 / 55_000,
        realizedCents: 0,
        priceStatus: "current",
        priceDate: "2026-11-02",
        fxDate: null,
      },
    ]);
  });

  it("uses the last known price and FX rate when a day is missing, and flags it", () => {
    const v = valuePlayer(alice, "2026-11-05", book);
    // 11-03 rows: AAPL 2 × 233.10 / 1.1590 = €402.24, IWDA 5 × 109.87 = €549.35.
    expect(v.valueCents).toBe(4_700 + 40_224 + 54_935);
    expect(v.stale).toBe(true);
    expect(v.holdings.map((h) => [h.priceStatus, h.priceDate, h.fxDate])).toEqual([
      ["stale", "2026-11-03", "2026-11-03"],
      ["stale", "2026-11-03", null],
    ]);
  });

  it("flags a missing FX rate for the day as stale even if the close is current", () => {
    const fxLate = createPriceBook(
      [price("AAPL", "2026-11-03", "233.10", "USD")],
      [usd("2026-11-02", "1.1612")],
    );
    const [h] = valuePlayer([buy("2026-11-03", "AAPL", "2", 40_000)], "2026-11-03", fxLate).holdings;
    // 466.20 / 1.1612 = €401.48.
    expect(h).toMatchObject({
      valueCents: 40_148,
      priceStatus: "stale",
      priceDate: "2026-11-03",
      fxDate: "2026-11-02",
    });
  });

  it("values a holding at cost when no price or FX rate is known yet", () => {
    const empty = createPriceBook([price("AAPL", "2026-11-03", "233.10", "USD")], []);
    const v = valuePlayer(
      [buy("2026-11-02", "AAPL", "2", 40_000), buy("2026-11-02", "NEW", "1", 10_000)],
      "2026-11-03",
      empty,
    );
    expect(v.valueCents).toBe(100_000); // nothing gained or lost until a price arrives
    expect(v.stale).toBe(true);
    expect(v.holdings.map((h) => [h.instrument, h.valueCents, h.gainCents, h.priceStatus])).toEqual(
      [
        ["AAPL", 40_000, 0, "missing"], // close known, but no USD rate
        ["NEW", 10_000, 0, "missing"],
      ],
    );
  });

  it("ignores prices from after the day", () => {
    const v = valuePlayer([buy("2026-11-01", "IWDA.AS", "1", 11_000)], "2026-11-01", book);
    expect(v.holdings[0]).toMatchObject({ valueCents: 11_000, priceStatus: "missing" });
  });

  it("tracks average cost and realized gains through sells", () => {
    const book = createPriceBook([price("X", "2026-11-03", "30")], []);
    const ledger = [
      buy("2026-11-01", "X", "10", 10_000),
      buy("2026-11-02", "X", "10", 30_000), // 20 shares for €400: €20 each
      sell("2026-11-03", "X", "5", 15_000), // cost of 5 = €100, so +€50 realized
    ];
    const [h] = valuePlayer(ledger, "2026-11-03", book).holdings;
    expect(h).toMatchObject({
      shares: "15",
      costCents: 30_000,
      valueCents: 45_000,
      gainCents: 15_000,
      gainRate: 0.5,
      realizedCents: 5_000,
    });

    // Selling the other 15 for €200 loses €100 on their €300 cost.
    const closed = valuePlayer([...ledger, sell("2026-11-04", "X", "15", 20_000)], "2026-11-04", book);
    expect(closed.holdings).toEqual([]);
    expect(closed.closedPositions).toEqual([{ instrument: "X", realizedCents: -5_000 }]);
    expect(closed.valueCents).toBe(100_000 - 10_000 - 30_000 + 15_000 + 20_000);
  });

  it("rounds the cost removed by a partial sell to a cent", () => {
    const v = valuePlayer(
      [buy("2026-11-01", "X", "3", 10_000), sell("2026-11-02", "X", "1", 4_000)],
      "2026-11-02",
      createPriceBook([], []),
    );
    // A third of €100.00 is €33.333… → €33.33 removed, €66.67 left.
    expect(v.holdings[0]).toMatchObject({ costCents: 6_667, realizedCents: 667 });
  });

  it("applies a day's buys before its sells, whatever order they were entered in", () => {
    const v = valuePlayer(
      [
        buy("2026-11-01", "X", "10", 10_000),
        sell("2026-11-02", "X", "10", 12_000),
        buy("2026-11-02", "X", "5", 5_000),
      ],
      "2026-11-02",
      createPriceBook([], []),
    );
    // 15 shares cost €150; selling 10 removes €100 and realizes €20.
    expect(v.holdings[0]).toMatchObject({ shares: "5", costCents: 5_000, realizedCents: 2_000 });
  });

  it("totals fees and dividends up to the day", () => {
    const ledger = [
      buy("2026-11-01", "X", "1", 50_000),
      tx("2026-11-01", "fee", 150, "X"),
      tx("2026-11-02", "fee", 100),
      tx("2026-11-05", "dividend", 120, "X"),
      tx("2026-11-06", "fee", 999),
    ];
    const v = valuePlayer(ledger, "2026-11-05", createPriceBook([price("X", "2026-11-05", "500")], []));
    expect(v.feesCents).toBe(250);
    expect(v.dividendsCents).toBe(120);
    expect(v.cashCents).toBe(100_000 - 50_000 - 250 + 120);
    expect(v.valueCents).toBe(49_870 + 50_000);
  });
});

describe("dayChange", () => {
  it("is the difference and its rate", () => {
    expect(dayChange(101_000, 100_000)).toEqual({ dayChangeCents: 1_000, dayChangeRate: 0.01 });
    expect(dayChange(100, 0)).toEqual({ dayChangeCents: 100, dayChangeRate: null });
  });
});

describe("valueSeries", () => {
  it("gives one point per day, with the first day's change against €1,000", () => {
    const book = createPriceBook(
      [price("X", "2026-11-01", "10"), price("X", "2026-11-02", "12")],
      [],
    );
    const ledger = [buy("2026-11-01", "X", "50", 50_000)];
    expect(valueSeries(ledger, "2026-11-01", "2026-11-03", book)).toEqual([
      // €500 cash + 50 × €10 = €1,000: bought at €10, so no gain yet.
      { date: "2026-11-01", valueCents: 100_000, returnRate: 0, stale: false, dayChangeCents: 0, dayChangeRate: 0 },
      // 50 × €12 = €600: +€100.
      { date: "2026-11-02", valueCents: 110_000, returnRate: 0.1, stale: false, dayChangeCents: 10_000, dayChangeRate: 0.1 },
      // No row for 11-03: carried, flagged, unchanged.
      { date: "2026-11-03", valueCents: 110_000, returnRate: 0.1, stale: true, dayChangeCents: 0, dayChangeRate: 0 },
    ]);
  });

  it("rejects a reversed range", () => {
    expect(() => valueSeries([], "2026-11-02", "2026-11-01", createPriceBook([], []))).toThrow(
      RangeError,
    );
  });
});

describe("database", () => {
  let db: Db & { close(): Promise<void> };

  beforeEach(async () => {
    db = await createTestDb();
    await migrate(db);
  });

  afterEach(async () => {
    await db.close();
  });

  it("has no last update and €1,000 for everyone before any data", async () => {
    await db.query("insert into players (name) values ('Zed')");
    expect(await latestSnapshotDate(db)).toBeNull();
    const [zed] = await standings(db, "2026-11-01");
    expect(zed).toMatchObject({ valueCents: 100_000, dayChangeCents: 0, holdings: [] });
  });

  it("ranks the seeded players on 2026-11-03 with hand-calculated values", async () => {
    await seed(db);
    expect(await latestSnapshotDate(db)).toBe("2026-11-03");

    const rows = await standings(db, "2026-11-03");
    expect(
      rows.map((r) => [r.player.name, r.valueCents, r.dayChangeCents, r.stale]),
    ).toEqual([
      // Bob: −€0.50 cash + 0.01052631 BTC × €96,120.80 = €1,011.80. 11-02: €998.42.
      ["Bob", -50 + 101_180, 101_180 - 99_842, false],
      // Alice: €47.00 + AAPL €402.24 + IWDA €549.35. 11-02: €996.41.
      ["Alice", 4_700 + 40_224 + 54_935, 99_859 - 99_641, false],
      // Carla: €5.00 + 9 × €109.87 = €988.83. Before her first trade: €1,000.
      ["Carla", 500 + 98_883, 99_383 - 100_000, false],
    ]);
    expect(rows[1].holdings.map((h) => [h.instrument, h.gainCents])).toEqual([
      ["AAPL", 224],
      ["IWDA.AS", -65],
    ]);
  });

  it("returns a daily series per player, carrying the last prices forward", async () => {
    await seed(db);
    const series = await playerSeries(db, "2026-11-02", "2026-11-04");
    expect(series.map((s) => s.player.name)).toEqual(["Alice", "Bob", "Carla"]);
    const bob = series[1].points;
    expect(bob.map((p) => [p.date, p.valueCents, p.dayChangeCents, p.stale])).toEqual([
      ["2026-11-02", -50 + 99_842, -50 + 99_842 - 100_000, false],
      ["2026-11-03", -50 + 101_180, 101_180 - 99_842, false],
      ["2026-11-04", -50 + 101_180, 0, true],
    ]);
  });
});
