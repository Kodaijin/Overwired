import { describe, expect, it } from "vitest";

import {
  averageByPeriod,
  computeStatistics,
  countBy,
  mean,
  severityTrend,
  summariseTreatments,
  type StatsEpisode,
} from "@/lib/statistics";

const at = (iso: string) => new Date(iso);

function episode(overrides: Partial<StatsEpisode> = {}): StatsEpisode {
  return {
    id: "e1",
    startedAt: at("2024-03-01T10:00:00Z"),
    endedAt: at("2024-03-01T12:00:00Z"),
    measurements: [{ recordedAt: at("2024-03-01T10:00:00Z"), severity: 5 }],
    locations: [],
    characteristics: [],
    triggers: [],
    symptoms: [],
    treatments: [],
    ...overrides,
  };
}

describe("computeStatistics", () => {
  it("summarises an empty history without dividing by zero", () => {
    const stats = computeStatistics([]);

    expect(stats.episodeCount).toBe(0);
    expect(stats.averageSeverity).toBeNull();
    expect(stats.highestSeverity).toBeNull();
    expect(stats.totalDurationSeconds).toBe(0);
    expect(stats.averageDurationSeconds).toBeNull();
    expect(stats.longestEpisode).toBeNull();
  });

  it("counts episodes and readings across the set", () => {
    const stats = computeStatistics([
      episode({
        id: "a",
        measurements: [
          { recordedAt: at("2024-03-01T10:00:00Z"), severity: 4 },
          { recordedAt: at("2024-03-01T11:00:00Z"), severity: 8 },
        ],
      }),
      episode({
        id: "b",
        measurements: [{ recordedAt: at("2024-03-02T10:00:00Z"), severity: 6 }],
      }),
    ]);

    expect(stats.episodeCount).toBe(2);
    expect(stats.measurementCount).toBe(3);
    expect(stats.averageSeverity).toBe(6);
    expect(stats.highestSeverity).toBe(8);
    expect(stats.lowestSeverity).toBe(4);
  });

  it("counts elapsed time for an ongoing episode up to now", () => {
    const now = at("2024-03-01T13:00:00Z");
    const stats = computeStatistics(
      [episode({ startedAt: at("2024-03-01T10:00:00Z"), endedAt: null })],
      now,
    );

    expect(stats.totalDurationSeconds).toBe(3 * 3600);
    expect(stats.activeCount).toBe(1);
  });

  it("identifies the longest episode", () => {
    const now = at("2024-03-05T00:00:00Z");
    const stats = computeStatistics(
      [
        episode({
          id: "short",
          startedAt: at("2024-03-01T10:00:00Z"),
          endedAt: at("2024-03-01T11:00:00Z"),
        }),
        episode({
          id: "long",
          startedAt: at("2024-03-02T10:00:00Z"),
          endedAt: at("2024-03-03T10:00:00Z"),
        }),
      ],
      now,
    );

    expect(stats.longestEpisode?.id).toBe("long");
    expect(stats.longestEpisode?.durationSeconds).toBe(86400);
    expect(stats.averageDurationSeconds).toBe((3600 + 86400) / 2);
  });

  it("ranks the most common tags", () => {
    const stats = computeStatistics([
      episode({ id: "a", locations: ["Lower back", "Neck"] }),
      episode({ id: "b", locations: ["Lower back"] }),
      episode({ id: "c", locations: ["Lower back", "Neck"] }),
    ]);

    expect(stats.topLocations).toEqual([
      { name: "Lower back", count: 3 },
      { name: "Neck", count: 2 },
    ]);
  });
});

describe("countBy", () => {
  it("sorts by count then alphabetically for a stable order", () => {
    expect(countBy(["b", "a", "c", "a", "b"])).toEqual([
      { name: "a", count: 2 },
      { name: "b", count: 2 },
      { name: "c", count: 1 },
    ]);
  });

  it("returns nothing for no input", () => {
    expect(countBy([])).toEqual([]);
  });
});

describe("summariseTreatments", () => {
  it("averages only the entries that were actually rated", () => {
    const summary = summariseTreatments([
      { name: "Ibuprofen", effectiveness: 50 },
      { name: "Ibuprofen", effectiveness: 100 },
      // Used but never rated: counts as a use, not as a zero.
      { name: "Ibuprofen", effectiveness: null },
      { name: "Heat", effectiveness: null },
    ]);

    expect(summary[0]).toEqual({
      name: "Ibuprofen",
      uses: 3,
      rated: 2,
      averageEffectiveness: 75,
    });
    expect(summary[1]).toEqual({
      name: "Heat",
      uses: 1,
      rated: 0,
      averageEffectiveness: null,
    });
  });
});

describe("averageByPeriod", () => {
  const measurements = [
    { recordedAt: at("2024-03-01T09:00:00"), severity: 4 },
    { recordedAt: at("2024-03-01T21:00:00"), severity: 8 },
    { recordedAt: at("2024-03-03T09:00:00"), severity: 6 },
  ];

  it("averages readings within each day", () => {
    const points = averageByPeriod(measurements, "day");

    expect(points).toHaveLength(2);
    expect(points[0].averageSeverity).toBe(6);
    expect(points[0].maxSeverity).toBe(8);
    expect(points[0].measurementCount).toBe(2);
  });

  it("leaves out days with no readings rather than plotting them as zero", () => {
    // 2 March has no readings; it must not appear as a pain-free day.
    const points = averageByPeriod(measurements, "day");
    expect(points.map((point) => point.key)).toEqual(["2024-03-01", "2024-03-03"]);
  });

  it("collapses readings into one bucket per week and month", () => {
    expect(averageByPeriod(measurements, "week")).toHaveLength(1);
    expect(averageByPeriod(measurements, "month")).toHaveLength(1);
    expect(averageByPeriod(measurements, "month")[0].averageSeverity).toBe(6);
  });

  it("returns nothing for no readings", () => {
    expect(averageByPeriod([], "day")).toEqual([]);
  });
});

describe("severityTrend", () => {
  const now = at("2024-03-15T12:00:00Z");

  it("compares the recent window against the one before it", () => {
    const trend = severityTrend(
      [
        { recordedAt: at("2024-03-14T12:00:00Z"), severity: 8 },
        { recordedAt: at("2024-03-05T12:00:00Z"), severity: 4 },
      ],
      7,
      now,
    );

    expect(trend.current).toBe(8);
    expect(trend.previous).toBe(4);
    expect(trend.change).toBe(4);
  });

  it("reports no change when there is nothing to compare against", () => {
    const trend = severityTrend(
      [{ recordedAt: at("2024-03-14T12:00:00Z"), severity: 8 }],
      7,
      now,
    );

    expect(trend.current).toBe(8);
    expect(trend.previous).toBeNull();
    expect(trend.change).toBeNull();
  });

  it("ignores readings older than both windows", () => {
    const trend = severityTrend(
      [{ recordedAt: at("2023-01-01T12:00:00Z"), severity: 10 }],
      7,
      now,
    );

    expect(trend.current).toBeNull();
    expect(trend.previous).toBeNull();
  });
});

describe("mean", () => {
  it("returns null for an empty set rather than zero", () => {
    expect(mean([])).toBeNull();
  });

  it("rounds to two decimals", () => {
    expect(mean([1, 2, 2])).toBe(1.67);
  });
});
