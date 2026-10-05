import type { Metadata } from "next";
import Link from "next/link";
import { Page } from "@/app/_components/ui";
import { getDb } from "@/lib/db/postgres";
import { listPlayers } from "@/lib/players";

export const metadata: Metadata = { title: "Trades · Stock League" };

export default async function TradesPage() {
  const players = await listPlayers(getDb());

  return (
    <Page title="Trades">
      {players.length === 0 ? (
        <p className="text-foreground/60">
          No players yet.{" "}
          <Link href="/players" className="underline">
            Add them first
          </Link>
          .
        </p>
      ) : (
        <>
          <p className="text-foreground/60">Whose trades?</p>
          <ul className="divide-y divide-foreground/10 rounded-2xl border border-foreground/15">
            {players.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/trades/${p.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-foreground/5"
                >
                  <span className="w-8 text-center text-2xl" aria-hidden>
                    {p.emoji ?? "🙂"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-lg">{p.name}</span>
                  <span className="text-foreground/50" aria-hidden>
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Page>
  );
}
