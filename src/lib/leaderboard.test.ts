import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/db";
import { migrate } from "@/lib/db/migrate";
import { createTestDb } from "@/lib/db/pglite";
import { seed } from "@/lib/db/seed";
import {
  daysBetween,
  formatDay,
  leaderboard,
  leaderboardDate,
  priceNote,
  rankStandings,
} from "@/lib/leaderboard";
import type { HoldingValuation, PlayerStanding } from "@/lib/valuation";

function standing(name: string, valueCents: number): PlayerStanding {
  return {
    player: { id: valueCents, name, emoji: null },
    date: "2026-11-03",
    cashCents: valueCents,
    holdingsValueCents: 0,
    valueCents,
    returnCents: valueCents - 100_000,
    returnRate: (valueCents - 100_000) / 100_000,
    feesCents: 0,
    dividendsCents: 0,
    holdings: [],
    closedPositions: [],
    stale: false,
    dayChangeCents: 0,
    dayChangeRate: 0,
  };
}

const places = (rows: ReturnType<typeof rankStandings>) =>
  rows.map((r) => [r.player.name, r.place, r.award]);

describe("rankStandings", () => {
  it("gives medals to the top three and the wooden spoon to last place", () => {
    const rows = [110, 105, 101, 99, 95].map((v, i) => standing("ABCDE"[i], v * 1000));
    expect(places(rankStandings(rows, true))).toEqual([
      ["A", 1, "gold"],
      ["B", 2, "silver"],
      ["C", 3, "bronze"],
      ["D", 4, null],
      ["E", 5, "spoon"],
    ]);
  });

  it("shares a place between equal values and skips the next one", () => {
    const rows = [110, 110, 101, 101].map((v, i) => standing("ABCD"[i], v * 1000));
    expect(places(rankStandings(rows, true))).toEqual([
      ["A", 1, "gold"],
      ["B", 1, "gold"],
      ["C", 3, "bronze"],
      ["D", 3, "bronze"],
    ]);
  });

  it("gives no spoon to a last place in the top three", () => {
    const rows = [110, 105, 101].map((v, i) => standing("ABC"[i], v * 1000));
    expect(places(rankStandings(rows, true)).map((r) => r[2])).toEqual([
      "gold",
      "silver",
      "bronze",
    ]);
  });

  it("gives no awards while everyone is level or before the game starts", () => {
    const level = ["A", "B", "C", "D"].map((n) => standing(n, 100_000));
    expect(places(rankStandings(level, true))).toEqual([
      ["A", 1, null],
      ["B", 1, null],
      ["C", 1, null],
      ["D", 1, null],
    ]);
    const apart = [110, 105].map((v, i) => standing("AB"[i], v * 1000));
    expect(rankStandings(apart, false).map((r) => r.award)).toEqual([null, null]);
  });

  it("handles no players", () => {
    expect(rankStandings([], true)).toEqual([]);
  });
});

describe("leaderboardDate", () => {
  it("is the latest day with prices, or today before there are any", () => {
    expect(leaderboardDate("2026-11-03", "2026-11-04")).toBe("2026-11-03");
    expect(leaderboardDate(null, "2026-10-05")).toBe("2026-10-05");
  });
});

describe("priceNote", () => {
  const holding = (
    priceStatus: HoldingValuation["priceStatus"],
    priceDate: string | null,
    fxDate: string | null = null,
  ): HoldingValuation => ({
    instrument: "X",
    shares: "1",
    costCents: 100,
    valueCents: 100,
    gainCents: 0,
    gainRate: 0,
    realizedCents: 0,
    priceStatus,
    priceDate,
    fxDate,
  });

  it("is null when every price is from the day", () => {
    expect(priceNote([])).toBeNull();
    expect(priceNote([holding("current", "2026-11-03", "2026-11-03")])).toBeNull();
  });

  it("names the oldest price or FX day used", () => {
    expect(
      priceNote([
        holding("current", "2026-11-04"),
        holding("stale", "2026-11-04", "2026-11-02"),
        holding("stale", "2026-11-03"),
      ]),
    ).toBe("Uses prices from Mon 2 Nov.");
  });

  it("says when a holding has no price yet", () => {
    expect(priceNote([holding("stale", "2026-11-02"), holding("missing", null)])).toBe(
      "A new buy has no price yet, so it counts at cost.",
    );
  });
});

describe("formatDay and daysBetween", () => {
  it("formats a day for people", () => {
    expect(formatDay("2026-11-01")).toBe("Sun 1 Nov");
  });

  it("counts whole days, across the clock change", () => {
    expect(daysBetween("2026-10-05", "2026-11-01")).toBe(27);
    expect(daysBetween("2026-11-01", "2026-11-01")).toBe(0);
    expect(daysBetween("2026-11-02", "2026-11-01")).toBe(-1);
  });
});

describe("leaderboard", () => {
  let db: Db & { close(): Promise<void> };

  beforeEach(async () => {
    db = await createTestDb();
    await migrate(db);
  });

  afterEach(async () => {
    await db.close();
  });

  it("shows the line-up at €1,000 before the game and before any prices", async () => {
    await db.query("insert into players (name) values ('Zed'), ('Amy')");
    const board = await leaderboard(db, "2026-10-05");
    expect(board).toMatchObject({ date: "2026-10-05", lastUpdated: null, started: false });
    expect(board.rows.map((r) => [r.player.name, r.valueCents, r.place, r.award])).toEqual([
      ["Amy", 100_000, 1, null],
      ["Zed", 100_000, 1, null],
    ]);
  });

  it("ranks the seeded players on the latest day with prices", async () => {
    await seed(db);
    const board = await leaderboard(db, "2026-11-05");
    expect(board).toMatchObject({ date: "2026-11-03", lastUpdated: "2026-11-03", started: true });
    expect(board.rows.map((r) => [r.player.name, r.place, r.award])).toEqual([
      ["Bob", 1, "gold"],
      ["Alice", 2, "silver"],
      ["Carla", 3, "bronze"],
    ]);
  });
});
