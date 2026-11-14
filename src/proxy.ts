import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  sessionNeedsRenewal,
  verifySessionToken,
} from "@/lib/auth";

// Every page is public to view (ADR 028). The proxy only keeps an editor's
// session fresh: changes are gated in the server actions (`requireEditor`).
export async function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const password = process.env.SITE_PASSWORD;
  // Sliding expiry: an editor who visits keeps a fresh 90-day session.
  if ((await verifySessionToken(token, password)) && sessionNeedsRenewal(token!)) {
    response.cookies.set(SESSION_COOKIE, await createSessionToken(password!), sessionCookieOptions());
  }
  return response;
}

export const config = {
  // `.swa` must stay reachable or SWA's deployment health check fails (ADR 004).
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|\\.swa/).*)"],
};
