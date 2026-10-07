import type { Metadata } from "next";
import Link from "next/link";
import { StrategyText } from "@/app/_components/strategy";
import { Page } from "@/app/_components/ui";
import { getDb } from "@/lib/db/postgres";
import { listStrategies } from "@/lib/strategy";

export const metadata: Metadata = { title: "Strategies · Stock League" };

export default async function StrategiesPage() {
  const all = await listStrategies(getDb());
  const written = all.filter((s) => s.text !== null);
  const missing = all.filter((s) => s.text === null);

  return (
    <Page title="Strategies">
      <p className="text-foreground/60">
        How everyone says they&apos;re playing. Newest changes first.
      </p>
      {all.length === 0 && (
        <p className="text-foreground/60">
          No players yet.{" "}
          <Link href="/players" className="underline">
            Add them
          </Link>
          .
        </p>
      )}
      {written.map((s) => (
        <section
          key={s.playerId}
          className="flex flex-col gap-3 rounded-2xl border border-foreground/15 p-4"
        >
          <div className="flex items-baseline gap-2">
            <Link
              href={`/portfolio/${s.playerId}`}
              className="min-w-0 flex-1 truncate text-lg font-semibold hover:underline"
            >
              {s.emoji ?? "🙂"} {s.name}
            </Link>
            <Link href={`/portfolio/${s.playerId}/strategy`} className="text-sm text-foreground/50">
              Edit
            </Link>
          </div>
          <StrategyText text={s.text!} updatedAt={s.updatedAt} />
        </section>
      ))}
      {missing.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Still keeping it secret</h2>
          <ul className="flex flex-col gap-1">
            {missing.map((s) => (
              <li key={s.playerId} className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate">
                  {s.emoji ?? "🙂"} {s.name}
                </span>
                <Link
                  href={`/portfolio/${s.playerId}/strategy`}
                  className="shrink-0 text-sm underline"
                >
                  Write one
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Page>
  );
}
