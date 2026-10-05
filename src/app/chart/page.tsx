import type { Metadata } from "next";
import Link from "next/link";
import { Page } from "@/app/_components/ui";
import { getDb } from "@/lib/db/postgres";
import { formatDay } from "@/lib/leaderboard";
import { STARTING_CASH_CENTS } from "@/lib/ledger";
import { formatEuroCents } from "@/lib/money";
import { GAME_START_DATE, latestSnapshotDate, playerSeries } from "@/lib/valuation";
import { ValueChart } from "./value-chart";

export const metadata: Metadata = { title: "Chart · Stock League" };

export default async function ChartPage() {
  const db = getDb();
  const lastUpdated = await latestSnapshotDate(db);
  const started = lastUpdated !== null && lastUpdated >= GAME_START_DATE;
  const all = started ? await playerSeries(db, GAME_START_DATE, lastUpdated) : [];
  const dates = all[0]?.points.map((p) => p.date) ?? [];

  return (
    <Page title="The race">
      {!started ? (
        <p className="text-foreground/60">
          The chart starts with the first prices, after the US close on{" "}
          {formatDay(GAME_START_DATE)}.
        </p>
      ) : all.length === 0 ? (
        <p className="text-foreground/60">
          No players yet.{" "}
          <Link href="/players" className="underline">
            Add them
          </Link>
          .
        </p>
      ) : (
        <>
          <p className="text-sm text-foreground/60">
            Everyone&apos;s value since kick-off, with prices up to{" "}
            {formatDay(lastUpdated)}. The dashed line is the{" "}
            {formatEuroCents(STARTING_CASH_CENTS)} everyone started with.
          </p>
          <ValueChart
            dates={dates}
            dayLabels={dates.map(formatDay)}
            baselineCents={STARTING_CASH_CENTS}
            series={all.map(({ player, points }) => ({
              id: player.id,
              name: player.name,
              emoji: player.emoji,
              values: points.map((p) => p.valueCents),
              stale: points.map((p) => p.stale),
            }))}
          />
        </>
      )}
    </Page>
  );
}
