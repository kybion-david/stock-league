import type { Db } from "@/lib/db/db";
import { InputError, isUniqueViolation } from "@/lib/db/errors";

export interface Player {
  id: number;
  name: string;
  emoji: string | null;
}

export interface PlayerInput {
  name: string;
  emoji: string;
}

const MAX_NAME_LENGTH = 40;
const MAX_EMOJI_LENGTH = 16;

export function listPlayers(db: Db): Promise<Player[]> {
  return db.query<Player>("select id, name, emoji from players order by name");
}

export async function getPlayer(db: Db, id: number): Promise<Player | null> {
  const [row] = await db.query<Player>(
    "select id, name, emoji from players where id = $1",
    [id],
  );
  return row ?? null;
}

/** Trims the input and checks it. Throws `InputError` with a readable message. */
export function cleanPlayerInput(input: PlayerInput): { name: string; emoji: string | null } {
  const name = input.name.trim();
  const emoji = input.emoji.trim();
  if (!name) throw new InputError("Enter a name.");
  if (name.length > MAX_NAME_LENGTH) {
    throw new InputError(`Keep the name under ${MAX_NAME_LENGTH} characters.`);
  }
  if (emoji.length > MAX_EMOJI_LENGTH) throw new InputError("That's a lot of emoji. Pick one.");
  return { name, emoji: emoji || null };
}

export async function createPlayer(db: Db, input: PlayerInput): Promise<Player> {
  const { name, emoji } = cleanPlayerInput(input);
  try {
    const [row] = await db.query<Player>(
      "insert into players (name, emoji) values ($1, $2) returning id, name, emoji",
      [name, emoji],
    );
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) throw new InputError(`There's already a player called ${name}.`);
    throw err;
  }
}

export async function updatePlayer(db: Db, id: number, input: PlayerInput): Promise<Player> {
  const { name, emoji } = cleanPlayerInput(input);
  try {
    const [row] = await db.query<Player>(
      "update players set name = $2, emoji = $3 where id = $1 returning id, name, emoji",
      [id, name, emoji],
    );
    if (!row) throw new InputError("That player doesn't exist.");
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) throw new InputError(`There's already a player called ${name}.`);
    throw err;
  }
}
