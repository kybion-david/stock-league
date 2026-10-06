import { describe, expect, it, vi } from "vitest";
import {
  createMarketDataClient,
  MarketDataError,
  NoDataError,
  normalizePrice,
  RateLimitError,
  UnknownCurrencyError,
  UnknownSymbolError,
  UnsupportedInstrumentError,
} from "@/lib/market-data";

// Trimmed copies of real responses (2026-10-05).
const chart = (meta: object, timestamp: number[], close: (number | null)[]) => ({
  chart: { result: [{ meta, timestamp, indicators: { quote: [{ close }] } }], error: null },
});

const BTC_EUR = chart(
  {
    symbol: "BTC-EUR",
    currency: "EUR",
    instrumentType: "CRYPTOCURRENCY",
    fullExchangeName: "CCC",
    exchangeTimezoneName: "UTC",
    longName: "Bitcoin EUR",
    priceHint: 2,
  },
  [1759190400, 1759276800, 1759363200], // 2025-09-30, 10-01, 10-02 at 00:00 UTC
  [97197.2265625, 101124.6015625, 102929.6484375],
);

const VOD_L = chart(
  {
    symbol: "VOD.L",
    currency: "GBp",
    instrumentType: "EQUITY",
    fullExchangeName: "LSE",
    exchangeTimezoneName: "Europe/London",
    longName: "Vodafone Group Public Limited Company",
    priceHint: 2,
  },
  [1759219200, 1759305600], // 2025-09-30, 10-01 at 08:00 London
  [127.19999694824219, 128.35],
);

// AAPL candles start at 09:30 New York, i.e. 13:30 UTC.
const AAPL = chart(
  {
    symbol: "AAPL",
    currency: "USD",
    instrumentType: "EQUITY",
    fullExchangeName: "NasdaqGS",
    exchangeTimezoneName: "America/New_York",
    shortName: "Apple Inc.",
    priceHint: 2,
  },
  [1759239000, 1759325400, 1759411800], // 2025-09-30, 10-01, 10-02
  [254.6300048828125, null, 257.1300048828125],
);

const NOT_FOUND = {
  chart: {
    result: null,
    error: { code: "Not Found", description: "No data found, symbol may be delisted" },
  },
};

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });

/** A client whose fetch returns the given responses in order and records the URLs. */
function clientWith(...responses: (Response | Error)[]) {
  const urls: string[] = [];
  const sleeps: number[] = [];
  const fetch = vi.fn(async (url: string | URL | Request) => {
    urls.push(String(url));
    const next = responses.shift();
    if (!next) throw new Error("unexpected fetch");
    if (next instanceof Error) throw next;
    return next;
  });
  const client = createMarketDataClient({
    fetch: fetch as typeof globalThis.fetch,
    sleep: async (ms) => void sleeps.push(ms),
  });
  return { client, urls, sleeps };
}

describe("getClose", () => {
  it("picks the candle for the date and rounds float noise to priceHint", async () => {
    const { client, urls } = clientWith(json(BTC_EUR));
    await expect(client.getClose("BTC-EUR", "2025-10-01")).resolves.toEqual({
      symbol: "BTC-EUR",
      date: "2025-10-01",
      close: "101124.6",
      currency: "EUR",
    });
    expect(urls[0]).toContain("/v8/finance/chart/BTC-EUR?");
    expect(urls[0]).toContain("interval=1d");
  });

  it("matches dates in the exchange's time zone", async () => {
    const { client } = clientWith(json(AAPL));
    await expect(client.getClose("AAPL", "2025-10-02")).resolves.toMatchObject({
      close: "257.13",
      currency: "USD",
    });
  });

  it("converts pence to pounds", async () => {
    const { client } = clientWith(json(VOD_L));
    await expect(client.getClose("VOD.L", "2025-09-30")).resolves.toMatchObject({
      close: "1.272",
      currency: "GBP",
    });
  });

  it("throws NoDataError when there's no candle or a null close", async () => {
    const missing = clientWith(json(BTC_EUR)).client;
    await expect(missing.getClose("BTC-EUR", "2025-10-04")).rejects.toThrow(NoDataError);
    const nullClose = clientWith(json(AAPL)).client;
    await expect(nullClose.getClose("AAPL", "2025-10-01")).rejects.toThrow(NoDataError);
  });

  it("throws UnknownSymbolError on Yahoo's 404", async () => {
    const { client } = clientWith(json(NOT_FOUND, 404));
    await expect(client.getClose("NOPE", "2025-10-01")).rejects.toThrow(UnknownSymbolError);
  });

  it("rejects malformed dates without fetching", async () => {
    const { client, urls } = clientWith();
    await expect(client.getClose("AAPL", "2025-13-01")).rejects.toThrow(TypeError);
    await expect(client.getClose("AAPL", "1.10.2025")).rejects.toThrow(TypeError);
    expect(urls).toEqual([]);
  });
});

