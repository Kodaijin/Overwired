"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

import { requireUser } from "@/lib/auth/user";
import {
  actionError,
  actionOk,
  validationError,
  withActionErrorHandling,
  type ActionResult,
} from "@/lib/errors";
import { list, number, text } from "@/lib/form-data";
import {
  addMeasurementSchema,
  addTreatmentsSchema,
  createEpisodeSchema,
  deleteEpisodeSchema,
  deleteMeasurementSchema,
  deleteTreatmentSchema,
  endEpisodeSchema,
  reopenEpisodeSchema,
  updateEpisodeSchema,
  updateTreatmentSchema,
} from "@/lib/schemas";
import { readRow, readTreatmentRows } from "@/lib/treatment-rows";
import * as episodes from "@/server/episodes";
import { EpisodeNotFoundError, WindowConflictError } from "@/server/episodes";

/**
 * Server actions for episodes.
 *
 * Each one: authenticate, validate, call the data layer, then invalidate the
 * pages that show the changed data. Domain errors (a missing episode, a change
 * that would strand readings) become plain messages; anything unexpected is
 * logged server-side and reported generically.
 */

function refreshEpisodeViews(episodeId?: string): void {
  revalidatePath("/");
  revalidatePath("/episodes");
  revalidatePath("/calendar");
  revalidatePath("/statistics");
  if (episodeId) revalidatePath(`/episodes/${episodeId}`);
}

/** Maps the data layer's domain errors onto messages the user can act on. */
function toDomainError(error: unknown): ActionResult<never> | null {
  if (error instanceof WindowConflictError) return actionError(error.message);
  if (error instanceof EpisodeNotFoundError) {
    return actionError("That episode no longer exists. It may have been deleted.");
  }
  return null;
}

async function runDomain<T>(
  context: string,
  fn: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  return withActionErrorHandling(context, async () => {
    try {
      return await fn();
    } catch (error) {
      const domainError = toDomainError(error);
      if (domainError) return domainError;
      throw error;
    }
  });
}

function readEpisodeFields(formData: FormData) {
  return {
    startedAt: text(formData, "startedAt"),
    endedAt: text(formData, "endedAt"),
    painType: text(formData, "painType"),
    description: text(formData, "description"),
    notes: text(formData, "notes"),
    locationIds: list(formData, "locationIds"),
    characteristicIds: list(formData, "characteristicIds"),
    triggerIds: list(formData, "triggerIds"),
    symptomIds: list(formData, "symptomIds"),
  };
}

export async function createEpisodeAction(
  _previous: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  const user = await requireUser();
  let newEpisodeId: string | null = null;

  const result = await runDomain("createEpisodeAction", async () => {
    const parsed = createEpisodeSchema.safeParse({
      ...readEpisodeFields(formData),
      // Defaults to "now" so the quick-entry form only needs a pain level.
      startedAt: text(formData, "startedAt") ?? new Date(),
      severity: number(formData, "severity"),
    });

    if (!parsed.success) return validationError(parsed.error);

    newEpisodeId = await episodes.createEpisode(user.id, {
      startedAt: parsed.data.startedAt,
      endedAt: parsed.data.endedAt,
      severity: parsed.data.severity,
      painType: parsed.data.painType,
      description: parsed.data.description,
      notes: parsed.data.notes,
      locationIds: parsed.data.locationIds,
      characteristicIds: parsed.data.characteristicIds,
      triggerIds: parsed.data.triggerIds,
      symptomIds: parsed.data.symptomIds,
    });

    refreshEpisodeViews(newEpisodeId);
    return actionOk();
  });

  if (result.ok && newEpisodeId) redirect(`/episodes/${newEpisodeId}`);
  return result;
}

export async function updateEpisodeAction(
  _previous: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  const user = await requireUser();

  return runDomain("updateEpisodeAction", async () => {
    const parsed = updateEpisodeSchema.safeParse({
      id: text(formData, "id"),
      ...readEpisodeFields(formData),
    });

    if (!parsed.success) return validationError(parsed.error);

    await episodes.updateEpisode(user.id, parsed.data);
    refreshEpisodeViews(parsed.data.id);
    return actionOk();
  });
}

export async function addMeasurementAction(
  _previous: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  const user = await requireUser();

  return runDomain("addMeasurementAction", async () => {
    const parsed = addMeasurementSchema.safeParse({
      episodeId: text(formData, "episodeId"),
      severity: number(formData, "severity"),
      recordedAt: text(formData, "recordedAt"),
      note: text(formData, "note"),
    });

    if (!parsed.success) return validationError(parsed.error);

    await episodes.addMeasurement(user.id, parsed.data);
    refreshEpisodeViews(parsed.data.episodeId);
    return actionOk();
  });
}

