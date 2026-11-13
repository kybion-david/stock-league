import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/db";
import { migrate } from "@/lib/db/migrate";
import { createTestDb } from "@/lib/db/pglite";
import { seed } from "@/lib/db/seed";
import type { LedgerTransaction } from "@/lib/ledger";
import {
  buildNews,
  list,
  loadNews,
  ordinal,
  places,
  recapLines,
  type DayNews,
  type PlayerWeek,
  type WeekRecap,
} from "@/lib/news";
import type { Player } from "@/lib/players";
import { createPriceBook, type GameData, type PriceRow } from "@/lib/valuation";

const ann: Player = { id: 1, name: "Ann", emoji: "🦊" };
const ben: Player = { id: 2, name: "Ben", emoji: null };
const cat: Player = { id: 3, name: "Cat", emoji: "🐙" };
const dan: Player = { id: 4, name: "Dan", emoji: "🐻" };

const buy = (date: string, symbol: string, shares: string, cents: number, id = date + symbol) =>
  ({ id, date, type: "buy", instrumentId: symbol, shares, amountCents: cents }) satisfies LedgerTransaction;

const price = (instrument: string, date: string, close: string): PriceRow => ({
  instrument,
  date,
  close,
  currency: "EUR",
});

describe("places", () => {
  it("ranks highest first and shares tied places", () => {
    const result = places(new Map([[1, 500], [2, 900], [3, 500], [4, 100]]));
    expect([...result.entries()].sort()).toEqual([[1, 2], [2, 1], [3, 2], [4, 4]]);
  });
});

describe("ordinal and list", () => {
  it("formats places", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st",
    ]);
  });
  it("joins names", () => {
    expect(list([])).toBe("");
    expect(list(["A"])).toBe("A");
    expect(list(["A", "B"])).toBe("A and B");
    expect(list(["A", "B", "C"])).toBe("A, B and C");
  });
});

describe("buildNews", () => {
  // Ann buys ACME on Mon 2 Nov; it jumps 10% on Tue and the day after is
  // quiet. Ben never trades. Friday 6 Nov brings the first recap.
  const game: GameData = {
    players: [ann, ben],
    ledgers: new Map([
      [1, [buy("2026-11-02", "ACME", "10", 50_000)]],
      [2, []],
    ]),
    book: createPriceBook(
      [
        price("ACME", "2026-11-02", "50"),
        price("ACME", "2026-11-03", "55"),
        price("ACME", "2026-11-04", "55"),
        price("ACME", "2026-11-05", "55"),
        price("ACME", "2026-11-06", "54"),
      ],
      [],
    ),
  };
  const items = buildNews(game, "2026-11-06", new Map([["ACME", "Acme Corp"]]));
  const days = items.filter((i): i is DayNews => i.kind === "day");

  it("lists days with a movement or a trade, newest first", () => {
    expect(items.map((i) => (i.kind === "day" ? i.date : `recap ${i.to}`))).toEqual([
      "recap 2026-11-06",
      "2026-11-06",
      "2026-11-03",
      "2026-11-02",
    ]);
  });

  it("shows trades, big moves and places per player", () => {
    const tuesday = days.find((d) => d.date === "2026-11-03")!;
    expect(tuesday.players.map((p) => p.player.name)).toEqual(["Ann", "Ben"]);
    const annNews = tuesday.players[0];
    expect(annNews.dayChangeCents).toBe(5_000);
    expect(annNews.moves).toEqual([{ instrument: "Acme Corp", rate: expect.closeTo(0.1, 6) }]);
    expect(annNews.place).toBe(1);
    // Everyone was level on Monday, so nobody "moved" places yet.
    expect(annNews.placeChange).toBeNull();
    expect(tuesday.players[1].placeChange).toBeNull();
    expect(days[0].players[0].placeChange).toBe(0);
    expect(tuesday.market).toBeNull();

    const monday = days.find((d) => d.date === "2026-11-02")!;
    expect(monday.players[0].trades).toEqual([
      { type: "buy", instrument: "Acme Corp", amountCents: 50_000 },
    ]);
    // A 1.8% drop isn't a big move.
    expect(days[0].players.find((p) => p.player.id === 1)!.moves).toEqual([]);
  });

  it("writes a recap for the first week from kick-off to Friday", () => {
    const recap = items[0] as WeekRecap;
    expect(recap).toMatchObject({ from: "2026-11-01", to: "2026-11-06", week: 1 });
    expect(recap.lines[0]).toContain("🦊 Ann");
    expect(recap.lines.join(" ")).toContain("🙂 Ben is still sitting on cash");
    expect(recap.lines.join(" ")).toContain("Hottest pick: Acme Corp, +8.00%");
  });

  it("is empty before kick-off", () => {
    expect(buildNews(game, "2026-10-31")).toEqual([]);
  });
});

