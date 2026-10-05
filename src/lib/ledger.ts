import { formatEuroCents } from "@/lib/money";

/** Every player starts with €1,000 of game cash. */
export const STARTING_CASH_CENTS = 100_000;

/** Cash may go down to −€50 and no further (SPEC → Game rules → Tolerance). */
export const MIN_CASH_CENTS = -5_000;

/** Share counts are exact decimals with at most this many decimal places. */
export const SHARE_DECIMALS = 8;

// BigInt() rather than bigint literals: tsconfig targets ES2017.
const ZERO = BigInt(0);
const SHARE_SCALE = BigInt(10) ** BigInt(SHARE_DECIMALS);

export type TransactionType = "buy" | "sell" | "fee" | "dividend";

/** One ledger row for one player, as the ledger logic needs it. */
export interface LedgerTransaction {
  id: string;
  /** Game day, `YYYY-MM-DD` (Europe/Berlin). */
  date: string;
  type: TransactionType;
  /** Required for buy, sell and dividend; optional for fee (e.g. a trade's commission). */
  instrumentId?: string | null;
  /** Decimal string such as `"0.5"` or `"1.50000000"`. Buy and sell only. */
  shares?: string | null;
  /** What the broker charged or paid, in positive integer euro cents. */
  amountCents: number;
}

export type TransactionInput = Omit<LedgerTransaction, "id">;

export type LedgerChange =
  | { kind: "create"; transaction: TransactionInput }
  | { kind: "update"; id: string; transaction: TransactionInput }
  | { kind: "delete"; id: string };

export interface LedgerState {
  /** Cash in integer euro cents. */
  cashCents: number;
  /** Shares per instrument id as normalized decimal strings; zero holdings are left out. */
  holdings: Record<string, string>;
}

/**
 * Parses a share count into fixed-point units of 10^-SHARE_DECIMALS.
 * Throws a TypeError for anything that isn't a plain non-negative decimal
 * with at most SHARE_DECIMALS decimal places.
 */
export function parseShares(shares: string): bigint {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(shares.trim());
  if (!match) {
    throw new TypeError(`Expected a decimal share count, got "${shares}"`);
  }
  const fraction = (match[2] ?? "").replace(/0+$/, "");
  if (fraction.length > SHARE_DECIMALS) {
    throw new TypeError(
      `Share counts can have at most ${SHARE_DECIMALS} decimal places, got "${shares}"`,
    );
  }
  return BigInt(match[1]) * SHARE_SCALE + BigInt(fraction.padEnd(SHARE_DECIMALS, "0"));
}

/** Formats fixed-point share units as a minimal decimal string, e.g. "1.5". */
export function formatShares(units: bigint): string {
  const sign = units < ZERO ? "-" : "";
  const abs = units < ZERO ? -units : units;
  const whole = abs / SHARE_SCALE;
  const fraction = (abs % SHARE_SCALE)
    .toString()
    .padStart(SHARE_DECIMALS, "0")
    .replace(/0+$/, "");
  return `${sign}${whole}${fraction ? `.${fraction}` : ""}`;
}

interface Totals {
  cashCents: number;
  units: Map<string, bigint>;
}

function apply(totals: Totals, tx: LedgerTransaction | TransactionInput): void {
  switch (tx.type) {
    case "buy":
    case "sell": {
      const sign = BigInt(tx.type === "buy" ? 1 : -1);
      const id = tx.instrumentId ?? "";
      const units = parseShares(tx.shares ?? "0");
      totals.units.set(id, (totals.units.get(id) ?? ZERO) + sign * units);
      totals.cashCents += tx.type === "buy" ? -tx.amountCents : tx.amountCents;
      break;
    }
    case "fee":
      totals.cashCents -= tx.amountCents;
      break;
    case "dividend":
      totals.cashCents += tx.amountCents;
      break;
  }
}

