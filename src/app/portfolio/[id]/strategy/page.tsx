import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Page } from "@/app/_components/ui";
import { parseId } from "@/lib/db/errors";
import { getDb } from "@/lib/db/postgres";
import { getStrategy } from "@/lib/strategy";
import { editStrategyAction } from "./actions";
import { StrategyForm } from "./strategy-form";

export async function generateMetadata({
  params,
}: PageProps<"/portfolio/[id]/strategy">): Promise<Metadata> {
  const id = parseId((await params).id);
  const s = id === null ? null : await getStrategy(getDb(), id);
  return { title: `${s ? `${s.name}'s strategy` : "Not found"} · Stock League` };
}

export default async function EditStrategyPage({ params }: PageProps<"/portfolio/[id]/strategy">) {
  const id = parseId((await params).id);
  const s = id === null ? null : await getStrategy(getDb(), id);
  if (!s) notFound();

  return (
    <Page
      title={`${s.emoji ?? "🙂"} ${s.name}'s strategy`}
      back={{ href: `/portfolio/${s.playerId}`, label: s.name }}
    >
      <p className="text-foreground/60">
        How are you playing the game, and why? Change it whenever your plan changes.
      </p>
      <StrategyForm action={editStrategyAction.bind(null, s.playerId)} text={s.text ?? ""} />
    </Page>
  );
}
