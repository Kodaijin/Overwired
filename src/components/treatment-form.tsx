"use client";

import { useCallback, useRef, useState } from "react";

import { DateTimeField } from "@/components/datetime-field";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/components/use-form-action";
import { cn } from "@/lib/utils";
import type { TreatmentTypeOption } from "@/server/taxonomy";
import { addTreatmentAction } from "@/server/actions/episodes";

const EFFECTIVENESS_STEPS = [
  { value: 0, label: "No effect" },
  { value: 25, label: "Slight" },
  { value: 50, label: "Moderate" },
  { value: 75, label: "Significant" },
  { value: 100, label: "Complete relief" },
] as const;

/**
 * Records a treatment against an episode.
 *
 * The medication name and dose fields only appear for treatment types flagged
 * as medication, so "applied heat" is not asked for a dosage.
 */
export function TreatmentForm({
  episodeId,
  treatmentTypes,
}: {
  episodeId: string;
  treatmentTypes: readonly TreatmentTypeOption[];
}) {
  const [typeId, setTypeId] = useState("");
  const [effectiveness, setEffectiveness] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the form after a save so the next treatment starts from scratch
  // instead of resubmitting the last one's details.
  const reset = useCallback(() => {
    formRef.current?.reset();
    setTypeId("");
    setEffectiveness(null);
  }, []);

  const [result, formAction] = useFormAction(addTreatmentAction, reset);

  const options = treatmentTypes.filter((type) => !type.archived);
  const isMedication = options.find((type) => type.id === typeId)?.isMedication ?? false;

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <input type="hidden" name="episodeId" value={episodeId} />
      <input type="hidden" name="effectiveness" value={effectiveness ?? ""} />

      <FormMessage result={result} successMessage="Treatment recorded." />

      <div className="space-y-2">
        <Label htmlFor="treatmentTypeId">Treatment</Label>
        <select
          id="treatmentTypeId"
          name="treatmentTypeId"
          value={typeId}
          onChange={(event) => setTypeId(event.target.value)}
          className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-lg border px-3 text-sm focus-visible:ring-3 focus-visible:outline-none"
        >
          <option value="">Choose a treatment...</option>
          {options.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </div>

      {isMedication && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="medicationName">Medication name</Label>
            <Input id="medicationName" name="medicationName" placeholder="e.g. Ibuprofen" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dose">Dose</Label>
            <Input id="dose" name="dose" placeholder="e.g. 400mg" />
          </div>
        </div>
      )}

      <DateTimeField
        id="takenAt"
        name="takenAt"
        label="When"
        hint="Leave empty to record it as now."
      />

      <fieldset className="space-y-2">
        <legend className="text-sm leading-none font-medium">
          Did it help?{" "}
          <span className="text-muted-foreground font-normal">
            (optional - you can come back and fill this in)
          </span>
        </legend>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Effectiveness">
          {EFFECTIVENESS_STEPS.map((step) => {
            const selected = effectiveness === step.value;
            return (
              <button
                key={step.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setEffectiveness(selected ? null : step.value)}
                className={cn(
                  "focus-visible:ring-ring rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:ring-3 focus-visible:outline-none",
                  selected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted",
                )}
              >
                {step.value}% - {step.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="treatment-notes">
          Notes <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea id="treatment-notes" name="notes" rows={2} />
      </div>

      <SubmitButton size="lg" pendingLabel="Saving...">
        Record treatment
      </SubmitButton>
    </form>
  );
}
