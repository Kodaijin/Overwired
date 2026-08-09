import { computeEpisodeCache } from "@/lib/episode-metrics";
import type { NormalizedEpisode } from "@/lib/import";
import { prisma } from "@/lib/prisma";
import type { TaxonomyKind } from "@/lib/schemas";
import { resolveOrCreateByName } from "@/server/taxonomy";

/**
 * Writes a validated import into the database.
 *
 * The whole file is inserted in one transaction: a failure part-way through
 * leaves the account exactly as it was, rather than half-imported.
 */

export interface ImportOptions {
  /**
   * Skip episodes whose start time already exists in the account. Makes
   * re-importing the same file safe instead of doubling the history.
   */
  skipDuplicates: boolean;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  measurements: number;
  treatments: number;
  taxonomyCreated: number;
}

export async function importEpisodes(
  userId: string,
  episodes: readonly NormalizedEpisode[],
  options: ImportOptions,
): Promise<ImportResult> {
  return prisma.$transaction(
    async (tx) => {
      const result: ImportResult = {
        imported: 0,
        skipped: 0,
        measurements: 0,
        treatments: 0,
        taxonomyCreated: 0,
      };

      // Resolving each distinct name once keeps the transaction short even for
      // a file with thousands of episodes.
      const cache = new Map<string, string>();
      const resolve = async (kind: TaxonomyKind, name: string): Promise<string> => {
        const key = `${kind}:${name.toLowerCase()}`;
        const cached = cache.get(key);
        if (cached) return cached;

        const { id, created } = await resolveOrCreateByName(tx, userId, kind, name);
        if (created) result.taxonomyCreated += 1;

        cache.set(key, id);
        return id;
      };

      const existingStarts = options.skipDuplicates
        ? new Set(
            (
              await tx.episode.findMany({
                where: { userId },
                select: { startedAt: true },
              })
            ).map((episode) => episode.startedAt.getTime()),
          )
        : new Set<number>();

      for (const episode of episodes) {
        if (options.skipDuplicates && existingStarts.has(episode.startedAt.getTime())) {
          result.skipped += 1;
          continue;
        }

        const [locationIds, characteristicIds, triggerIds, symptomIds] =
          await Promise.all([
            mapNames(episode.locations, (name) => resolve("location", name)),
            mapNames(episode.characteristics, (name) => resolve("characteristic", name)),
            mapNames(episode.triggers, (name) => resolve("trigger", name)),
            mapNames(episode.symptoms, (name) => resolve("symptom", name)),
          ]);

        // An imported episode with no readings would have no severity at all,
        // so seed one at the start time to keep the timeline well-formed.
        const measurements =
          episode.measurements.length > 0
            ? episode.measurements
            : [{ recordedAt: episode.startedAt, severity: 0, note: null }];

        const cacheValues = computeEpisodeCache(episode, measurements);

        const created = await tx.episode.create({
          data: {
            userId,
            startedAt: episode.startedAt,
            endedAt: episode.endedAt,
            painType: episode.painType,
            description: episode.description,
            notes: episode.notes,
            currentSeverity: cacheValues.currentSeverity,
            peakSeverity: cacheValues.peakSeverity,
            minSeverity: cacheValues.minSeverity,
            durationSeconds: cacheValues.durationSeconds,
            measurements: { create: measurements },
            locations: { create: locationIds.map((locationId) => ({ locationId })) },
            characteristics: {
              create: characteristicIds.map((characteristicId) => ({
                characteristicId,
              })),
            },
            triggers: { create: triggerIds.map((triggerId) => ({ triggerId })) },
            symptoms: { create: symptomIds.map((symptomId) => ({ symptomId })) },
          },
          select: { id: true },
        });

        for (const treatment of episode.treatments) {
          await tx.treatment.create({
            data: {
              episodeId: created.id,
              treatmentTypeId: treatment.typeName
                ? await resolve("treatmentType", treatment.typeName)
                : null,
              medicationName: treatment.medicationName,
              dose: treatment.dose,
              takenAt: treatment.takenAt,
              effectiveness: treatment.effectiveness,
              notes: treatment.notes,
            },
          });
        }

        existingStarts.add(episode.startedAt.getTime());
        result.imported += 1;
        result.measurements += measurements.length;
        result.treatments += episode.treatments.length;
      }

      return result;
    },
    // A few thousand episodes take a while; the defaults are tuned for short
    // interactive writes.
    { timeout: 120_000, maxWait: 10_000 },
  );
}

async function mapNames(
  names: readonly string[],
  resolve: (name: string) => Promise<string>,
): Promise<string[]> {
  const ids: string[] = [];
  for (const name of names) {
    ids.push(await resolve(name));
  }
  return [...new Set(ids)];
}

