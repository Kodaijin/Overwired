import type { Prisma } from "@/generated/prisma/client";
import { computeEpisodeCache } from "@/lib/episode-metrics";
import { buildEpisodeWhere, EPISODES_PER_PAGE } from "@/lib/filters";
import { prisma } from "@/lib/prisma";
import type { EpisodeFilter } from "@/lib/schemas";
import { isEarlierMinute, preserveStoredTime } from "@/lib/time-precision";

/**
 * Episode data access.
 *
 * Two rules hold everywhere in this file:
 *
 *  1. Every query and mutation is scoped by `userId`. Ownership is enforced in
 *     the `where` clause rather than checked afterwards, so a wrong id returns
 *     "not found" instead of touching another account's row.
 *  2. Any write that can change the severity timeline or the episode window
 *     ends with `recalculateEpisode`, which recomputes the cached
 *     peak/min/current/duration values from the measurement rows.
 */

/** Fields needed to render an episode in a list. */
const episodeListSelect = {
  id: true,
  startedAt: true,
  endedAt: true,
  painType: true,
  description: true,
  currentSeverity: true,
  peakSeverity: true,
  minSeverity: true,
  durationSeconds: true,
  locations: { select: { location: { select: { id: true, name: true } } } },
  characteristics: {
    select: { characteristic: { select: { id: true, name: true } } },
  },
} satisfies Prisma.EpisodeSelect;

export type EpisodeListItem = Prisma.EpisodeGetPayload<{
  select: typeof episodeListSelect;
}>;

const episodeDetailInclude = {
  measurements: { orderBy: [{ recordedAt: "asc" }, { createdAt: "asc" }] },
  treatments: {
    orderBy: { takenAt: "asc" },
    include: { treatmentType: { select: { id: true, name: true, isMedication: true } } },
  },
  locations: { include: { location: { select: { id: true, name: true } } } },
  characteristics: {
    include: { characteristic: { select: { id: true, name: true } } },
  },
  triggers: { include: { trigger: { select: { id: true, name: true } } } },
  symptoms: { include: { symptom: { select: { id: true, name: true } } } },
} satisfies Prisma.EpisodeInclude;

export type EpisodeDetail = Prisma.EpisodeGetPayload<{
  include: typeof episodeDetailInclude;
}>;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getEpisode(
  userId: string,
  episodeId: string,
): Promise<EpisodeDetail | null> {
  return prisma.episode.findFirst({
    where: { id: episodeId, userId },
    include: episodeDetailInclude,
  });
}

export async function getActiveEpisodes(userId: string): Promise<EpisodeDetail[]> {
  return prisma.episode.findMany({
    where: { userId, endedAt: null },
    include: episodeDetailInclude,
    orderBy: { startedAt: "desc" },
  });
}

export async function listEpisodes(
  userId: string,
  filter: EpisodeFilter,
): Promise<{ episodes: EpisodeListItem[]; total: number; pageCount: number }> {
  const where = buildEpisodeWhere(userId, filter);

  const [episodes, total] = await Promise.all([
    prisma.episode.findMany({
      where,
      select: episodeListSelect,
      orderBy: { startedAt: "desc" },
      skip: (filter.page - 1) * EPISODES_PER_PAGE,
      take: EPISODES_PER_PAGE,
    }),
    prisma.episode.count({ where }),
  ]);

  return {
    episodes,
    total,
    pageCount: Math.max(1, Math.ceil(total / EPISODES_PER_PAGE)),
  };
}

/**
 * Episodes overlapping a date range - an episode that started earlier and is
 * still running counts as happening on every day in between.
 */
export async function getEpisodesInRange(
  userId: string,
  from: Date,
  to: Date,
): Promise<EpisodeListItem[]> {
  return prisma.episode.findMany({
    where: {
      userId,
      startedAt: { lte: to },
      OR: [{ endedAt: null }, { endedAt: { gte: from } }],
    },
    select: episodeListSelect,
    orderBy: { startedAt: "asc" },
  });
}

export async function getRecentEpisodes(
  userId: string,
  take = 5,
): Promise<EpisodeListItem[]> {
  return prisma.episode.findMany({
    where: { userId },
    select: episodeListSelect,
    orderBy: { startedAt: "desc" },
    take,
  });
}

// ---------------------------------------------------------------------------
// Derived-value maintenance
// ---------------------------------------------------------------------------

