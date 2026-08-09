import { durationSeconds } from "@/lib/duration";

/**
 * Derived episode values.
 *
 * Severity readings are append-only, so peak/min/current are never stored
 * directly by the UI - they are recomputed from the measurement list. The
 * results are cached on the `episodes` row purely so that SQL can filter and
 * sort on them; this module is the single source of truth for the values.
 */

export interface MeasurementLike {
  recordedAt: Date;
  severity: number;
  /** Tie-breaker when two readings share a timestamp. */
  createdAt?: Date;
}

export interface EpisodeAggregates {
  currentSeverity: number | null;
  peakSeverity: number | null;
  minSeverity: number | null;
  averageSeverity: number | null;
  measurementCount: number;
}

/**
 * Chronological order: by `recordedAt`, then by `createdAt` so that two
 * readings entered for the same minute keep their insertion order.
 */
export function sortMeasurements<T extends MeasurementLike>(
  measurements: readonly T[],
): T[] {
  return [...measurements].sort((a, b) => {
    const byRecorded = a.recordedAt.getTime() - b.recordedAt.getTime();
    if (byRecorded !== 0) return byRecorded;
    return (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0);
  });
}

export function computeAggregates(
  measurements: readonly MeasurementLike[],
): EpisodeAggregates {
  if (measurements.length === 0) {
    return {
      currentSeverity: null,
      peakSeverity: null,
      minSeverity: null,
      averageSeverity: null,
      measurementCount: 0,
    };
  }

  const ordered = sortMeasurements(measurements);
  const severities = ordered.map((m) => m.severity);
  const total = severities.reduce((sum, value) => sum + value, 0);

  return {
    // "Current" is the most recent reading in time, not the most recently
    // entered - back-dating a reading must not change what the episode reads
    // as right now.
    currentSeverity: ordered[ordered.length - 1].severity,
    peakSeverity: Math.max(...severities),
    minSeverity: Math.min(...severities),
    averageSeverity: roundTo(total / severities.length, 2),
    measurementCount: severities.length,
  };
}

export interface EpisodeLike {
  startedAt: Date;
  endedAt?: Date | null;
}

/**
 * The full derived-field set written back to the `episodes` row.
 *
 * `durationSeconds` stays null while the episode is ongoing so that a stale
 * cached number can never be mistaken for a final duration.
 */
export function computeEpisodeCache(
  episode: EpisodeLike,
  measurements: readonly MeasurementLike[],
): EpisodeAggregates & { durationSeconds: number | null } {
  return {
    ...computeAggregates(measurements),
    durationSeconds:
      episode.endedAt == null ? null : durationSeconds(episode, episode.endedAt),
  };
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export { roundTo };
