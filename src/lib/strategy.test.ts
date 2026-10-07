import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/db";
import { InputError } from "@/lib/db/errors";
import { migrate } from "@/lib/db/migrate";
import { createTestDb } from "@/lib/db/pglite";
import { createPlayer } from "./players";
import {
  cleanStrategy,
  getStrategy,
  listStrategies,
  MAX_STRATEGY_LENGTH,
  updateStrategy,
} from "./strategy";

let db: Db & { close(): Promise<void> };

beforeEach(async () => {
  db = await createTestDb();
  await migrate(db);
});

afterEach(async () => {
  await db.close();
});

describe("cleanStrategy", () => {
  it("trims, keeps line breaks and turns form line endings into \\n", () => {
    expect(cleanStrategy("  All in on ETFs.\r\n\r\nMaybe some BTC.  ")).toBe(
      "All in on ETFs.\n\nMaybe some BTC.",
    );
  });

  it("treats blank as no strategy", () => {
    expect(cleanStrategy("  \r\n ")).toBeNull();
  });

  it("allows the limit, counting \\r\\n as one character, and rejects more", () => {
    // 1,500 characters as sent by a form, 999 once stored (trailing break trimmed).
    expect(cleanStrategy("x\r\n".repeat(MAX_STRATEGY_LENGTH / 2))).toHaveLength(
      MAX_STRATEGY_LENGTH - 1,
    );
    expect(cleanStrategy("x".repeat(MAX_STRATEGY_LENGTH))).toHaveLength(MAX_STRATEGY_LENGTH);
    expect(() => cleanStrategy("x".repeat(MAX_STRATEGY_LENGTH + 1))).toThrow(
      "Keep it under 1,000 characters (it's 1,001).",
    );
  });
});

describe("strategies", () => {
  it("starts empty for every player", async () => {
    const p = await createPlayer(db, { name: "Adam", emoji: "🦊" });
    expect(await getStrategy(db, p.id)).toEqual({
      playerId: p.id,
      name: "Adam",
      emoji: "🦊",
      text: null,
      updatedAt: null,
    });
    expect(await getStrategy(db, 999)).toBeNull();
  });

  it("saves, keeps the date when unchanged, and clears", async () => {
    const p = await createPlayer(db, { name: "Adam", emoji: "" });
    const saved = await updateStrategy(db, p.id, " Buy the dip. ");
    expect(saved.text).toBe("Buy the dip.");
    expect(saved.updatedAt).toBeInstanceOf(Date);

    await db.query("update players set strategy_updated_at = '2026-11-02T10:00:00Z'");
    const same = await updateStrategy(db, p.id, "Buy the dip.");
    expect(same.updatedAt?.toISOString()).toBe("2026-11-02T10:00:00.000Z");

    const changed = await updateStrategy(db, p.id, "Sell the rip.");
    expect(changed.updatedAt?.toISOString()).not.toBe("2026-11-02T10:00:00.000Z");

    const cleared = await updateStrategy(db, p.id, "   ");
    expect(cleared).toMatchObject({ text: null, updatedAt: null });
  });

  it("rejects an unknown player and too long a text", async () => {
    await expect(updateStrategy(db, 999, "Hi")).rejects.toThrow("That player doesn't exist.");
    const p = await createPlayer(db, { name: "Adam", emoji: "" });
    await expect(updateStrategy(db, p.id, "x".repeat(1001))).rejects.toThrow(InputError);
    expect((await getStrategy(db, p.id))?.text).toBeNull();
  });

  it("lists written strategies newest first, then the rest by name", async () => {
    const zoe = await createPlayer(db, { name: "Zoe", emoji: "" });
    const bea = await createPlayer(db, { name: "Bea", emoji: "" });
    const cas = await createPlayer(db, { name: "Cas", emoji: "" });
    await createPlayer(db, { name: "Abe", emoji: "" });
    await updateStrategy(db, zoe.id, "Crypto only.");
    await updateStrategy(db, cas.id, "Dividends.");
    await updateStrategy(db, bea.id, "World ETF.");
    await db.query(
      `update players set strategy_updated_at = case name
         when 'Zoe' then timestamptz '2026-11-01T09:00:00Z'
         when 'Cas' then timestamptz '2026-11-03T09:00:00Z'
         when 'Bea' then timestamptz '2026-11-02T09:00:00Z'
       end where strategy is not null`,
    );
    expect((await listStrategies(db)).map((s) => s.name)).toEqual(["Cas", "Bea", "Zoe", "Abe"]);
  });
});
