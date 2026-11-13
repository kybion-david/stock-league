// Value-over-time chart geometry (ticket 015, ADR 018). Pure layout math:
// scales, ticks, line paths and end labels in SVG user units. The page draws
// it as plain SVG, so the chart needs no library (ADR 018).

/** One player's line: value in cents for every date of the chart, in order. */
export interface ChartSeries {
  id: number;
  name: string;
  emoji: string | null;
  values: number[];
}

export interface ChartInput {
  /** Consecutive `YYYY-MM-DD` days, oldest first. At least one. */
  dates: string[];
  series: ChartSeries[];
  /** Value of the reference line (the stake), in cents. */
  baselineCents: number;
  /** The market benchmark's value per date (ADR 025), drawn as its own grey line. */
  market?: number[];
}

export interface Point {
  x: number;
  y: number;
}

export interface ChartLine {
  id: number;
  /** Colour slot 0–7, fixed per player (by id), never by rank. */
  slot: number;
  /** Dashed when the 8 colours have run out and a slot is reused. */
  dashed: boolean;
  /** SVG path through every point (`M … L …`). */
  path: string;
  points: Point[];
  /** Where the emoji label at the end of the line goes (`y` de-overlapped). */
  label: Point;
}

export interface Tick {
  /** x for date ticks, y for value ticks. */
  at: number;
  label: string;
  anchor?: "start" | "middle" | "end";
}

export interface ChartLayout {
  width: number;
  height: number;
  plot: { left: number; right: number; top: number; bottom: number };
  /** x of each date. */
  xs: number[];
  xTicks: Tick[];
  yTicks: Tick[];
  baselineY: number;
  lines: ChartLine[];
  /** The market benchmark's line, or null without one. */
  market: MarketLine | null;
}

export interface MarketLine {
  path: string;
  points: Point[];
  label: Point;
}

export const SLOT_COUNT = 8;

const WIDTH = 340;
const HEIGHT = 220;
const PLOT = { left: 48, right: WIDTH - 26, top: 10, bottom: HEIGHT - 22 };
/** Smallest value range shown (€20), so a flat start isn't blown up into noise. */
const MIN_SPAN_CENTS = 2_000;
const LABEL_GAP = 15;

/** Lays the chart out in a fixed 340 × 220 viewBox that scales to the screen width. */
export function layoutChart({ dates, series, baselineCents, market }: ChartInput): ChartLayout {
  if (dates.length === 0) throw new RangeError("A chart needs at least one day");
  const { left, right, top, bottom } = PLOT;

  const xs = dates.map((_, i) =>
    dates.length === 1 ? (left + right) / 2 : left + (i * (right - left)) / (dates.length - 1),
  );

  const values = series
    .flatMap((s) => s.values)
    .concat(market ?? [])
    .concat(baselineCents);
  const { min, max, step } = valueDomain(Math.min(...values), Math.max(...values));
  const y = (cents: number) => bottom - ((cents - min) / (max - min)) * (bottom - top);

  const yTicks: Tick[] = [];
  for (let v = min; v <= max; v += step) yTicks.push({ at: y(v), label: formatAxisEuros(v) });

  const slots = slotsById(series.map((s) => s.id));
  const lines = series.map((s) => {
    const points = s.values.map((v, i) => ({ x: xs[i], y: y(v) }));
    const end = points[points.length - 1];
    const slot = slots.get(s.id) ?? 0;
    return {
      id: s.id,
      slot: slot % SLOT_COUNT,
      dashed: slot >= SLOT_COUNT,
      path: pathThrough(points),
      points,
      label: { x: end.x + 12, y: end.y },
    };
  });
  const marketLine = market ? lineThrough(market.map((v, i) => ({ x: xs[i], y: y(v) }))) : null;
  const labelled = marketLine ? [...lines, marketLine] : lines;
  const spread = spreadLabels(
    labelled.map((l) => l.label.y),
    LABEL_GAP,
    top,
    bottom,
  );
  labelled.forEach((l, i) => (l.label.y = spread[i]));

  return {
    width: WIDTH,
    height: HEIGHT,
    plot: PLOT,
    xs,
    xTicks: dateTickIndexes(dates.length).map((i, n, all) => ({
      at: xs[i],
      label: dayLabel(dates[i]),
      anchor: all.length === 1 ? "middle" : n === 0 ? "start" : n === all.length - 1 ? "end" : "middle",
    })),
    yTicks,
    baselineY: y(baselineCents),
    lines,
    market: marketLine,
  };
}

function lineThrough(points: Point[]): MarketLine {
  const end = points[points.length - 1];
  return { path: pathThrough(points), points, label: { x: end.x + 12, y: end.y } };
}

function pathThrough(points: readonly Point[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${round(p.x)} ${round(p.y)}`).join(" ");
}

/** A rounded value range (in cents) with a step that gives 3–6 gridlines. */
export function valueDomain(minCents: number, maxCents: number) {
  const span = Math.max(maxCents - minCents, MIN_SPAN_CENTS);
  const mid = (minCents + maxCents) / 2;
  const step = niceStep(span / 4);
  return {
    min: Math.floor((mid - span / 2) / step) * step,
    max: Math.ceil((mid + span / 2) / step) * step,
    step,
  };
}

/** The smallest of 1, 2, 2.5 or 5 × 10ⁿ cents that is at least `raw`. */
export function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? 10 * power;
}

/** Which dates get an axis label: all of them up to 4, else first, last and two between. */
export function dateTickIndexes(count: number): number[] {
  if (count <= 4) return Array.from({ length: count }, (_, i) => i);
  return [0, 1, 2, 3].map((k) => Math.round((k * (count - 1)) / 3));
}

/**
 * Moves label positions apart so no two are closer than `gap`, staying
 * within [min, max] and as close to where they want to be as that allows.
 * Returns the new positions in the input order.
 */
export function spreadLabels(wanted: readonly number[], gap: number, min: number, max: number) {
  const order = wanted.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y || a.i - b.i);
  const ys = order.map((o) => o.y);
  for (let k = 0; k < ys.length; k++) ys[k] = Math.max(ys[k], k === 0 ? min : ys[k - 1] + gap);
  for (let k = ys.length - 1; k >= 0; k--) {
    ys[k] = Math.min(ys[k], k === ys.length - 1 ? max : ys[k + 1] - gap);
  }
  const result: number[] = new Array(wanted.length);
  order.forEach((o, k) => (result[o.i] = ys[k]));
  return result;
}

/** Colour slots by player id, so a player keeps their colour when others join. */
function slotsById(ids: readonly number[]): Map<number, number> {
  return new Map([...ids].sort((a, b) => a - b).map((id, slot) => [id, slot]));
}

/** The index of the date nearest to `x` (in viewBox units). */
export function nearestIndex(xs: readonly number[], x: number): number {
  let best = 0;
  xs.forEach((xi, i) => {
    if (Math.abs(xi - x) < Math.abs(xs[best] - x)) best = i;
  });
  return best;
}

const axisEuros = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** Whole euros for the value axis, e.g. 105000 → "€1,050". */
export function formatAxisEuros(cents: number): string {
  return axisEuros.format(Math.round(cents / 100));
}

const shortDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** A date for the time axis, e.g. "3 Nov". */
export function dayLabel(date: string): string {
  return shortDay.format(new Date(`${date}T00:00:00Z`));
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
