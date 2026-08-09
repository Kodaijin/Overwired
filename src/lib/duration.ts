/**
 * Duration helpers.
 *
 * An episode with no `endedAt` is still running, so its duration is measured
 * against "now" rather than being stored. Once it ends, the duration becomes a
 * fixed value that is cached on the row.
 */

export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
export const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;

export interface DurationInput {
  startedAt: Date;
  endedAt?: Date | null;
}

/**
 * Elapsed seconds for an episode.
 *
 * Returns the live elapsed time for ongoing episodes. Clocks and clock changes
 * can produce an end before the start; rather than surfacing a negative
 * duration in the UI, that is floored at 0. Input validation rejects
 * end-before-start on write, so a negative value here means the data was
 * already inconsistent.
 */
export function durationSeconds(
  { startedAt, endedAt }: DurationInput,
  now: Date = new Date(),
): number {
  const end = endedAt ?? now;
  const elapsedMs = end.getTime() - startedAt.getTime();
  if (!Number.isFinite(elapsedMs)) return 0;
  return Math.max(0, Math.floor(elapsedMs / 1000));
}

export function isOngoing(episode: { endedAt?: Date | null }): boolean {
  return episode.endedAt == null;
}

/**
 * Compact, human-readable duration: `45s`, `12m`, `2h 15m`, `3d 4h`.
 *
 * Shows at most two units - the extra precision is noise at longer scales.
 */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0m";

  const seconds = Math.floor(totalSeconds);

  if (seconds < SECONDS_PER_MINUTE) {
    return `${seconds}s`;
  }

  const days = Math.floor(seconds / SECONDS_PER_DAY);
  const hours = Math.floor((seconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

/** Spelled out for screen readers: `"2 hours 15 minutes"`. */
export function formatDurationLong(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0 minutes";

  const seconds = Math.floor(totalSeconds);
  if (seconds < SECONDS_PER_MINUTE) {
    return plural(seconds, "second");
  }

  const days = Math.floor(seconds / SECONDS_PER_DAY);
  const hours = Math.floor((seconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);

  const parts: string[] = [];
  if (days > 0) parts.push(plural(days, "day"));
  if (hours > 0) parts.push(plural(hours, "hour"));
  if (minutes > 0 && days === 0) parts.push(plural(minutes, "minute"));

  return parts.length > 0 ? parts.join(" ") : "0 minutes";
}

function plural(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
}
