import type { Db } from "./db";

/**
 * Fake dev data: three players, three instruments (a USD stock, a EUR ETF
 * and fractional crypto), a valid ledger (no overselling, cash never below
 * −€50), and two days of price and FX snapshots.
 */
const players = [
  { name: "Alice", emoji: "🦊" },
  { name: "Bob", emoji: "🐻" },
  { name: "Carla", emoji: "🐙" },
];

const instruments = [
  { symbol: "AAPL", name: "Apple Inc.", type: "stock", currency: "USD", exchange: "NASDAQ" },
  { symbol: "IWDA.AS", name: "iShares Core MSCI World", type: "etf", currency: "EUR", exchange: "Euronext Amsterdam" },
  { symbol: "BTC-EUR", name: "Bitcoin", type: "crypto", currency: "EUR", exchange: "CCC" },
];

type SeedTransaction = {
  player: string;
  date: string;
  type: "buy" | "sell" | "fee" | "dividend";
  symbol?: string;
  shares?: string;
  amountCents: number;
  note?: string;
};

// Cash after each player's trades: Alice €47.00 → €48.20, Bob −€0.50 → €479.50,
// Carla €5.00 → €227.00. All start from €1,000.
const transactions: SeedTransaction[] = [
  { player: "Alice", date: "2026-11-02", type: "buy", symbol: "AAPL", shares: "2", amountCents: 40000 },
  { player: "Alice", date: "2026-11-02", type: "buy", symbol: "IWDA.AS", shares: "5", amountCents: 55000 },
  { player: "Alice", date: "2026-11-02", type: "fee", amountCents: 300, note: "Broker fees" },
  { player: "Alice", date: "2026-11-14", type: "dividend", symbol: "AAPL", amountCents: 120 },
  { player: "Bob", date: "2026-11-02", type: "buy", symbol: "BTC-EUR", shares: "0.01052631", amountCents: 99900 },
  { player: "Bob", date: "2026-11-02", type: "fee", amountCents: 150 },
  { player: "Bob", date: "2026-11-10", type: "sell", symbol: "BTC-EUR", shares: "0.005", amountCents: 48000, note: "Taking profit" },
  { player: "Carla", date: "2026-11-03", type: "buy", symbol: "IWDA.AS", shares: "9", amountCents: 99000 },
  { player: "Carla", date: "2026-11-03", type: "fee", amountCents: 500 },
  { player: "Carla", date: "2026-11-12", type: "sell", symbol: "IWDA.AS", shares: "2", amountCents: 22200 },
];

const prices = [
  { symbol: "AAPL", date: "2026-11-02", close: "231.55", currency: "USD" },
  { symbol: "AAPL", date: "2026-11-03", close: "233.10", currency: "USD" },
  { symbol: "IWDA.AS", date: "2026-11-02", close: "110.12", currency: "EUR" },
  { symbol: "IWDA.AS", date: "2026-11-03", close: "109.87", currency: "EUR" },
  { symbol: "BTC-EUR", date: "2026-11-02", close: "94850.25", currency: "EUR" },
  { symbol: "BTC-EUR", date: "2026-11-03", close: "96120.80", currency: "EUR" },
];

const fx = [
  { date: "2026-11-02", currency: "USD", unitsPerEur: "1.1612" },
  { date: "2026-11-03", currency: "USD", unitsPerEur: "1.1590" },
];

const SEED_LABEL = "seed";

/** Inserts the dev data. Refuses if any players exist, so it never mixes with real data. */
export async function seed(db: Db): Promise<void> {
  const [{ count }] = await db.query<{ count: number }>(
    "select count(*)::int as count from players",
  );
  if (count > 0) {
    throw new Error(`Database already has ${count} players; not seeding.`);
  }

  await db.transaction(async (tx) => {
    const playerIds = new Map<string, number>();
    for (const p of players) {
      const [row] = await tx.query<{ id: number }>(
        "insert into players (name, emoji) values ($1, $2) returning id",
        [p.name, p.emoji],
      );
      playerIds.set(p.name, row.id);
    }

    const instrumentIds = new Map<string, number>();
    for (const i of instruments) {
      const [row] = await tx.query<{ id: number }>(
        `insert into instruments (symbol, name, type, currency, exchange)
         values ($1, $2, $3, $4, $5) returning id`,
        [i.symbol, i.name, i.type, i.currency, i.exchange],
      );
      instrumentIds.set(i.symbol, row.id);
    }

    for (const t of transactions) {
      await tx.query(
        `insert into transactions
           (player_id, date, type, instrument_id, shares, amount_cents, note, created_by, updated_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
        [
          playerIds.get(t.player),
          t.date,
          t.type,
          t.symbol ? instrumentIds.get(t.symbol) : null,
          t.shares ?? null,
          t.amountCents,
          t.note ?? null,
          SEED_LABEL,
        ],
      );
    }

    for (const p of prices) {
      await tx.query(
        "insert into price_snapshots (instrument_id, date, close, currency) values ($1, $2, $3, $4)",
        [instrumentIds.get(p.symbol), p.date, p.close, p.currency],
      );
    }

    for (const r of fx) {
      await tx.query(
        "insert into fx_snapshots (date, currency, units_per_eur) values ($1, $2, $3)",
        [r.date, r.currency, r.unitsPerEur],
      );
    }
  });
}
