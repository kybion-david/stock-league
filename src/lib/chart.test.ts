import { describe, expect, it } from "vitest";
import {
  dateTickIndexes,
  dayLabel,
  formatAxisEuros,
  layoutChart,
  nearestIndex,
  niceStep,
  spreadLabels,
  valueDomain,
} from "@/lib/chart";

const series = (id: number, values: number[]) => ({ id, name: `P${id}`, emoji: null, values });

describe("valueDomain", () => {
  it("rounds the range out to a nice step", () => {
    expect(valueDomain(96_120, 104_380)).toEqual({ min: 95_000, max: 105_000, step: 2_500 });
  });

  it("keeps at least €20 of range when everyone is level", () => {
    expect(valueDomain(100_000, 100_000)).toEqual({ min: 99_000, max: 101_000, step: 500 });
  });
});

describe("niceStep", () => {
  it("picks 1, 2, 2.5 or 5 times a power of ten", () => {
    expect(niceStep(500)).toBe(500);
    expect(niceStep(501)).toBe(1_000);
    expect(niceStep(2_100)).toBe(2_500);
    expect(niceStep(31_000)).toBe(50_000);
    expect(niceStep(60_000)).toBe(100_000);
  });
});

describe("dateTickIndexes", () => {
  it("labels every day up to four, then four spread out", () => {
    expect(dateTickIndexes(1)).toEqual([0]);
    expect(dateTickIndexes(3)).toEqual([0, 1, 2]);
    expect(dateTickIndexes(30)).toEqual([0, 10, 19, 29]);
  });
});

describe("spreadLabels", () => {
  it("leaves labels that are far enough apart alone", () => {
    expect(spreadLabels([50, 10, 100], 15, 0, 200)).toEqual([50, 10, 100]);
  });

  it("pushes close labels apart around where they want to be", () => {
    expect(spreadLabels([100, 100, 105], 15, 0, 200)).toEqual([100, 115, 130]);
  });

  it("pushes labels back inside the bottom edge", () => {
    expect(spreadLabels([198, 199], 15, 0, 200)).toEqual([185, 200]);
  });
});

describe("nearestIndex", () => {
  it("snaps to the closest date", () => {
    expect(nearestIndex([10, 20, 30], 24)).toBe(1);
    expect(nearestIndex([10, 20, 30], -5)).toBe(0);
    expect(nearestIndex([10, 20, 30], 99)).toBe(2);
  });
});

describe("formatting", () => {
  it("shows whole euros on the axis and short days on the time axis", () => {
    expect(formatAxisEuros(104_500)).toBe("€1,045");
    expect(formatAxisEuros(97_250)).toBe("€973");
    expect(dayLabel("2026-11-03")).toBe("3 Nov");
  });
});

describe("layoutChart", () => {
  it("works with a single day: one centred point per player", () => {
    const layout = layoutChart({
      dates: ["2026-11-01"],
      series: [series(1, [100_000]), series(2, [100_000])],
      baselineCents: 100_000,
    });
    const centre = (layout.plot.left + layout.plot.right) / 2;
    expect(layout.xs).toEqual([centre]);
    expect(layout.xTicks).toEqual([{ at: centre, label: "1 Nov", anchor: "middle" }]);
    expect(layout.lines.map((l) => l.path)).toEqual([
      `M${centre} ${layout.baselineY}`,
      `M${centre} ${layout.baselineY}`,
    ]);
    // Level players' emoji labels don't sit on top of each other.
    const [a, b] = layout.lines.map((l) => l.label.y);
    expect(Math.abs(a - b)).toBeGreaterThanOrEqual(15);
  });

  it("spans the plot, puts the baseline inside it and keeps higher values higher", () => {
    const layout = layoutChart({
      dates: ["2026-11-01", "2026-11-02", "2026-11-03"],
      series: [series(1, [100_000, 103_000, 104_000]), series(2, [100_000, 98_000, 97_000])],
      baselineCents: 100_000,
    });
    const { left, right, top, bottom } = layout.plot;
    expect(layout.xs).toEqual([left, (left + right) / 2, right]);
    expect(layout.baselineY).toBeGreaterThan(top);
    expect(layout.baselineY).toBeLessThan(bottom);
    const [up, down] = layout.lines;
    expect(up.points[2].y).toBeLessThan(layout.baselineY);
    expect(down.points[2].y).toBeGreaterThan(layout.baselineY);
    expect(layout.yTicks.map((t) => t.label)).toEqual(["€960", "€980", "€1,000", "€1,020", "€1,040"]);
    expect(layout.xTicks.map((t) => t.anchor)).toEqual(["start", "middle", "end"]);
  });

  it("gives colours by player id, not by order or rank, and dashes past eight", () => {
    const ids = [9, 3, 1, 4, 5, 2, 6, 7, 8];
    const layout = layoutChart({
      dates: ["2026-11-01"],
      series: ids.map((id) => series(id, [100_000 + id])),
      baselineCents: 100_000,
    });
    expect(layout.lines.map((l) => [l.id, l.slot, l.dashed])).toEqual([
      [9, 0, true],
      [3, 2, false],
      [1, 0, false],
      [4, 3, false],
      [5, 4, false],
      [2, 1, false],
      [6, 5, false],
      [7, 6, false],
      [8, 7, false],
    ]);
  });

  it("refuses a chart without days", () => {
    expect(() => layoutChart({ dates: [], series: [], baselineCents: 100_000 })).toThrow(RangeError);
  });
});
