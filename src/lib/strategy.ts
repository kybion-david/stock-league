// Player strategies (ticket 022): a short free-text note on how a player
// invests, written by anyone with the shared password, like everything else.
import type { Db } from "@/lib/db/db";
import { InputError } from "@/lib/db/errors";

export interface Strategy {
  playerId: number;
  name: string;
  emoji: string | null;
  /** `null` until someone writes one (or after it's cleared). */
  text: string | null;
  updatedAt: Date | null;
}

export const MAX_STRATEGY_LENGTH = 1000;

const COLUMNS = `id as "playerId", name, emoji, strategy as text,
  strategy_updated_at as "updatedAt"`;

/**
 * Every player's strategy: written ones first, most recently changed first,
 * then players without one by name.
 */
export function listStrategies(db: Db): Promise<Strategy[]> {
  return db.query<Strategy>(
    `select ${COLUMNS} from players
     order by strategy is null, strategy_updated_at desc, name`,
  );
}

export async function getStrategy(db: Db, playerId: number): Promise<Strategy | null> {
  const [row] = await db.query<Strategy>(`select ${COLUMNS} from players where id = $1`, [
    playerId,
  ]);
  return row ?? null;
}

/**
 * Trims the text and checks its length. Line breaks are kept (as `\n`: forms
 * send `\r\n`); empty means "no strategy". Throws `InputError`.
 */
export function cleanStrategy(input: string): string | null {
  const text = input.replace(/\r\n?/g, "\n").trim();
  if (text.length > MAX_STRATEGY_LENGTH) {
    throw new InputError(
      `Keep it under ${MAX_STRATEGY_LENGTH.toLocaleString("en")} characters (it's ${text.length.toLocaleString("en")}).`,
    );
  }
  return text || null;
}

/** Saves (or clears) a player's strategy. Unchanged text keeps its date. */
export async function updateStrategy(db: Db, playerId: number, input: string): Promise<Strategy> {
  const text = cleanStrategy(input);
  const [row] = await db.query<Strategy>(
    `update players set
       strategy = $2,
       strategy_updated_at = case
         when strategy is not distinct from $2 then strategy_updated_at
         when $2::text is null then null
         else now()
       end
     where id = $1
     returning ${COLUMNS}`,
    [playerId, text],
  );
  if (!row) throw new InputError("That player doesn't exist.");
  return row;
}
