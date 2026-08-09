import { z } from "zod";

import { MAX_SEVERITY, MIN_SEVERITY } from "@/lib/pain-scale";

/**
 * Server-side validation contracts.
 *
 * Every mutation parses its input through one of these schemas before touching
 * the database. Client-side checks exist only to give faster feedback; they are
 * never the thing that keeps bad data out.
 */

const MAX_SHORT_TEXT = 200;
const MAX_LONG_TEXT = 5_000;

/** cuid()s are what Prisma generates for every id in this schema. */
export const idSchema = z.string().trim().min(1, "Required").max(64);

export const severitySchema = z
  .number({ error: "Pain level is required" })
  .int("Pain level must be a whole number")
  .min(MIN_SEVERITY, `Pain level must be at least ${MIN_SEVERITY}`)
  .max(MAX_SEVERITY, `Pain level must be at most ${MAX_SEVERITY}`);

export const effectivenessSchema = z
  .number()
  .int("Effectiveness must be a whole number")
  .min(0, "Effectiveness must be at least 0%")
  .max(100, "Effectiveness must be at most 100%");

/**
 * Accepts a Date or an ISO/`datetime-local` string and rejects anything that
 * does not parse. `datetime-local` inputs submit `2024-01-31T14:30` with no
 * timezone, which `new Date()` reads as local time - which is what the user
 * meant.
 */
export const dateSchema = z.union([z.date(), z.string()]).transform((value, ctx) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    ctx.addIssue({ code: "custom", message: "Enter a valid date and time" });
    return z.NEVER;
  }
  return date;
});

const optionalText = (max: number) =>
  z
    .string()
    .max(max, `Must be ${max} characters or fewer`)
    .trim()
    .transform((value) => (value.length === 0 ? null : value))
    .nullish()
    .transform((value) => value ?? null);

export const shortText = optionalText(MAX_SHORT_TEXT);
export const longText = optionalText(MAX_LONG_TEXT);

export const idListSchema = z
  .array(idSchema)
  .max(100, "Too many items selected")
  // De-duplicate so a repeated checkbox cannot violate the join-table PK.
  .transform((ids) => Array.from(new Set(ids)))
  .default([]);

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

/**
 * Trimming and lower-casing happen *before* the format check: an address
 * pasted with a trailing space is a valid address, and rejecting it as
 * malformed would be a confusing dead end at the login form.
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address").max(254));

/**
 * Length is the only rule. Composition rules push people toward predictable
 * substitutions; a long passphrase is stronger and easier to remember.
 */
export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200, "Must be 200 characters or fewer");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(200),
});

export const registerSchema = z.object({
  email: emailSchema,
  name: shortText,
  password: passwordSchema,
});

// ---------------------------------------------------------------------------
// Episodes
// ---------------------------------------------------------------------------

const episodeCoreShape = {
  startedAt: dateSchema,
  endedAt: dateSchema.nullish().transform((value) => value ?? null),
  painType: shortText,
  description: longText,
  notes: longText,
  locationIds: idListSchema,
  characteristicIds: idListSchema,
  triggerIds: idListSchema,
  symptomIds: idListSchema,
};

/** Absorbs clock skew between the browser and the server. */
const FUTURE_TOLERANCE_MS = 60_000;

/**
 * An episode may not end before it starts, and may not start in the future -
 * this is a record of what happened, not a plan.
 */
function checkChronology(
  data: { startedAt: Date; endedAt: Date | null },
  ctx: z.RefinementCtx,
): void {
  const latestAllowed = Date.now() + FUTURE_TOLERANCE_MS;

  if (data.endedAt != null && data.endedAt.getTime() < data.startedAt.getTime()) {
    ctx.addIssue({
      code: "custom",
      message: "The end time cannot be before the start time",
      path: ["endedAt"],
    });
  }

  if (data.startedAt.getTime() > latestAllowed) {
    ctx.addIssue({
      code: "custom",
      message: "The start time cannot be in the future",
      path: ["startedAt"],
    });
  }

  if (data.endedAt != null && data.endedAt.getTime() > latestAllowed) {
    ctx.addIssue({
      code: "custom",
      message: "The end time cannot be in the future",
      path: ["endedAt"],
    });
  }
}

