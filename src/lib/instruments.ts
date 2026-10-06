import type { Db } from "@/lib/db/db";
import { InputError, isUniqueViolation } from "@/lib/db/errors";
import {
  MarketDataError,
  UnknownSymbolError,
  UnsupportedInstrumentError,
  type InstrumentType,
  type MarketDataClient,
} from "@/lib/market-data";

/** The types with a market price, fetched from Yahoo. */
export const INSTRUMENT_TYPES: readonly InstrumentType[] = ["stock", "etf", "crypto"];

/**
 * `manual`: anything Yahoo can't price, such as an options trade (ADR 022).
 * Players type in what it's worth; its symbol is the name they gave it.
 */
export type InstrumentKind = InstrumentType | "manual";

export interface Instrument {
  id: number;
  symbol: string;
  name: string;
  type: InstrumentKind;
  currency: string;
  exchange: string | null;
}

/** What can be changed after an instrument is added. The symbol is fixed. */
export interface InstrumentEdit {
  name: string;
  type: string;
  currency: string;
  exchange: string;
}

const COLUMNS = "id, symbol, name, type, currency, exchange";
// Mixed case on purpose: London listings report GBp (pence), not GBP.
const CURRENCY = /^[A-Za-z]{3}$/;
const MAX_SYMBOL_LENGTH = 32;
const MAX_TEXT_LENGTH = 100;

export function listInstruments(db: Db): Promise<Instrument[]> {
  return db.query<Instrument>(`select ${COLUMNS} from instruments order by symbol`);
}

export async function getInstrument(db: Db, id: number): Promise<Instrument | null> {
  const [row] = await db.query<Instrument>(
    `select ${COLUMNS} from instruments where id = $1`,
    [id],
  );
  return row ?? null;
}

async function findBySymbol(db: Db, symbol: string): Promise<Instrument | null> {
  const [row] = await db.query<Instrument>(
    `select ${COLUMNS} from instruments where upper(symbol) = upper($1)`,
    [symbol],
  );
  return row ?? null;
}

function duplicate(symbol: string): InputError {
  return new InputError(`${symbol} is already in the list.`);
}

/**
 * Adds an instrument by its Yahoo symbol. The symbol is checked with Yahoo,
 * and the name, type, currency and exchange are taken from Yahoo's answer,
 * stored under Yahoo's spelling of the symbol. Throws `InputError` for
 * anything the user can fix: unknown or unsupported symbols, duplicates, or
 * Yahoo being unreachable.
 */
export async function addInstrument(
  db: Db,
  market: Pick<MarketDataClient, "lookupSymbol">,
  rawSymbol: string,
): Promise<Instrument> {
  const symbol = rawSymbol.trim();
  if (!symbol) throw new InputError("Enter a symbol.");
  if (symbol.length > MAX_SYMBOL_LENGTH || /\s/.test(symbol)) {
    throw new InputError(`"${symbol}" doesn't look like a Yahoo symbol.`);
  }
  // Skip the network call when it's obviously a duplicate.
  if (await findBySymbol(db, symbol)) throw duplicate(symbol.toUpperCase());

  let info;
  try {
    info = await market.lookupSymbol(symbol);
  } catch (err) {
    if (err instanceof UnknownSymbolError) {
      throw new InputError(`Yahoo Finance doesn't know "${symbol}". Check the symbol on finance.yahoo.com.`);
    }
    if (err instanceof UnsupportedInstrumentError) throw new InputError(err.message);
    if (err instanceof MarketDataError) {
      throw new InputError("Couldn't reach Yahoo Finance to check the symbol. Try again in a minute.");
    }
    throw err;
  }
  if (!CURRENCY.test(info.currency)) {
    throw new InputError(`Yahoo Finance doesn't report a usable currency for ${info.symbol}.`);
  }
  if (await findBySymbol(db, info.symbol)) throw duplicate(info.symbol);

  try {
    const [row] = await db.query<Instrument>(
      `insert into instruments (symbol, name, type, currency, exchange)
       values ($1, $2, $3, $4, $5) returning ${COLUMNS}`,
      [
        info.symbol,
        info.name.slice(0, MAX_TEXT_LENGTH),
        info.type,
        info.currency,
        info.exchange?.slice(0, MAX_TEXT_LENGTH) ?? null,
      ],
    );
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) throw duplicate(info.symbol);
    throw err;
  }
}

/**
 * Adds a manual instrument (ADR 022): no Yahoo check, priced in EUR by
 * hand. The name doubles as its symbol, so it must be short and unique.
 */
export async function addManualInstrument(db: Db, rawName: string): Promise<Instrument> {
  const name = rawName.trim().replace(/\s+/g, " ");
  if (!name) throw new InputError("Enter a name.");
  if (name.length > MAX_SYMBOL_LENGTH) {
    throw new InputError(`Keep the name to ${MAX_SYMBOL_LENGTH} characters.`);
  }
  const existing = await findBySymbol(db, name);
  if (existing) throw duplicate(existing.symbol);
  try {
    const [row] = await db.query<Instrument>(
      `insert into instruments (symbol, name, type, currency)
       values ($1, $1, 'manual', 'EUR') returning ${COLUMNS}`,
      [name],
    );
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) throw duplicate(name);
    throw err;
  }
}

/** Trims the edit and checks it. Throws `InputError` with a readable message. */
export function cleanInstrumentEdit(input: InstrumentEdit): {
  name: string;
  type: InstrumentType;
  currency: string;
  exchange: string | null;
} {
  const name = input.name.trim();
  const currency = input.currency.trim();
  const exchange = input.exchange.trim();
  const type = INSTRUMENT_TYPES.find((t) => t === input.type);
  if (!name) throw new InputError("Enter a name.");
  if (name.length > MAX_TEXT_LENGTH || exchange.length > MAX_TEXT_LENGTH) {
    throw new InputError(`Keep names under ${MAX_TEXT_LENGTH} characters.`);
  }
  if (!type) throw new InputError("Pick stock, ETF or crypto.");
  if (!CURRENCY.test(currency)) {
    throw new InputError("Currency is a three-letter code like EUR, USD or GBp.");
  }
  return { name, type, currency, exchange: exchange || null };
}

/**
 * Saves an edit. A manual instrument (ADR 022) only takes a new name and
 * stays manual and in EUR; a priced one can't be turned into a manual one.
 */
export async function updateInstrument(
  db: Db,
  id: number,
  input: InstrumentEdit,
): Promise<Instrument> {
  const existing = await getInstrument(db, id);
  if (!existing) throw new InputError("That instrument doesn't exist.");
  const manual = existing.type === "manual";
  // A manual instrument's form only has the name: it keeps its type, currency and exchange.
  const { name, type, currency, exchange } = manual
    ? {
        ...cleanInstrumentEdit({ ...input, type: "stock", currency: "EUR", exchange: "" }),
        type: "manual",
        exchange: existing.exchange,
      }
    : cleanInstrumentEdit(input);
  const [row] = await db.query<Instrument>(
    `update instruments set name = $2, type = $3, currency = $4, exchange = $5
     where id = $1 returning ${COLUMNS}`,
    [id, name, type, currency, exchange],
  );
  if (!row) throw new InputError("That instrument doesn't exist.");
  return row;
}
