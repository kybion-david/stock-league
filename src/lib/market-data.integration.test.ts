// Live calls to Yahoo and Frankfurter. Skipped unless MARKET_DATA_LIVE=1
// (`npm run test:live`); the `market-data-live` workflow runs it on a GitHub
// Actions runner to check that Yahoo doesn't block datacenter IPs.
import { describe, expect, it } from "vitest";
import { BENCHMARK_SYMBOLS } from "@/lib/benchmark";
import {
  createMarketDataClient,
  NoDataError,
  UnknownCurrencyError,
  UnknownSymbolError,
} from "@/lib/market-data";

// A past Wednesday: every market was open and the prices are final.
const DAY = "2026-09-30";
const client = createMarketDataClient();

describe.skipIf(!process.env.MARKET_DATA_LIVE)("market data (live)", { timeout: 60_000 }, () => {
  it.each([
    ["AAPL", "USD"],
    ["SAP.DE", "EUR"],
    ["VWCE.DE", "EUR"],
    ["IWDA.AS", "EUR"],
    ["VOD.L", "GBP"],
    ["BTC-EUR", "EUR"],
  ])("gets the close of %s", async (symbol, currency) => {
    const close = await client.getClose(symbol, DAY);
    expect(close).toMatchObject({ symbol, date: DAY, currency });
    expect(Number(close.close)).toBeGreaterThan(0);
  });

  // The market benchmark (ADR 025): EUR ETFs with a close on kick-off's Friday.
  it.each(BENCHMARK_SYMBOLS)("gets the benchmark's %s in EUR on 2026-10-30", async (symbol) => {
    const close = await client.getClose(symbol, "2026-10-30");
    expect(close).toMatchObject({ symbol, currency: "EUR" });
    expect(Number(close.close)).toBeGreaterThan(0);
    await expect(client.lookupSymbol(symbol)).resolves.toMatchObject({ type: "etf", currency: "EUR" });
  });

  it("has no close on a weekend for a stock", async () => {
    await expect(client.getClose("AAPL", "2026-10-03")).rejects.toThrow(NoDataError);
  });

  it("gets ECB rates, falling back to the last publication day", async () => {
    const usd = await client.getFxToEur("USD", DAY);
    expect(usd.date).toBe(DAY);
    expect(Number(usd.unitsPerEur)).toBeGreaterThan(0.5);
    expect(Number(usd.unitsPerEur)).toBeLessThan(2);
    expect((await client.getFxToEur("GBP", "2026-10-03")).date).toBe("2026-10-02");
    await expect(client.getFxToEur("XYZ", DAY)).rejects.toThrow(UnknownCurrencyError);
  });

  it("looks up and searches symbols", async () => {
    await expect(client.lookupSymbol("VWCE.DE")).resolves.toMatchObject({
      type: "etf",
      currency: "EUR",
    });
    await expect(client.lookupSymbol("BTC-EUR")).resolves.toMatchObject({ type: "crypto" });
    await expect(client.lookupSymbol("NOPEXYZ123")).rejects.toThrow(UnknownSymbolError);
    const results = await client.searchSymbols("Apple");
    expect(results.map((r) => r.symbol)).toContain("AAPL");
  });
});