/**
 * Recomputes an episode's cached severity and duration values from its
 * measurements. Safe to call repeatedly - it derives everything from scratch.
 */
export async function recalculateEpisode(
  tx: Prisma.TransactionClient,
  episodeId: string,
): Promise<void> {
  const episode = await tx.episode.findUnique({
    where: { id: episodeId },
    select: {
      startedAt: true,
      endedAt: true,
      measurements: {
        select: { recordedAt: true, severity: true, createdAt: true },
      },
    },
  });

  if (!episode) return;

  const cache = computeEpisodeCache(episode, episode.measurements);

  await tx.episode.update({
    where: { id: episodeId },
    data: {
      currentSeverity: cache.currentSeverity,
      peakSeverity: cache.peakSeverity,
      minSeverity: cache.minSeverity,
      durationSeconds: cache.durationSeconds,
    },
  });
}

// ---------------------------------------------------------------------------
// Ownership helpers
// ---------------------------------------------------------------------------

/**
 * Narrows a list of taxonomy ids to the ones this user actually owns.
 *
 * Ids arrive from form submissions, so they cannot be trusted: without this,
 * a crafted request could attach another account's entries to an episode.
 */
async function ownedIds(
  tx: Prisma.TransactionClient,
  userId: string,
  kind: "location" | "characteristic" | "trigger" | "symptom",
  ids: readonly string[],
): Promise<string[]> {
  if (ids.length === 0) return [];

  const where = { userId, id: { in: [...ids] } };
  const select = { id: true };

  const rows =
    kind === "location"
      ? await tx.location.findMany({ where, select })
      : kind === "characteristic"
        ? await tx.characteristic.findMany({ where, select })
        : kind === "trigger"
          ? await tx.trigger.findMany({ where, select })
          : await tx.symptom.findMany({ where, select });

  return rows.map((row) => row.id);
}

async function assertOwnsEpisode(
  tx: Prisma.TransactionClient,
  userId: string,
  episodeId: string,
): Promise<{ startedAt: Date; endedAt: Date | null }> {
  const episode = await tx.episode.findFirst({
    where: { id: episodeId, userId },
    select: { startedAt: true, endedAt: true },
  });

  if (!episode) throw new EpisodeNotFoundError();
  return episode;
}

export class EpisodeNotFoundError extends Error {
  constructor() {
    super("Episode not found");
    this.name = "EpisodeNotFoundError";
  }
}

/** Raised when a change would leave readings outside the episode's window. */
export class WindowConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WindowConflictError";
  }
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface CreateEpisodeData {
  startedAt: Date;
  endedAt: Date | null;
  severity: number;
  painType: string | null;
  description: string | null;
  notes: string | null;
  locationIds: string[];
  characteristicIds: string[];
  triggerIds: string[];
  symptomIds: string[];
}

export async function createEpisode(
  userId: string,
  data: CreateEpisodeData,
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const [locationIds, characteristicIds, triggerIds, symptomIds] = await Promise.all([
      ownedIds(tx, userId, "location", data.locationIds),
      ownedIds(tx, userId, "characteristic", data.characteristicIds),
      ownedIds(tx, userId, "trigger", data.triggerIds),
      ownedIds(tx, userId, "symptom", data.symptomIds),
    ]);

    const episode = await tx.episode.create({
      data: {
        userId,
        startedAt: data.startedAt,
        endedAt: data.endedAt,
        painType: data.painType,
        description: data.description,
        notes: data.notes,
        // The starting severity becomes the first point on the timeline.
        measurements: {
          create: { recordedAt: data.startedAt, severity: data.severity },
        },
        locations: { create: locationIds.map((locationId) => ({ locationId })) },
        characteristics: {
          create: characteristicIds.map((characteristicId) => ({ characteristicId })),
        },
        triggers: { create: triggerIds.map((triggerId) => ({ triggerId })) },
        symptoms: { create: symptomIds.map((symptomId) => ({ symptomId })) },
      },
      select: { id: true },
    });

    await recalculateEpisode(tx, episode.id);
    return episode.id;
  });
}

export interface UpdateEpisodeData {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  painType: string | null;
  description: string | null;
  notes: string | null;
  locationIds: string[];
  characteristicIds: string[];
  triggerIds: string[];
  symptomIds: string[];
  /** Corrections to the ends of the timeline; null leaves them untouched. */
  startSeverity?: number | null;
  endSeverity?: number | null;
}

