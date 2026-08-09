import { durationSeconds, formatDuration } from "@/lib/duration";
import { computeAggregates } from "@/lib/episode-metrics";
import {
  EXPORT_FORMAT,
  EXPORT_VERSION,
  type ExportDocument,
  type ExportEpisode,
} from "@/lib/export-format";

/**
 * Serialisation for data export.
 *
 * Everything here is pure: it takes already-loaded episodes and returns a
 * string. That keeps the formats directly testable and keeps the route
 * handlers to "load, serialise, respond".
 */

export interface ExportableEpisode {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  painType: string | null;
  description: string | null;
  notes: string | null;
  locations: string[];
  characteristics: string[];
  triggers: string[];
  symptoms: string[];
  measurements: { recordedAt: Date; severity: number; note: string | null }[];
  treatments: {
    type: string | null;
    medicationName: string | null;
    dose: string | null;
    takenAt: Date;
    effectiveness: number | null;
    notes: string | null;
  }[];
}

export function buildExportDocument(
  episodes: readonly ExportableEpisode[],
  exportedAt: Date = new Date(),
): ExportDocument {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: exportedAt.toISOString(),
    episodes: episodes.map(toExportEpisode),
  };
}

function toExportEpisode(episode: ExportableEpisode): ExportEpisode {
  return {
    startedAt: episode.startedAt.toISOString(),
    endedAt: episode.endedAt ? episode.endedAt.toISOString() : null,
    painType: episode.painType,
    description: episode.description,
    notes: episode.notes,
    locations: episode.locations,
    characteristics: episode.characteristics,
    triggers: episode.triggers,
    symptoms: episode.symptoms,
    measurements: episode.measurements.map((m) => ({
      recordedAt: m.recordedAt.toISOString(),
      severity: m.severity,
      note: m.note,
    })),
    treatments: episode.treatments.map((t) => ({
      type: t.type,
      medicationName: t.medicationName,
      dose: t.dose,
      takenAt: t.takenAt.toISOString(),
      effectiveness: t.effectiveness,
      notes: t.notes,
    })),
  };
}

export function exportToJson(
  episodes: readonly ExportableEpisode[],
  exportedAt?: Date,
): string {
  return JSON.stringify(buildExportDocument(episodes, exportedAt), null, 2);
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

export type CsvDataset = "episodes" | "measurements" | "treatments";

/**
 * One row per episode, with list fields joined by `; `.
 *
 * Ongoing episodes report the duration elapsed at export time and are flagged
 * in the `ongoing` column, so a reader can tell a 4-hour finished episode from
 * one that has been running 4 hours and counting.
 */
export function episodesToCsv(
  episodes: readonly ExportableEpisode[],
  now: Date = new Date(),
): string {
  const rows = episodes.map((episode) => {
    const aggregates = computeAggregates(episode.measurements);
    const seconds = durationSeconds(episode, now);

    return {
      episode_id: episode.id,
      started_at: episode.startedAt.toISOString(),
      ended_at: episode.endedAt?.toISOString() ?? "",
      ongoing: episode.endedAt ? "no" : "yes",
      duration_seconds: seconds,
      duration_human: formatDuration(seconds),
      pain_type: episode.painType ?? "",
      current_severity: aggregates.currentSeverity ?? "",
      peak_severity: aggregates.peakSeverity ?? "",
      min_severity: aggregates.minSeverity ?? "",
      average_severity: aggregates.averageSeverity ?? "",
      reading_count: aggregates.measurementCount,
      locations: episode.locations.join("; "),
      characteristics: episode.characteristics.join("; "),
      triggers: episode.triggers.join("; "),
      symptoms: episode.symptoms.join("; "),
      treatments: episode.treatments
        .map((t) => t.medicationName ?? t.type ?? "Treatment")
        .join("; "),
      description: episode.description ?? "",
      notes: episode.notes ?? "",
    };
  });

  return toCsv(rows);
}

/** One row per severity reading - the shape you want for charting elsewhere. */
export function measurementsToCsv(episodes: readonly ExportableEpisode[]): string {
  const rows = episodes.flatMap((episode) =>
    episode.measurements.map((measurement) => ({
      episode_id: episode.id,
      episode_started_at: episode.startedAt.toISOString(),
      recorded_at: measurement.recordedAt.toISOString(),
      severity: measurement.severity,
      note: measurement.note ?? "",
      locations: episode.locations.join("; "),
      pain_type: episode.painType ?? "",
    })),
  );

  return toCsv(rows);
}

export function treatmentsToCsv(episodes: readonly ExportableEpisode[]): string {
  const rows = episodes.flatMap((episode) =>
    episode.treatments.map((treatment) => ({
      episode_id: episode.id,
      episode_started_at: episode.startedAt.toISOString(),
      taken_at: treatment.takenAt.toISOString(),
      treatment_type: treatment.type ?? "",
      medication_name: treatment.medicationName ?? "",
      dose: treatment.dose ?? "",
      effectiveness_percent: treatment.effectiveness ?? "",
      notes: treatment.notes ?? "",
    })),
  );

  return toCsv(rows);
}

export function exportToCsv(
  episodes: readonly ExportableEpisode[],
  dataset: CsvDataset,
  now?: Date,
): string {
  switch (dataset) {
    case "episodes":
      return episodesToCsv(episodes, now);
    case "measurements":
      return measurementsToCsv(episodes);
    case "treatments":
      return treatmentsToCsv(episodes);
  }
}

type CsvValue = string | number | null | undefined;

/**
 * RFC 4180 CSV.
 *
 * A leading `=`, `+`, `-` or `@` is prefixed with a single quote: spreadsheets
 * treat those as formulas, and a note that starts with "-" should stay a note.
 */
export function toCsv(rows: readonly Record<string, CsvValue>[]): string {
  if (rows.length === 0) return "";

  const headers = Object.keys(rows[0]);
  const lines = [headers.map(escapeCsvCell).join(",")];

  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsvCell(row[header])).join(","));
  }

  return `${lines.join("\r\n")}\r\n`;
}

function escapeCsvCell(value: CsvValue): string {
  if (value == null) return "";

  let text = String(value);

  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}
