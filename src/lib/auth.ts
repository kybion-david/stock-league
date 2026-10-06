// Shared-password gate (ADR 002, ADR 006). Framework-free so it can be unit
// tested; `src/proxy.ts` and the login action are thin wrappers around it.
//
// A session is a cookie `v1.<expiresAtSeconds>.<hmac>` signed with
// SITE_PASSWORD itself, so changing the password logs every device out.

export const SESSION_COOKIE = "sl_session";
export const SESSION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;
/**
 * A valid session older than this is re-issued for another 90 days on the
 * next visit, so players who use the site aren't logged out mid-game.
 */
export const SESSION_RENEW_AFTER_SECONDS = 24 * 60 * 60;

const encoder = new TextEncoder();

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** True if `attempt` equals the site password. False when no password is configured. */
export async function checkPassword(
  attempt: string,
  sitePassword: string | undefined,
): Promise<boolean> {
  if (!sitePassword) return false;
  // Compare fixed-length digests so the comparison doesn't leak the length.
  const [a, b] = await Promise.all([
    hmacHex("password-check", attempt),
    hmacHex("password-check", sitePassword),
  ]);
  return timingSafeEqual(a, b);
}

export async function createSessionToken(
  sitePassword: string,
  nowMs: number = Date.now(),
): Promise<string> {
  const payload = `v1.${Math.floor(nowMs / 1000) + SESSION_MAX_AGE_SECONDS}`;
  return `${payload}.${await hmacHex(sitePassword, payload)}`;
}

/** Cookie settings for the session, at login and when it's renewed. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/** True if a verified `token` was issued more than `SESSION_RENEW_AFTER_SECONDS` ago. */
export function sessionNeedsRenewal(token: string, nowMs: number = Date.now()): boolean {
  const expiresAt = Number(token.split(".")[1]);
  return expiresAt - nowMs / 1000 < SESSION_MAX_AGE_SECONDS - SESSION_RENEW_AFTER_SECONDS;
}

/** True if `token` was signed with the current password and hasn't expired. */
export async function verifySessionToken(
  token: string | undefined,
  sitePassword: string | undefined,
  nowMs: number = Date.now(),
): Promise<boolean> {
  if (!token || !sitePassword) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const expiresAt = Number(parts[1]);
  if (!Number.isInteger(expiresAt) || expiresAt * 1000 <= nowMs) return false;
  const expected = await hmacHex(sitePassword, `${parts[0]}.${parts[1]}`);
  return timingSafeEqual(parts[2], expected);
}

/** Only allow same-site relative paths as a post-login redirect target. */
export function safeNextPath(next: unknown): string {
  if (
    typeof next !== "string" ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/\\")
  ) {
    return "/";
  }
  return next;
}
