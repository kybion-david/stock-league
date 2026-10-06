// Transaction ledger data access (ticket 009, ADR 013): list, create, edit
// and delete one player's buys, sells, fees and dividends. Every change is
// checked with the ledger rules (ADR 007) against the player's whole ledger,
// inside a database transaction that locks the player's row.
import type { Db } from "@/lib/db/db";
import { DEMO, DEMO_TODAY } from "@/lib/demo/config";
import { InputError, parseId } from "@/lib/db/errors";
import {
  formatShares,
  parseShares,
  replay,
  validate,
  validateTransaction,
  type LedgerChange,
  type LedgerTransaction,
  type TransactionInput,
  type TransactionType,
} from "@/lib/ledger";

export const TRANSACTION_TYPES: readonly TransactionType[] = ["buy", "sell", "fee", "dividend"];

export interface Transaction {
  id: number;
  playerId: number;
  /** Game day, `YYYY-MM-DD`. */
  date: string;
  type: TransactionType;
  instrumentId: number | null;
  /** The instrument's symbol, joined in for display. */
  symbol: string | null;
  /** Exact decimal string, buy and sell only. */
  shares: string | null;
  amountCents: number;
  note: string | null;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
}

/** What the form sends, as typed. */
export interface TransactionForm {
  date: string;
  type: string;
  /** Instrument id as a string; "" for none. */
  instrumentId: string;
  shares: string;
  /** Euros as typed, e.g. "1234.56" or "1234,56". */
  amount: string;
  note: string;
  /** Who is making the change: a player's name (the audit label). */
  by: string;
}

export interface Position {
  cashCents: number;
  /** Holdings with shares > 0, by symbol. */
  holdings: { symbol: string; shares: string }[];
}

const COLUMNS = `t.id, t.player_id as "playerId", t.date, t.type,
  t.instrument_id as "instrumentId", i.symbol, t.shares,
  t.amount_cents as "amountCents", t.note,
  t.created_at as "createdAt", t.created_by as "createdBy",
  t.updated_at as "updatedAt", t.updated_by as "updatedBy"`;
const FROM = "transactions t left join instruments i on i.id = t.instrument_id";

const MAX_NOTE_LENGTH = 200;
// Far above anything in a €1,000 game, and well inside the integer column.
const MAX_AMOUNT_CENTS = 100_000_000;

/** Today's game day (`YYYY-MM-DD` in Europe/Berlin); the pretend day in demo mode (ADR 020). */
export function berlinToday(now?: Date): string {
  if (!now && DEMO) return DEMO_TODAY;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(now ?? new Date());
}

/** A player's transactions, newest first. */
export function listTransactions(db: Db, playerId: number): Promise<Transaction[]> {
  return db.query<Transaction>(
    `select ${COLUMNS} from ${FROM} where t.player_id = $1 order by t.date desc, t.id desc`,
    [playerId],
  );
}

export async function getTransaction(db: Db, id: number): Promise<Transaction | null> {
  const [row] = await db.query<Transaction>(`select ${COLUMNS} from ${FROM} where t.id = $1`, [id]);
  return row ?? null;
}

/**
 * The ledger keys instruments by symbol (unique and fixed, ADR 011) rather
 * than by id, so its error messages read "more AAPL shares would be sold".
 */
function toLedger(tx: Transaction): LedgerTransaction {
  return {
    id: String(tx.id),
    date: tx.date,
    type: tx.type,
    instrumentId: tx.symbol,
    shares: tx.shares,
    amountCents: tx.amountCents,
  };
}

