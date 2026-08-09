import type { Prisma } from "@/generated/prisma/client";
import { episodeFilterSchema, type EpisodeFilter } from "@/lib/schemas";

export const EPISODES_PER_PAGE = 25;

/**
 * Reads a filter out of the query string.
 *
 * Every field falls back to its default rather than erroring: a stale bookmark
 * or a hand-edited URL should show unfiltered results, not an error page.
 */
export function parseEpisodeFilter(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): EpisodeFilter {
  const get = (key: string): string | undefined => {
    if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const getAll = (key: string): string[] => {
    if (params instanceof URLSearchParams) return params.getAll(key);
    const value = params[key];
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
  };

  // Multi-value fields accept either repeated keys (?loc=a&loc=b) or a single
  // comma-separated value (?loc=a,b) so links stay short.
  const idList = (key: string): string[] =>
    getAll(key)
      .flatMap((entry) => entry.split(","))
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

  return episodeFilterSchema.parse({
    from: get("from") || undefined,
    to: get("to") || undefined,
    status: get("status"),
    minSeverity: get("minSeverity") || undefined,
    maxSeverity: get("maxSeverity") || undefined,
    painType: get("painType") || undefined,
    search: get("q") || undefined,
    locationIds: idList("loc"),
    characteristicIds: idList("char"),
    triggerIds: idList("trig"),
    symptomIds: idList("symp"),
    treatmentTypeIds: idList("treat"),
    page: get("page") || undefined,
  });
}

/** Rebuilds a query string from a filter, dropping anything at its default. */
export function episodeFilterToSearchParams(
  filter: Partial<EpisodeFilter>,
): URLSearchParams {
  const params = new URLSearchParams();

  if (filter.from) params.set("from", toDateInput(filter.from));
  if (filter.to) params.set("to", toDateInput(filter.to));
  if (filter.status && filter.status !== "all") params.set("status", filter.status);
  if (filter.minSeverity != null) params.set("minSeverity", String(filter.minSeverity));
  if (filter.maxSeverity != null) params.set("maxSeverity", String(filter.maxSeverity));
  if (filter.painType) params.set("painType", filter.painType);
  if (filter.search) params.set("q", filter.search);
  if (filter.locationIds?.length) params.set("loc", filter.locationIds.join(","));
  if (filter.characteristicIds?.length)
    params.set("char", filter.characteristicIds.join(","));
  if (filter.triggerIds?.length) params.set("trig", filter.triggerIds.join(","));
  if (filter.symptomIds?.length) params.set("symp", filter.symptomIds.join(","));
  if (filter.treatmentTypeIds?.length)
    params.set("treat", filter.treatmentTypeIds.join(","));
  if (filter.page && filter.page > 1) params.set("page", String(filter.page));

  return params;
}

function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Translates a filter into a Prisma `where` clause.
 *
 * Notes on the semantics chosen here:
 *  - Date range uses **overlap**, not containment. An episode that started
 *    before the range and is still going is happening during the range, so it
 *    matches. Filtering on `startedAt` alone would hide exactly the long
 *    episodes most worth seeing.
 *  - Severity filters on **peak** severity: "show me everything that got to 8
 *    or worse" is the question people actually ask.
 *  - Multiple values within one category are OR-ed (any of these locations);
 *    different categories are AND-ed (this location AND that trigger).
 */
export function buildEpisodeWhere(
  userId: string,
  filter: EpisodeFilter,
): Prisma.EpisodeWhereInput {
  const where: Prisma.EpisodeWhereInput = { userId };
  const and: Prisma.EpisodeWhereInput[] = [];

  if (filter.from) {
    // Episode has not already finished before the window opens.
    and.push({
      OR: [{ endedAt: null }, { endedAt: { gte: filter.from } }],
    });
  }

  if (filter.to) {
    // Episode had started by the time the window closes.
    and.push({ startedAt: { lte: endOfDay(filter.to) } });
  }

  if (filter.status === "active") {
    and.push({ endedAt: null });
  } else if (filter.status === "completed") {
    and.push({ endedAt: { not: null } });
  }

  if (filter.minSeverity != null) {
    and.push({ peakSeverity: { gte: filter.minSeverity } });
  }
  if (filter.maxSeverity != null) {
    and.push({ peakSeverity: { lte: filter.maxSeverity } });
  }

  if (filter.painType) {
    and.push({ painType: { contains: filter.painType, mode: "insensitive" } });
  }

  if (filter.search) {
    and.push({
      OR: [
        { description: { contains: filter.search, mode: "insensitive" } },
        { notes: { contains: filter.search, mode: "insensitive" } },
        { painType: { contains: filter.search, mode: "insensitive" } },
      ],
    });
  }

  if (filter.locationIds.length > 0) {
    and.push({ locations: { some: { locationId: { in: filter.locationIds } } } });
  }
  if (filter.characteristicIds.length > 0) {
    and.push({
      characteristics: {
        some: { characteristicId: { in: filter.characteristicIds } },
      },
    });
  }
  if (filter.triggerIds.length > 0) {
    and.push({ triggers: { some: { triggerId: { in: filter.triggerIds } } } });
  }
  if (filter.symptomIds.length > 0) {
    and.push({ symptoms: { some: { symptomId: { in: filter.symptomIds } } } });
  }
  if (filter.treatmentTypeIds.length > 0) {
    and.push({
      treatments: { some: { treatmentTypeId: { in: filter.treatmentTypeIds } } },
    });
  }

  if (and.length > 0) where.AND = and;

  return where;
}

/** A `to` of 2024-03-01 means "through the end of 1 March". */
export function endOfDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function hasActiveFilters(filter: EpisodeFilter): boolean {
  return Boolean(
    filter.from ||
      filter.to ||
      filter.status !== "all" ||
      filter.minSeverity != null ||
      filter.maxSeverity != null ||
      filter.painType ||
      filter.search ||
      filter.locationIds.length ||
      filter.characteristicIds.length ||
      filter.triggerIds.length ||
      filter.symptomIds.length ||
      filter.treatmentTypeIds.length,
  );
}
