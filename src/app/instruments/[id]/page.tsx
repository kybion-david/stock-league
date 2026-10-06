import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Page } from "@/app/_components/ui";
import { parseId } from "@/lib/db/errors";
import { getDb } from "@/lib/db/postgres";
import { getInstrument } from "@/lib/instruments";
import { editInstrumentAction } from "../actions";
import { EditInstrumentForm } from "../instrument-forms";

export const metadata: Metadata = { title: "Edit instrument · Stock League" };

export default async function EditInstrumentPage({ params }: PageProps<"/instruments/[id]">) {
  const id = parseId((await params).id);
  const instrument = id === null ? null : await getInstrument(getDb(), id);
  if (!instrument) notFound();

  return (
    <Page title={instrument.symbol} back={{ href: "/instruments", label: "Instruments" }}>
      {instrument.type === "manual" ? (
        <p className="text-sm text-foreground/60">
          A manual instrument: its holders type in what it&apos;s worth on their trades page.
          The short name can&apos;t be changed, but the name below can say more.
        </p>
      ) : (
        <p className="text-sm text-foreground/60">
          The symbol can&apos;t be changed: prices are fetched with it. If it&apos;s wrong,
          add the right one as a new instrument. Currency is what Yahoo quotes the price
          in; only change it if Yahoo got it wrong.
        </p>
      )}
      <EditInstrumentForm action={editInstrumentAction.bind(null, instrument.id)} instrument={instrument} />
    </Page>
  );
}
