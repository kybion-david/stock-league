import { describe, expect, it } from "vitest";
import { centsToInput, signedAmount } from "./format";

describe("trade formatting", () => {
  it("signs amounts by their effect on cash", () => {
    expect(signedAmount("buy", 40000)).toBe("−€400.00");
    expect(signedAmount("fee", 150)).toBe("−€1.50");
    expect(signedAmount("sell", 123456)).toBe("+€1,234.56");
    expect(signedAmount("dividend", 5)).toBe("+€0.05");
  });

  it("turns cents back into the form's amount text", () => {
    expect(centsToInput(40050)).toBe("400.50");
    expect(centsToInput(5)).toBe("0.05");
    expect(centsToInput(100000)).toBe("1000.00");
  });
});
