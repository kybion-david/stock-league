"use client";

import { useMemo, useState } from "react";
import { layoutChart, nearestIndex, type ChartSeries } from "@/lib/chart";
import { formatEuroCents, formatSignedPercent } from "@/lib/money";

export interface ValueChartSeries extends ChartSeries {
  /** Per date: true if that day's value uses an old or missing price (ADR 014). */
  stale: boolean[];
}

/**
 * Every player's value over the game as plain SVG (ADR 018). Tap, drag or
 * use the arrow keys to pick a day; the list above shows everyone's value
 * on it, and doubles as the legend.
 */
export function ValueChart({
  dates,
  dayLabels,
  series,
  baselineCents,
}: {
  dates: string[];
  /** A label per date for the readout, e.g. "Tue 3 Nov". */
  dayLabels: string[];
  series: ValueChartSeries[];
  baselineCents: number;
}) {
  const layout = useMemo(
    () => layoutChart({ dates, series, baselineCents }),
    [dates, series, baselineCents],
  );
  const last = dates.length - 1;
  const [selected, setSelected] = useState(last);
  const day = Math.min(selected, last);
  const { plot } = layout;

  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    setSelected(nearestIndex(layout.xs, ((e.clientX - box.left) / box.width) * layout.width));
  };

  const keys: Record<string, (i: number) => number> = {
    ArrowLeft: (i) => Math.max(0, i - 1),
    ArrowRight: (i) => Math.min(last, i + 1),
    Home: () => 0,
    End: () => last,
  };

  const rows = series
    .map((s, n) => ({ s, line: layout.lines[n], value: s.values[day] }))
    .sort((a, b) => b.value - a.value || a.s.name.localeCompare(b.s.name));

  return (
    <div className="value-chart flex flex-col gap-3">
      <div aria-live="polite" className="flex flex-col gap-2">
        <p className="text-sm text-foreground/60">
          <span className="font-semibold text-foreground">{dayLabels[day]}</span>
          {last > 0 && " · tap or drag the chart to pick a day"}
        </p>
        <ul className="flex flex-col gap-1">
          {rows.map(({ s, line, value }) => (
            <li key={s.id} className="flex min-w-0 items-center gap-2">
              <svg width="14" height="4" aria-hidden className="shrink-0">
                <line
                  x1="0"
                  y1="2"
                  x2="14"
                  y2="2"
                  stroke={`var(--series-${line.slot + 1})`}
                  strokeWidth="3"
                  strokeDasharray={line.dashed ? "4 2" : undefined}
                />
              </svg>
              <span aria-hidden>{s.emoji ?? "🙂"}</span>
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              {s.stale[day] && (
                <span className="shrink-0" role="img" aria-label="Uses an old price">
                  ⏳
                </span>
              )}
              <span className="shrink-0 font-semibold tabular-nums">{formatEuroCents(value)}</span>
              <span className={`w-16 shrink-0 text-right text-sm tabular-nums ${tone(value - baselineCents)}`}>
                {formatSignedPercent((value - baselineCents) / baselineCents)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="h-auto w-full touch-pan-y select-none outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
        role="img"
        aria-label={`Value of each player from ${dayLabels[0]} to ${dayLabels[last]}. Use the arrow keys to pick a day.`}
        tabIndex={0}
        onPointerDown={pick}
        onPointerMove={(e) => (e.pointerType === "mouse" || e.buttons > 0) && pick(e)}
        onPointerLeave={(e) => e.pointerType === "mouse" && setSelected(last)}
        onKeyDown={(e) => {
          const move = keys[e.key];
          if (!move) return;
          e.preventDefault();
          setSelected(move(day));
        }}
      >
        {layout.yTicks.map((t) => (
          <g key={t.label}>
            <line x1={plot.left} x2={plot.right} y1={t.at} y2={t.at} className="stroke-foreground/10" />
            <text
              x={plot.left - 6}
              y={t.at}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="10"
              className="fill-foreground/50 tabular-nums"
            >
              {t.label}
            </text>
          </g>
        ))}
        <line
          x1={plot.left}
          x2={plot.right}
          y1={layout.baselineY}
          y2={layout.baselineY}
          strokeDasharray="4 3"
          className="stroke-foreground/50"
        />
        {layout.xTicks.map((t) => (
          <text
            key={t.at}
            x={t.at}
            y={plot.bottom + 15}
            textAnchor={t.anchor}
            fontSize="10"
            className="fill-foreground/50"
          >
            {t.label}
          </text>
        ))}

        <line
          x1={layout.xs[day]}
          x2={layout.xs[day]}
          y1={plot.top}
          y2={plot.bottom}
          className="stroke-foreground/30"
        />
        {layout.lines.map((line) => (
          <path
            key={line.id}
            d={line.path}
            fill="none"
            stroke={`var(--series-${line.slot + 1})`}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={line.dashed ? "6 3" : undefined}
          />
        ))}
        {layout.lines.map((line) => (
          <circle
            key={line.id}
            cx={line.points[day].x}
            cy={line.points[day].y}
            r="4"
            fill={`var(--series-${line.slot + 1})`}
            strokeWidth="2"
            className="stroke-background"
          />
        ))}
        {layout.lines.map((line, n) => (
          <text
            key={line.id}
            x={line.label.x}
            y={line.label.y}
            dominantBaseline="middle"
            fontSize="12"
            aria-hidden
          >
            {series[n].emoji ?? "🙂"}
          </text>
        ))}
      </svg>
    </div>
  );
}

/** Green for up, red for down, as on the leaderboard. */
function tone(cents: number): string {
  if (cents > 0) return "text-green-700 dark:text-green-400";
  if (cents < 0) return "text-red-600 dark:text-red-400";
  return "text-foreground/60";
}
