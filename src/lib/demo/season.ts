import { STARTING_CASH_CENTS } from "@/lib/ledger";
import { DEMO_TODAY } from "./config";

/**
 * A made-up season for demo mode (ADR 020): seven fake players with their
 * own investing styles, real-looking instruments and deterministic fake
 * prices from the day before kick-off to `DEMO_TODAY`. Pure: the same input
 * always gives the same season, so every server instance shows the same game.
 */

export interface DemoPlayer {
  name: string;
  emoji: string;
  /** One-line personality, shown on the `/demo` page. */
  trait: string;
  /** How that shows up in their trades. */
  style: string;
}

export interface DemoInstrument {
  symbol: string;
  name: string;
  type: "stock" | "etf" | "crypto";
  /** As Yahoo reports it (`GBp` for London). */
  currency: string;
  exchange: string;
}

export interface DemoTransaction {
  player: string;
  date: string;
  type: "buy" | "sell" | "fee" | "dividend";
  symbol: string | null;
  shares: string | null;
  amountCents: number;
  note: string | null;
}

export interface DemoPrice {
  symbol: string;
  date: string;
  close: string;
  /** ISO currency of `close` (GBp listings come back in GBP, ADR 010). */
  currency: string;
}

export interface DemoFx {
  date: string;
  currency: string;
  unitsPerEur: string;
}

export interface DemoSeason {
  players: DemoPlayer[];
  instruments: DemoInstrument[];
  transactions: DemoTransaction[];
  prices: DemoPrice[];
  fx: DemoFx[];
}

/** First day with prices: the day before kick-off, so day 1 has a "yesterday". */
const FIRST_PRICE_DAY = "2026-10-31";
/** Markets closed (besides weekends), for every non-crypto instrument. */
const HOLIDAYS = new Set(["2026-12-25", "2027-01-01"]);

export const DEMO_PLAYERS: DemoPlayer[] = [
  {
    name: "Lena",
    emoji: "🐢",
    trait: "The patient saver",
    style: "Two world ETFs on day one, then hands off. Put the last few euros in in January.",
  },
  {
    name: "Max",
    emoji: "🚀",
    trait: "The crypto degen",
    style: "All in on Bitcoin, Ether, Solana and Dogecoin. Buys dips, chases pumps.",
  },
  {
    name: "Jonas",
    emoji: "📊",
    trait: "The day trader",
    style: "In and out of NVIDIA and Tesla every week, with a €1 fee each time.",
  },
  {
    name: "Sofia",
    emoji: "🍎",
    trait: "The Big Tech believer",
    style: "Apple, Microsoft and NVIDIA. Takes some profit, collects dividends.",
  },
  {
    name: "Tom",
    emoji: "🎲",
    trait: "The meme lord",
    style: "GameStop, Tesla and Dogecoin. Rode the December squeeze up and back down.",
  },
  {
    name: "Mia",
    emoji: "🇪🇺",
    trait: "The European value hunter",
    style: "SAP, ASML and Vodafone in London (pence!). Reinvests her dividends.",
  },
  {
    name: "Erik",
    emoji: "💤",
    trait: "The procrastinator",
    style: "Forgot the game started. First trade in December, overspent by a few euros.",
  },
];

interface PriceModel {
  instrument: DemoInstrument;
  /** Close on `FIRST_PRICE_DAY`, in the price currency's major unit. */
  start: number;
  /** Daily drift and volatility of the log return. */
  drift: number;
  vol: number;
  decimals: number;
  /** One-off moves on given days (0.2 = +20%), on top of the random walk. */
  shocks?: Record<string, number>;
  /** Shares another symbol's random walk (two funds tracking the same market). */
  follows?: string;
}

