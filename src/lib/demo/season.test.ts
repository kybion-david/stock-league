import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/pglite";
import { migrate } from "@/lib/db/migrate";
import { validate, type LedgerTransaction } from "@/lib/ledger";
import { leaderboard } from "@/lib/leaderboard";
import { funStats } from "@/lib/stats";
import { DEMO, DEMO_TODAY } from "./config";
import { loadSeason } from "./load";
import { DEMO_PLAYERS, demoSeason } from "./season";

describe("demo season", () => {
  const season = demoSeason();

  it("is off outside a Next build", () => {
    expect(DEMO).toBe(false);
  });

  it("is the same every time, so every server instance shows the same game", () => {
    expect(demoSeason()).toEqual(season);
  });

  it("gives every player a ledger the entry form would accept", () => {
    for (const player of DEMO_PLAYERS) {
      const ledger: LedgerTransaction[] = season.transactions
        .filter((t) => t.player === player.name)
        .map((t, i) => ({
          id: String(i),
          date: t.date,
          type: t.type,
          instrumentId: t.symbol,
          shares: t.shares,
          amountCents: t.amountCents,
        }));
      expect(ledger.length, player.name).toBeGreaterThan(0);
      const [last, ...rest] = [...ledger].reverse();
      expect(validate(rest.reverse(), { kind: "create", transaction: last }), player.name).toEqual([]);
      expect(ledger.every((t) => t.date >= "2026-11-01" && t.date <= DEMO_TODAY)).toBe(true);
    }
  });

  it("has a price for every instrument on every day up to the pretend today", () => {
    const days = new Set(season.prices.map((p) => p.date));
    expect([...days].sort().at(-1)).toBe(DEMO_TODAY);
    expect(season.prices).toHaveLength(days.size * season.instruments.length);
    expect(season.fx).toHaveLength(days.size * 2);
  });

  it("loads into a migrated database and gives a started, ranked leaderboard", async () => {
    const db = await createTestDb();
    try {
      await migrate(db);
      await loadSeason(db, season);
      const board = await leaderboard(db, DEMO_TODAY);
      expect(board.started).toBe(true);
      expect(board.lastUpdated).toBe(DEMO_TODAY);
      expect(board.rows.map((r) => r.player.name).sort()).toEqual(DEMO_PLAYERS.map((p) => p.name).sort());
      expect(board.rows.every((r) => !r.stale)).toBe(true);
      expect(new Set(board.rows.map((r) => r.valueCents)).size).toBe(DEMO_PLAYERS.length);
      const stats = await funStats(db, DEMO_TODAY);
      expect(stats.started).toBe(true);
      expect(stats.mostFees?.players.map((p) => p.name)).toEqual(["Jonas"]);
    } finally {
      await db.close();
    }
    // PGlite start-up plus 90 days of valuation; slow when suites run in parallel.
  }, 30_000);
});