describe("recapLines", () => {
  const week = (p: Player, start: number, end: number, extra: Partial<PlayerWeek> = {}): PlayerWeek => ({
    player: p,
    startCents: start,
    endCents: end,
    startPlace: 1,
    endPlace: 1,
    trades: 1,
    feesCents: 0,
    invested: true,
    ...extra,
  });

  it("covers the leader, best and worst week, market, spoon, places and picks", () => {
    const lines = recapLines({
      week: 2,
      players: [
        week(ann, 100_000, 110_000, { startPlace: 3, endPlace: 1 }),
        week(ben, 105_000, 104_000, { startPlace: 1, endPlace: 2, trades: 0 }),
        week(cat, 102_000, 101_000, { startPlace: 2, endPlace: 3, trades: 5, feesCents: 600 }),
        week(dan, 99_000, 95_000, { startPlace: 4, endPlace: 4 }),
      ],
      marketRate: 0.01,
      picks: [
        { instrument: "Acme", rate: 0.2, holders: [ann] },
        { instrument: "Bust", rate: -0.3, holders: [cat, dan] },
      ],
    });
    expect(lines).toEqual([
      "🦊 Ann snatched 1st place from 🙂 Ben and sits on €1,100.00 (+10.00%). Savour it.",
      expect.stringContaining("🦊 Ann"),
      expect.stringContaining("🐻 Dan"),
      "The 🌍 market did +1.00%. 🙂 Ben, 🐙 Cat and 🐻 Dan were beaten by a fund that doesn't even try.",
      "🐻 Dan holds the wooden spoon 🥄, €150.00 behind the top.",
      "🦊 Ann climbed 2 places to 1st.",
      "Hottest pick: Acme, +20.00%. Well played, Ann.",
      "Coldest pick: Bust, −30.00%. Sorry, Cat and Dan.",
      "🐙 Cat made 5 trades. Somewhere a broker is buying a boat.",
      "🙂 Ben didn't touch a thing. Diamond hands, or a forgotten password?",
      "🐙 Cat paid €6.00 in fees. The broker says thanks.",
    ]);
  });

  it("says so when everyone is level", () => {
    const lines = recapLines({
      week: 1,
      players: [week(ann, 100_000, 100_000), week(ben, 100_000, 100_000)],
      marketRate: null,
      picks: [],
    });
    expect(lines[0]).toMatch(/level|equals/);
  });

  it("is the same text every time for the same week", () => {
    const facts = {
      week: 3,
      players: [week(ann, 100_000, 101_000), week(ben, 100_000, 99_000)],
      marketRate: -0.02,
      picks: [],
    };
    expect(recapLines(facts)).toEqual(recapLines(facts));
    expect(recapLines(facts)).toContain(
      "The 🌍 market did −2.00%. Everyone beat it. Enjoy it, that won't happen often.",
    );
  });
});

describe("loadNews", () => {
  let db: Db & { close(): Promise<void> };
  beforeEach(async () => {
    db = await createTestDb();
    await migrate(db);
  });
  afterEach(() => db.close());

  it("is empty before kick-off", async () => {
    expect(await loadNews(db, "2026-10-20")).toMatchObject({ started: false, items: [] });
  });

  it("builds the feed up to the latest prices", async () => {
    await seed(db);
    const news = await loadNews(db, "2026-11-13");
    expect(news.date).toBe("2026-11-03");
    const dates = news.items.map((i) => (i.kind === "day" ? i.date : i.to));
    expect(dates).toEqual(["2026-11-03", "2026-11-02"]);
    const monday = news.items[1] as DayNews;
    expect(monday.players.find((p) => p.player.name === "Alice")!.trades).toContainEqual({
      type: "buy",
      instrument: "Apple Inc.",
      amountCents: 40_000,
    });
  });
});