const MODELS: PriceModel[] = [
  model("AAPL", "Apple Inc.", "stock", "USD", "NasdaqGS", 262, 0.0009, 0.013, 2, {
    "2027-01-28": 0.045,
  }),
  model("MSFT", "Microsoft Corporation", "stock", "USD", "NasdaqGS", 515, 0.0004, 0.012, 2, {
    "2027-01-28": -0.06,
  }),
  model("NVDA", "NVIDIA Corporation", "stock", "USD", "NasdaqGS", 188, 0.0022, 0.028, 2, {
    "2026-11-19": 0.08,
    "2026-12-16": -0.07,
  }),
  model("TSLA", "Tesla, Inc.", "stock", "USD", "NasdaqGS", 445, -0.0006, 0.034, 2, {
    "2026-11-24": 0.09,
    "2027-01-27": -0.12,
  }),
  model("GME", "GameStop Corp.", "stock", "USD", "NYSE", 23.4, -0.004, 0.035, 2, {
    "2026-12-07": 0.38,
    "2026-12-08": 0.31,
    "2026-12-09": 0.12,
    "2026-12-10": -0.22,
    "2026-12-11": -0.18,
    "2026-12-14": -0.15,
  }),
  model("SAP.DE", "SAP SE", "stock", "EUR", "XETRA", 236, 0.0007, 0.014, 2, {
    "2027-01-22": 0.05,
  }),
  model("ASML.AS", "ASML Holding N.V.", "stock", "EUR", "Amsterdam", 845, 0.0012, 0.02, 1, {
    "2027-01-27": 0.08,
  }),
  model("VOD.L", "Vodafone Group Public Limited Company", "stock", "GBp", "LSE", 74.2, 0.0005, 0.011, 2),
  model("IWDA.AS", "iShares Core MSCI World UCITS ETF USD (Acc)", "etf", "EUR", "Amsterdam", 107.8, 0.0006, 0.007, 3),
  { ...model("VWCE.DE", "Vanguard FTSE All-World UCITS ETF USD Acc", "etf", "EUR", "XETRA", 139.6, 0.0006, 0.0075, 2), follows: "IWDA.AS" },
  model("BTC-EUR", "Bitcoin EUR", "crypto", "EUR", "CCC", 93500, 0.0012, 0.026, 2, {
    "2026-11-17": -0.09,
    "2026-11-18": -0.07,
    "2027-01-12": 0.09,
    "2027-01-13": 0.05,
  }),
  model("ETH-EUR", "Ethereum EUR", "crypto", "EUR", "CCC", 3420, 0.0004, 0.034, 2, {
    "2026-11-17": -0.11,
    "2026-11-18": -0.06,
  }),
  model("SOL-EUR", "Solana EUR", "crypto", "EUR", "CCC", 168, 0.0006, 0.045, 2, {
    "2027-01-20": 0.21,
  }),
  model("DOGE-EUR", "Dogecoin EUR", "crypto", "EUR", "CCC", 0.192, -0.002, 0.055, 5, {
    "2026-12-20": 0.42,
    "2026-12-21": -0.24,
  }),
];

function model(
  symbol: string,
  name: string,
  type: DemoInstrument["type"],
  currency: string,
  exchange: string,
  start: number,
  drift: number,
  vol: number,
  decimals: number,
  shocks?: Record<string, number>,
): PriceModel {
  return { instrument: { symbol, name, type, currency, exchange }, start, drift, vol, decimals, shocks };
}

/** What each player did, in order. Amounts are euros of budget, not cents. */
type Step =
  | { date: string; buy: string; eur: number | "rest"; fractional?: boolean; note?: string }
  | { date: string; sell: string; fraction: number; note?: string }
  | { date: string; fee: number; symbol?: string; note?: string }
  | { date: string; dividend: string; eur: number; note?: string };

interface Script {
  player: string;
  /** Broker fee booked after every buy and sell, in euros (0 = free broker). */
  tradeFee: number;
  steps: Step[];
}

