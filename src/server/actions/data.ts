"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/user";
import {
  actionError,
  actionOk,
  withActionErrorHandling,
  type ActionResult,
} from "@/lib/errors";
import { boolean } from "@/lib/form-data";
import { parseImportFile, type ImportIssue, type ImportSummary } from "@/lib/import";
import { importEpisodes, type ImportResult } from "@/server/import";

/**
 * JSON import.
 *
 * The file is validated in full before anything is written. Validation
 * failures are reported per entry ("Episode 3 > measurements > 1"), and the
 * "check only" option lets a file be inspected without importing it.
 */

export type ImportActionData =
  | { kind: "checked"; summary: ImportSummary }
  | { kind: "imported"; summary: ImportSummary; result: ImportResult };

/** Generous for years of tracking, small enough to reject a mis-picked file. */
const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

export async function importDataAction(
  _previous: ActionResult<ImportActionData> | null,
  formData: FormData,
): Promise<ActionResult<ImportActionData>> {
  const user = await requireUser();

  return withActionErrorHandling("importDataAction", async () => {
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return actionError("Choose a JSON file to import.");
    }

    if (file.size > MAX_IMPORT_BYTES) {
      return actionError(
        `That file is ${formatBytes(file.size)}, which is larger than the ${formatBytes(
          MAX_IMPORT_BYTES,
        )} limit.`,
      );
    }

    const parsed = parseImportFile(await file.text());

    if (!parsed.ok) {
      return actionError(
        `This file could not be imported. ${describeIssueCount(parsed.issues)}`,
        issuesToFieldErrors(parsed.issues),
      );
    }

    if (boolean(formData, "checkOnly")) {
      return actionOk<ImportActionData>({ kind: "checked", summary: parsed.summary });
    }

    const result = await importEpisodes(user.id, parsed.episodes, {
      skipDuplicates: boolean(formData, "skipDuplicates"),
    });

    revalidatePath("/");
    revalidatePath("/episodes");
    revalidatePath("/calendar");
    revalidatePath("/statistics");

    return actionOk<ImportActionData>({
      kind: "imported",
      summary: parsed.summary,
      result,
    });
  });
}

function issuesToFieldErrors(issues: readonly ImportIssue[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const issue of issues) {
    (grouped[issue.path] ??= []).push(issue.message);
  }
  return grouped;
}

function describeIssueCount(issues: readonly ImportIssue[]): string {
  return issues.length === 1
    ? "One problem was found - nothing was imported."
    : `${issues.length} problems were found - nothing was imported.`;
}

function formatBytes(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  return megabytes >= 1
    ? `${megabytes.toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