describe("normalizePrice", () => {
  it("rounds to priceHint decimals, at least 2, and trims trailing zeros", () => {
    expect(normalizePrice(254.6300048828125, "USD", 2)).toEqual({ close: "254.63", currency: "USD" });
    expect(normalizePrice(100, "EUR", 2)).toEqual({ close: "100", currency: "EUR" });
    expect(normalizePrice(0.0000123456789, "EUR", 8)).toEqual({ close: "0.00001235", currency: "EUR" });
  });

  it("shifts minor units exactly", () => {
    expect(normalizePrice(5, "GBp", 2)).toEqual({ close: "0.05", currency: "GBP" });
    expect(normalizePrice(1234.5, "GBX", 2)).toEqual({ close: "12.345", currency: "GBP" });
    expect(normalizePrice(0.1, "GBp", 2)).toEqual({ close: "0.001", currency: "GBP" });
  });
});

describe("getFxToEur", () => {
  it("returns the ECB rate and its publication date", async () => {
    const { client, urls } = clientWith(
      json([{ date: "2026-10-02", base: "EUR", quote: "USD", rate: 1.1225 }]),
    );
    await expect(client.getFxToEur("USD", "2026-10-03")).resolves.toEqual({
      currency: "USD",
      date: "2026-10-02",
      unitsPerEur: "1.1225",
    });
    expect(urls[0]).toBe(
      "https://api.frankfurter.dev/v2/rates?date=2026-10-03&base=EUR&quotes=USD&providers=ecb",
    );
  });

  it("answers EUR without fetching", async () => {
    const { client, urls } = clientWith();
    await expect(client.getFxToEur("EUR", "2026-10-03")).resolves.toEqual({
      currency: "EUR",
      date: "2026-10-03",
      unitsPerEur: "1",
    });
    expect(urls).toEqual([]);
  });

  it("throws UnknownCurrencyError for unknown or non-ISO codes", async () => {
    const { client, urls } = clientWith(
      json({ status: 422, message: "invalid currency: XYZ" }, 422),
    );
    await expect(client.getFxToEur("XYZ", "2026-10-03")).rejects.toThrow(UnknownCurrencyError);
    await expect(client.getFxToEur("GBp", "2026-10-03")).rejects.toThrow(UnknownCurrencyError);
    expect(urls).toHaveLength(1);
  });

  it("throws NoDataError when the response has no matching row", async () => {
    const { client } = clientWith(json([]));
    await expect(client.getFxToEur("USD", "1990-01-01")).rejects.toThrow(NoDataError);
  });
});

