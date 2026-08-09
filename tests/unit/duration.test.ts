import { describe, expect, it } from "vitest";

import {
  durationSeconds,
  formatDuration,
  formatDurationLong,
  isOngoing,
} from "@/lib/duration";

const at = (iso: string) => new Date(iso);

describe("durationSeconds", () => {
  it("measures a completed episode from start to end", () => {
    expect(
      durationSeconds({
        startedAt: at("2024-03-01T10:00:00Z"),
        endedAt: at("2024-03-01T12:30:00Z"),
      }),
    ).toBe(2.5 * 60 * 60);
  });

  it("measures an ongoing episode against the current time", () => {
    const now = at("2024-03-01T13:00:00Z");
    expect(
      durationSeconds({ startedAt: at("2024-03-01T10:00:00Z"), endedAt: null }, now),
    ).toBe(3 * 60 * 60);
  });

  it("treats a missing end date the same as an explicit null", () => {
    const now = at("2024-03-01T11:00:00Z");
    expect(durationSeconds({ startedAt: at("2024-03-01T10:00:00Z") }, now)).toBe(3600);
  });

  it("keeps sub-second precision out of the result", () => {
    expect(
      durationSeconds({
        startedAt: at("2024-03-01T10:00:00.000Z"),
        endedAt: at("2024-03-01T10:00:01.900Z"),
      }),
    ).toBe(1);
  });

  it("floors an end-before-start at zero rather than reporting negative time", () => {
    expect(
      durationSeconds({
        startedAt: at("2024-03-01T12:00:00Z"),
        endedAt: at("2024-03-01T10:00:00Z"),
      }),
    ).toBe(0);
  });

  it("spans multi-day episodes", () => {
    expect(
      durationSeconds({
        startedAt: at("2024-03-01T10:00:00Z"),
        endedAt: at("2024-03-04T10:00:00Z"),
      }),
    ).toBe(3 * 24 * 60 * 60);
  });
});

describe("isOngoing", () => {
  it("is true only while there is no end date", () => {
    expect(isOngoing({ endedAt: null })).toBe(true);
    expect(isOngoing({})).toBe(true);
    expect(isOngoing({ endedAt: at("2024-03-01T10:00:00Z") })).toBe(false);
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0s"],
    [45, "45s"],
    [60, "1m"],
    [90, "1m"],
    [45 * 60, "45m"],
    [60 * 60, "1h"],
    [2 * 60 * 60 + 15 * 60, "2h 15m"],
    [24 * 60 * 60, "1d"],
    [3 * 24 * 60 * 60 + 4 * 60 * 60, "3d 4h"],
  ])("formats %i seconds as %s", (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  it("shows at most two units", () => {
    // 3 days, 4 hours, 5 minutes - the minutes are dropped.
    expect(formatDuration(3 * 86400 + 4 * 3600 + 5 * 60)).toBe("3d 4h");
  });

  it("degrades safely on nonsense input", () => {
    expect(formatDuration(-10)).toBe("0m");
    expect(formatDuration(Number.NaN)).toBe("0m");
  });
});

describe("formatDurationLong", () => {
  it("spells units out for screen readers", () => {
    expect(formatDurationLong(2 * 3600 + 15 * 60)).toBe("2 hours 15 minutes");
    expect(formatDurationLong(3600)).toBe("1 hour");
    expect(formatDurationLong(60)).toBe("1 minute");
    expect(formatDurationLong(1)).toBe("1 second");
  });
});
