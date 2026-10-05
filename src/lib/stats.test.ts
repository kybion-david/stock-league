import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/db";
import { migrate } from "@/lib/db/migrate";
import { createTestDb } from "@/lib/db/pglite";
import { seed } from "@/lib/db/seed";
import type { Player } from "@/lib/players";
import {
  dayRecords,
  feeLeader,
  funStats,
  pickMovers,
  pickRecords,
  playerMovers,
} from "@/lib/stats";
import {
  createPriceBook,
  type HoldingValuation,
  type PlayerStanding,
  type SeriesPoint,
} from "@/lib/valuation";

const player = (id: number, name: string): Player => ({ id, name, emoji: null });
const ann = player(1, "Ann");
const ben = player(2, "Ben");
const cat = player(3, "Cat");

function holding(instrument: string, gainCents: number, realizedCents = 0): HoldingValuation {
  return {
    instrument,
    shares: "1",
    costCents: 10_000,
    valueCents: 10_000 + gainCents,
    gainCents,
    gainRate: gainCents / 10_000,
    realizedCents,
    priceStatus: "current",
    priceDate: "2026-11-03",
    fxDate: null,
  };
}

function standing(
  p: Player,
  fields: Partial<Pick<PlayerStanding, "dayChangeCents" | "feesCents" | "holdings" | "closedPositions">>,
): PlayerStanding {
  const dayChangeCents = fields.dayChangeCents ?? 0;
  return {
    player: p,
    date: "2026-11-03",
    cashCents: 100_000,
    holdingsValueCents: 0,
    valueCents: 100_000,
    returnCents: 0,
    returnRate: 0,
    feesCents: fields.feesCents ?? 0,
    dividendsCents: 0,
    holdings: fields.holdings ?? [],
    closedPositions: fields.closedPositions ?? [],
    stale: false,
    dayChangeCents,
    dayChangeRate: dayChangeCents / 100_000,
  };
}

const point = (date: string, dayChangeCents: number): SeriesPoint => ({
  date,
  valueCents: 100_000,
  returnRate: 0,
  stale: false,
  dayChangeCents,
  dayChangeRate: dayChangeCents / 100_000,
});

describe("playerMovers", () => {
  it("picks the biggest rise and fall in €, ties by name", () => {
    const rows = [
      standing(cat, { dayChangeCents: 500 }),
      standing(ann, { dayChangeCents: 500 }),
      standing(ben, { dayChangeCents: -20 }),
    ];
    const { topGainer, topLoser } = playerMovers(rows);
    expect(topGainer).toMatchObject({ player: ann, cents: 500, rate: 0.005 });
    expect(topLoser).toMatchObject({ player: ben, cents: -20 });
  });

  it("has no gainer if nobody rose and no loser if nobody fell", () => {
    const flat = playerMovers([standing(ann, {}), standing(ben, { dayChangeCents: 0 })]);
    expect(flat).toEqual({ topGainer: null, topLoser: null });
    const down = playerMovers([standing(ann, { dayChangeCents: -1 })]);
    expect(down.topGainer).toBeNull();
    expect(down.topLoser?.player).toBe(ann);
  });
});

describe("dayRecords", () => {
  it("finds the best and worst day across all players, earliest first on a tie", () => {
    const { bestDay, worstDay } = dayRecords([
      { player: ann, points: [point("2026-11-01", 0), point("2026-11-02", 900), point("2026-11-03", -50)] },
      { player: ben, points: [point("2026-11-01", 900), point("2026-11-02", -700), point("2026-11-03", 10)] },
    ]);
    expect(bestDay).toMatchObject({ player: ben, date: "2026-11-01", cents: 900 });
    expect(worstDay).toMatchObject({ player: ben, date: "2026-11-02", cents: -700 });
  });

  it("is empty while nobody has moved", () => {
    expect(dayRecords([{ player: ann, points: [point("2026-11-01", 0)] }])).toEqual({
      bestDay: null,
      worstDay: null,
    });
  });
});