export async function updateEpisode(
  userId: string,
  data: UpdateEpisodeData,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await assertOwnsEpisode(tx, userId, data.id);

    // The form can only express minutes, so a time in the same minute as the
    // stored one means "untouched" - keep the stored value rather than
    // truncating its seconds away.
    const startedAt = preserveStoredTime(data.startedAt, existing.startedAt);
    const requestedEnd = preserveStoredTime(data.endedAt, existing.endedAt);

    await assertWindowFitsMeasurements(tx, data.id, startedAt, requestedEnd);
    const endedAt = await clampEndToLastReading(tx, data.id, requestedEnd);

    const [locationIds, characteristicIds, triggerIds, symptomIds] = await Promise.all([
      ownedIds(tx, userId, "location", data.locationIds),
      ownedIds(tx, userId, "characteristic", data.characteristicIds),
      ownedIds(tx, userId, "trigger", data.triggerIds),
      ownedIds(tx, userId, "symptom", data.symptomIds),
    ]);

    await tx.episode.update({
      where: { id: data.id },
      data: {
        startedAt,
        endedAt,
        painType: data.painType,
        description: data.description,
        notes: data.notes,
        // Replace the tag sets wholesale - simpler than diffing, and these are
        // small collections.
        locations: {
          deleteMany: {},
          create: locationIds.map((locationId) => ({ locationId })),
        },
        characteristics: {
          deleteMany: {},
          create: characteristicIds.map((characteristicId) => ({ characteristicId })),
        },
        triggers: {
          deleteMany: {},
          create: triggerIds.map((triggerId) => ({ triggerId })),
        },
        symptoms: {
          deleteMany: {},
          create: symptomIds.map((symptomId) => ({ symptomId })),
        },
      },
    });

    await applyBoundarySeverities(tx, data.id, endedAt, {
      start: data.startSeverity ?? null,
      end: data.endSeverity ?? null,
    });

    await recalculateEpisode(tx, data.id);
  });
}

/**
 * Corrects the pain level an episode started and ended at.
 *
 * This is deliberately narrow. The first reading is edited in place, because
 * it is the same reading the user is looking at when they say "I typed the
 * wrong number" - appending a second reading at the same instant would leave
 * the timeline claiming two different levels at once. Readings in between are
 * never touched here; they are added and removed from the episode page, so the
 * edit form cannot be used to quietly flatten how the pain actually changed.
 *
 * The ending level attaches to the reading recorded at the end time. If there
 * is no such reading - the episode was ended without one - it is added.
 */
async function applyBoundarySeverities(
  tx: Prisma.TransactionClient,
  episodeId: string,
  endedAt: Date | null,
  severities: { start: number | null; end: number | null },
): Promise<void> {
  if (severities.start == null && severities.end == null) return;

  const measurements = await tx.painMeasurement.findMany({
    where: { episodeId },
    orderBy: [{ recordedAt: "asc" }, { createdAt: "asc" }],
    select: { id: true, severity: true, recordedAt: true },
  });

  const first = measurements[0];
  const last = measurements[measurements.length - 1];
  const endReading =
    endedAt && last && last.recordedAt.getTime() === endedAt.getTime() ? last : null;

  // A zero-length episode's single reading is both its start and its end, so
  // it cannot be two different numbers.
  if (
    severities.start != null &&
    severities.end != null &&
    first &&
    endReading &&
    first.id === endReading.id &&
    severities.start !== severities.end
  ) {
    throw new WindowConflictError(
      "This episode has one reading covering both its start and its end, so they cannot be different levels. Add a reading from the episode page to record the change.",
    );
  }

  if (severities.start != null && first && first.severity !== severities.start) {
    await tx.painMeasurement.update({
      where: { id: first.id },
      data: { severity: severities.start },
    });
  }

  if (severities.end != null && endedAt) {
    if (endReading) {
      if (endReading.severity !== severities.end) {
        await tx.painMeasurement.update({
          where: { id: endReading.id },
          data: { severity: severities.end },
        });
      }
    } else {
      await tx.painMeasurement.create({
        data: { episodeId, recordedAt: endedAt, severity: severities.end },
      });
    }
  }
}

/**
 * Ends an episode.
 *
 * The closing severity, when given, is recorded as a normal timeline entry at
 * the end time rather than overwriting anything.
 */
