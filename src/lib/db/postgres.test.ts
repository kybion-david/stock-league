import { describe, expect, it } from "vitest";
import { withoutUnsupportedParams } from "./postgres";

describe("withoutUnsupportedParams", () => {
  it("drops channel_binding from a Neon URL and keeps sslmode", () => {
    expect(
      withoutUnsupportedParams(
        "postgresql://u:p@ep-x-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
      ),
    ).toBe("postgresql://u:p@ep-x-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require");
  });

  it("leaves other URLs untouched", () => {
    const url = "postgres://u:p@localhost:5432/dev";
    expect(withoutUnsupportedParams(url)).toBe(url);
  });
});