describe("pickRecords", () => {
  it("adds realized gains to open ones and counts sold-out positions", () => {
    const rows = [
      standing(ann, { holdings: [holding("AAPL", 300, 200), holding("SAP.DE", -100)] }),
      standing(ben, { closedPositions: [{ instrument: "BTC-EUR", realizedCents: -400 }] }),
    ];
    const { bestPick, worstPick } = pickRecords(rows);
    expect(bestPick).toEqual({ player: ann, instrument: "AAPL", cents: 500 });
    expect(worstPick).toEqual({ player: ben, instrument: "BTC-EUR", cents: -400 });
  });

  it("has no best pick without a gain and no worst pick without a loss", () => {
    expect(pickRecords([standing(ann, { holdings: [holding("AAPL", 0)] })])).toEqual({
      bestPick: null,
      worstPick: null,
    });
  });
});

describe("feeLeader", () => {
  it("names everyone tied on the most fees, by name", () => {
    const rows = [
      standing(cat, { feesCents: 300 }),
      standing(ben, { feesCents: 100 }),
      standing(ann, { feesCents: 300 }),
    ];
    expect(feeLeader(rows)).toEqual({ players: [ann, cat], cents: 300 });
  });

  it("is null when nobody paid fees or there are no players", () => {
    expect(feeLeader([standing(ann, {})])).toBeNull();
    expect(feeLeader([])).toBeNull();
  });
});

describe("pickMovers", () => {
  const book = createPriceBook(
    [
      { instrument: "AAPL", date: "2026-11-02", close: "200", currency: "USD" },
      { instrument: "AAPL", date: "2026-11-03", close: "200", currency: "USD" },
      { instrument: "SAP.DE", date: "2026-11-02", close: "100", currency: "EUR" },
      { instrument: "SAP.DE", date: "2026-11-03", close: "95", currency: "EUR" },
      { instrument: "IWDA.AS", date: "2026-11-02", close: "110", currency: "EUR" },
      // IWDA.AS has no price on 11-03: the 11-02 one carries forward (no move).
      { instrument: "NEW", date: "2026-11-03", close: "10", currency: "EUR" },
    ],
    [
      { date: "2026-11-02", currency: "USD", unitsPerEur: "1.25" },
      { date: "2026-11-03", currency: "USD", unitsPerEur: "1" },
    ],
  );

  it("measures the move in EUR and lists everyone holding the pick", () => {
    const rows = [
      standing(ben, { holdings: [holding("AAPL", 0), holding("SAP.DE", 0)] }),
      standing(ann, { holdings: [holding("SAP.DE", 0), holding("IWDA.AS", 0), holding("NEW", 0)] }),
    ];
    const { hotPick, coldPick } = pickMovers(rows, book, "2026-11-03");
    // AAPL: $200 at 1.25 = €160, then $200 at 1.00 = €200: +25% from FX alone.
    expect(hotPick?.instrument).toBe("AAPL");
    expect(hotPick?.rate).toBeCloseTo(0.25, 10);
    expect(hotPick?.holders).toEqual([ben]);
    expect(coldPick?.instrument).toBe("SAP.DE");
    expect(coldPick?.rate).toBeCloseTo(-0.05, 10);
    expect(coldPick?.holders).toEqual([ann, ben]);
  });

  it("leaves out picks with no price the day before", () => {
    const rows = [standing(ann, { holdings: [holding("NEW", 0), holding("IWDA.AS", 0)] })];
    expect(pickMovers(rows, book, "2026-11-03")).toEqual({ hotPick: null, coldPick: null });
  });
});

