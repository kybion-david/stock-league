import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/db";
import { InputError, parseId } from "@/lib/db/errors";
import { migrate } from "@/lib/db/migrate";
import { createTestDb } from "@/lib/db/pglite";
import { createPlayer, getPlayer, listPlayers, updatePlayer } from "./players";

let db: Db & { close(): Promise<void> };

beforeEach(async () => {
  db = await createTestDb();
  await migrate(db);
});

afterEach(async () => {
  await db.close();
});

describe("players", () => {
  it("creates players with trimmed names and lists them by name", async () => {
    await createPlayer(db, { name: "  Zoe ", emoji: " 🦄 " });
    await createPlayer(db, { name: "Adam", emoji: "" });
    expect(await listPlayers(db)).toEqual([
      { id: 2, name: "Adam", emoji: null },
      { id: 1, name: "Zoe", emoji: "🦄" },
    ]);
  });

  it("rejects blank and duplicate names", async () => {
    await expect(createPlayer(db, { name: "   ", emoji: "" })).rejects.toThrow(InputError);
    await createPlayer(db, { name: "Adam", emoji: "" });
    await expect(createPlayer(db, { name: "Adam ", emoji: "" })).rejects.toThrow(
      "There's already a player called Adam.",
    );
  });

  it("renames a player and changes the emoji", async () => {
    const { id } = await createPlayer(db, { name: "Adam", emoji: "🐻" });
    await updatePlayer(db, id, { name: "Adam B.", emoji: "" });
    expect(await getPlayer(db, id)).toEqual({ id, name: "Adam B.", emoji: null });
  });

  it("rejects renaming to another player's name, and unknown ids", async () => {
    await createPlayer(db, { name: "Adam", emoji: "" });
    const { id } = await createPlayer(db, { name: "Bea", emoji: "" });
    await expect(updatePlayer(db, id, { name: "Adam", emoji: "" })).rejects.toThrow(InputError);
    await expect(updatePlayer(db, 999, { name: "X", emoji: "" })).rejects.toThrow(InputError);
    expect(await getPlayer(db, 999)).toBeNull();
  });
});

describe("parseId", () => {
  it("accepts positive integers only", () => {
    expect(parseId("42")).toBe(42);
    for (const bad of ["0", "-1", "1.5", "abc", "", "01", "99999999999", undefined]) {
      expect(parseId(bad), String(bad)).toBeNull();
    }
  });
});