describe("lookupSymbol", () => {
  it("describes stocks, ETFs and crypto", async () => {
    const { client } = clientWith(json(VOD_L), json(BTC_EUR), json(AAPL));
    await expect(client.lookupSymbol("VOD.L")).resolves.toEqual({
      symbol: "VOD.L",
      name: "Vodafone Group Public Limited Company",
      type: "stock",
      currency: "GBp",
      exchange: "LSE",
    });
    await expect(client.lookupSymbol("BTC-EUR")).resolves.toMatchObject({ type: "crypto" });
    await expect(client.lookupSymbol("AAPL")).resolves.toMatchObject({ name: "Apple Inc." });
  });

  it("throws UnknownSymbolError for unknown symbols", async () => {
    const { client } = clientWith(json(NOT_FOUND, 404));
    await expect(client.lookupSymbol("NOPEXYZ123")).rejects.toThrow(UnknownSymbolError);
  });

  it("throws UnsupportedInstrumentError for indices, funds, currencies", async () => {
    const index = chart({ symbol: "^GSPC", currency: "USD", instrumentType: "INDEX" }, [], []);
    const { client } = clientWith(json(index));
    const err = await client.lookupSymbol("^GSPC").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UnsupportedInstrumentError);
    expect((err as Error).message).toBe('"^GSPC" is an index on Yahoo, not a stock, ETF or crypto.');
  });
});

describe("searchSymbols", () => {
  it("maps quote types and drops unsupported ones", async () => {
    const { client, urls } = clientWith(
      json({
        quotes: [
          {
            symbol: "VWCE.DE",
            quoteType: "ETF",
            shortname: "Vanguard FTSE All-World U.ETF R",
            longname: "Vanguard FTSE All-World UCITS ETF USD Accumulation",
            exchDisp: "XETRA",
          },
          { symbol: "^FTAW", quoteType: "INDEX", shortname: "FTSE All-World" },
          { symbol: "BTC-EUR", quoteType: "CRYPTOCURRENCY", shortname: "Bitcoin EUR" },
        ],
      }),
    );
    await expect(client.searchSymbols("vanguard all-world")).resolves.toEqual([
      {
        symbol: "VWCE.DE",
        name: "Vanguard FTSE All-World UCITS ETF USD Accumulation",
        type: "etf",
        exchange: "XETRA",
      },
      { symbol: "BTC-EUR", name: "Bitcoin EUR", type: "crypto", exchange: null },
    ]);
    expect(urls[0]).toContain("q=vanguard%20all-world");
  });
});

describe("retries", () => {
  it("retries 429 and 5xx with exponential backoff, then succeeds", async () => {
    const { client, sleeps } = clientWith(
      json({}, 429),
      json({}, 503),
      new TypeError("fetch failed"),
      json(BTC_EUR),
    );
    await expect(client.getClose("BTC-EUR", "2025-10-01")).resolves.toMatchObject({
      close: "101124.6",
    });
    expect(sleeps).toEqual([1_000, 2_000, 4_000]);
  });

  it("honours Retry-After", async () => {
    const { client, sleeps } = clientWith(json({}, 429, { "Retry-After": "7" }), json(BTC_EUR));
    await client.getClose("BTC-EUR", "2025-10-01");
    expect(sleeps).toEqual([7_000]);
  });

  it("throws RateLimitError when every attempt is rate-limited", async () => {
    const { client, urls } = clientWith(...Array.from({ length: 4 }, () => json({}, 429)));
    await expect(client.getClose("BTC-EUR", "2025-10-01")).rejects.toThrow(RateLimitError);
    expect(urls).toHaveLength(4);
  });

  it("throws a MarketDataError after repeated network failures", async () => {
    const { client } = clientWith(...Array.from({ length: 4 }, () => new TypeError("fetch failed")));
    const error = await client.getClose("BTC-EUR", "2025-10-01").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MarketDataError);
    expect(error).not.toBeInstanceOf(RateLimitError);
  });

  it("doesn't retry other 4xx", async () => {
    const { client, urls } = clientWith(json({}, 403));
    await expect(client.getClose("BTC-EUR", "2025-10-01")).rejects.toThrow(MarketDataError);
    expect(urls).toHaveLength(1);
  });
});
