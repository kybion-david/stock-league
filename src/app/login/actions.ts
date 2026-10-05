"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  checkPassword,
  createSessionToken,
  safeNextPath,
} from "@/lib/auth";

export async function login(formData: FormData) {
  const sitePassword = process.env.SITE_PASSWORD;
  const next = safeNextPath(formData.get("next"));
  const attempt = String(formData.get("password") ?? "");

  if (!sitePassword || !(await checkPassword(attempt, sitePassword))) {
    // Slow down guessing a little; there's no other rate limit.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const params = new URLSearchParams({ error: "1" });
    if (next !== "/") params.set("next", next);
    redirect(`/login?${params}`);
  }

  (await cookies()).set(SESSION_COOKIE, await createSessionToken(sitePassword), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  redirect(next);
}
