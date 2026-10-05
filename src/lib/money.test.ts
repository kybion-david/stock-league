import { describe, expect, it } from "vitest";
import { formatEuroCents, formatSignedEuroCents, formatSignedPercent } from "@/lib/money";

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

describe("formatSignedEuroCents", () => {
  it("puts a plus or a minus sign in front", () => {
    expect(formatSignedEuroCents(1234)).toBe("+€12.34");
    expect(formatSignedEuroCents(-50)).toBe("−€0.50");
    expect(formatSignedEuroCents(-123456)).toBe("−€1,234.56");
  });

  it("has no sign for zero", () => {
    expect(formatSignedEuroCents(0)).toBe("€0.00");
  });
});

describe("formatSignedPercent", () => {
  it("formats a rate as a signed percentage with two decimals", () => {
    expect(formatSignedPercent(0.0523)).toBe("+5.23%");
    expect(formatSignedPercent(-0.01171)).toBe("−1.17%");
    expect(formatSignedPercent(1.5)).toBe("+150.00%");
  });

  it("has no sign when it rounds to zero", () => {
    expect(formatSignedPercent(0)).toBe("0.00%");
    expect(formatSignedPercent(-0.00001)).toBe("0.00%");
  });
});