const SCRIPTS: Script[] = [
  {
    player: "Lena",
    tradeFee: 0,
    steps: [
      { date: "2026-11-02", buy: "VWCE.DE", eur: 500, note: "Savings plan, set and forget" },
      { date: "2026-11-02", buy: "IWDA.AS", eur: 480 },
      { date: "2026-11-02", fee: 1.5, note: "Order fees for both ETFs" },
      { date: "2027-01-04", buy: "IWDA.AS", eur: "rest", note: "New year, invest the leftovers" },
    ],
  },
  {
    player: "Max",
    tradeFee: 0.99,
    steps: [
      { date: "2026-11-01", buy: "BTC-EUR", eur: 400, note: "Kick-off at midnight, obviously" },
      { date: "2026-11-01", buy: "ETH-EUR", eur: 250 },
      { date: "2026-11-01", buy: "SOL-EUR", eur: 200 },
      { date: "2026-11-01", buy: "DOGE-EUR", eur: 140, note: "To the moon 🐕" },
      { date: "2026-11-18", sell: "ETH-EUR", fraction: 1, note: "Panic sell, never again" },
      { date: "2026-11-19", buy: "BTC-EUR", eur: "rest", note: "Buying the dip with the ETH money" },
      { date: "2026-12-21", sell: "DOGE-EUR", fraction: 0.5, note: "Took half the Doge pump" },
      { date: "2026-12-22", buy: "SOL-EUR", eur: "rest" },
      { date: "2027-01-14", sell: "BTC-EUR", fraction: 0.3, note: "Profit after the rally" },
      { date: "2027-01-15", buy: "ETH-EUR", eur: "rest", note: "OK, one more time" },
    ],
  },
  {
    player: "Jonas",
    tradeFee: 1,
    steps: [
      { date: "2026-11-02", buy: "NVDA", eur: 480 },
      { date: "2026-11-02", buy: "TSLA", eur: 450 },
      { date: "2026-11-06", sell: "TSLA", fraction: 1, note: "Stopped out" },
      { date: "2026-11-09", buy: "TSLA", eur: "rest", note: "Back in" },
      { date: "2026-11-20", sell: "NVDA", fraction: 1, note: "Sold the earnings pop" },
      { date: "2026-11-23", buy: "NVDA", eur: "rest" },
      { date: "2026-11-25", sell: "TSLA", fraction: 1, note: "+9% in a day, out" },
      { date: "2026-11-30", buy: "AAPL", eur: "rest" },
      { date: "2026-12-11", sell: "AAPL", fraction: 1 },
      { date: "2026-12-14", buy: "TSLA", eur: "rest" },
      { date: "2026-12-17", sell: "NVDA", fraction: 1, note: "Cutting the loser" },
      { date: "2026-12-18", buy: "NVDA", eur: "rest", note: "…and buying it back" },
      { date: "2027-01-08", sell: "TSLA", fraction: 1 },
      { date: "2027-01-11", buy: "SOL-EUR", eur: "rest", note: "Trying crypto" },
      { date: "2027-01-21", sell: "SOL-EUR", fraction: 1, note: "Solana +21%, cashing out" },
      { date: "2027-01-22", buy: "TSLA", eur: "rest" },
    ],
  },
  {
    player: "Sofia",
    tradeFee: 0.99,
    steps: [
      { date: "2026-11-02", buy: "AAPL", eur: 340 },
      { date: "2026-11-02", buy: "MSFT", eur: 330 },
      { date: "2026-11-02", buy: "NVDA", eur: 310 },
      { date: "2026-11-14", dividend: "AAPL", eur: 0.22, note: "Quarterly dividend" },
      { date: "2026-12-10", dividend: "MSFT", eur: 0.58, note: "Quarterly dividend" },
      { date: "2026-12-15", sell: "NVDA", fraction: 0.4, note: "Taking some profit" },
      { date: "2027-01-05", buy: "AAPL", eur: "rest" },
    ],
  },
  {
    player: "Tom",
    tradeFee: 1.5,
    steps: [
      { date: "2026-11-02", buy: "GME", eur: 420, note: "Diamond hands 💎🙌" },
      { date: "2026-11-02", buy: "TSLA", eur: 400 },
      { date: "2026-11-03", buy: "DOGE-EUR", eur: "rest" },
      { date: "2026-12-08", buy: "GME", eur: "rest", note: "Squeeze is ON" },
      { date: "2026-12-09", sell: "TSLA", fraction: 1, note: "All in on GME" },
      { date: "2026-12-09", buy: "GME", eur: "rest", note: "Bought the top, didn't I" },
      { date: "2027-01-19", sell: "GME", fraction: 0.5, note: "Fine. Half." },
      { date: "2027-01-19", buy: "TSLA", eur: "rest" },
    ],
  },
  {
    player: "Mia",
    tradeFee: 1.5,
    steps: [
      { date: "2026-11-02", buy: "SAP.DE", eur: 300 },
      { date: "2026-11-02", buy: "ASML.AS", eur: 330, note: "A fraction of a share, it's pricey" },
      { date: "2026-11-02", buy: "VOD.L", eur: 330, note: "Priced in pence, careful" },
      { date: "2026-11-27", dividend: "VOD.L", eur: 7.24, note: "Vodafone interim dividend" },
      { date: "2026-12-03", buy: "VOD.L", eur: "rest", note: "Dividend reinvested" },
      { date: "2027-01-26", sell: "VOD.L", fraction: 0.5 },
      { date: "2027-01-26", buy: "SAP.DE", eur: "rest" },
    ],
  },
  {
    player: "Erik",
    tradeFee: 0,
    steps: [
      { date: "2026-12-07", buy: "IWDA.AS", eur: 520, fractional: true, note: "Oops, forgot about this" },
      { date: "2026-12-07", buy: "BTC-EUR", eur: 300 },
      { date: "2026-12-07", buy: "AAPL", eur: 205, fractional: true, note: "A bit over budget, within the tolerance" },
      { date: "2026-12-07", fee: 3 },
    ],
  },
];

