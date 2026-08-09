"use client";

import { useActionState, useCallback, useRef, useState } from "react";

import { DateTimeField } from "@/components/datetime-field";
import { FormMessage } from "@/components/form-message";
import { SeverityPicker } from "@/components/severity-picker";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormAction } from "@/components/use-form-action";
import type { ActionResult } from "@/lib/errors";
import {
  addMeasurementAction,
  endEpisodeAction,
  reopenEpisodeAction,
} from "@/server/actions/episodes";

/**
 * The controls used while an episode is happening: add a reading, or end it.
 *
 * Adding a reading is the common case, so it is always open and needs one tap
 * plus submit. Ending is behind a toggle so it cannot be hit by accident.
 */
export function ActivePainControls({
  episodeId,
  currentSeverity,
}: {
  episodeId: string;
  currentSeverity: number | null;
}) {
  const [ending, setEnding] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Update this episode</CardTitle>
        <CardDescription>
          Each reading is added to the timeline. Earlier readings are never
          changed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <AddMeasurementForm episodeId={episodeId} currentSeverity={currentSeverity} />

        <div className="border-t pt-4">
          {ending ? (
            <EndEpisodeForm
              episodeId={episodeId}
              currentSeverity={currentSeverity}
              onCancel={() => setEnding(false)}
            />
          ) : (
            <Button variant="outline" size="lg" onClick={() => setEnding(true)}>
              End episode
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AddMeasurementForm({
  episodeId,
  currentSeverity,
}: {
  episodeId: string;
  currentSeverity: number | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the note after a successful save so the next reading starts fresh
  // rather than repeating the last note.
  const reset = useCallback(() => formRef.current?.reset(), []);

  const [result, formAction] = useFormAction(addMeasurementAction, reset);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <input type="hidden" name="episodeId" value={episodeId} />

      <FormMessage result={result} successMessage="Reading added to the timeline." />

      <SeverityPicker
        name="severity"
        label="Pain level now"
        defaultValue={currentSeverity}
      />

      <div className="space-y-2">
        <Label htmlFor="measurement-note">
          Note <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="measurement-note"
          name="note"
          placeholder="e.g. after standing up, woke me at night"
        />
      </div>

      <DateTimeField
        id="measurement-recordedAt"
        name="recordedAt"
        label="Time of this reading"
        hint="Leave empty to record it as now."
      />

      <SubmitButton size="lg" pendingLabel="Adding...">
        Add reading
      </SubmitButton>
    </form>
  );
}

function EndEpisodeForm({
  episodeId,
  currentSeverity,
  onCancel,
}: {
  episodeId: string;
  currentSeverity: number | null;
  onCancel: () => void;
}) {
  const [result, formAction] = useActionState<ActionResult<undefined> | null, FormData>(
    endEpisodeAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={episodeId} />

      <p className="text-sm font-medium">Ending this episode</p>
      <FormMessage result={result} />

      <DateTimeField
        id="end-endedAt"
        name="endedAt"
        label="When did it stop?"
        hint="Leave empty to end it now. The duration is worked out for you."
      />

      <SeverityPicker
        name="severity"
        label="Final pain level"
        defaultValue={currentSeverity != null ? 0 : null}
        required={false}
      />

      <div className="flex flex-wrap gap-2">
        <SubmitButton size="lg" pendingLabel="Ending...">
          End episode
        </SubmitButton>
        <Button type="button" variant="ghost" size="lg" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function ReopenEpisodeForm({ episodeId }: { episodeId: string }) {
  const [result, formAction] = useActionState<ActionResult<undefined> | null, FormData>(
    reopenEpisodeAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={episodeId} />
      <FormMessage result={result} />
      <SubmitButton variant="outline" size="lg" pendingLabel="Reopening...">
        Reopen episode
      </SubmitButton>
    </form>
  );
}
