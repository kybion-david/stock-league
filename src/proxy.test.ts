import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth";
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

  it("redirects pages to the login screen without a session", async () => {
    const res = await proxy(request("/players?tab=1"));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/players?tab=1");
  });

  it("returns 401 for API routes without a session", async () => {
    const res = await proxy(request("/api/anything"));
    expect(res.status).toBe(401);
  });

  it("denies a session signed with a different password", async () => {
    const token = await createSessionToken("old-password");
    expect((await proxy(request("/", token))).status).toBe(307);
    expect((await proxy(request("/api/anything", token))).status).toBe(401);
  });

  it("denies everything when SITE_PASSWORD is not set", async () => {
    const token = await createSessionToken(PASSWORD);
    vi.stubEnv("SITE_PASSWORD", "");
    expect((await proxy(request("/api/anything", token))).status).toBe(401);
  });

  it("lets a valid session through to pages and API routes", async () => {
    const token = await createSessionToken(PASSWORD);
    for (const path of ["/", "/players", "/api/anything"]) {
      const res = await proxy(request(path, token));
      expect(res.headers.get("x-middleware-next")).toBe("1");
    }
  });

  it("always lets the login page through", async () => {
    const res = await proxy(request("/login"));
    expect(res.headers.get("x-middleware-next")).toBe("1");
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
