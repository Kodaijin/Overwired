import { z } from "zod";

import { severitySchema } from "@/lib/schemas";

/**
 * The interchange format for export and import.
 *
 * Taxonomy is written out as names rather than ids so a file can be imported
 * into a different account (or a rebuilt database) and still line up. On
 * import, names are matched case-insensitively by slug and created when
 * missing.
 *
 * `version` exists so a future format change can be migrated rather than
 * rejected.
 */

export const EXPORT_FORMAT = "pain-tracker-export";
export const EXPORT_VERSION = 1;

export const exportMeasurementSchema = z.object({
  recordedAt: z.string(),
  severity: severitySchema,
  note: z.string().nullish().default(null),
});

export const exportTreatmentSchema = z.object({
  type: z.string().nullish().default(null),
  medicationName: z.string().nullish().default(null),
  dose: z.string().nullish().default(null),
  takenAt: z.string(),
  effectiveness: z.number().int().min(0).max(100).nullish().default(null),
  notes: z.string().nullish().default(null),
});

export const exportEpisodeSchema = z.object({
  startedAt: z.string(),
  endedAt: z.string().nullish().default(null),
  painType: z.string().nullish().default(null),
  description: z.string().nullish().default(null),
  notes: z.string().nullish().default(null),
  locations: z.array(z.string()).default([]),
  characteristics: z.array(z.string()).default([]),
  triggers: z.array(z.string()).default([]),
  symptoms: z.array(z.string()).default([]),
  measurements: z.array(exportMeasurementSchema).default([]),
  treatments: z.array(exportTreatmentSchema).default([]),
});

export const exportDocumentSchema = z.object({
  format: z.literal(EXPORT_FORMAT, {
    error: `Not a pain tracker export file (expected "format": "${EXPORT_FORMAT}")`,
  }),
  version: z
    .number()
    .int()
    .min(1)
    .max(EXPORT_VERSION, {
      error: `This file was written by a newer version of the app (supported up to version ${EXPORT_VERSION})`,
    }),
  exportedAt: z.string().optional(),
  episodes: z.array(exportEpisodeSchema),
});

export type ExportMeasurement = z.infer<typeof exportMeasurementSchema>;
export type ExportTreatment = z.infer<typeof exportTreatmentSchema>;
export type ExportEpisode = z.infer<typeof exportEpisodeSchema>;
export type ExportDocument = z.infer<typeof exportDocumentSchema>;
