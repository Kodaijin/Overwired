import { format, startOfDay, startOfMonth, startOfWeek } from "date-fns";

import { durationSeconds } from "@/lib/duration";
import { roundTo } from "@/lib/episode-metrics";

/**
 * Statistics over recorded data.
 *
 * These are descriptive summaries of what was entered - counts, means, extremes
 * and how often things co-occur. They are not analysis: a trigger that appears
 * alongside severe episodes is a pattern in the log, not a cause, and nothing
 * here should be presented as one.
 *
 * Every function is pure so the numbers can be tested directly.
 */

export interface StatsMeasurement {
  recordedAt: Date;
  severity: number;
}

export interface StatsTreatment {
  name: string;
  effectiveness: number | null;
}

export interface StatsEpisode {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  measurements: StatsMeasurement[];
  locations: string[];
  characteristics: string[];
  triggers: string[];
  symptoms: string[];
  treatments: StatsTreatment[];
}

export interface CountedItem {
  name: string;
  count: number;
}

export interface TreatmentEffectiveness {
  name: string;
  /** Times this treatment was recorded. */
  uses: number;
  /** Times an effectiveness value was actually filled in. */
  rated: number;
  /** Mean of the recorded percentages, or null when none were rated. */
  averageEffectiveness: number | null;
}

export interface EpisodeStatistics {
  episodeCount: number;
  activeCount: number;
  measurementCount: number;

  averageSeverity: number | null;
  highestSeverity: number | null;
  lowestSeverity: number | null;

  totalDurationSeconds: number;
  averageDurationSeconds: number | null;
  longestEpisode: { id: string; durationSeconds: number } | null;

  topLocations: CountedItem[];
  topCharacteristics: CountedItem[];
  topTriggers: CountedItem[];
  topSymptoms: CountedItem[];
  treatmentEffectiveness: TreatmentEffectiveness[];
}

export function computeStatistics(
  episodes: readonly StatsEpisode[],
  now: Date = new Date(),
): EpisodeStatistics {
  const allSeverities = episodes.flatMap((episode) =>
    episode.measurements.map((m) => m.severity),
  );

  // Ongoing episodes contribute the time elapsed so far, which is what makes
  // "total time in pain" meaningful while something is still happening.
  const durations = episodes.map((episode) => ({
    id: episode.id,
    seconds: durationSeconds(episode, now),
  }));

  const totalDurationSeconds = durations.reduce((sum, d) => sum + d.seconds, 0);
  const longest = durations.reduce<{ id: string; seconds: number } | null>(
    (best, current) => (best == null || current.seconds > best.seconds ? current : best),
    null,
  );

  return {
    episodeCount: episodes.length,
    activeCount: episodes.filter((episode) => episode.endedAt == null).length,
    measurementCount: allSeverities.length,

    averageSeverity: mean(allSeverities),
    highestSeverity: allSeverities.length > 0 ? Math.max(...allSeverities) : null,
    lowestSeverity: allSeverities.length > 0 ? Math.min(...allSeverities) : null,

    totalDurationSeconds,
    averageDurationSeconds:
      episodes.length > 0 ? Math.round(totalDurationSeconds / episodes.length) : null,
    longestEpisode:
      longest && episodes.length > 0
        ? { id: longest.id, durationSeconds: longest.seconds }
        : null,

    topLocations: countBy(episodes.flatMap((e) => e.locations)),
    topCharacteristics: countBy(episodes.flatMap((e) => e.characteristics)),
    topTriggers: countBy(episodes.flatMap((e) => e.triggers)),
    topSymptoms: countBy(episodes.flatMap((e) => e.symptoms)),
    treatmentEffectiveness: summariseTreatments(episodes.flatMap((e) => e.treatments)),
  };
}

/** Descending by count, then alphabetical so equal counts have a stable order. */
export function countBy(names: readonly string[]): CountedItem[] {
  const counts = new Map<string, number>();
  for (const name of names) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function summariseTreatments(
  treatments: readonly StatsTreatment[],
): TreatmentEffectiveness[] {
  const grouped = new Map<string, { uses: number; ratings: number[] }>();

  for (const treatment of treatments) {
    const entry = grouped.get(treatment.name) ?? { uses: 0, ratings: [] };
    entry.uses += 1;
    if (treatment.effectiveness != null) entry.ratings.push(treatment.effectiveness);
    grouped.set(treatment.name, entry);
  }

  return [...grouped.entries()]
    .map(([name, entry]) => ({
      name,
      uses: entry.uses,
      rated: entry.ratings.length,
      averageEffectiveness: mean(entry.ratings),
    }))
    .sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name));
}

export type Period = "day" | "week" | "month";

export interface PeriodPoint {
  /** ISO date of the bucket start, e.g. `2024-03-11`. */
  key: string;
  label: string;
  averageSeverity: number | null;
  maxSeverity: number | null;
  measurementCount: number;
}

/**
 * Buckets readings by day, week or month.
 *
 * Buckets with no readings are omitted rather than plotted as zero - "no data
 * recorded" and "no pain" are different, and charting them the same way would
 * make gaps in tracking look like pain-free stretches.
 */
export function averageByPeriod(
  measurements: readonly StatsMeasurement[],
  period: Period,
): PeriodPoint[] {
  const buckets = new Map<string, { date: Date; severities: number[] }>();

  for (const measurement of measurements) {
    const bucketStart = startOfPeriod(measurement.recordedAt, period);
    const key = format(bucketStart, "yyyy-MM-dd");
    const bucket = buckets.get(key) ?? { date: bucketStart, severities: [] };
    bucket.severities.push(measurement.severity);
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, bucket]) => ({
      key,
      label: formatPeriodLabel(bucket.date, period),
      averageSeverity: mean(bucket.severities),
      maxSeverity: bucket.severities.length > 0 ? Math.max(...bucket.severities) : null,
      measurementCount: bucket.severities.length,
    }));
}

export function startOfPeriod(date: Date, period: Period): Date {
  switch (period) {
    case "day":
      return startOfDay(date);
    case "week":
      return startOfWeek(date, { weekStartsOn: 1 });
    case "month":
      return startOfMonth(date);
  }
}

function formatPeriodLabel(date: Date, period: Period): string {
  switch (period) {
    case "day":
      return format(date, "d MMM");
    case "week":
      return `Week of ${format(date, "d MMM")}`;
    case "month":
      return format(date, "MMM yyyy");
  }
}

export interface Trend {
  current: number | null;
  previous: number | null;
  /** Positive means the recent average is higher than the one before it. */
  change: number | null;
}

/**
 * Compares the mean severity of the last `windowDays` against the `windowDays`
 * before that. Returns nulls when either side has no readings - a change
 * against nothing is not a trend.
 */
export function severityTrend(
  measurements: readonly StatsMeasurement[],
  windowDays: number,
  now: Date = new Date(),
): Trend {
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const currentStart = now.getTime() - windowMs;
  const previousStart = currentStart - windowMs;

  const current: number[] = [];
  const previous: number[] = [];

  for (const measurement of measurements) {
    const time = measurement.recordedAt.getTime();
    if (time >= currentStart && time <= now.getTime()) {
      current.push(measurement.severity);
    } else if (time >= previousStart && time < currentStart) {
      previous.push(measurement.severity);
    }
  }

  const currentMean = mean(current);
  const previousMean = mean(previous);

  return {
    current: currentMean,
    previous: previousMean,
    change:
      currentMean != null && previousMean != null
        ? roundTo(currentMean - previousMean, 2)
        : null,
  };
}

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return roundTo(total / values.length, 2);
}
