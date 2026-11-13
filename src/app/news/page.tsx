import type { Metadata } from "next";
import { NewsFeed } from "@/app/_components/news";
import { Page } from "@/app/_components/ui";
import { getDb } from "@/lib/db/postgres";
import { formatDay } from "@/lib/leaderboard";
import { loadNews } from "@/lib/news";
import { GAME_START_DATE } from "@/lib/valuation";

export const metadata: Metadata = { title: "News · Stock League" };

export default async function NewsPage() {
  const news = await loadNews(getDb());
  return (
    <Page title="📰 News">
      {news.items.length === 0 ? (
        <p className="text-foreground/60">
          {news.started
            ? "Nothing has happened yet. News shows up after the first prices."
            : `News starts once the game does, on ${formatDay(GAME_START_DATE)} 2026.`}
        </p>
      ) : (
        <>
          <p className="-mt-4 text-sm text-foreground/60">
            Every day&apos;s moves, and a recap of the week once Friday&apos;s prices are in.
          </p>
          <NewsFeed items={news.items} />
        </>
      )}
    </Page>
  );
}