export async function deleteMeasurementAction(
  _previous: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  const user = await requireUser();

  return runDomain("deleteMeasurementAction", async () => {
    const parsed = deleteMeasurementSchema.safeParse({
      id: text(formData, "id"),
      episodeId: text(formData, "episodeId"),
    });

    if (!parsed.success) return validationError(parsed.error);

    await episodes.deleteMeasurement(user.id, parsed.data);
    refreshEpisodeViews(parsed.data.episodeId);
    return actionOk();
  });
}

export async function endEpisodeAction(
  _previous: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  const user = await requireUser();

  return runDomain("endEpisodeAction", async () => {
    const parsed = endEpisodeSchema.safeParse({
      id: text(formData, "id"),
      endedAt: text(formData, "endedAt"),
      severity: number(formData, "severity"),
      note: text(formData, "note"),
    });

    if (!parsed.success) return validationError(parsed.error);

    await episodes.endEpisode(user.id, parsed.data);
    refreshEpisodeViews(parsed.data.id);
    return actionOk();
  });
}

export async function reopenEpisodeAction(
  _previous: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  const user = await requireUser();

  return runDomain("reopenEpisodeAction", async () => {
    const parsed = reopenEpisodeSchema.safeParse({ id: text(formData, "id") });
    if (!parsed.success) return validationError(parsed.error);

    await episodes.reopenEpisode(user.id, parsed.data.id);
    refreshEpisodeViews(parsed.data.id);
    return actionOk();
  });
}

export async function deleteEpisodeAction(
  _previous: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  const user = await requireUser();
  let deleted = false;

  const result = await runDomain("deleteEpisodeAction", async () => {
    const parsed = deleteEpisodeSchema.safeParse({ id: text(formData, "id") });
    if (!parsed.success) return validationError(parsed.error);

    await episodes.deleteEpisode(user.id, parsed.data.id);
    deleted = true;
    refreshEpisodeViews(parsed.data.id);
    return actionOk();
  });

  // The episode's own page no longer exists, so go back to the list.
  if (result.ok && deleted) redirect("/episodes");
  return result;
}

// ---------------------------------------------------------------------------
// Treatments
// ---------------------------------------------------------------------------

/** Field names are internal; the alert has to name the row a person can see. */
const TREATMENT_FIELD_LABELS: Record<string, string> = {
  treatmentTypeId: "treatment",
  medicationName: "medication name",
  dose: "dose",
  takenAt: "time",
  effectiveness: "effectiveness",
  notes: "notes",
};

/**
 * Turns `treatments.1.dose` into "Treatment 2 - dose".
 *
 * The shared `validationError` groups by the first path segment, which for a
 * list of rows would collapse every row's problems under one heading.
 */
function treatmentValidationError(error: z.ZodError<unknown>): ActionResult<never> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const [head, index, field] = issue.path;
    const key =
      head === "treatments" && typeof index === "number"
        ? `Treatment ${index + 1}${
            typeof field === "string"
              ? ` - ${TREATMENT_FIELD_LABELS[field] ?? field}`
              : ""
          }`
        : typeof head === "string"
          ? head
          : "Treatment";

    (fieldErrors[key] ??= []).push(issue.message);
  }

  const first = Object.values(fieldErrors)[0]?.[0];
  return actionError(
    first ?? "Please check the highlighted fields and try again.",
    fieldErrors,
  );
}

export async function addTreatmentAction(
  _previous: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  const user = await requireUser();

  return runDomain("addTreatmentAction", async () => {
    const parsed = addTreatmentsSchema.safeParse({
      episodeId: text(formData, "episodeId"),
      treatments: readTreatmentRows(formData),
    });

    if (!parsed.success) return treatmentValidationError(parsed.error);

    await episodes.addTreatments(
      user.id,
      parsed.data.episodeId,
      parsed.data.treatments,
    );
    refreshEpisodeViews(parsed.data.episodeId);
    return actionOk();
  });
}

export async function updateTreatmentAction(
  _previous: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  const user = await requireUser();

  return runDomain("updateTreatmentAction", async () => {
    const parsed = updateTreatmentSchema.safeParse({
      id: text(formData, "id"),
      episodeId: text(formData, "episodeId"),
      ...readRow(formData, ""),
    });
    if (!parsed.success) return validationError(parsed.error);

    await episodes.updateTreatment(user.id, parsed.data);
    refreshEpisodeViews(parsed.data.episodeId);
    return actionOk();
  });
}

export async function deleteTreatmentAction(
  _previous: ActionResult<undefined> | null,
  formData: FormData,
): Promise<ActionResult<undefined>> {
  const user = await requireUser();

  return runDomain("deleteTreatmentAction", async () => {
    const parsed = deleteTreatmentSchema.safeParse({
      id: text(formData, "id"),
      episodeId: text(formData, "episodeId"),
    });
    if (!parsed.success) return validationError(parsed.error);

    await episodes.deleteTreatment(user.id, parsed.data);
    refreshEpisodeViews(parsed.data.episodeId);
    return actionOk();
  });
}
