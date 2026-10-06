import { describe, expect, it } from "vitest";
import { EMOJI_GROUPS } from "./emoji";
import { cleanPlayerInput } from "./players";

const all = EMOJI_GROUPS.flatMap((g) => g.emojis);

describe("EMOJI_GROUPS", () => {
  it("has no duplicates", () => {
    expect(new Set(all).size).toBe(all.length);
  });

  it("holds exactly one emoji per entry", () => {
    const segmenter = new Intl.Segmenter();
    for (const emoji of all) {
      expect([...segmenter.segment(emoji)], emoji).toHaveLength(1);
      expect(emoji, emoji).toMatch(/^\p{Extended_Pictographic}/u);
    }
  });

  it("only offers emojis the player form accepts unchanged", () => {
    for (const emoji of all) {
      expect(cleanPlayerInput({ name: "Zoe", emoji }).emoji).toBe(emoji);
    }
  });
});
