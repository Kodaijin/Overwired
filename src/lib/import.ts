import { z } from "zod";

import {
  exportDocumentSchema,
  type ExportDocument,
  type ExportEpisode,
} from "@/lib/export-format";
import { slugify } from "@/lib/taxonomy-defaults";

/**
 * Import validation.
 *
 * Nothing reaches the database until the whole file has been checked. The
 * caller gets either a fully normalised set of episodes or a list of issues
 * addressed to specific entries ("Episode 3: ..."), so a bad file can be fixed
 * rather than guessed at.
 */

export interface ImportIssue {
  /** Human-readable location within the file. */
  path: string;
  message: string;
}

export interface NormalizedMeasurement {
  recordedAt: Date;
  severity: number;
  note: string | null;
}

export interface NormalizedTreatment {
  typeName: string | null;
  medicationName: string | null;
  dose: string | null;
  takenAt: Date;
  effectiveness: number | null;
  notes: string | null;
}

export interface NormalizedEpisode {
  startedAt: Date;
  endedAt: Date | null;
  painType: string | null;
  description: string | null;
  notes: string | null;
  locations: string[];
  characteristics: string[];
  triggers: string[];
  symptoms: string[];
  measurements: NormalizedMeasurement[];
  treatments: NormalizedTreatment[];
}

export interface ImportSummary {
  episodes: number;
  measurements: number;
  treatments: number;
  /** Distinct taxonomy names referenced by the file, per category. */
  taxonomy: {
    locations: string[];
    characteristics: string[];
    triggers: string[];
    symptoms: string[];
    treatmentTypes: string[];
  };
  earliest: Date | null;
  latest: Date | null;
}

export type ImportParseResult =
  | { ok: true; episodes: NormalizedEpisode[]; summary: ImportSummary }
  | { ok: false; issues: ImportIssue[] };

/** Parses raw file text. Reports malformed JSON separately from schema errors. */
export function parseImportFile(raw: string): ImportParseResult {
  let json: unknown;

  try {
    json = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      issues: [
        {
          path: "File",
          message:
            "This file is not valid JSON. Export a fresh copy, or check that the file was not truncated.",
        },
      ],
    };
  }

  return validateImportDocument(json);
}

export function validateImportDocument(input: unknown): ImportParseResult {
  const parsed = exportDocumentSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, issues: toIssues(parsed.error) };
  }

  return normalizeDocument(parsed.data);
}

function normalizeDocument(document: ExportDocument): ImportParseResult {
  const issues: ImportIssue[] = [];
  const episodes: NormalizedEpisode[] = [];

  document.episodes.forEach((episode, index) => {
    const label = `Episode ${index + 1}`;
    const normalized = normalizeEpisode(episode, label, issues);
    if (normalized) episodes.push(normalized);
  });

  if (issues.length > 0) return { ok: false, issues };

  if (episodes.length === 0) {
    return {
      ok: false,
      issues: [{ path: "File", message: "This file contains no episodes to import." }],
    };
  }

  return { ok: true, episodes, summary: summarise(episodes) };
}

function normalizeEpisode(
  episode: ExportEpisode,
  label: string,
  issues: ImportIssue[],
): NormalizedEpisode | null {
  const before = issues.length;

  const startedAt = parseDate(episode.startedAt, `${label} start time`, issues);
  const endedAt = episode.endedAt
    ? parseDate(episode.endedAt, `${label} end time`, issues)
    : null;

  if (startedAt && endedAt && endedAt.getTime() < startedAt.getTime()) {
    issues.push({
      path: label,
      message: "The end time is before the start time.",
    });
  }

  const measurements: NormalizedMeasurement[] = [];
  episode.measurements.forEach((measurement, index) => {
    const recordedAt = parseDate(
      measurement.recordedAt,
      `${label}, reading ${index + 1}`,
      issues,
    );
    if (!recordedAt) return;
    measurements.push({
      recordedAt,
      severity: measurement.severity,
      note: emptyToNull(measurement.note),
    });
  });

  const treatments: NormalizedTreatment[] = [];
  episode.treatments.forEach((treatment, index) => {
    const takenAt = parseDate(
      treatment.takenAt,
      `${label}, treatment ${index + 1}`,
      issues,
    );
    if (!takenAt) return;
    treatments.push({
      typeName: emptyToNull(treatment.type),
      medicationName: emptyToNull(treatment.medicationName),
      dose: emptyToNull(treatment.dose),
      takenAt,
      effectiveness: treatment.effectiveness ?? null,
      notes: emptyToNull(treatment.notes),
    });
  });

  if (issues.length > before || !startedAt) return null;

  return {
    startedAt,
    endedAt,
    painType: emptyToNull(episode.painType),
    description: emptyToNull(episode.description),
    notes: emptyToNull(episode.notes),
    locations: cleanNames(episode.locations),
    characteristics: cleanNames(episode.characteristics),
    triggers: cleanNames(episode.triggers),
    symptoms: cleanNames(episode.symptoms),
    measurements,
    treatments,
  };
}

function summarise(episodes: readonly NormalizedEpisode[]): ImportSummary {
  const dates = episodes.flatMap((episode) => [
    episode.startedAt,
    ...(episode.endedAt ? [episode.endedAt] : []),
  ]);

  return {
    episodes: episodes.length,
    measurements: episodes.reduce((sum, e) => sum + e.measurements.length, 0),
    treatments: episodes.reduce((sum, e) => sum + e.treatments.length, 0),
    taxonomy: {
      locations: distinctNames(episodes.flatMap((e) => e.locations)),
      characteristics: distinctNames(episodes.flatMap((e) => e.characteristics)),
      triggers: distinctNames(episodes.flatMap((e) => e.triggers)),
      symptoms: distinctNames(episodes.flatMap((e) => e.symptoms)),
      treatmentTypes: distinctNames(
        episodes.flatMap((e) =>
          e.treatments.map((t) => t.typeName).filter((n): n is string => n != null),
        ),
      ),
    },
    earliest: dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null,
    latest: dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null,
  };
}

function parseDate(
  value: string,
  path: string,
  issues: ImportIssue[],
): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    issues.push({ path, message: `"${truncate(value)}" is not a valid date and time.` });
    return null;
  }
  return date;
}

/** Trims, drops blanks, and collapses names that differ only by case. */
function cleanNames(names: readonly string[]): string[] {
  return distinctNames(names);
}

function distinctNames(names: readonly string[]): string[] {
  const bySlug = new Map<string, string>();
  for (const name of names) {
    const trimmed = name.trim();
    if (trimmed.length === 0) continue;
    const slug = slugify(trimmed);
    if (!bySlug.has(slug)) bySlug.set(slug, trimmed);
  }
  return [...bySlug.values()];
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function truncate(value: string, max = 40): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

/** Rewrites Zod paths as `Episode 2 > measurements > 1 > severity`. */
function toIssues(error: z.ZodError): ImportIssue[] {
  return error.issues.slice(0, 50).map((issue) => ({
    path: formatPath(issue.path),
    message: issue.message,
  }));
}

function formatPath(path: readonly PropertyKey[]): string {
  if (path.length === 0) return "File";

  const parts: string[] = [];
  path.forEach((segment, index) => {
    if (typeof segment === "number") {
      // "episodes" -> "Episode 3"
      const parent = parts.pop();
      const singular = parent ? singularise(parent) : "Item";
      parts.push(`${singular} ${segment + 1}`);
      return;
    }
    parts.push(index === 0 ? capitalise(String(segment)) : String(segment));
  });

  return parts.join(" > ");
}

function singularise(word: string): string {
  return word.endsWith("s") ? word.slice(0, -1) : word;
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
