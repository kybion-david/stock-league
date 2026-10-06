// Manual instruments (ADR 022): things Yahoo can't price, such as an options
// trade. Players buy and sell them like anything else and type in what
// their holding is worth now. That's stored as a per-unit EUR price row in
// `price_snapshots`, so valuation, the chart and stats treat it like a close.
import type { Db } from "@/lib/db/db";
import { InputError, parseId } from "@/lib/db/errors";
import { formatShares, isValidDate, parseShares, SHARE_DECIMALS } from "@/lib/ledger";
import { berlinToday, listTransactions, parseAmountCents, position } from "@/lib/transactions";

/** What the "worth now" form sends, as typed. */
export interface ManualValueForm {
  /** Instrument id as a string. */
  instrumentId: string;
  date: string;
  /** Euros as typed, for everything the player holds of it. */
  worth: string;
}

export interface ManualValue {
  symbol: string;
  date: string;
  /** Per-unit value in EUR, exact decimal string. */
  close: string;
}

/** Euros as typed into cents, like `parseAmountCents` but €0 is fine (it expired worthless). */
export function parseWorthCents(text: string): number {
  if (/^0+(?:[.,]0{1,2})?$/.test(text.replace(/[\s€]/g, ""))) return 0;
  return parseAmountCents(text);
}

/**
 * The per-unit value, to `SHARE_DECIMALS` places (rounded half up), that
 * makes `shares` worth `worthCents`.
 */
export function unitValue(worthCents: number, shares: string): string {
  const units = parseShares(shares);
  if (units <= BigInt(0)) throw new RangeError("Shares must be more than 0");
  // Both shares and the result are in units of 10^-SHARE_DECIMALS; cents are 10^-2.
  const numerator = BigInt(worthCents) * BigInt(10) ** BigInt(2 * SHARE_DECIMALS - 2);
  const two = BigInt(2);
  return formatShares((numerator * two + units) / (units * two));
}

/**
 * Records what a player's holding of a manual instrument is worth at the end
 * of a day. Re-entering a day overwrites it. Throws `InputError` for
 * anything the user can fix.
 */
export async function setManualValue(
  db: Db,
  playerId: number,
  input: ManualValueForm,
  today = berlinToday(),
): Promise<ManualValue & { worthCents: number }> {
  const id = parseId(input.instrumentId);
  const [instrument] =
    id === null
      ? []
      : await db.query<{ symbol: string; type: string }>(
          "select symbol, type from instruments where id = $1",
          [id],
        );
  if (!instrument || instrument.type !== "manual") {
    throw new InputError("Only a manual instrument's value can be typed in.");
  }
  const date = input.date.trim();
  if (!isValidDate(date)) throw new InputError("Pick a date.");
  if (date > today) throw new InputError(`The date can't be in the future (today is ${today}).`);
  const worthCents = parseWorthCents(input.worth);

  const held = position(await listTransactions(db, playerId), date).holdings.find(
    (h) => h.symbol === instrument.symbol,
  );
  if (!held) throw new InputError(`No ${instrument.symbol} is held on ${date}. Add the buy first.`);

  const close = unitValue(worthCents, held.shares);
  await db.query(
    `insert into price_snapshots (instrument_id, date, close, currency) values ($1, $2, $3, 'EUR')
     on conflict (instrument_id, date)
     do update set close = excluded.close, currency = excluded.currency, fetched_at = now()`,
    [id, date, close],
  );
  return { symbol: instrument.symbol, date, close, worthCents };
}

/** Each manual instrument's latest entered value, by symbol. */
export async function latestManualValues(db: Db): Promise<Map<string, ManualValue>> {
  const rows = await db.query<ManualValue>(
    `select distinct on (p.instrument_id) i.symbol, p.date, p.close
     from price_snapshots p join instruments i on i.id = p.instrument_id
     where i.type = 'manual'
     order by p.instrument_id, p.date desc`,
  );
  return new Map(rows.map((r) => [r.symbol, r]));
}
