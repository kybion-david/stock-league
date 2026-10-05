// Market data client (ticket 010, ADR 003): Yahoo Finance chart API for
// prices and symbols, Frankfurter (ECB reference rates) for FX to EUR.
// Both are keyless. Callers depend on the `MarketDataClient` interface so the
// provider can be swapped (ADR 003 → Consequences).

export type InstrumentType = "stock" | "etf" | "crypto";

/** An instrument as the provider describes it; fits the `instruments` table. */
export interface InstrumentInfo {
  /** Yahoo symbol, e.g. `AAPL`, `SAP.DE`, `BTC-EUR`. */
  symbol: string;
  name: string;
  type: InstrumentType;
  /** As Yahoo reports it, so London listings say `GBp` (pence). */
  currency: string;
  exchange: string | null;
}

/** A daily close; fits the `price_snapshots` table. */
export interface Close {
  symbol: string;
  /** The candle's date in the exchange's time zone, `YYYY-MM-DD`. */
  date: string;
  /** Exact decimal string in major units of `currency` (pence are converted to pounds). */
  close: string;
  /** ISO 4217 code, e.g. `USD`, `EUR`, `GBP`. */
  currency: string;
}

/** An ECB reference rate; fits the `fx_snapshots` table. */
export interface FxRate {
  currency: string;
  /** The date the ECB published the rate. Earlier than asked on weekends and holidays. */
  date: string;
  /** 1 EUR = `unitsPerEur` units of `currency`, as an exact decimal string. */
  unitsPerEur: string;
}

export interface MarketDataClient {
  /** Close of `symbol` on game day `date`. Throws NoDataError if it didn't trade that day. */
  getClose(symbol: string, date: string): Promise<Close>;
  /** ECB rate for `currency` (ISO 4217) on `date`, or the last one published before it. */
  getFxToEur(currency: string, date: string): Promise<FxRate>;
  /** Exact symbol check. Throws UnknownSymbolError or UnsupportedInstrumentError. */
  lookupSymbol(symbol: string): Promise<InstrumentInfo>;
  /** Free-text search (name, ticker, ISIN). Only stocks, ETFs and crypto are returned. */
  searchSymbols(query: string): Promise<Omit<InstrumentInfo, "currency">[]>;
}

export class MarketDataError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** The provider doesn't know this symbol. */
export class UnknownSymbolError extends MarketDataError {}

/** The symbol exists but isn't a stock, ETF or crypto (SPEC → Game rules). */
export class UnsupportedInstrumentError extends MarketDataError {}

/** The symbol exists but has no price for that date (weekend, holiday, not listed yet). */
export class NoDataError extends MarketDataError {}

/** The ECB doesn't publish a rate for this currency. */
export class UnknownCurrencyError extends MarketDataError {}

/** Still rate-limited (HTTP 429) after every retry. */
export class RateLimitError extends MarketDataError {}

export interface MarketDataOptions {
  fetch?: typeof fetch;
  /** Waits between retries. Tests pass a no-op. */
  sleep?: (ms: number) => Promise<void>;
  /** Retries after the first attempt, for 429, 5xx, timeouts and network errors. */
  retries?: number;
  /** First backoff delay; doubles on each retry. */
  baseDelayMs?: number;
  timeoutMs?: number;
}

const YAHOO = "https://query1.finance.yahoo.com";
const FRANKFURTER = "https://api.frankfurter.dev/v2";
// Yahoo rate-limits Node's default User-Agent much sooner than a browser's.
const HEADERS = { "User-Agent": "Mozilla/5.0 (stock-league)", Accept: "application/json" };
const DAY_SECONDS = 86_400;
const MAX_RETRY_AFTER_MS = 60_000;

const YAHOO_TYPES: Record<string, InstrumentType> = {
  EQUITY: "stock",
  ETF: "etf",
  CRYPTOCURRENCY: "crypto",
};

