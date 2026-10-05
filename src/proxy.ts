import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  sessionNeedsRenewal,
  verifySessionToken,
} from "@/lib/auth";

// Shared-password gate for every page and API route (ADR 006).
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/login") return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const password = process.env.SITE_PASSWORD;
  if (await verifySessionToken(token, password)) {
    const response = NextResponse.next();
    // Sliding expiry: a player who visits keeps a fresh 90-day session.
    if (sessionNeedsRenewal(token!)) {
      response.cookies.set(SESSION_COOKIE, await createSessionToken(password!), sessionCookieOptions());
    }
    return response;
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  // `.swa` must stay reachable or SWA's deployment health check fails (ADR 004).
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|\\.swa/).*)"],
};
