/** True for Postgres `unique_violation` (23505), from postgres.js or PGlite. */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "23505"
  );
}

/**
 * A problem with what the user entered. Its message is safe to show on the
 * page; server actions catch it and return the message to the form.
 */
export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

/** Parses a route or form id, or returns null if it isn't a positive integer. */
export function parseId(value: unknown): number | null {
  if (typeof value !== "string" || !/^[1-9]\d{0,9}$/.test(value)) return null;
  const id = Number(value);
  return id <= 2_147_483_647 ? id : null;
}
