"use client";

import { useActionState } from "react";
import { format } from "date-fns";

import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/errors";
import { importDataAction, type ImportActionData } from "@/server/actions/data";

/**
 * JSON import.
 *
 * "Check the file first" runs the same validation without writing anything, so
 * a file can be inspected before it touches the log. Either way, validation
 * happens before any insert - a file with a bad entry imports nothing.
 */
export function ImportForm() {
  const [result, formAction] = useActionState<
    ActionResult<ImportActionData> | null,
    FormData
  >(importDataAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage result={result} />

      {result?.ok && <ImportOutcome data={result.data} />}

      <div className="space-y-2">
        <Label htmlFor="file">JSON file</Label>
        <Input
          id="file"
          name="file"
          type="file"
          accept="application/json,.json"
          required
          aria-describedby="file-hint"
        />
        <p id="file-hint" className="text-muted-foreground text-sm">
          A file exported from this app. Locations, triggers and other entries
          are matched by name, and created if they do not exist yet.
        </p>
      </div>

      <div className="space-y-2">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="skipDuplicates"
            defaultChecked
            className="mt-0.5"
          />
          <span>
            Skip episodes that start at a time already in your log
            <span className="text-muted-foreground block">
              Leave this on to re-import a file safely.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="checkOnly" className="mt-0.5" />
          <span>
            Check the file only
            <span className="text-muted-foreground block">
              Validates and reports what it contains without importing anything.
            </span>
          </span>
        </label>
      </div>

      <SubmitButton size="lg" pendingLabel="Reading file...">
        Import
      </SubmitButton>
    </form>
  );
}

function ImportOutcome({ data }: { data: ImportActionData }) {
  const { summary } = data;
  const range =
    summary.earliest && summary.latest
      ? `${format(summary.earliest, "d MMM yyyy")} to ${format(summary.latest, "d MMM yyyy")}`
      : "an unknown range";

  if (data.kind === "checked") {
    return (
      <Alert role="status">
        <AlertTitle>This file is valid - nothing was imported</AlertTitle>
        <AlertDescription>
          <p>
            It contains {summary.episodes} episodes, {summary.measurements} pain
            readings and {summary.treatments} treatments, covering {range}.
          </p>
          <p>
            Uncheck &ldquo;Check the file only&rdquo; and submit again to import
            it.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  const { result } = data;

  return (
    <Alert role="status">
      <AlertTitle>
        Imported {result.imported} {result.imported === 1 ? "episode" : "episodes"}
      </AlertTitle>
      <AlertDescription>
        <p>
          {result.measurements} pain readings and {result.treatments} treatments
          were added, covering {range}.
        </p>
        {result.skipped > 0 && (
          <p>
            {result.skipped} {result.skipped === 1 ? "episode was" : "episodes were"}{" "}
            skipped because your log already had an episode starting at the same
            time.
          </p>
        )}
        {result.taxonomyCreated > 0 && (
          <p>
            {result.taxonomyCreated} new{" "}
            {result.taxonomyCreated === 1 ? "entry was" : "entries were"} added to
            your locations, triggers and other lists.
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
