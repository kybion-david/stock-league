import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/db";
import { migrate } from "@/lib/db/migrate";
import { createTestDb } from "@/lib/db/pglite";
import { seed } from "@/lib/db/seed";
import {
  formatPlace,
  holdingNote,
  holdingRows,
  portfolio,
  realizedTotal,
} from "@/lib/portfolio";
import type { HoldingValuation } from "@/lib/valuation";

function holding(
  instrument: string,
  valueCents: number,
  extra: Partial<HoldingValuation> = {},
): HoldingValuation {
  return {
    instrument,
    shares: "1",
    costCents: 10_000,
    valueCents,
    gainCents: valueCents - 10_000,
    gainRate: (valueCents - 10_000) / 10_000,
    realizedCents: 0,
    priceStatus: "current",
    priceDate: "2026-11-03",
    fxDate: null,
    ...extra,
  };
}

describe("holdingRows", () => {
  const names = new Map([["AAPL", "Apple Inc."]]);

  it("sorts by value, biggest first, and adds names and weights", () => {
    const rows = holdingRows(
      [holding("AAPL", 20_000), holding("BTC-EUR", 50_000), holding("ABC", 20_000)],
      100_000,
      names,
    );
    expect(rows.map((r) => [r.instrument, r.name, r.weight])).toEqual([
      ["BTC-EUR", null, 0.5],
      ["AAPL", "Apple Inc.", 0.2],
      ["ABC", null, 0.2],
    ]);
  });

  it("has no weights when the total is zero or less", () => {
    expect(holdingRows([holding("AAPL", 100)], -50, names)[0].weight).toBeNull();
  });
});

describe("holdingNote", () => {
  it("is null for a price from the day", () => {
    expect(holdingNote(holding("AAPL", 1))).toBeNull();
  });

  it("names the older of the price and FX days", () => {
    const h = holding("AAPL", 1, {
      priceStatus: "stale",
      priceDate: "2026-11-03",
      fxDate: "2026-11-02",
    });
    expect(holdingNote(h)).toBe("Price from Mon 2 Nov.");
  });

  it("says when there is no price yet", () => {
    const h = holding("AAPL", 1, { priceStatus: "missing", priceDate: null });
    expect(holdingNote(h)).toBe("No price yet, so it counts at cost.");
  });
});

describe("realizedTotal", () => {
  it("adds sells of held and fully sold positions", () => {
    expect(
      realizedTotal(
        [holding("AAPL", 1, { realizedCents: 250 })],
        [{ instrument: "BTC-EUR", realizedCents: -100 }],
      ),
    ).toBe(150);
  });
});

describe("formatPlace", () => {
  it("uses English ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map((p) => formatPlace(p, 30))).toEqual([
      "1st of 30",
      "2nd of 30",
      "3rd of 30",
      "4th of 30",
      "11th of 30",
      "12th of 30",
      "13th of 30",
      "21st of 30",
      "22nd of 30",
    ]);
  });
});

describe("portfolio", () => {
  let db: Db & { close(): Promise<void> };

  beforeEach(async () => {
    db = await createTestDb();
    await migrate(db);
  });

  afterEach(async () => {
    await db.close();
  });

  const idOf = async (name: string) =>
    (await db.query<{ id: number }>("select id from players where name = $1", [name]))[0].id;

  it("is null for an unknown player", async () => {
    expect(await portfolio(db, 999, "2026-10-05")).toBeNull();
  });

  it("shows €1,000 cash and no chart before the game", async () => {
    await db.query("insert into players (name) values ('Amy')");
    const p = await portfolio(db, await idOf("Amy"), "2026-10-05");
    expect(p).toMatchObject({
      date: "2026-10-05",
      lastUpdated: null,
      started: false,
      playerCount: 1,
      holdings: [],
      series: [],
      transactions: [],
      realizedCents: 0,
    });
    expect(p?.row.cashCents).toBe(100_000);
  });

  it("matches the leaderboard for a seeded player, with a daily series", async () => {
    await seed(db);
    const p = await portfolio(db, await idOf("Alice"), "2026-11-05");
    expect(p).toMatchObject({ date: "2026-11-03", started: true, playerCount: 3 });
    expect(p?.row).toMatchObject({
      place: 2,
      award: "silver",
      valueCents: 99_859,
      cashCents: 4_700,
      feesCents: 300,
      dividendsCents: 0,
    });
    // AAPL €402.24 (+€2.24), IWDA €549.35 (−€0.65): IWDA is bigger, so first.
    expect(p?.holdings.map((h) => [h.instrument, h.name, h.valueCents, h.gainCents])).toEqual([
      ["IWDA.AS", "iShares Core MSCI World", 54_935, -65],
      ["AAPL", "Apple Inc.", 40_224, 224],
    ]);
    expect(p?.series.map((s) => [s.date, s.valueCents])).toEqual([
      ["2026-11-01", 100_000],
      ["2026-11-02", 99_641],
      ["2026-11-03", 99_859],
    ]);
    // Every transaction, newest first, even those after the day shown.
    expect(p?.transactions.map((t) => [t.date, t.type])).toEqual([
      ["2026-11-14", "dividend"],
      ["2026-11-02", "fee"],
      ["2026-11-02", "buy"],
      ["2026-11-02", "buy"],
    ]);
  });

  it("books the realized gain of a partial sell", async () => {
    await seed(db);
    await db.query(
      `insert into price_snapshots (instrument_id, date, close, currency)
       select id, '2026-11-12', '111.00', 'EUR' from instruments where symbol = 'IWDA.AS'`,
    );
    const p = await portfolio(db, await idOf("Carla"), "2026-11-12");
    // 9 IWDA cost €990.00; selling 2 for €222.00 removes €220.00 of cost.
    expect(p?.realizedCents).toBe(200);
    // 7 left: cost €770.00, worth 7 × €111.00 = €777.00.
    expect(p?.holdings.map((h) => [h.instrument, h.shares, h.costCents, h.valueCents])).toEqual([
      ["IWDA.AS", "7", 77_000, 77_700],
    ]);
    expect(p?.closed).toEqual([]);
  });
});
