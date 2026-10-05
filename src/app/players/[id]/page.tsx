import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Page } from "@/app/_components/ui";
import { parseId } from "@/lib/db/errors";
import { getDb } from "@/lib/db/postgres";
import { getPlayer } from "@/lib/players";
import { editPlayerAction } from "../actions";
import { PlayerForm } from "../player-form";

export const metadata: Metadata = { title: "Edit player · Stock League" };

export default async function EditPlayerPage({ params }: PageProps<"/players/[id]">) {
  const id = parseId((await params).id);
  const player = id === null ? null : await getPlayer(getDb(), id);
  if (!player) notFound();

  return (
    <Page title={`Edit ${player.name}`} back={{ href: "/players", label: "Players" }}>
      <PlayerForm
        action={editPlayerAction.bind(null, player.id)}
        player={player}
        submitLabel="Save"
        pendingLabel="Saving…"
      />
    </Page>
  );
}
