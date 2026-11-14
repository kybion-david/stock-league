import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Prerendered pages get cached at SWA's edge for a year and served without
// running the app, so they'd go stale (ADR 006, ADR 028).
describe("root layout", () => {
  it("forces dynamic rendering so no page is cached at the edge", () => {
    const source = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");
    expect(source).toMatch(/^export const dynamic = "force-dynamic";$/m);
  });
});
