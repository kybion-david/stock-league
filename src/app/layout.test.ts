import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Guards the fix for the gate bypass (ADR 006): prerendered pages get cached
// at SWA's edge and served without the password check.
describe("root layout", () => {
  it("forces dynamic rendering so no page is cached past the password gate", () => {
    const source = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");
    expect(source).toMatch(/^export const dynamic = "force-dynamic";$/m);
  });
});
