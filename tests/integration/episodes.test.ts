import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { parseEpisodeFilter } from "@/lib/filters";
import { seedDefaultTaxonomy } from "@/lib/taxonomy";
import {
  addMeasurement,
  addTreatment,
  addTreatments,
  createEpisode,
  deleteEpisode,
  deleteMeasurement,
  endEpisode,
  EpisodeNotFoundError,
  getEpisode,
  listEpisodes,
  reopenEpisode,
  updateEpisode,
  WindowConflictError,
  type TreatmentEntry,
  type UpdateEpisodeData,
} from "@/server/episodes";

/**
 * End-to-end exercise of the episode data layer against a real database.
 *
 * This is the layer the server actions delegate to; the actions themselves add
 * only authentication, validation and cache invalidation. Running against real
 * SQL is what makes the cascade rules, the ownership scoping and the derived
 * severity cache genuinely verified rather than assumed.
 */

const runIfDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip;

const at = (iso: string) => new Date(iso);

runIfDatabase("episode lifecycle", () => {
  let userId: string;
  let otherUserId: string;
  let locationId: string;
  let characteristicId: string;
  let treatmentTypeId: string;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [testEmail(), otherEmail()] } },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // A fresh pair of accounts per test keeps them independent, and deleting
    // the user cascades to everything they own.
    await prisma.user.deleteMany({
      where: { email: { in: [testEmail(), otherEmail()] } },
    });

    userId = await createTestUser(testEmail());
    otherUserId = await createTestUser(otherEmail());

    const location = await prisma.location.findFirst({
      where: { userId, slug: "lower-back" },
      select: { id: true },
    });
    const characteristic = await prisma.characteristic.findFirst({
      where: { userId, slug: "burning" },
      select: { id: true },
    });
    const treatmentType = await prisma.treatmentType.findFirst({
      where: { userId, slug: "medication" },
      select: { id: true },
    });

    locationId = location!.id;
    characteristicId = characteristic!.id;
    treatmentTypeId = treatmentType!.id;
  });

  describe("creating an episode", () => {
    it("stores the episode and seeds the timeline with its first reading", async () => {
      const id = await createEpisode(userId, {
        startedAt: at("2024-03-01T10:00:00Z"),
        endedAt: null,
        severity: 6,
        painType: "flare-up",
        description: null,
        notes: null,
        locationIds: [locationId],
        characteristicIds: [characteristicId],
        triggerIds: [],
        symptomIds: [],
      });

      const episode = await getEpisode(userId, id);

      expect(episode).not.toBeNull();
      expect(episode!.painType).toBe("flare-up");
      expect(episode!.endedAt).toBeNull();
      expect(episode!.measurements).toHaveLength(1);
      expect(episode!.measurements[0].severity).toBe(6);
      expect(episode!.locations[0].location.id).toBe(locationId);
      expect(episode!.characteristics[0].characteristic.id).toBe(characteristicId);
    });

    it("caches the derived severities and leaves duration null while ongoing", async () => {
      const id = await createEpisode(userId, baseEpisode({ severity: 6 }));
      const episode = await getEpisode(userId, id);

      expect(episode!.currentSeverity).toBe(6);
      expect(episode!.peakSeverity).toBe(6);
      expect(episode!.minSeverity).toBe(6);
      expect(episode!.durationSeconds).toBeNull();
    });

    it("ignores taxonomy ids belonging to another account", async () => {
      const foreignLocation = await prisma.location.findFirst({
        where: { userId: otherUserId },
        select: { id: true },
      });

      const id = await createEpisode(
        userId,
        baseEpisode({ locationIds: [foreignLocation!.id] }),
      );

      const episode = await getEpisode(userId, id);
      expect(episode!.locations).toHaveLength(0);
    });
  });

  describe("updating pain severity", () => {
    it("appends readings without altering earlier ones", async () => {
      const id = await createEpisode(
        userId,
        baseEpisode({ startedAt: at("2024-03-01T10:00:00Z"), severity: 4 }),
      );

      await addMeasurement(userId, {
        episodeId: id,
        severity: 6,
        recordedAt: at("2024-03-01T10:30:00Z"),
        note: null,
      });
      await addMeasurement(userId, {
        episodeId: id,
        severity: 8,
        recordedAt: at("2024-03-01T11:15:00Z"),
        note: "peaked",
      });
      await addMeasurement(userId, {
        episodeId: id,
        severity: 4,
        recordedAt: at("2024-03-01T13:30:00Z"),
        note: null,
      });

      const episode = await getEpisode(userId, id);

      expect(episode!.measurements.map((m) => m.severity)).toEqual([4, 6, 8, 4]);
      expect(episode!.currentSeverity).toBe(4);
      expect(episode!.peakSeverity).toBe(8);
      expect(episode!.minSeverity).toBe(4);
    });

    it("keeps peak severity after the pain subsides", async () => {
      const id = await createEpisode(
        userId,
        baseEpisode({ startedAt: at("2024-03-01T10:00:00Z"), severity: 9 }),
      );

      await addMeasurement(userId, {
        episodeId: id,
        severity: 1,
        recordedAt: at("2024-03-01T14:00:00Z"),
        note: null,
      });

      const episode = await getEpisode(userId, id);
      expect(episode!.peakSeverity).toBe(9);
      expect(episode!.currentSeverity).toBe(1);
    });

    it("refuses a reading from before the episode started", async () => {
      const id = await createEpisode(
        userId,
        baseEpisode({ startedAt: at("2024-03-01T10:00:00Z") }),
      );

      await expect(
        addMeasurement(userId, {
          episodeId: id,
          severity: 5,
          recordedAt: at("2024-03-01T09:00:00Z"),
          note: null,
        }),
      ).rejects.toBeInstanceOf(WindowConflictError);
    });

    it("will not add a reading to somebody else's episode", async () => {
      const id = await createEpisode(userId, baseEpisode());

      await expect(
        addMeasurement(otherUserId, {
          episodeId: id,
          severity: 5,
          recordedAt: null,
          note: null,
        }),
      ).rejects.toBeInstanceOf(EpisodeNotFoundError);
    });

    it("refuses to remove the only reading an episode has", async () => {
      const id = await createEpisode(userId, baseEpisode());
      const episode = await getEpisode(userId, id);

      await expect(
        deleteMeasurement(userId, {
          id: episode!.measurements[0].id,
          episodeId: id,
        }),
      ).rejects.toBeInstanceOf(WindowConflictError);
    });

    it("recalculates the cache after a reading is removed", async () => {
      const id = await createEpisode(
        userId,
        baseEpisode({ startedAt: at("2024-03-01T10:00:00Z"), severity: 3 }),
      );
      await addMeasurement(userId, {
        episodeId: id,
        severity: 10,
        recordedAt: at("2024-03-01T11:00:00Z"),
        note: null,
      });

      const before = await getEpisode(userId, id);
      expect(before!.peakSeverity).toBe(10);

      await deleteMeasurement(userId, {
        id: before!.measurements[1].id,
        episodeId: id,
      });

      const after = await getEpisode(userId, id);
      expect(after!.peakSeverity).toBe(3);
      expect(after!.currentSeverity).toBe(3);
    });
  });

  describe("ending an episode", () => {
    it("sets the end time and computes the duration", async () => {
      const id = await createEpisode(
        userId,
        baseEpisode({ startedAt: at("2024-03-01T10:00:00Z") }),
      );

      await endEpisode(userId, {
        id,
        endedAt: at("2024-03-01T12:30:00Z"),
        severity: null,
        note: null,
      });

      const episode = await getEpisode(userId, id);
      expect(episode!.endedAt?.toISOString()).toBe("2024-03-01T12:30:00.000Z");
      expect(episode!.durationSeconds).toBe(9000);
    });

    it("records a closing reading on the timeline rather than overwriting", async () => {
      const id = await createEpisode(
        userId,
        baseEpisode({ startedAt: at("2024-03-01T10:00:00Z"), severity: 7 }),
      );

      await endEpisode(userId, {
        id,
        endedAt: at("2024-03-01T12:00:00Z"),
        severity: 0,
        note: "gone",
      });

      const episode = await getEpisode(userId, id);
      expect(episode!.measurements).toHaveLength(2);
      expect(episode!.measurements[0].severity).toBe(7);
      expect(episode!.currentSeverity).toBe(0);
      expect(episode!.peakSeverity).toBe(7);
    });

    it("defaults to ending now when no time is given", async () => {
      const id = await createEpisode(userId, baseEpisode());

      await endEpisode(userId, { id, endedAt: null, severity: null, note: null });

      const episode = await getEpisode(userId, id);
      expect(episode!.endedAt).not.toBeNull();
      expect(episode!.durationSeconds).not.toBeNull();
    });

    it("refuses an end time that would strand later readings", async () => {
      const id = await createEpisode(
        userId,
        baseEpisode({ startedAt: at("2024-03-01T10:00:00Z") }),
      );
      await addMeasurement(userId, {
        episodeId: id,
        severity: 5,
        recordedAt: at("2024-03-01T15:00:00Z"),
        note: null,
      });

      await expect(
        endEpisode(userId, {
          id,
          endedAt: at("2024-03-01T12:00:00Z"),
          severity: null,
          note: null,
        }),
      ).rejects.toBeInstanceOf(WindowConflictError);
    });

    it("clears the duration again when the episode is reopened", async () => {
      const id = await createEpisode(
        userId,
        baseEpisode({ startedAt: at("2024-03-01T10:00:00Z") }),
      );
      await endEpisode(userId, {
        id,
        endedAt: at("2024-03-01T12:00:00Z"),
        severity: null,
        note: null,
      });

      await reopenEpisode(userId, id);

      const episode = await getEpisode(userId, id);
      expect(episode!.endedAt).toBeNull();
      expect(episode!.durationSeconds).toBeNull();
    });
  });

  describe("editing an episode", () => {
    it("replaces the tag sets and updates the text fields", async () => {
      const id = await createEpisode(
        userId,
        baseEpisode({ locationIds: [locationId] }),
      );

      const otherLocation = await prisma.location.findFirst({
        where: { userId, slug: "neck" },
        select: { id: true },
      });

      await updateEpisode(userId, {
        id,
        startedAt: at("2024-03-01T09:00:00Z"),
        endedAt: null,
        painType: "renamed",
        description: "now described",
        notes: null,
        locationIds: [otherLocation!.id],
        characteristicIds: [],
        triggerIds: [],
        symptomIds: [],
      });

      const episode = await getEpisode(userId, id);
      expect(episode!.painType).toBe("renamed");
      expect(episode!.description).toBe("now described");
      expect(episode!.locations).toHaveLength(1);
      expect(episode!.locations[0].location.id).toBe(otherLocation!.id);
    });

    it("refuses a start time later than an existing reading", async () => {
      const id = await createEpisode(
        userId,
        baseEpisode({ startedAt: at("2024-03-01T10:00:00Z") }),
      );

      await expect(
        updateEpisode(userId, {
          id,
          startedAt: at("2024-03-01T11:00:00Z"),
          endedAt: null,
          painType: null,
          description: null,
          notes: null,
          locationIds: [],
          characteristicIds: [],
          triggerIds: [],
          symptomIds: [],
        }),
      ).rejects.toBeInstanceOf(WindowConflictError);
    });

    it("will not edit another account's episode", async () => {
      const id = await createEpisode(userId, baseEpisode());

      await expect(
        updateEpisode(otherUserId, {
          id,
          startedAt: at("2024-03-01T10:00:00Z"),
          endedAt: null,
          painType: "hijacked",
          description: null,
          notes: null,
          locationIds: [],
          characteristicIds: [],
          triggerIds: [],
          symptomIds: [],
        }),
      ).rejects.toBeInstanceOf(EpisodeNotFoundError);
    });
  });

  describe("correcting the start and end pain level", () => {
    const START = at("2024-03-01T10:00:00Z");
    const END = at("2024-03-01T14:00:00Z");

    /** An edit that changes nothing except what the overrides say. */
    function edit(id: string, overrides: Partial<UpdateEpisodeData> = {}) {
      return updateEpisode(userId, {
        id,
        startedAt: START,
        endedAt: null,
        painType: null,
        description: null,
        notes: null,
        locationIds: [],
        characteristicIds: [],
        triggerIds: [],
        symptomIds: [],
        ...overrides,
      });
    }

    it("corrects the first reading in place instead of adding one", async () => {
      const id = await createEpisode(
        userId,
        baseEpisode({ startedAt: START, severity: 4 }),
      );

      await edit(id, { startSeverity: 8 });

      const episode = await getEpisode(userId, id);
      expect(episode!.measurements).toHaveLength(1);
      expect(episode!.measurements[0].severity).toBe(8);
      // The reading keeps its place on the timeline.
      expect(episode!.measurements[0].recordedAt).toEqual(START);
    });

    it("recomputes the cached peak and current values", async () => {
      const id = await createEpisode(
        userId,
        baseEpisode({ startedAt: START, severity: 9 }),
      );

      await edit(id, { startSeverity: 3 });

      const episode = await getEpisode(userId, id);
      expect(episode!.peakSeverity).toBe(3);
      expect(episode!.minSeverity).toBe(3);
      expect(episode!.currentSeverity).toBe(3);
    });

    it("leaves readings from during the episode alone", async () => {
      const id = await createEpisode(
        userId,
        baseEpisode({ startedAt: START, severity: 4 }),
      );
      await addMeasurement(userId, {
        episodeId: id,
        severity: 9,
        recordedAt: at("2024-03-01T11:00:00Z"),
        note: null,
      });
      await addMeasurement(userId, {
        episodeId: id,
        severity: 6,
        recordedAt: at("2024-03-01T12:00:00Z"),
        note: null,
      });

      await edit(id, { startSeverity: 2 });

      const episode = await getEpisode(userId, id);
      expect(episode!.measurements.map((m) => m.severity)).toEqual([2, 9, 6]);
      // The peak still comes from the untouched middle reading.
      expect(episode!.peakSeverity).toBe(9);
    });

    it("corrects the closing reading when one was recorded at the end time", async () => {
      const id = await createEpisode(
        userId,
        baseEpisode({ startedAt: START, severity: 4 }),
      );
      await endEpisode(userId, { id, endedAt: END, severity: 3, note: null });

      await edit(id, { endedAt: END, endSeverity: 1 });

      const episode = await getEpisode(userId, id);
      expect(episode!.measurements).toHaveLength(2);
      expect(episode!.measurements[1].severity).toBe(1);
      expect(episode!.currentSeverity).toBe(1);
    });

    it("adds a closing reading when the episode ended without one", async () => {
      const id = await createEpisode(
        userId,
        baseEpisode({ startedAt: START, severity: 7 }),
      );
      await endEpisode(userId, { id, endedAt: END, severity: null, note: null });

      const before = await getEpisode(userId, id);
      expect(before!.measurements).toHaveLength(1);

      await edit(id, { endedAt: END, endSeverity: 2 });

      const episode = await getEpisode(userId, id);
      expect(episode!.measurements).toHaveLength(2);
      expect(episode!.measurements[1].recordedAt).toEqual(END);
      expect(episode!.measurements[1].severity).toBe(2);
      expect(episode!.minSeverity).toBe(2);
    });

    it("changes both ends in one edit", async () => {
      const id = await createEpisode(
        userId,
        baseEpisode({ startedAt: START, severity: 4 }),
      );
      await endEpisode(userId, { id, endedAt: END, severity: 3, note: null });

      await edit(id, { endedAt: END, startSeverity: 8, endSeverity: 1 });

      const episode = await getEpisode(userId, id);
      expect(episode!.measurements.map((m) => m.severity)).toEqual([8, 1]);
      expect(episode!.peakSeverity).toBe(8);
    });

    it("touches nothing when no levels are given", async () => {
      const id = await createEpisode(
        userId,
        baseEpisode({ startedAt: START, severity: 5 }),
      );
      await endEpisode(userId, { id, endedAt: END, severity: 2, note: null });

      await edit(id, { endedAt: END, painType: "renamed" });

      const episode = await getEpisode(userId, id);
      expect(episode!.painType).toBe("renamed");
      expect(episode!.measurements.map((m) => m.severity)).toEqual([5, 2]);
    });

    it("accepts zero as a real level rather than treating it as absent", async () => {
      const id = await createEpisode(
        userId,
        baseEpisode({ startedAt: START, severity: 5 }),
      );

      await edit(id, { startSeverity: 0 });

      const episode = await getEpisode(userId, id);
      expect(episode!.measurements[0].severity).toBe(0);
      expect(episode!.peakSeverity).toBe(0);
    });

    it("refuses two different levels when one reading is both ends", async () => {
      // A zero-length episode: its single reading is the start and the end.
      const id = await createEpisode(
        userId,
        baseEpisode({ startedAt: START, severity: 5 }),
      );
      await endEpisode(userId, { id, endedAt: START, severity: null, note: null });

      await expect(
        edit(id, { endedAt: START, startSeverity: 8, endSeverity: 2 }),
      ).rejects.toBeInstanceOf(WindowConflictError);

      // Nothing was written - the transaction rolled the whole edit back.
      const episode = await getEpisode(userId, id);
      expect(episode!.measurements).toHaveLength(1);
      expect(episode!.measurements[0].severity).toBe(5);
    });

    it("allows the same level at both ends of a zero-length episode", async () => {
      const id = await createEpisode(
        userId,
        baseEpisode({ startedAt: START, severity: 5 }),
      );
      await endEpisode(userId, { id, endedAt: START, severity: null, note: null });

      await edit(id, { endedAt: START, startSeverity: 6, endSeverity: 6 });

      const episode = await getEpisode(userId, id);
      expect(episode!.measurements).toHaveLength(1);
      expect(episode!.measurements[0].severity).toBe(6);
    });

    it("ignores an ending level while the episode is still going", async () => {
      const id = await createEpisode(
        userId,
        baseEpisode({ startedAt: START, severity: 5 }),
      );

      // The schema rejects this before it reaches here; the data layer must not
      // invent a closing reading for an episode with no end.
      await edit(id, { endedAt: null, endSeverity: 2 });

      const episode = await getEpisode(userId, id);
      expect(episode!.measurements).toHaveLength(1);
      expect(episode!.measurements[0].severity).toBe(5);
    });

    it("will not correct another account's readings", async () => {
      const id = await createEpisode(
        userId,
        baseEpisode({ startedAt: START, severity: 5 }),
      );

      await expect(
        updateEpisode(otherUserId, {
          id,
          startedAt: START,
          endedAt: null,
          painType: null,
          description: null,
          notes: null,
          locationIds: [],
          characteristicIds: [],
          triggerIds: [],
          symptomIds: [],
          startSeverity: 0,
        }),
      ).rejects.toBeInstanceOf(EpisodeNotFoundError);

      const episode = await getEpisode(userId, id);
      expect(episode!.measurements[0].severity).toBe(5);
    });
  });

  describe("recording treatments", () => {
    const entry = (overrides: Partial<TreatmentEntry> = {}): TreatmentEntry => ({
      treatmentTypeId: null,
      medicationName: null,
      dose: null,
      takenAt: null,
      effectiveness: null,
      notes: null,
      ...overrides,
    });

    it("writes every row of one submission", async () => {
      const id = await createEpisode(userId, baseEpisode());

      const count = await addTreatments(userId, id, [
        entry({
          treatmentTypeId,
          medicationName: "Ibuprofen",
          dose: "400mg",
          takenAt: at("2024-03-01T10:30:00Z"),
          effectiveness: 75,
        }),
        entry({ medicationName: "Heat pack", takenAt: at("2024-03-01T10:35:00Z") }),
        entry({ medicationName: "Dark room", takenAt: at("2024-03-01T10:40:00Z") }),
      ]);

      expect(count).toBe(3);

      const episode = await getEpisode(userId, id);
      expect(episode!.treatments).toHaveLength(3);

      // Each keeps its own details rather than being merged into one entry.
      const [first, second, third] = episode!.treatments;
      expect(first.medicationName).toBe("Ibuprofen");
      expect(first.dose).toBe("400mg");
      expect(first.effectiveness).toBe(75);
      expect(second.medicationName).toBe("Heat pack");
      expect(second.effectiveness).toBeNull();
      expect(third.medicationName).toBe("Dark room");
    });

    it("gives rows with no time of their own the same timestamp", async () => {
      const id = await createEpisode(userId, baseEpisode());
      const before = new Date();

      await addTreatments(userId, id, [
        entry({ medicationName: "Ibuprofen" }),
        entry({ medicationName: "Heat pack" }),
      ]);

      const episode = await getEpisode(userId, id);
      const [first, second] = episode!.treatments;

      expect(first.takenAt.getTime()).toBe(second.takenAt.getTime());
      expect(first.takenAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    });

    it("writes nothing at all when the episode is not the caller's", async () => {
      const id = await createEpisode(userId, baseEpisode());

      await expect(
        addTreatments(otherUserId, id, [entry({ medicationName: "Ibuprofen" })]),
      ).rejects.toBeInstanceOf(EpisodeNotFoundError);

      expect(await prisma.treatment.count({ where: { episodeId: id } })).toBe(0);
    });

    it("drops a treatment type belonging to another account", async () => {
      const id = await createEpisode(userId, baseEpisode());
      const foreign = await prisma.treatmentType.findFirst({
        where: { userId: otherUserId, slug: "medication" },
        select: { id: true },
      });

      await addTreatments(userId, id, [
        entry({ treatmentTypeId: foreign!.id, medicationName: "Ibuprofen" }),
        entry({ treatmentTypeId, medicationName: "Paracetamol" }),
      ]);

      const episode = await getEpisode(userId, id);
      const byName = new Map(
        episode!.treatments.map((t) => [t.medicationName, t.treatmentTypeId]),
      );

      // The row is still recorded - only the borrowed classification is dropped.
      expect(byName.get("Ibuprofen")).toBeNull();
      expect(byName.get("Paracetamol")).toBe(treatmentTypeId);
    });

    it("records a single treatment through the same path", async () => {
      const id = await createEpisode(userId, baseEpisode());

      await addTreatment(userId, {
        episodeId: id,
        treatmentTypeId,
        medicationName: "Ibuprofen",
        dose: "400mg",
        takenAt: null,
        effectiveness: 50,
        notes: null,
      });

      const episode = await getEpisode(userId, id);
      expect(episode!.treatments).toHaveLength(1);
      expect(episode!.treatments[0].treatmentTypeId).toBe(treatmentTypeId);
    });
  });

  describe("deleting an episode", () => {
    it("removes the episode and everything hanging off it", async () => {
      const id = await createEpisode(userId, baseEpisode({ locationIds: [locationId] }));
      await addTreatment(userId, {
        episodeId: id,
        treatmentTypeId,
        medicationName: "Ibuprofen",
        dose: "400mg",
        takenAt: null,
        effectiveness: 50,
        notes: null,
      });

      await deleteEpisode(userId, id);

      expect(await getEpisode(userId, id)).toBeNull();
      expect(await prisma.painMeasurement.count({ where: { episodeId: id } })).toBe(0);
      expect(await prisma.treatment.count({ where: { episodeId: id } })).toBe(0);
      expect(await prisma.episodeLocation.count({ where: { episodeId: id } })).toBe(0);
    });

    it("leaves the taxonomy entries themselves alone", async () => {
      const id = await createEpisode(userId, baseEpisode({ locationIds: [locationId] }));
      await deleteEpisode(userId, id);

      expect(
        await prisma.location.count({ where: { id: locationId } }),
      ).toBe(1);
    });

    it("will not delete another account's episode", async () => {
      const id = await createEpisode(userId, baseEpisode());

      await expect(deleteEpisode(otherUserId, id)).rejects.toBeInstanceOf(
        EpisodeNotFoundError,
      );
      expect(await getEpisode(userId, id)).not.toBeNull();
    });
  });

  describe("filtering", () => {
    beforeEach(async () => {
      await createEpisode(
        userId,
        baseEpisode({
          startedAt: at("2024-01-10T10:00:00Z"),
          endedAt: at("2024-01-10T11:00:00Z"),
          severity: 3,
          painType: "mild ache",
          locationIds: [locationId],
        }),
      );
      await createEpisode(
        userId,
        baseEpisode({
          startedAt: at("2024-02-10T10:00:00Z"),
          endedAt: at("2024-02-10T20:00:00Z"),
          severity: 9,
          painType: "migraine",
        }),
      );
      await createEpisode(
        userId,
        baseEpisode({ startedAt: at("2024-03-10T10:00:00Z"), severity: 6 }),
      );
    });

    it("returns everything by default, newest first", async () => {
      const { episodes, total } = await listEpisodes(userId, parseEpisodeFilter({}));

      expect(total).toBe(3);
      expect(episodes[0].startedAt.getTime()).toBeGreaterThan(
        episodes[1].startedAt.getTime(),
      );
    });

    it("filters to ongoing episodes", async () => {
      const { episodes } = await listEpisodes(
        userId,
        parseEpisodeFilter({ status: "active" }),
      );

      expect(episodes).toHaveLength(1);
      expect(episodes[0].endedAt).toBeNull();
    });

    it("filters on peak severity", async () => {
      const { episodes } = await listEpisodes(
        userId,
        parseEpisodeFilter({ minSeverity: "7" }),
      );

      expect(episodes).toHaveLength(1);
      expect(episodes[0].peakSeverity).toBe(9);
    });

    it("filters by location", async () => {
      const { episodes } = await listEpisodes(
        userId,
        parseEpisodeFilter({ loc: locationId }),
      );

      expect(episodes).toHaveLength(1);
    });

    it("searches the label", async () => {
      const { episodes } = await listEpisodes(
        userId,
        parseEpisodeFilter({ q: "MIGRAINE" }),
      );

      expect(episodes).toHaveLength(1);
      expect(episodes[0].painType).toBe("migraine");
    });

    it("combines filters", async () => {
      const { episodes } = await listEpisodes(
        userId,
        parseEpisodeFilter({ from: "2024-02-01", minSeverity: "7" }),
      );

      expect(episodes).toHaveLength(1);
      expect(episodes[0].painType).toBe("migraine");
    });

    it("never returns another account's episodes", async () => {
      const { total } = await listEpisodes(otherUserId, parseEpisodeFilter({}));
      expect(total).toBe(0);
    });
  });

  // --- helpers -------------------------------------------------------------

  function baseEpisode(overrides: Partial<Parameters<typeof createEpisode>[1]> = {}) {
    return {
      startedAt: at("2024-03-01T10:00:00Z"),
      endedAt: null,
      severity: 5,
      painType: null,
      description: null,
      notes: null,
      locationIds: [],
      characteristicIds: [],
      triggerIds: [],
      symptomIds: [],
      ...overrides,
    };
  }
});

function testEmail(): string {
  return "integration-primary@test.invalid";
}

function otherEmail(): string {
  return "integration-other@test.invalid";
}

async function createTestUser(email: string): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, passwordHash: "not-a-real-hash" },
      select: { id: true },
    });
    await seedDefaultTaxonomy(tx, user.id);
    return user.id;
  });
}
