import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, safeNextPath, verifySessionToken } from "@/lib/auth";

/**
 * The edit gate (ADR 028). Every server action that changes data calls this
 * first, outside its `try`. Without a valid session it redirects to `/login`,
 * which sends the player back to the page they were on.
 */
export async function requireEditor(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token, process.env.SITE_PASSWORD)) return;

  let next = "/";
  const referer = (await headers()).get("referer");
  if (referer) {
    try {
      const url = new URL(referer);
      next = safeNextPath(url.pathname + url.search);
    } catch {
      // Not a URL: fall back to the home page.
    }
  }
  redirect(next === "/" ? "/login" : `/login?${new URLSearchParams({ next })}`);
}
