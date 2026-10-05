import { describe, expect, it } from "vitest";
import { formatEuroCents } from "@/lib/money";

describe("formatEuroCents", () => {
  it("formats cents as euros with thousands separators", () => {
    expect(formatEuroCents(123456)).toBe("€1,234.56");
    expect(formatEuroCents(100000)).toBe("€1,000.00");
    expect(formatEuroCents(5)).toBe("€0.05");
  });

  it("formats negative amounts", () => {
    expect(formatEuroCents(-5000)).toBe("-€50.00");
  });

  it("rejects non-integer cents", () => {
    expect(() => formatEuroCents(1.5)).toThrow(TypeError);
  });
});
