import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE, createSessionToken, verifySessionToken } from "@/lib/auth";
import { config, proxy } from "./proxy";

const PASSWORD = "hunter2";

function request(path: string, token?: string) {
  const req = new NextRequest(new URL(path, "https://league.example"));
  if (token) req.cookies.set(SESSION_COOKIE, token);
  return req;
}

describe("proxy", () => {
  beforeEach(() => vi.stubEnv("SITE_PASSWORD", PASSWORD));
  afterEach(() => vi.unstubAllEnvs());

  it("lets everyone view pages without a session (ADR 028)", async () => {
    for (const path of ["/", "/players?tab=1", "/trades/1", "/api/anything"]) {
      const res = await proxy(request(path));
      expect(res.headers.get("x-middleware-next")).toBe("1");
      expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
    }
  });

  it("renews an editor's session that is more than a day old", async () => {
    const day = 24 * 60 * 60 * 1000;
    const fresh = await proxy(request("/", await createSessionToken(PASSWORD)));
    expect(fresh.cookies.get(SESSION_COOKIE)).toBeUndefined();

    // Logged in 89 days ago: one day left before this visit.
    const old = await createSessionToken(PASSWORD, Date.now() - 89 * day);
    const res = await proxy(request("/players", old));
    expect(res.headers.get("x-middleware-next")).toBe("1");
    const renewed = res.cookies.get(SESSION_COOKIE);
    expect(renewed?.maxAge).toBe(90 * 24 * 60 * 60);
    expect(renewed?.httpOnly).toBe(true);
    expect(await verifySessionToken(renewed?.value, PASSWORD, Date.now() + 80 * day)).toBe(true);
  });

  it("doesn't renew a session signed with a different password", async () => {
    const day = 24 * 60 * 60 * 1000;
    const old = await createSessionToken("old-password", Date.now() - 89 * day);
    const res = await proxy(request("/", old));
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });
});

describe("proxy matcher", () => {
  const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url });

  it("covers pages and API routes", () => {
    expect(matches("/")).toBe(true);
    expect(matches("/players/1")).toBe(true);
    expect(matches("/api/prices")).toBe(true);
  });

  it("skips SWA's health check and static assets", () => {
    expect(matches("/.swa/health.html")).toBe(false);
    expect(matches("/_next/static/chunk.js")).toBe(false);
    expect(matches("/favicon.ico")).toBe(false);
  });
});