export async function endEpisode(
  userId: string,
  input: { id: string; endedAt: Date | null; severity: number | null; note: string | null },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await assertOwnsEpisode(tx, userId, input.id);

    const requested = input.endedAt ?? new Date();
    await assertWindowFitsMeasurements(tx, input.id, null, requested);
    const endedAt = (await clampEndToLastReading(tx, input.id, requested))!;

    if (input.severity != null) {
      await tx.painMeasurement.create({
        data: {
          episodeId: input.id,
          recordedAt: endedAt,
          severity: input.severity,
          note: input.note,
        },
      });
    }

    await tx.episode.update({ where: { id: input.id }, data: { endedAt } });
    await recalculateEpisode(tx, input.id);
  });
}

/** Reopens a closed episode, e.g. when the pain came back within the hour. */
export async function reopenEpisode(userId: string, episodeId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await assertOwnsEpisode(tx, userId, episodeId);
    await tx.episode.update({ where: { id: episodeId }, data: { endedAt: null } });
    await recalculateEpisode(tx, episodeId);
  });
}

export async function deleteEpisode(userId: string, episodeId: string): Promise<void> {
  // Related rows are removed by the schema's cascade rules.
  const result = await prisma.episode.deleteMany({ where: { id: episodeId, userId } });
  if (result.count === 0) throw new EpisodeNotFoundError();
}

export async function addMeasurement(
  userId: string,
  input: {
    episodeId: string;
    severity: number;
    recordedAt: Date | null;
    note: string | null;
  },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const episode = await assertOwnsEpisode(tx, userId, input.episodeId);
    const recordedAt = input.recordedAt ?? new Date();

    if (isEarlierMinute(recordedAt, episode.startedAt)) {
      throw new WindowConflictError(
        "That reading is before the episode started. Adjust the time, or edit the episode's start time first.",
      );
    }

    if (episode.endedAt && isEarlierMinute(episode.endedAt, recordedAt)) {
      throw new WindowConflictError(
        "That reading is after the episode ended. Adjust the time, or reopen the episode first.",
      );
    }

    await tx.painMeasurement.create({
      data: {
        episodeId: input.episodeId,
        severity: input.severity,
        recordedAt,
        note: input.note,
      },
    });

    await recalculateEpisode(tx, input.episodeId);
  });
}

export async function deleteMeasurement(
  userId: string,
  input: { id: string; episodeId: string },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await assertOwnsEpisode(tx, userId, input.episodeId);

    const remaining = await tx.painMeasurement.count({
      where: { episodeId: input.episodeId },
    });

    // An episode with no readings has no severity at all, which breaks the
    // timeline the whole app is built around.
    if (remaining <= 1) {
      throw new WindowConflictError(
        "An episode needs at least one pain reading. Add another reading before removing this one.",
      );
    }

    await tx.painMeasurement.deleteMany({
      where: { id: input.id, episodeId: input.episodeId },
    });

    await recalculateEpisode(tx, input.episodeId);
  });
}

/**
 * Nudges an end time up to the last reading when the two share a minute.
 *
 * Because the boundary checks compare whole minutes, an end time typed as
 * "13:00" is accepted for an episode whose last reading is at 13:00:44. Left
 * alone that reading would sit after the episode's own end, and a closing
 * reading recorded at 13:00:00 would not be the final one - so the episode's
 * ending level would be the older reading instead of the one just entered.
 *
 * The adjustment is never more than a minute: anything larger is refused
 * outright by `assertWindowFitsMeasurements`.
 */
async function clampEndToLastReading(
  tx: Prisma.TransactionClient,
  episodeId: string,
  endedAt: Date | null,
): Promise<Date | null> {
  if (endedAt == null) return null;

  const latest = await tx.painMeasurement.findFirst({
    where: { episodeId },
    orderBy: { recordedAt: "desc" },
    select: { recordedAt: true },
  });

  return latest && latest.recordedAt.getTime() > endedAt.getTime()
    ? latest.recordedAt
    : endedAt;
}

/**
 * Rejects a window change that would strand existing readings outside it.
 * Passing null for either bound leaves that side unchanged.
 */
