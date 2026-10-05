import type { Award } from "@/lib/leaderboard";
import { formatSignedEuroCents, formatSignedPercent } from "@/lib/money";

/** Medals and the wooden spoon, as the leaderboard shows them. */
export const AWARDS: Record<Award, { emoji: string; label: string }> = {
  gold: { emoji: "🥇", label: "1st place" },
  silver: { emoji: "🥈", label: "2nd place" },
  bronze: { emoji: "🥉", label: "3rd place" },
  spoon: { emoji: "🥄", label: "Wooden spoon" },
};

/** Green for up, red for down. */
export function tone(cents: number): string {
  if (cents > 0) return "text-green-700 dark:text-green-400";
  if (cents < 0) return "text-red-600 dark:text-red-400";
  return "text-foreground/60";
}

/** A gain or loss chip: green and ▲ for up, red and ▼ for down. */
export function Change({
  label,
  cents,
  rate,
}: {
  label: string;
  cents: number;
  rate: number | null;
}) {
  return (
    <span className="rounded-full bg-foreground/5 px-2 py-0.5 tabular-nums">
      <span className="text-foreground/60">{label} </span>
      <span className={tone(cents)}>
        {cents > 0 ? "▲ " : cents < 0 ? "▼ " : ""}
        {formatSignedEuroCents(cents)}
        {rate !== null && ` (${formatSignedPercent(rate)})`}
      </span>
    </span>
  );
}