export const createEpisodeSchema = z
  .object({
    ...episodeCoreShape,
    /** Seeds the timeline with its first reading. */
    severity: severitySchema,
  })
  .superRefine(checkChronology);

export const updateEpisodeSchema = z
  .object({
    id: idSchema,
    ...episodeCoreShape,
  })
  .superRefine(checkChronology);

export const endEpisodeSchema = z.object({
  id: idSchema,
  endedAt: dateSchema.nullish().transform((value) => value ?? null),
  /** Optional closing reading, recorded at the end time. */
  severity: severitySchema.nullish().transform((value) => value ?? null),
  note: shortText,
});

export const deleteEpisodeSchema = z.object({ id: idSchema });

export const reopenEpisodeSchema = z.object({ id: idSchema });

// ---------------------------------------------------------------------------
// Measurements
// ---------------------------------------------------------------------------

export const addMeasurementSchema = z.object({
  episodeId: idSchema,
  severity: severitySchema,
  recordedAt: dateSchema.nullish().transform((value) => value ?? null),
  note: shortText,
});

export const deleteMeasurementSchema = z.object({
  id: idSchema,
  episodeId: idSchema,
});

// ---------------------------------------------------------------------------
// Treatments
// ---------------------------------------------------------------------------

export const treatmentSchema = z.object({
  episodeId: idSchema,
  treatmentTypeId: idSchema.nullish().transform((value) => value ?? null),
  medicationName: shortText,
  dose: shortText,
  takenAt: dateSchema.nullish().transform((value) => value ?? null),
  effectiveness: effectivenessSchema.nullish().transform((value) => value ?? null),
  notes: longText,
});

export const updateTreatmentSchema = treatmentSchema.extend({ id: idSchema });

export const deleteTreatmentSchema = z.object({
  id: idSchema,
  episodeId: idSchema,
});

// ---------------------------------------------------------------------------
// Taxonomy
// ---------------------------------------------------------------------------

export const taxonomyKindSchema = z.enum([
  "location",
  "characteristic",
  "trigger",
  "symptom",
  "treatmentType",
]);

export type TaxonomyKind = z.infer<typeof taxonomyKindSchema>;

export const createTaxonomyItemSchema = z.object({
  kind: taxonomyKindSchema,
  name: z.string().trim().min(1, "Enter a name").max(MAX_SHORT_TEXT),
  /** Locations only. */
  parentId: idSchema.nullish().transform((value) => value ?? null),
  isMedication: z.boolean().default(false),
});

export const updateTaxonomyItemSchema = z.object({
  kind: taxonomyKindSchema,
  id: idSchema,
  name: z.string().trim().min(1, "Enter a name").max(MAX_SHORT_TEXT).optional(),
  archived: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

export const episodeStatusSchema = z.enum(["all", "active", "completed"]);

/**
 * Parsed from the query string, so every field arrives as a string or is
 * missing entirely. Unknown or malformed values fall back to defaults rather
 * than erroring - a bad bookmark should not produce an error page.
 */
export const episodeFilterSchema = z.object({
  from: dateSchema.nullish().catch(null).transform((v) => v ?? null),
  to: dateSchema.nullish().catch(null).transform((v) => v ?? null),
  status: episodeStatusSchema.catch("all").default("all"),
  minSeverity: z.coerce.number().int().min(0).max(10).nullish().catch(null),
  maxSeverity: z.coerce.number().int().min(0).max(10).nullish().catch(null),
  painType: z.string().trim().max(MAX_SHORT_TEXT).nullish().catch(null),
  search: z.string().trim().max(MAX_SHORT_TEXT).nullish().catch(null),
  locationIds: idListSchema.catch([]),
  characteristicIds: idListSchema.catch([]),
  triggerIds: idListSchema.catch([]),
  symptomIds: idListSchema.catch([]),
  treatmentTypeIds: idListSchema.catch([]),
  page: z.coerce.number().int().min(1).catch(1).default(1),
});

export type EpisodeFilter = z.infer<typeof episodeFilterSchema>;

export type CreateEpisodeInput = z.infer<typeof createEpisodeSchema>;
export type UpdateEpisodeInput = z.infer<typeof updateEpisodeSchema>;
export type AddMeasurementInput = z.infer<typeof addMeasurementSchema>;
export type TreatmentInput = z.infer<typeof treatmentSchema>;