/** Yahoo quotes some listings in minor units. Converted to the major unit for prices. */
const MINOR_UNITS: Record<string, string> = { GBp: "GBP", GBX: "GBP", ZAc: "ZAR", ILA: "ILS" };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function createMarketDataClient(options: MarketDataOptions = {}): MarketDataClient {
  const {
    fetch: fetchFn = globalThis.fetch,
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    retries = 3,
    baseDelayMs = 1_000,
    timeoutMs = 15_000,
  } = options;

  /** Fetches JSON, retrying transient failures. Other non-2xx responses are returned to the caller. */
  async function request(url: string): Promise<{ status: number; body: unknown }> {
    const host = new URL(url).host;
    for (let attempt = 0; ; attempt++) {
      let res: Response | undefined;
      let failure: unknown;
      try {
        res = await fetchFn(url, { headers: HEADERS, signal: AbortSignal.timeout(timeoutMs) });
      } catch (err) {
        failure = err;
      }
      const retryable = !res || res.status === 429 || res.status >= 500;
      if (!retryable) {
        return { status: res!.status, body: await res!.json().catch(() => null) };
      }
      if (attempt >= retries) {
        if (res?.status === 429) {
          throw new RateLimitError(`${host} is still rate-limiting after ${retries} retries`);
        }
        const why = res ? `HTTP ${res.status}` : String(failure);
        throw new MarketDataError(`${host} failed after ${retries} retries: ${why}`, {
          cause: failure,
        });
      }
      const retryAfter = Number(res?.headers.get("Retry-After"));
      const delay =
        retryAfter > 0
          ? Math.min(retryAfter * 1_000, MAX_RETRY_AFTER_MS)
          : baseDelayMs * 2 ** attempt;
      await sleep(delay);
    }
  }

  async function chart(symbol: string, query: string): Promise<YahooChartResult> {
    const url = `${YAHOO}/v8/finance/chart/${encodeURIComponent(symbol)}?${query}&interval=1d`;
    const { status, body } = await request(url);
    const result = (body as YahooChartResponse | null)?.chart?.result?.[0];
    if (status === 404 || (status === 200 && !result)) {
      throw new UnknownSymbolError(`Unknown symbol "${symbol}"`);
    }
    if (status !== 200 || !result?.meta) {
      throw new MarketDataError(`Yahoo chart for "${symbol}": HTTP ${status}`);
    }
    return result;
  }

  return {
    async getClose(symbol, date) {
      assertDate(date);
      const start = Date.parse(`${date}T00:00:00Z`) / 1_000 - DAY_SECONDS;
      const result = await chart(symbol, `period1=${start}&period2=${start + 3 * DAY_SECONDS}`);
      const { meta } = result;
      const timestamps = result.timestamp ?? [];
      const index = timestamps.findIndex(
        (t) => localDate(t, meta.exchangeTimezoneName ?? "UTC") === date,
      );
      const close = index < 0 ? null : result.indicators?.quote?.[0]?.close?.[index];
      if (close == null) {
        throw new NoDataError(`No close for "${symbol}" on ${date}`);
      }
      return { symbol, date, ...normalizePrice(close, meta.currency, meta.priceHint) };
    },

    async getFxToEur(currency, date) {
      assertDate(date);
      if (currency === "EUR") return { currency, date, unitsPerEur: "1" };
      if (!/^[A-Z]{3}$/.test(currency)) {
        throw new UnknownCurrencyError(`Not an ISO 4217 currency code: "${currency}"`);
      }
      const url = `${FRANKFURTER}/rates?date=${date}&base=EUR&quotes=${currency}&providers=ecb`;
      const { status, body } = await request(url);
      if (status === 404 || status === 422) {
        throw new UnknownCurrencyError(`No ECB rate for "${currency}"`);
      }
      if (status !== 200) {
        throw new MarketDataError(`Frankfurter ${currency} on ${date}: HTTP ${status}`);
      }
      const row = (body as FrankfurterRate[] | null)?.find((r) => r.quote === currency);
      if (!row) throw new NoDataError(`No ECB rate for "${currency}" on ${date}`);
      return { currency, date: row.date, unitsPerEur: String(row.rate) };
    },

    async lookupSymbol(symbol) {
      const { meta } = await chart(symbol, "range=5d");
      const type = YAHOO_TYPES[meta.instrumentType ?? ""];
      if (!type) {
        throw new UnsupportedInstrumentError(
          `"${symbol}" is a ${meta.instrumentType ?? "unknown type"}, not a stock, ETF or crypto`,
        );
      }
      return {
        symbol: meta.symbol ?? symbol,
        name: meta.longName ?? meta.shortName ?? symbol,
        type,
        currency: meta.currency ?? "",
        exchange: meta.fullExchangeName ?? meta.exchangeName ?? null,
      };
    },

    async searchSymbols(query) {
      const url =
        `${YAHOO}/v1/finance/search?q=${encodeURIComponent(query)}` +
        `&quotesCount=10&newsCount=0&listsCount=0`;
      const { status, body } = await request(url);
      if (status !== 200) throw new MarketDataError(`Yahoo search: HTTP ${status}`);
      return ((body as YahooSearchResponse | null)?.quotes ?? []).flatMap((q) => {
        const type = YAHOO_TYPES[q.quoteType ?? ""];
        if (!type || !q.symbol) return [];
        return [
          {
            symbol: q.symbol,
            name: q.longname ?? q.shortname ?? q.symbol,
            type,
            exchange: q.exchDisp ?? q.exchange ?? null,
          },
        ];
      });
    },
  };
}

/**
 * Turns Yahoo's float close into an exact decimal string in the major unit.
 * Yahoo's floats carry float32 noise (`97197.2265625`), so round to the
 * instrument's `priceHint` decimals (at least 2) before converting.
 */
export function normalizePrice(
  close: number,
  currency: string | undefined,
  priceHint = 4,
): { close: string; currency: string } {
  if (!currency) throw new MarketDataError("Yahoo returned a price without a currency");
  let digits = close.toFixed(Math.max(priceHint, 2));
  const major = MINOR_UNITS[currency];
  if (major) {
    // Divide by 100 by moving the decimal point, so no float rounding creeps in.
    const [whole, fraction] = digits.split(".");
    const padded = whole.padStart(3, "0");
    digits = `${padded.slice(0, -2)}.${padded.slice(-2)}${fraction}`;
  }
  return {
    close: digits.replace(/0+$/, "").replace(/\.$/, ""),
    currency: major ?? currency.toUpperCase(),
  };
}

function localDate(epochSeconds: number, timeZone: string): string {
  return new Date(epochSeconds * 1_000).toLocaleDateString("en-CA", { timeZone });
}

function assertDate(date: string): void {
  if (!DATE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new TypeError(`Expected a YYYY-MM-DD date, got "${date}"`);
  }
}

interface YahooChartResult {
  meta: {
    symbol?: string;
    currency?: string;
    instrumentType?: string;
    exchangeName?: string;
    fullExchangeName?: string;
    exchangeTimezoneName?: string;
    longName?: string;
    shortName?: string;
    priceHint?: number;
  };
  timestamp?: number[];
  indicators?: { quote?: { close?: (number | null)[] }[] };
}

interface YahooChartResponse {
  chart?: { result?: YahooChartResult[] | null; error?: unknown };
}

interface YahooSearchResponse {
  quotes?: {
    symbol?: string;
    quoteType?: string;
    longname?: string;
    shortname?: string;
    exchDisp?: string;
    exchange?: string;
  }[];
}

interface FrankfurterRate {
  date: string;
  base: string;
  quote: string;
  rate: number;
}
