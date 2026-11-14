import type { Metadata } from "next";
import { SubmitButton } from "@/app/_components/submit-button";
import { safeNextPath } from "@/lib/auth";
import { login } from "./actions";

export const metadata: Metadata = {
  title: "Log in · Stock League",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="text-5xl" aria-hidden>
        🔒
      </div>
      <h1 className="text-3xl font-bold tracking-tight">Stock League</h1>
      <p className="text-foreground/60">
        Anyone can look around. Enter the league password to add or change trades,
        players, instruments and strategies.
      </p>
      <form action={login} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={safeNextPath(next)} />
        <label className="flex flex-col gap-2">
          <span className="text-sm text-foreground/60">Password</span>
          <input
            type="password"
            name="password"
            required
            autoFocus
            autoComplete="current-password"
            className="rounded-xl border border-foreground/15 bg-transparent px-4 py-3 text-lg"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Wrong password. Try again.
          </p>
        )}
        <SubmitButton pendingLabel="Logging in…">Enter</SubmitButton>
      </form>
    </main>
  );
}
