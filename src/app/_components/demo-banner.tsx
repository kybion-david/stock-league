import Link from "next/link";
import { DEMO, DEMO_TODAY } from "@/lib/demo/config";
import { formatDay } from "@/lib/leaderboard";

/** A strip on every page while demo mode is on (ADR 021), so nobody mistakes it for the real game. */
export function DemoBanner() {
  if (!DEMO) return null;
  return (
    <div className="bg-amber-300 px-4 py-2 text-center text-sm text-black">
      🧪 Demo season: fake players and prices, pretending it&apos;s {formatDay(DEMO_TODAY)}{" "}
      {DEMO_TODAY.slice(0, 4)}.{" "}
      <Link href="/demo" className="font-semibold underline">
        What&apos;s this?
      </Link>
    </div>
  );
}