function byDate<T extends { date: string }>(transactions: readonly T[]): T[] {
  // Array.prototype.sort is stable, so same-day rows keep their input order.
  return [...transactions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Replays one player's transactions up to and including `date` (`YYYY-MM-DD`).
 * It only computes: an inconsistent ledger yields negative numbers, not an error.
 */
export function replay(
  transactions: readonly (LedgerTransaction | TransactionInput)[],
  date: string,
): LedgerState {
  const totals: Totals = { cashCents: STARTING_CASH_CENTS, units: new Map() };
  for (const tx of byDate(transactions)) {
    if (tx.date > date) break;
    apply(totals, tx);
  }
  const holdings: Record<string, string> = {};
  for (const [id, units] of totals.units) {
    if (units !== ZERO) holdings[id] = formatShares(units);
  }
  return { cashCents: totals.cashCents, holdings };
}

function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(date);
}

/** Checks one transaction on its own. Returns error messages; empty means valid. */
export function validateTransaction(tx: TransactionInput): string[] {
  const errors: string[] = [];
  const types: TransactionType[] = ["buy", "sell", "fee", "dividend"];
  if (!types.includes(tx.type)) {
    return [`Unknown transaction type "${tx.type}".`];
  }
  if (!isValidDate(tx.date)) {
    errors.push(`Date must be a real date in YYYY-MM-DD form, got "${tx.date}".`);
  }
  if (!Number.isInteger(tx.amountCents) || tx.amountCents <= 0) {
    errors.push("Amount must be more than €0.00, in whole cents.");
  }

  const hasInstrument = tx.instrumentId != null && tx.instrumentId !== "";
  if (tx.type !== "fee" && !hasInstrument) {
    errors.push(`A ${tx.type} needs an instrument.`);
  }

  const hasShares = tx.shares != null && tx.shares !== "";
  if (tx.type === "buy" || tx.type === "sell") {
    if (!hasShares) {
      errors.push(`A ${tx.type} needs a number of shares.`);
    } else {
      try {
        if (parseShares(tx.shares!) === ZERO) {
          errors.push("Number of shares must be more than 0.");
        }
      } catch {
        errors.push(
          `Number of shares must be a positive decimal with at most ${SHARE_DECIMALS} decimal places, got "${tx.shares}".`,
        );
      }
    }
  } else if (hasShares) {
    errors.push(`A ${tx.type} doesn't take a number of shares.`);
  }
  return errors;
}

/**
 * Checks a whole ledger of individually valid transactions. Rules are checked
 * at the end of each day, after all of that day's transactions, so the order
 * in which same-day trades were entered doesn't matter (ADR 007). Reports the
 * first day each rule breaks.
 */
function validateLedger(transactions: readonly TransactionInput[]): string[] {
  const errors: string[] = [];
  const totals: Totals = { cashCents: STARTING_CASH_CENTS, units: new Map() };
  const sorted = byDate(transactions);
  let cashBroken = false;
  const brokenInstruments = new Set<string>();

  for (let i = 0; i < sorted.length; ) {
    const day = sorted[i].date;
    for (; i < sorted.length && sorted[i].date === day; i++) apply(totals, sorted[i]);

    if (!cashBroken && totals.cashCents < MIN_CASH_CENTS) {
      cashBroken = true;
      errors.push(
        `On ${day} cash would be ${formatEuroCents(totals.cashCents)}, below the ${formatEuroCents(MIN_CASH_CENTS)} limit.`,
      );
    }
    for (const [id, units] of totals.units) {
      if (units < ZERO && !brokenInstruments.has(id)) {
        brokenInstruments.add(id);
        errors.push(
          `On ${day} more ${id} shares would be sold than held (holding would be ${formatShares(units)}).`,
        );
      }
    }
  }
  return errors;
}

/**
 * Validates creating, editing or deleting one transaction in a player's
 * ledger. The change is applied and the whole resulting ledger is re-checked,
 * so an edit or delete that breaks a later transaction is caught too.
 * Returns error messages; an empty array means the change is allowed.
 */
export function validate(
  existingTransactions: readonly LedgerTransaction[],
  change: LedgerChange,
): string[] {
  if (change.kind !== "create" && !existingTransactions.some((tx) => tx.id === change.id)) {
    return [`Transaction ${change.id} doesn't exist.`];
  }
  if (change.kind !== "delete") {
    const errors = validateTransaction(change.transaction);
    if (errors.length > 0) return errors;
  }

  const others =
    change.kind === "create"
      ? existingTransactions
      : existingTransactions.filter((tx) => tx.id !== change.id);
  const next: TransactionInput[] =
    change.kind === "delete" ? [...others] : [...others, change.transaction];
  return validateLedger(next);
}
