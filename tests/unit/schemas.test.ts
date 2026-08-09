import { describe, expect, it } from "vitest";

import {
  addMeasurementSchema,
  createEpisodeSchema,
  effectivenessSchema,
  emailSchema,
  passwordSchema,
  severitySchema,
  treatmentSchema,
} from "@/lib/schemas";

/**
 * These schemas are the only thing standing between a form post and the
 * database, so the cases that matter are the invalid ones.
 */

const baseEpisode = {
  startedAt: "2024-03-01T10:00",
  severity: 5,
};

describe("severitySchema", () => {
  it.each([0, 1, 5, 10])("accepts %i", (value) => {
    expect(severitySchema.parse(value)).toBe(value);
  });

  it.each([-1, 11, 3.5, Number.NaN])("rejects %s", (value) => {
    expect(severitySchema.safeParse(value).success).toBe(false);
  });

  it("rejects a missing value", () => {
    expect(severitySchema.safeParse(undefined).success).toBe(false);
  });
});

describe("effectivenessSchema", () => {
  it.each([0, 25, 50, 75, 100])("accepts %i percent", (value) => {
    expect(effectivenessSchema.parse(value)).toBe(value);
  });

  it.each([-1, 101])("rejects %i percent", (value) => {
    expect(effectivenessSchema.safeParse(value).success).toBe(false);
  });
});

describe("createEpisodeSchema", () => {
  it("accepts a minimal entry and defaults the optional fields", () => {
    const parsed = createEpisodeSchema.parse(baseEpisode);

    expect(parsed.severity).toBe(5);
    expect(parsed.endedAt).toBeNull();
    expect(parsed.painType).toBeNull();
    expect(parsed.locationIds).toEqual([]);
  });

  it("reads a datetime-local string as local time", () => {
    const parsed = createEpisodeSchema.parse(baseEpisode);
    expect(parsed.startedAt.getHours()).toBe(10);
    expect(parsed.startedAt.getMinutes()).toBe(0);
  });

  it("rejects an end time before the start time", () => {
    const result = createEpisodeSchema.safeParse({
      ...baseEpisode,
      endedAt: "2024-03-01T09:00",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["endedAt"]);
    expect(result.error?.issues[0].message).toMatch(/cannot be before/i);
  });

  it("accepts an end time equal to the start time", () => {
    // A momentary jolt is a real episode with zero duration.
    const result = createEpisodeSchema.safeParse({
      ...baseEpisode,
      endedAt: "2024-03-01T10:00",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a start time in the future", () => {
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const result = createEpisodeSchema.safeParse({
      ...baseEpisode,
      startedAt: nextWeek,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/future/i);
  });

  it("tolerates a start time a few seconds ahead, for clock skew", () => {
    const result = createEpisodeSchema.safeParse({
      ...baseEpisode,
      startedAt: new Date(Date.now() + 5_000),
    });

    expect(result.success).toBe(true);
  });

  it("rejects an unparseable date", () => {
    const result = createEpisodeSchema.safeParse({
      ...baseEpisode,
      startedAt: "not a date",
    });

    expect(result.success).toBe(false);
  });

  it("de-duplicates repeated ids so a join-table key cannot be violated", () => {
    const parsed = createEpisodeSchema.parse({
      ...baseEpisode,
      locationIds: ["a", "b", "a"],
    });

    expect(parsed.locationIds).toEqual(["a", "b"]);
  });

  it("turns blank text into null rather than empty strings", () => {
    const parsed = createEpisodeSchema.parse({
      ...baseEpisode,
      painType: "   ",
      notes: "",
    });

    expect(parsed.painType).toBeNull();
    expect(parsed.notes).toBeNull();
  });

  it("trims surrounding whitespace from text", () => {
    const parsed = createEpisodeSchema.parse({
      ...baseEpisode,
      painType: "  migraine  ",
    });

    expect(parsed.painType).toBe("migraine");
  });

  it("rejects a severity outside the scale", () => {
    expect(
      createEpisodeSchema.safeParse({ ...baseEpisode, severity: 11 }).success,
    ).toBe(false);
  });
});

describe("addMeasurementSchema", () => {
  it("allows an omitted time, meaning now", () => {
    const parsed = addMeasurementSchema.parse({ episodeId: "abc", severity: 7 });
    expect(parsed.recordedAt).toBeNull();
    expect(parsed.severity).toBe(7);
  });

  it("requires an episode id", () => {
    expect(addMeasurementSchema.safeParse({ severity: 7 }).success).toBe(false);
  });
});

describe("treatmentSchema", () => {
  it("accepts a treatment with nothing but an episode", () => {
    const parsed = treatmentSchema.parse({ episodeId: "abc" });
    expect(parsed.effectiveness).toBeNull();
    expect(parsed.medicationName).toBeNull();
  });

  it("keeps medication details when given", () => {
    const parsed = treatmentSchema.parse({
      episodeId: "abc",
      medicationName: "Ibuprofen",
      dose: "400mg",
      effectiveness: 75,
    });

    expect(parsed.medicationName).toBe("Ibuprofen");
    expect(parsed.dose).toBe("400mg");
    expect(parsed.effectiveness).toBe(75);
  });
});

describe("credentials", () => {
  it("normalises email case and whitespace", () => {
    expect(emailSchema.parse("  Me@Example.COM ")).toBe("me@example.com");
  });

  it("rejects a malformed address", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });

  it("requires a password of at least 10 characters", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("correct horse battery").success).toBe(true);
  });
});
