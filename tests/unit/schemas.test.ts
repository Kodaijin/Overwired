import { describe, expect, it } from "vitest";

import {
  addMeasurementSchema,
  addTreatmentsSchema,
  createEpisodeSchema,
  effectivenessSchema,
  emailSchema,
  passwordSchema,
  severitySchema,
  treatmentSchema,
  updateEpisodeSchema,
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

describe("updateEpisodeSchema", () => {
  const baseUpdate = {
    id: "ep1",
    startedAt: "2024-03-01T10:00",
  };

  it("leaves both boundary levels null when they are not given", () => {
    const parsed = updateEpisodeSchema.parse(baseUpdate);
    expect(parsed.startSeverity).toBeNull();
    expect(parsed.endSeverity).toBeNull();
  });

  it("accepts corrections to the start and end levels", () => {
    const parsed = updateEpisodeSchema.parse({
      ...baseUpdate,
      endedAt: "2024-03-01T14:00",
      startSeverity: 6,
      endSeverity: 2,
    });

    expect(parsed.startSeverity).toBe(6);
    expect(parsed.endSeverity).toBe(2);
  });

  it("keeps zero, which is a real pain level and not an absent one", () => {
    const parsed = updateEpisodeSchema.parse({
      ...baseUpdate,
      endedAt: "2024-03-01T14:00",
      startSeverity: 0,
      endSeverity: 0,
    });

    expect(parsed.startSeverity).toBe(0);
    expect(parsed.endSeverity).toBe(0);
  });

  it("refuses an ending level on an episode that has not ended", () => {
    const result = updateEpisodeSchema.safeParse({ ...baseUpdate, endSeverity: 3 });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["endSeverity"]);
  });

  it("rejects a boundary level outside the scale", () => {
    expect(
      updateEpisodeSchema.safeParse({ ...baseUpdate, startSeverity: 11 }).success,
    ).toBe(false);
    expect(
      updateEpisodeSchema.safeParse({ ...baseUpdate, startSeverity: -1 }).success,
    ).toBe(false);
  });

  it("still enforces the episode's chronology", () => {
    const result = updateEpisodeSchema.safeParse({
      ...baseUpdate,
      endedAt: "2024-03-01T09:00",
      startSeverity: 5,
    });

    expect(result.success).toBe(false);
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
  it("accepts a treatment identified only by its type", () => {
    const parsed = treatmentSchema.parse({ episodeId: "abc", treatmentTypeId: "heat" });
    expect(parsed.effectiveness).toBeNull();
    expect(parsed.medicationName).toBeNull();
  });

  it("accepts a treatment identified only by name", () => {
    const parsed = treatmentSchema.parse({ episodeId: "abc", medicationName: "Ibuprofen" });
    expect(parsed.treatmentTypeId).toBeNull();
  });

  it("rejects a treatment that says nothing about what was tried", () => {
    const result = treatmentSchema.safeParse({ episodeId: "abc" });
    expect(result.success).toBe(false);
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

describe("addTreatmentsSchema", () => {
  const entry = (extra: Record<string, unknown> = {}) => ({
    treatmentTypeId: "medication",
    medicationName: "Ibuprofen",
    ...extra,
  });

  it("accepts several treatments at once and keeps them separate", () => {
    const parsed = addTreatmentsSchema.parse({
      episodeId: "abc",
      treatments: [
        entry({ dose: "400mg", effectiveness: 75 }),
        { treatmentTypeId: "heat", notes: "20 minutes" },
        { medicationName: "Lay down in the dark" },
      ],
    });

    expect(parsed.treatments).toHaveLength(3);
    expect(parsed.treatments[0].dose).toBe("400mg");
    expect(parsed.treatments[0].effectiveness).toBe(75);
    expect(parsed.treatments[1].notes).toBe("20 minutes");
    expect(parsed.treatments[2].treatmentTypeId).toBeNull();
  });

  it("keeps each row's time independent", () => {
    const parsed = addTreatmentsSchema.parse({
      episodeId: "abc",
      treatments: [
        entry({ takenAt: "2024-03-01T14:30" }),
        entry({ medicationName: "Paracetamol" }),
      ],
    });

    expect(parsed.treatments[0].takenAt).toEqual(new Date("2024-03-01T14:30"));
    // Blank means "now", decided at write time rather than here.
    expect(parsed.treatments[1].takenAt).toBeNull();
  });

  it("rejects the whole submission when one row is blank", () => {
    const result = addTreatmentsSchema.safeParse({
      episodeId: "abc",
      treatments: [entry(), {}],
    });

    expect(result.success).toBe(false);
    // The path identifies the offending row so the form can name it.
    expect(result.error?.issues[0]?.path).toEqual(["treatments", 1, "treatmentTypeId"]);
  });

  it("rejects a submission with no treatments at all", () => {
    expect(
      addTreatmentsSchema.safeParse({ episodeId: "abc", treatments: [] }).success,
    ).toBe(false);
  });

  it("refuses an implausible number of rows", () => {
    const result = addTreatmentsSchema.safeParse({
      episodeId: "abc",
      treatments: Array.from({ length: 11 }, () => entry()),
    });

    expect(result.success).toBe(false);
  });

  it("reports a bad value against the row it came from", () => {
    const result = addTreatmentsSchema.safeParse({
      episodeId: "abc",
      treatments: [entry(), entry({ effectiveness: 150 })],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["treatments", 1, "effectiveness"]);
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