/** Builds the whole demo season. */
export function demoSeason(today = DEMO_TODAY): DemoSeason {
  const days = eachDay(FIRST_PRICE_DAY, today);
  const fx = fxRates(days);
  const prices = MODELS.flatMap((m) => pricePath(m, days));

  const close = new Map(prices.map((p) => [`${p.symbol}|${p.date}`, Number(p.close)]));
  const rate = new Map(fx.map((r) => [`${r.currency}|${r.date}`, Number(r.unitsPerEur)]));
  const eurPrice = (symbol: string, date: string) => {
    const m = MODELS.find((x) => x.instrument.symbol === symbol)!;
    const c = close.get(`${symbol}|${date}`)!;
    const currency = priceCurrency(m.instrument.currency);
    return currency === "EUR" ? c : c / rate.get(`${currency}|${date}`)!;
  };

  const transactions = SCRIPTS.flatMap((s) =>
    runScript(s, eurPrice, (symbol) => MODELS.find((m) => m.instrument.symbol === symbol)!.instrument),
  ).filter((t) => t.date <= today);

  return {
    players: DEMO_PLAYERS,
    instruments: MODELS.map((m) => m.instrument),
    transactions,
    prices,
    fx,
  };
}

function runScript(
  script: Script,
  eurPrice: (symbol: string, date: string) => number,
  instrument: (symbol: string) => DemoInstrument,
): DemoTransaction[] {
  const out: DemoTransaction[] = [];
  let cashCents = STARTING_CASH_CENTS;
  // Shares in units of 10^-8, so sells of a fraction stay exact.
  const held = new Map<string, bigint>();
  const tx = (t: Omit<DemoTransaction, "player" | "note"> & { note?: string }) =>
    out.push({ player: script.player, note: t.note ?? null, ...t });
  const tradeFee = (date: string) => {
    if (script.tradeFee <= 0) return;
    const cents = Math.round(script.tradeFee * 100);
    cashCents -= cents;
    tx({ date, type: "fee", symbol: null, shares: null, amountCents: cents, note: "Broker fee" });
  };

  for (const step of script.steps) {
    if ("buy" in step) {
      const price = eurPrice(step.buy, step.date);
      const feeCents = Math.round(script.tradeFee * 100);
      const budget = step.eur === "rest" ? (cashCents - feeCents) / 100 : step.eur;
      // "rest" spends what's left, which needs a fraction of a share.
      const fractional = step.fractional || step.eur === "rest" || instrument(step.buy).type === "crypto";
      const units = buyUnits(budget, price, fractional);
      if (units <= BigInt(0)) continue;
      const amountCents = Math.round((Number(units) / 1e8) * price * 100);
      cashCents -= amountCents;
      held.set(step.buy, (held.get(step.buy) ?? BigInt(0)) + units);
      tx({ date: step.date, type: "buy", symbol: step.buy, shares: shares(units), amountCents, note: step.note });
      tradeFee(step.date);
    } else if ("sell" in step) {
      const have = held.get(step.sell) ?? BigInt(0);
      const units =
        step.fraction >= 1 ? have : roundUnits(have, step.fraction, instrument(step.sell).type);
      if (units <= BigInt(0)) continue;
      const amountCents = Math.round((Number(units) / 1e8) * eurPrice(step.sell, step.date) * 100);
      cashCents += amountCents;
      held.set(step.sell, have - units);
      tx({ date: step.date, type: "sell", symbol: step.sell, shares: shares(units), amountCents, note: step.note });
      tradeFee(step.date);
    } else if ("fee" in step) {
      const cents = Math.round(step.fee * 100);
      cashCents -= cents;
      tx({ date: step.date, type: "fee", symbol: step.symbol ?? null, shares: null, amountCents: cents, note: step.note });
    } else {
      const cents = Math.round(step.eur * 100);
      cashCents += cents;
      tx({ date: step.date, type: "dividend", symbol: step.dividend, shares: null, amountCents: cents, note: step.note });
    }
  }
  return out;
}

