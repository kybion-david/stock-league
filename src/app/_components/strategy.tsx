import { formatDay } from "@/lib/leaderboard";
import { berlinToday } from "@/lib/transactions";

/** A player's strategy text, line breaks kept, with the day it last changed. */
export function StrategyText({ text, updatedAt }: { text: string; updatedAt: Date | null }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="whitespace-pre-line break-words leading-relaxed">{text}</p>
      {updatedAt && (
        <p className="text-xs text-foreground/50">Updated {formatDay(berlinToday(updatedAt))}</p>
      )}
    </div>
  );
}
