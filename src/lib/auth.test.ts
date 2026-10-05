import { describe, expect, it } from "vitest";
import {
  SESSION_MAX_AGE_SECONDS,
  checkPassword,
  createSessionToken,
  safeNextPath,
  verifySessionToken,
} from "./auth";

const NOW = Date.UTC(2026, 10, 1);
const DAY_MS = 24 * 60 * 60 * 1000;

describe("checkPassword", () => {
  it("accepts only the exact password", async () => {
    expect(await checkPassword("hunter2", "hunter2")).toBe(true);
    expect(await checkPassword("hunter3", "hunter2")).toBe(false);
    expect(await checkPassword("", "hunter2")).toBe(false);
  });

  it("rejects everything when no password is configured", async () => {
    expect(await checkPassword("", undefined)).toBe(false);
    expect(await checkPassword("", "")).toBe(false);
  });
});

describe("session tokens", () => {
  it("are valid for at least 30 days", async () => {
    const token = await createSessionToken("hunter2", NOW);
    expect(SESSION_MAX_AGE_SECONDS).toBeGreaterThanOrEqual(30 * 24 * 60 * 60);
    expect(await verifySessionToken(token, "hunter2", NOW + 30 * DAY_MS)).toBe(true);
  });

  it("expire after the max age", async () => {
    const token = await createSessionToken("hunter2", NOW);
    expect(
      await verifySessionToken(token, "hunter2", NOW + SESSION_MAX_AGE_SECONDS * 1000),
    ).toBe(false);
  });

  it("stop working when the password changes", async () => {
    const token = await createSessionToken("hunter2", NOW);
    expect(await verifySessionToken(token, "new-password", NOW)).toBe(false);
  });

  it("reject tampered, missing or malformed tokens", async () => {
    const token = await createSessionToken("hunter2", NOW);
    const [v, , sig] = token.split(".");
    const extended = `${v}.${Math.floor(NOW / 1000) + 10 * SESSION_MAX_AGE_SECONDS}.${sig}`;
    expect(await verifySessionToken(extended, "hunter2", NOW)).toBe(false);
    expect(await verifySessionToken(undefined, "hunter2", NOW)).toBe(false);
    expect(await verifySessionToken("garbage", "hunter2", NOW)).toBe(false);
    expect(await verifySessionToken(token, undefined, NOW)).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths and drops anything else", () => {
    expect(safeNextPath("/players?x=1")).toBe("/players?x=1");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
  });
});
