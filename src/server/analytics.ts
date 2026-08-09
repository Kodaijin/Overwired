import type { ExportableEpisode } from "@/lib/export";
import { buildEpisodeWhere } from "@/lib/filters";
import { prisma } from "@/lib/prisma";
import type { EpisodeFilter } from "@/lib/schemas";
import type { StatsEpisode, StatsMeasurement } from "@/lib/statistics";

/**
 * Loaders for the read-heavy views: statistics, reports and export.
 *
 * All three need the same fully-expanded episode, so it is loaded once and
 * mapped into whichever shape the consumer wants. The pure functions in
 * `lib/statistics` and `lib/export` do the actual work.
 */

const fullEpisodeInclude = {
  measurements: {
    select: { recordedAt: true, severity: true, note: true },
    orderBy: { recordedAt: "asc" as const },
  },
  treatments: {
    select: {
      medicationName: true,
      dose: true,
      takenAt: true,
      effectiveness: true,
      notes: true,
      treatmentType: { select: { name: true } },
    },
    orderBy: { takenAt: "asc" as const },
  },
  locations: { select: { location: { select: { name: true } } } },
  characteristics: { select: { characteristic: { select: { name: true } } } },
  triggers: { select: { trigger: { select: { name: true } } } },
  symptoms: { select: { symptom: { select: { name: true } } } },
};

type FullEpisode = Awaited<ReturnType<typeof loadFullEpisodes>>[number];

async function loadFullEpisodes(userId: string, filter?: EpisodeFilter) {
  return prisma.episode.findMany({
    where: filter ? buildEpisodeWhere(userId, filter) : { userId },
    include: fullEpisodeInclude,
    orderBy: { startedAt: "asc" },
  });
}

export async function loadStatsEpisodes(
  userId: string,
  filter?: EpisodeFilter,
): Promise<StatsEpisode[]> {
  const episodes = await loadFullEpisodes(userId, filter);
  return episodes.map(toStatsEpisode);
}

export async function loadExportableEpisodes(
  userId: string,
  filter?: EpisodeFilter,
): Promise<ExportableEpisode[]> {
  const episodes = await loadFullEpisodes(userId, filter);
  return episodes.map(toExportableEpisode);
}

/** Readings for a user, optionally bounded, for the trend and calendar views. */
export async function loadAllMeasurements(
  userId: string,
  since?: Date,
  until?: Date,
): Promise<StatsMeasurement[]> {
  const recordedAt =
    since || until
      ? { ...(since ? { gte: since } : {}), ...(until ? { lte: until } : {}) }
      : undefined;

  return prisma.painMeasurement.findMany({
    where: {
      episode: { userId },
      ...(recordedAt ? { recordedAt } : {}),
    },
    select: { recordedAt: true, severity: true },
    orderBy: { recordedAt: "asc" },
  });
}

function toStatsEpisode(episode: FullEpisode): StatsEpisode {
  return {
    id: episode.id,
    startedAt: episode.startedAt,
    endedAt: episode.endedAt,
    measurements: episode.measurements.map((m) => ({
      recordedAt: m.recordedAt,
      severity: m.severity,
    })),
    locations: episode.locations.map((l) => l.location.name),
    characteristics: episode.characteristics.map((c) => c.characteristic.name),
    triggers: episode.triggers.map((t) => t.trigger.name),
    symptoms: episode.symptoms.map((s) => s.symptom.name),
    treatments: episode.treatments.map((t) => ({
      // Group medication by its name so "Ibuprofen" and "Paracetamol" are
      // reported separately rather than both as "Medication".
      name: t.medicationName ?? t.treatmentType?.name ?? "Other",
      effectiveness: t.effectiveness,
    })),
  };
}

function toExportableEpisode(episode: FullEpisode): ExportableEpisode {
  return {
    id: episode.id,
    startedAt: episode.startedAt,
    endedAt: episode.endedAt,
    painType: episode.painType,
    description: episode.description,
    notes: episode.notes,
    locations: episode.locations.map((l) => l.location.name),
    characteristics: episode.characteristics.map((c) => c.characteristic.name),
    triggers: episode.triggers.map((t) => t.trigger.name),
    symptoms: episode.symptoms.map((s) => s.symptom.name),
    measurements: episode.measurements.map((m) => ({
      recordedAt: m.recordedAt,
      severity: m.severity,
      note: m.note,
    })),
    treatments: episode.treatments.map((t) => ({
      type: t.treatmentType?.name ?? null,
      medicationName: t.medicationName,
      dose: t.dose,
      takenAt: t.takenAt,
      effectiveness: t.effectiveness,
      notes: t.notes,
    })),
  };
}
