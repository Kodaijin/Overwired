import { describe, expect, it } from "vitest";

import {
  computeAggregates,
  computeEpisodeCache,
  sortMeasurements,
} from "@/lib/episode-metrics";

const at = (iso: string) => new Date(iso);

const reading = (iso: string, severity: number, createdAt?: string) => ({
  recordedAt: at(iso),
  severity,
  ...(createdAt ? { createdAt: at(createdAt) } : {}),
});

describe("computeAggregates", () => {
  it("derives peak, minimum, current and average from the timeline", () => {
    // The worked example from the spec: 4 -> 6 -> 8 -> 7 -> 4
    const measurements = [
      reading("2024-03-01T10:00:00Z", 4),
      reading("2024-03-01T10:30:00Z", 6),
      reading("2024-03-01T11:15:00Z", 8),
      reading("2024-03-01T12:00:00Z", 7),
      reading("2024-03-01T13:30:00Z", 4),
    ];

    expect(computeAggregates(measurements)).toEqual({
      currentSeverity: 4,
      peakSeverity: 8,
      minSeverity: 4,
      averageSeverity: 5.8,
      measurementCount: 5,
    });
  });

  it("treats the latest reading in time as current, not the last in the array", () => {
    // A back-dated reading entered after the fact must not become "current".
    const measurements = [
      reading("2024-03-01T12:00:00Z", 7),
      reading("2024-03-01T09:00:00Z", 2),
    ];

    expect(computeAggregates(measurements).currentSeverity).toBe(7);
  });

  it("breaks ties on recordedAt using insertion order", () => {
    const measurements = [
      reading("2024-03-01T10:00:00Z", 5, "2024-03-01T10:00:01Z"),
      reading("2024-03-01T10:00:00Z", 9, "2024-03-01T10:00:02Z"),
    ];

    expect(computeAggregates(measurements).currentSeverity).toBe(9);
  });

  it("returns nulls rather than zeros when there are no readings", () => {
    expect(computeAggregates([])).toEqual({
      currentSeverity: null,
      peakSeverity: null,
      minSeverity: null,
      averageSeverity: null,
      measurementCount: 0,
    });
  });

  it("handles a single reading", () => {
    expect(computeAggregates([reading("2024-03-01T10:00:00Z", 6)])).toEqual({
      currentSeverity: 6,
      peakSeverity: 6,
      minSeverity: 6,
      averageSeverity: 6,
      measurementCount: 1,
    });
  });

  it("keeps a severity of 0 distinct from no reading at all", () => {
    const aggregates = computeAggregates([reading("2024-03-01T10:00:00Z", 0)]);
    expect(aggregates.currentSeverity).toBe(0);
    expect(aggregates.measurementCount).toBe(1);
  });

  it("rounds the average to two decimals", () => {
    const measurements = [
      reading("2024-03-01T10:00:00Z", 1),
      reading("2024-03-01T11:00:00Z", 2),
      reading("2024-03-01T12:00:00Z", 2),
    ];
    expect(computeAggregates(measurements).averageSeverity).toBe(1.67);
  });

  it("does not mutate the input array", () => {
    const measurements = [
      reading("2024-03-01T12:00:00Z", 7),
      reading("2024-03-01T09:00:00Z", 2),
    ];
    const snapshot = [...measurements];
    computeAggregates(measurements);
    expect(measurements).toEqual(snapshot);
  });
});

describe("sortMeasurements", () => {
  it("orders chronologically", () => {
    const sorted = sortMeasurements([
      reading("2024-03-01T12:00:00Z", 7),
      reading("2024-03-01T09:00:00Z", 2),
      reading("2024-03-01T10:30:00Z", 5),
    ]);

    expect(sorted.map((m) => m.severity)).toEqual([2, 5, 7]);
  });
});

describe("computeEpisodeCache", () => {
  it("stores a fixed duration once the episode has ended", () => {
    const cache = computeEpisodeCache(
      {
        startedAt: at("2024-03-01T10:00:00Z"),
        endedAt: at("2024-03-01T12:00:00Z"),
      },
      [reading("2024-03-01T10:00:00Z", 5)],
    );

    expect(cache.durationSeconds).toBe(7200);
  });

  it("leaves duration null while the episode is ongoing", () => {
    // A cached number here could be mistaken for a final duration.
    const cache = computeEpisodeCache(
      { startedAt: at("2024-03-01T10:00:00Z"), endedAt: null },
      [reading("2024-03-01T10:00:00Z", 5)],
    );

    expect(cache.durationSeconds).toBeNull();
    expect(cache.currentSeverity).toBe(5);
  });
});