/** Cash and holdings after all of a player's transactions. */
export function position(transactions: readonly Transaction[]): Position {
  const state = replay(transactions.map(toLedger), "9999-12-31");
  const holdings = Object.entries(state.holdings)
    .filter(([, shares]) => !shares.startsWith("-"))
    .map(([symbol, shares]) => ({ symbol, shares }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
  return { cashCents: state.cashCents, holdings };
}

/**
 * Parses euros as typed into integer cents: "12", "12.5", "12,50", "€ 1234.56".
 * No thousands separators, so "1,234" isn't misread. Throws `InputError`.
 */
export function parseAmountCents(text: string): number {
  const cleaned = text.replace(/[\s€]/g, "");
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(cleaned);
  if (!match) {
    throw new InputError("Enter the amount in euros like 1234.56, with at most 2 decimals.");
  }
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (cents <= 0) throw new InputError("The amount must be more than €0.00.");
  if (cents > MAX_AMOUNT_CENTS) throw new InputError("That amount looks too big. Check it.");
  return cents;
}

interface Cleaned {
  date: string;
  type: TransactionType;
  instrumentId: number | null;
  symbol: string | null;
  shares: string | null;
  amountCents: number;
  note: string | null;
  by: string;
}

/**
 * Checks one transaction on its own (shape, instrument, audit label, no
 * future dates) and normalizes it. Throws `InputError` with a readable message.
 */
async function clean(db: Db, input: TransactionForm, today: string): Promise<Cleaned> {
  const type = TRANSACTION_TYPES.find((t) => t === input.type);
  if (!type) throw new InputError("Pick buy, sell, fee or dividend.");
  const date = input.date.trim();
  const amountCents = parseAmountCents(input.amount);

  // Shares only belong to buys and sells; the form hides the field for the
  // others, so ignore anything left over from switching the type.
  const takesShares = type === "buy" || type === "sell";
  const shares = takesShares ? input.shares.trim().replace(",", ".") : "";

  let instrumentId: number | null = null;
  let symbol: string | null = null;
  if (input.instrumentId) {
    const id = parseId(input.instrumentId);
    const [row] =
      id === null
        ? []
        : await db.query<{ symbol: string }>("select symbol from instruments where id = $1", [id]);
    if (!row) throw new InputError("That instrument doesn't exist.");
    instrumentId = id;
    symbol = row.symbol;
  }

  const errors = validateTransaction({
    date,
    type,
    instrumentId: symbol,
    shares: shares || null,
    amountCents,
  });
  if (errors.length > 0) throw new InputError(errors.join(" "));
  if (date > today) throw new InputError(`The date can't be in the future (today is ${today}).`);

  const note = input.note.trim();
  if (note.length > MAX_NOTE_LENGTH) {
    throw new InputError(`Keep the note under ${MAX_NOTE_LENGTH} characters.`);
  }

  const by = input.by.trim();
  const [player] = await db.query("select 1 from players where name = $1", [by]);
  if (!player) throw new InputError("Pick who is making this change.");

  return {
    date,
    type,
    instrumentId,
    symbol,
    // Minimal form, e.g. "1.50000000" → "1.5".
    shares: shares ? formatShares(parseShares(shares)) : null,
    amountCents,
    note: note || null,
    by,
  };
}

function ledgerInput(tx: Cleaned): TransactionInput {
  return {
    date: tx.date,
    type: tx.type,
    instrumentId: tx.symbol,
    shares: tx.shares,
    amountCents: tx.amountCents,
  };
}

/**
 * Locks the player's row, so changes to one ledger run one at a time and
 * each is checked against the ledger it actually changes, then checks the
 * change against the whole ledger.
 */
async function checkLedger(tx: Db, playerId: number, change: LedgerChange): Promise<void> {
  const [player] = await tx.query("select id from players where id = $1 for update", [playerId]);
  if (!player) throw new InputError("That player doesn't exist.");
  const ledger = (await listTransactions(tx, playerId)).map(toLedger);
  const errors = validate(ledger, change);
  if (errors.length > 0) throw new InputError(errors.join(" "));
}

/** Adds a transaction to a player's ledger. Throws `InputError` if it breaks a rule. */
export async function createTransaction(
  db: Db,
  playerId: number,
  input: TransactionForm,
  today = berlinToday(),
): Promise<Transaction> {
  return db.transaction(async (tx) => {
    const t = await clean(tx, input, today);
    await checkLedger(tx, playerId, { kind: "create", transaction: ledgerInput(t) });
    const [{ id }] = await tx.query<{ id: number }>(
      `insert into transactions
         (player_id, date, type, instrument_id, shares, amount_cents, note, created_by, updated_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $8) returning id`,
      [playerId, t.date, t.type, t.instrumentId, t.shares, t.amountCents, t.note, t.by],
    );
    return (await getTransaction(tx, id))!;
  });
}

/** The player a transaction belongs to, or `InputError` if it doesn't exist. */
async function ownerOf(tx: Db, id: number): Promise<number> {
  const [row] = await tx.query<{ playerId: number }>(
    `select player_id as "playerId" from transactions where id = $1`,
    [id],
  );
  if (!row) throw new InputError("That transaction doesn't exist anymore.");
  return row.playerId;
}

/**
 * Edits a transaction (it stays in the same player's ledger). The whole
 * ledger is re-checked, so an edit that breaks a later trade is rejected.
 */
export async function updateTransaction(
  db: Db,
  id: number,
  input: TransactionForm,
  today = berlinToday(),
): Promise<Transaction> {
  return db.transaction(async (tx) => {
    const t = await clean(tx, input, today);
    const playerId = await ownerOf(tx, id);
    await checkLedger(tx, playerId, { kind: "update", id: String(id), transaction: ledgerInput(t) });
    await tx.query(
      `update transactions set date = $2, type = $3, instrument_id = $4, shares = $5,
         amount_cents = $6, note = $7, updated_at = now(), updated_by = $8
       where id = $1`,
      [id, t.date, t.type, t.instrumentId, t.shares, t.amountCents, t.note, t.by],
    );
    return (await getTransaction(tx, id))!;
  });
}

/**
 * Deletes a transaction for good (ADR 013). Rejected if the ledger would
 * break without it, e.g. deleting a buy that a later sell depends on.
 */
export async function deleteTransaction(db: Db, id: number): Promise<void> {
  await db.transaction(async (tx) => {
    const playerId = await ownerOf(tx, id);
    await checkLedger(tx, playerId, { kind: "delete", id: String(id) });
    await tx.query("delete from transactions where id = $1", [id]);
  });
}