describe("funStats", () => {
  let db: Db & { close(): Promise<void> };

  beforeEach(async () => {
    db = await createTestDb();
    await migrate(db);
  });

  afterEach(async () => {
    await db.close();
  });

  it("shows nothing before the game starts", async () => {
    await db.query("insert into players (name) values ('Zed')");
    const stats = await funStats(db, "2026-10-20");
    expect(stats).toMatchObject({ date: "2026-10-20", started: false, days: 0 });
    expect(stats.topGainer).toBeNull();
    expect(stats.mostFees).toBeNull();
  });

  it("works with one day of data, without records", async () => {
    const [{ id: playerId }] = await db.query<{ id: number }>(
      "insert into players (name) values ('Zed') returning id",
    );
    const [{ id: instrumentId }] = await db.query<{ id: number }>(
      `insert into instruments (symbol, name, type, currency) values ('SAP.DE', 'SAP', 'stock', 'EUR')
       returning id`,
    );
    await db.query(
      `insert into transactions
         (player_id, date, type, instrument_id, shares, amount_cents, created_by, updated_by)
       values ($1, '2026-11-01', 'buy', $2, '5', 50000, 'test', 'test')`,
      [playerId, instrumentId],
    );
    await db.query(
      `insert into price_snapshots (instrument_id, date, close, currency)
       values ($1, '2026-11-01', '101', 'EUR')`,
      [instrumentId],
    );

    const stats = await funStats(db, "2026-11-02");
    expect(stats).toMatchObject({ date: "2026-11-01", started: true, days: 1 });
    // 5 × €101 = €505 against the €500 paid.
    expect(stats.topGainer).toMatchObject({ cents: 500, rate: 0.005 });
    expect(stats.bestPick).toMatchObject({ instrument: "SAP.DE", cents: 500 });
    expect(stats).toMatchObject({
      topLoser: null,
      hotPick: null,
      coldPick: null,
      bestDay: null,
      worstDay: null,
      worstPick: null,
      mostFees: null,
    });
  });

  it("matches hand-calculated stats for the seed on 2026-11-03", async () => {
    await seed(db);
    const stats = await funStats(db, "2026-11-05");
    const name = (p: { player: Player } | null) => p?.player.name;
    expect(stats).toMatchObject({ date: "2026-11-03", started: true, days: 3 });

    // Day changes on 11-03 (see valuation.test.ts): Alice +€2.18, Bob +€13.38, Carla −€6.17.
    expect([name(stats.topGainer), stats.topGainer?.cents]).toEqual(["Bob", 1338]);
    expect(stats.topGainer?.rate).toBeCloseTo(1338 / 99_792, 10);
    expect([name(stats.topLoser), stats.topLoser?.cents]).toEqual(["Carla", -617]);

    // BTC €94,850.25 → €96,120.80: +1.34%. AAPL in EUR: +0.86%. IWDA €110.12 → €109.87.
    expect(stats.hotPick?.instrument).toBe("BTC-EUR");
    expect(stats.hotPick?.rate).toBeCloseTo(96120.8 / 94850.25 - 1, 10);
    expect(stats.coldPick?.instrument).toBe("IWDA.AS");
    expect(stats.coldPick?.holders.map((p) => p.name)).toEqual(["Alice", "Carla"]);

    // 11-02: Alice −€3.59, Bob −€2.08. 11-03 as above.
    expect([name(stats.bestDay), stats.bestDay?.date, stats.bestDay?.cents]).toEqual([
      "Bob",
      "2026-11-03",
      1338,
    ]);
    expect([name(stats.worstDay), stats.worstDay?.date, stats.worstDay?.cents]).toEqual([
      "Carla",
      "2026-11-03",
      -617,
    ]);

    // Bob's BTC: €1,011.80 against €999.00. Carla's IWDA: €988.83 against €990.00.
    expect(stats.bestPick).toMatchObject({ instrument: "BTC-EUR", cents: 1280 });
    expect(name(stats.bestPick)).toBe("Bob");
    expect(stats.worstPick).toMatchObject({ instrument: "IWDA.AS", cents: -117 });
    expect(name(stats.worstPick)).toBe("Carla");

    expect(stats.mostFees?.players.map((p) => p.name)).toEqual(["Carla"]);
    expect(stats.mostFees?.cents).toBe(500);
  });
});
