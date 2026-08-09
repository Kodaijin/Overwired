"use client";

import { useSyncExternalStore } from "react";

import { formatDuration, formatDurationLong } from "@/lib/duration";

/**
 * Elapsed time for an episode, refreshed once a minute while it is ongoing.
 *
 * The current time is an external, changing value, so it is read through
 * `useSyncExternalStore` rather than by calling `Date.now()` during render.
 * That keeps the component pure (React may re-render at any time and must get
 * the same answer), and it means the duration is derived from the live props
 * on every render - ending an episode immediately stops the count, where a
 * value kept in state would keep going.
 *
 * `initialSeconds` is what the server computed. It is the snapshot used for
 * server rendering and hydration, so the first paint shows the real duration
 * instead of zero.
 */
export function LiveDuration({
  startedAt,
  endedAt,
  initialSeconds,
  className,
}: {
  startedAt: Date | string;
  endedAt?: Date | string | null;
  initialSeconds: number;
  className?: string;
}) {
  const startMs = toTimestamp(startedAt);
  const endMs = endedAt == null ? null : toTimestamp(endedAt);

  const now = useSyncExternalStore(
    subscribeToMinuteTicks,
    getCachedNow,
    // Server and hydration render: reuse the server's own measurement.
    () => startMs + initialSeconds * 1000,
  );

  const seconds = elapsed(startMs, endMs, now);

  return (
    <span className={className}>
      <span aria-hidden="true">{formatDuration(seconds)}</span>
      <span className="sr-only">
        {formatDurationLong(seconds)}
        {endMs == null ? " and counting" : ""}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// A single shared minute ticker
// ---------------------------------------------------------------------------
//
// One interval drives every LiveDuration on the page. The snapshot has to be
// cached rather than computed per call: `useSyncExternalStore` compares
// successive snapshots, and a fresh `Date.now()` each time would look like a
// change on every render and loop.

let cachedNow = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribeToMinuteTicks(onStoreChange: () => void): () => void {
  // Nothing kept the cache warm while there were no subscribers. React re-reads
  // the snapshot right after subscribing, so refreshing here is enough.
  cachedNow = Date.now();
  listeners.add(onStoreChange);

  timer ??= setInterval(() => {
    cachedNow = Date.now();
    for (const listener of listeners) listener();
  }, 60_000);

  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getCachedNow(): number {
  return cachedNow;
}

function toTimestamp(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function elapsed(startMs: number, endMs: number | null, now: number): number {
  const end = endMs ?? now;
  if (!Number.isFinite(end - startMs)) return 0;
  return Math.max(0, Math.floor((end - startMs) / 1000));
}