const UNIT = BigInt(100_000_000);

/**
 * Shares a budget buys, rounded down: whole shares, or 6 decimals for a
 * fractional buy or when a single share costs more than the budget.
 */
function buyUnits(budgetEur: number, priceEur: number, fractional: boolean): bigint {
  const raw = budgetEur / priceEur;
  if (fractional || raw < 1) return BigInt(Math.floor(raw * 1e6)) * BigInt(100);
  return BigInt(Math.floor(raw)) * UNIT;
}

function roundUnits(have: bigint, fraction: number, type: DemoInstrument["type"]): bigint {
  if (type === "crypto") {
    return (have * BigInt(Math.round(fraction * 1e6))) / BigInt(1e6);
  }
  const whole = have / UNIT;
  return BigInt(Math.max(1, Math.round(Number(whole) * fraction))) * UNIT;
}

function shares(units: bigint): string {
  const whole = units / UNIT;
  const fraction = (units % UNIT).toString().padStart(8, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

/** Price rows for every calendar day; markets closed on weekends carry Friday forward. */
function pricePath(m: PriceModel, days: string[]): DemoPrice[] {
  const random = gaussian(hash(m.follows ?? m.instrument.symbol));
  const currency = priceCurrency(m.instrument.currency);
  // GBp listings are quoted in pence but stored in pounds (ADR 010).
  const scale = m.instrument.currency === "GBp" ? 0.01 : 1;
  const decimals = m.instrument.currency === "GBp" ? m.decimals + 2 : m.decimals;
  let price = m.start;
  return days.map((date, i) => {
    const open = m.instrument.type === "crypto" || isMarketDay(date);
    if (i > 0 && open) {
      const shock = m.shocks?.[date] ?? 0;
      price *= Math.exp(m.drift + m.vol * random()) * (1 + shock);
    }
    return { symbol: m.instrument.symbol, date, close: (price * scale).toFixed(decimals), currency };
  });
}

/** ECB-style rates: published on market days, carried over weekends and holidays. */
function fxRates(days: string[]): DemoFx[] {
  const series: { currency: string; start: number; vol: number }[] = [
    { currency: "USD", start: 1.1585, vol: 0.0035 },
    { currency: "GBP", start: 0.8712, vol: 0.0022 },
  ];
  return series.flatMap(({ currency, start, vol }) => {
    const random = gaussian(hash(currency));
    let r = start;
    return days.map((date, i) => {
      if (i > 0 && isMarketDay(date)) r *= Math.exp(vol * random());
      return { date, currency, unitsPerEur: r.toFixed(4) };
    });
  });
}

function priceCurrency(currency: string): string {
  return currency === "GBp" ? "GBP" : currency;
}

function isMarketDay(date: string): boolean {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return weekday !== 0 && weekday !== 6 && !HOLIDAYS.has(date);
}

function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d.toISOString().slice(0, 10) <= to; ) {
    days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

/** A seeded standard-normal generator (mulberry32 + Box–Muller). */
function gaussian(seed: number): () => number {
  let a = seed >>> 0;
  const uniform = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => Math.sqrt(-2 * Math.log(1 - uniform())) * Math.cos(2 * Math.PI * uniform());
}

function hash(text: string): number {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