async function assertWindowFitsMeasurements(
  tx: Prisma.TransactionClient,
  episodeId: string,
  startedAt: Date | null,
  endedAt: Date | null,
): Promise<void> {
  if (!startedAt && !endedAt) return;

  const [earliest, latest] = await Promise.all([
    tx.painMeasurement.findFirst({
      where: { episodeId },
      orderBy: { recordedAt: "asc" },
      select: { recordedAt: true },
    }),
    tx.painMeasurement.findFirst({
      where: { episodeId },
      orderBy: { recordedAt: "desc" },
      select: { recordedAt: true },
    }),
  ]);

  if (startedAt && earliest && isEarlierMinute(earliest.recordedAt, startedAt)) {
    throw new WindowConflictError(
      "There are pain readings before that start time. Remove or re-time them first.",
    );
  }

  if (endedAt && latest && isEarlierMinute(endedAt, latest.recordedAt)) {
    throw new WindowConflictError(
      "There are pain readings after that end time. Remove or re-time them first.",
    );
  }
}

// ---------------------------------------------------------------------------
// Treatments
// ---------------------------------------------------------------------------

export interface TreatmentEntry {
  treatmentTypeId: string | null;
  medicationName: string | null;
  dose: string | null;
  takenAt: Date | null;
  effectiveness: number | null;
  notes: string | null;
}

export type TreatmentData = TreatmentEntry & { episodeId: string };

/**
 * Records one or more treatments against an episode.
 *
 * Everything goes in a single transaction: if one row is rejected none of them
 * are written, so a half-recorded response to a bout of pain is not possible.
 * Rows that left the time blank all share one timestamp - they were logged in
 * the same breath, and inventing slightly different times would be fiction.
 */
export async function addTreatments(
  userId: string,
  episodeId: string,
  entries: readonly TreatmentEntry[],
): Promise<number> {
  if (entries.length === 0) return 0;

  return prisma.$transaction(async (tx) => {
    await assertOwnsEpisode(tx, userId, episodeId);

    const owned = await ownedTreatmentTypeIds(
      tx,
      userId,
      entries.map((entry) => entry.treatmentTypeId),
    );
    const now = new Date();

    const result = await tx.treatment.createMany({
      data: entries.map((entry) => ({
        episodeId,
        treatmentTypeId:
          entry.treatmentTypeId && owned.has(entry.treatmentTypeId)
            ? entry.treatmentTypeId
            : null,
        medicationName: entry.medicationName,
        dose: entry.dose,
        takenAt: entry.takenAt ?? now,
        effectiveness: entry.effectiveness,
        notes: entry.notes,
      })),
    });

    return result.count;
  });
}

export async function addTreatment(
  userId: string,
  data: TreatmentData,
): Promise<void> {
  const { episodeId, ...entry } = data;
  await addTreatments(userId, episodeId, [entry]);
}

export async function updateTreatment(
  userId: string,
  data: TreatmentData & { id: string },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await assertOwnsEpisode(tx, userId, data.episodeId);
    const treatmentTypeId = await ownedTreatmentTypeId(tx, userId, data.treatmentTypeId);

    const result = await tx.treatment.updateMany({
      where: { id: data.id, episodeId: data.episodeId },
      data: {
        treatmentTypeId,
        medicationName: data.medicationName,
        dose: data.dose,
        takenAt: data.takenAt ?? new Date(),
        effectiveness: data.effectiveness,
        notes: data.notes,
      },
    });

    if (result.count === 0) throw new EpisodeNotFoundError();
  });
}

export async function deleteTreatment(
  userId: string,
  input: { id: string; episodeId: string },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await assertOwnsEpisode(tx, userId, input.episodeId);
    await tx.treatment.deleteMany({
      where: { id: input.id, episodeId: input.episodeId },
    });
  });
}

/**
 * Narrows treatment-type ids to the ones this user owns, for the same reason
 * as `ownedIds` above: the ids came from a form submission.
 */
async function ownedTreatmentTypeIds(
  tx: Prisma.TransactionClient,
  userId: string,
  ids: readonly (string | null)[],
): Promise<Set<string>> {
  const wanted = ids.filter((id): id is string => id != null);
  if (wanted.length === 0) return new Set();

  const rows = await tx.treatmentType.findMany({
    where: { userId, id: { in: wanted } },
    select: { id: true },
  });

  return new Set(rows.map((row) => row.id));
}

async function ownedTreatmentTypeId(
  tx: Prisma.TransactionClient,
  userId: string,
  treatmentTypeId: string | null,
): Promise<string | null> {
  if (!treatmentTypeId) return null;
  const owned = await ownedTreatmentTypeIds(tx, userId, [treatmentTypeId]);
  return owned.has(treatmentTypeId) ? treatmentTypeId : null;
}
