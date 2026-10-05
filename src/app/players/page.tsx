import type { Metadata } from "next";
import Link from "next/link";
import { Page } from "@/app/_components/ui";
import { getDb } from "@/lib/db/postgres";
import { listPlayers } from "@/lib/players";
import { addPlayerAction } from "./actions";
import { PlayerForm } from "./player-form";

export const metadata: Metadata = { title: "Players · Stock League" };

export default async function PlayersPage() {
  const players = await listPlayers(getDb());

  return (
    <Page title="Players">
      {players.length === 0 ? (
        <p className="text-foreground/60">No players yet. Add the first one below.</p>
      ) : (
        <ul className="divide-y divide-foreground/10 rounded-2xl border border-foreground/15">
          {players.map((p) => (
            <li key={p.id}>
              <Link
                href={`/players/${p.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-foreground/5"
              >
                <span className="w-8 text-center text-2xl" aria-hidden>
                  {p.emoji ?? "🙂"}
                </span>
                <span className="min-w-0 flex-1 truncate text-lg">{p.name}</span>
                <span className="text-sm text-foreground/50">Edit</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Add a player</h2>
        <PlayerForm action={addPlayerAction} submitLabel="Add player" pendingLabel="Adding…" />
      </section>
    </Page>
  );
}
