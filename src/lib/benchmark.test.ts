import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  BENCHMARK,
  BENCHMARK_SYMBOLS,
  benchmarkLedger,
  benchmarkSeries,
  benchmarkStanding,
  ensureBenchmarkInstruments,
  versusMarket,
} from "@/lib/benchmark";
import type { Db } from "@/lib/db/db";
import { migrate } from "@/lib/db/migrate";
import { createTestDb } from "@/lib/db/pglite";
import { leaderboard } from "@/lib/leaderboard";
import { createPriceBook, loadGame } from "@/lib/valuation";

let db: Db & { close(): Promise<void> };

beforeEach(async () => {
  db = await createTestDb();
  await migrate(db);
});

afterEach(async () => {
  await db.close();
});

async function price(symbol: string, date: string, close: string) {
  await db.query(
    `insert into price_snapshots (instrument_id, date, close, currency)
     select id, $2, $3, 'EUR' from instruments where symbol = $1`,
    [symbol, date, close],
  );
}

describe("BENCHMARK", () => {
  it("is 70% developed and 30% emerging, adding up to the stake", () => {
    expect(BENCHMARK.parts.map((p) => [p.symbol, p.cents])).toEqual([
      ["EUNL.DE", 70_000],
      ["IS3N.DE", 30_000],
    ]);
    expect(BENCHMARK_SYMBOLS).toEqual(["EUNL.DE", "IS3N.DE"]);
  });
});

describe("ensureBenchmarkInstruments", () => {
  it("adds the ETFs once and leaves an existing row alone", async () => {
    await db.query(
      "insert into instruments (symbol, name, type, currency) values ('EUNL.DE', 'Mine', 'etf', 'EUR')",
    );
    await ensureBenchmarkInstruments(db);
    await ensureBenchmarkInstruments(db);
    expect(
      await db.query("select symbol, name, type, currency from instruments order by symbol"),
    ).toEqual([
      { symbol: "EUNL.DE", name: "Mine", type: "etf", currency: "EUR" },
      {
        symbol: "IS3N.DE",
        name: "iShares Core MSCI EM IMI UCITS ETF USD (Acc)",
        type: "etf",
        currency: "EUR",
      },
    ]);
  });
});

describe("benchmarkLedger", () => {
  it("buys €700 and €300 at the last close on or before kick-off", () => {
    const book = createPriceBook(
      [
        { instrument: "EUNL.DE", date: "2026-10-30", close: "110", currency: "EUR" },
        { instrument: "IS3N.DE", date: "2026-10-30", close: "33", currency: "EUR" },
        { instrument: "EUNL.DE", date: "2026-11-02", close: "999", currency: "EUR" },
      ],
      [],
    );
    expect(benchmarkLedger(book)).toEqual([
      expect.objectContaining({ instrumentId: "EUNL.DE", shares: "6.36363636", amountCents: 70_000 }),
      expect.objectContaining({ instrumentId: "IS3N.DE", shares: "9.09090909", amountCents: 30_000 }),
    ]);
  });

  it("converts a non-EUR close with the day's FX rate", () => {
    const book = createPriceBook(
      [{ instrument: "X", date: "2026-11-01", close: "120", currency: "USD" }],
      [{ date: "2026-11-01", currency: "USD", unitsPerEur: "1.2" }],
    );
    const parts = [{ symbol: "X", name: "X", label: "X", cents: 100_000 }];
    expect(benchmarkLedger(book, parts)?.[0].shares).toBe("10");
  });

  it("is null until every part has a price by kick-off", () => {
    const book = createPriceBook(
      [
        { instrument: "EUNL.DE", date: "2026-11-01", close: "110", currency: "EUR" },
        { instrument: "IS3N.DE", date: "2026-11-02", close: "33", currency: "EUR" },
      ],
      [],
    );
    expect(benchmarkLedger(book)).toBeNull();
  });
});

describe("benchmarkStanding and benchmarkSeries", () => {
  beforeEach(async () => {
    await ensureBenchmarkInstruments(db);
    await price("EUNL.DE", "2026-11-01", "100");
    await price("IS3N.DE", "2026-11-01", "30");
    await price("EUNL.DE", "2026-11-02", "110"); // +10%
    await price("IS3N.DE", "2026-11-02", "27"); // −10%
  });

  it("values the 70/30 mix like a player, with day change", async () => {
    const game = await loadGame(db, "2026-11-02");
    const day1 = benchmarkStanding(game, "2026-11-01");
    expect(day1?.valueCents).toBe(100_000);
    const day2 = benchmarkStanding(game, "2026-11-02");
    // 7 × 110 + 10 × 27 = 1,040
    expect(day2).toMatchObject({
      valueCents: 104_000,
      returnCents: 4_000,
      returnRate: 0.04,
      dayChangeCents: 4_000,
      stale: false,
    });
    expect(benchmarkStanding(game, "2026-10-31")).toBeNull();
    expect(benchmarkSeries(game, "2026-11-01", "2026-11-03")?.map((p) => [p.valueCents, p.stale])).toEqual([
      [100_000, false],
      [104_000, false],
      [104_000, true],
    ]);
  });

  it("shows on the leaderboard, with nobody's place changed", async () => {
    await db.query("insert into players (name) values ('Alice')");
    const board = await leaderboard(db, "2026-11-03");
    expect(board.date).toBe("2026-11-02");
    expect(board.benchmark?.valueCents).toBe(104_000);
    expect(board.rows.map((r) => [r.player.name, r.place])).toEqual([["Alice", 1]]);
  });

});

describe("benchmark before kick-off", () => {
  it("is missing from the pre-game leaderboard", async () => {
    await ensureBenchmarkInstruments(db);
    const board = await leaderboard(db, "2026-10-20");
    expect(board.started).toBe(false);
    expect(board.benchmark).toBeNull();
  });
});

describe("versusMarket", () => {
  it("is the gap in euros and as a share of the stake", () => {
    expect(versusMarket(105_000, { valueCents: 102_000 })).toEqual({ cents: 3_000, rate: 0.03 });
    expect(versusMarket(99_000, { valueCents: 102_000 })).toEqual({ cents: -3_000, rate: -0.03 });
  });
});

