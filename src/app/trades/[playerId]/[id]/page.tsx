import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Page } from "@/app/_components/ui";
import { parseId } from "@/lib/db/errors";
import { getDb } from "@/lib/db/postgres";
import { listInstruments } from "@/lib/instruments";
import { getPlayer, listPlayers } from "@/lib/players";
import { getTransaction } from "@/lib/transactions";
import { deleteTransactionAction, editTransactionAction } from "../../actions";
import { centsToInput } from "../../format";
import { DeleteTransactionForm, TransactionForm } from "../../transaction-forms";

export const metadata: Metadata = { title: "Edit transaction · Stock League" };

const stamp = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Berlin",
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function EditTransactionPage({
  params,
}: PageProps<"/trades/[playerId]/[id]">) {
  const { playerId: rawPlayerId, id: rawId } = await params;
  const playerId = parseId(rawPlayerId);
  const id = parseId(rawId);
  const db = getDb();
  const transaction = id === null ? null : await getTransaction(db, id);
  if (!transaction || transaction.playerId !== playerId) notFound();

  const [player, instruments, players] = await Promise.all([
    getPlayer(db, transaction.playerId),
    listInstruments(db),
    listPlayers(db),
  ]);
  if (!player) notFound();

  return (
    <Page title="Edit transaction" back={{ href: `/trades/${player.id}`, label: player.name }}>
      <TransactionForm
        action={editTransactionAction.bind(null, transaction.id, player.id)}
        defaults={{
          date: transaction.date,
          type: transaction.type,
          instrumentId: transaction.instrumentId === null ? "" : String(transaction.instrumentId),
          shares: transaction.shares ?? "",
          amount: centsToInput(transaction.amountCents),
          note: transaction.note ?? "",
          by: player.name,
        }}
        instruments={instruments}
        players={players.map((p) => p.name)}
        submitLabel="Save"
        pendingLabel="Checking and saving…"
      />
      <p className="text-xs text-foreground/50">
        Added by {transaction.createdBy} on {stamp.format(transaction.createdAt)}
        {transaction.updatedAt.getTime() !== transaction.createdAt.getTime() &&
          `, last changed by ${transaction.updatedBy} on ${stamp.format(transaction.updatedAt)}`}
        .
      </p>
      <DeleteTransactionForm action={deleteTransactionAction.bind(null, transaction.id, player.id)} />
    </Page>
  );
}
