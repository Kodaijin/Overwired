"use client";

import { useCallback, useRef, useState } from "react";
import { PlusIcon, XIcon } from "lucide-react";

import { DateTimeField } from "@/components/datetime-field";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
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

/** Matches the bound in `addTreatmentsSchema`. */
const MAX_ROWS = 10;

interface Row {
  /** Stable across adds and removes, so a row's fields follow the row. */
  key: number;
  typeId: string;
  effectiveness: number | null;
}

const newRow = (key: number): Row => ({ key, typeId: "", effectiveness: null });

/**
 * Records treatments against an episode.
 *
 * Responding to pain is rarely one thing - a pill, a heat pack and a dark room
 * often happen together - so several can be entered at once. Each row is saved
 * as its own entry with its own time and effectiveness, which is what makes
 * "did the ibuprofen help, or was it lying down?" answerable later.
 *
 * Field names carry the row's key (`dose.3`), so removing a row cannot shift
 * another row's answers onto the wrong treatment.
 */
export function TreatmentForm({
  episodeId,
  treatmentTypes,
}: {
  episodeId: string;
  treatmentTypes: readonly TreatmentTypeOption[];
}) {
  const nextKey = useRef(1);
  const [rows, setRows] = useState<Row[]>(() => [newRow(0)]);
  const formRef = useRef<HTMLFormElement>(null);

  // Start from scratch after a save rather than resubmitting the last entry.
  const reset = useCallback(() => {
    formRef.current?.reset();
    setRows([newRow(nextKey.current++)]);
  }, []);

  const [result, formAction] = useFormAction(addTreatmentAction, reset);

  const addRow = useCallback(() => {
    setRows((current) =>
      current.length >= MAX_ROWS ? current : [...current, newRow(nextKey.current++)],
    );
  }, []);

  const removeRow = useCallback((key: number) => {
    setRows((current) =>
      current.length <= 1 ? current : current.filter((row) => row.key !== key),
    );
  }, []);

  const updateRow = useCallback((key: number, changes: Partial<Row>) => {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...changes } : row)),
    );
  }, []);

  const options = treatmentTypes.filter((type) => !type.archived);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <input type="hidden" name="episodeId" value={episodeId} />

      <FormMessage
        result={result}
        successMessage={rows.length > 1 ? "Treatments recorded." : "Treatment recorded."}
      />

      <ol className="space-y-4">
        {rows.map((row, index) => (
          <li key={row.key}>
            <TreatmentRow
              row={row}
              position={index + 1}
              showPosition={rows.length > 1}
              options={options}
              canRemove={rows.length > 1}
              onChange={updateRow}
              onRemove={removeRow}
            />
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton size="lg" pendingLabel="Saving...">
          {rows.length > 1 ? `Record ${rows.length} treatments` : "Record treatment"}
        </SubmitButton>

        {rows.length < MAX_ROWS ? (
          <Button type="button" variant="outline" onClick={addRow}>
            <PlusIcon aria-hidden="true" />
            Add another treatment
          </Button>
        ) : (
          <p className="text-muted-foreground text-sm">
            That is the most you can add at once. Save these, then add more.
          </p>
        )}
      </div>
    </form>
  );
}

/**
 * One treatment's fields.
 *
 * The medication name and dose only appear for treatment types flagged as
 * medication, so "applied heat" is not asked for a dosage.
 */
function TreatmentRow({
  row,
  position,
  showPosition,
  options,
  canRemove,
  onChange,
  onRemove,
}: {
  row: Row;
  position: number;
  showPosition: boolean;
  options: readonly TreatmentTypeOption[];
  canRemove: boolean;
  onChange: (key: number, changes: Partial<Row>) => void;
  onRemove: (key: number) => void;
}) {
  const { key } = row;
  const isMedication = options.find((type) => type.id === row.typeId)?.isMedication ?? false;

  return (
    <fieldset
      className={cn(
        "space-y-4",
        showPosition && "border-border rounded-lg border p-4",
      )}
    >
      {/* The legend has to be the fieldset's first child to name it, so it is
          always rendered and only hidden visually. */}
      <legend
        className={cn(
          "text-muted-foreground px-1 text-xs font-medium tracking-wide uppercase",
          !showPosition && "sr-only",
        )}
      >
        Treatment {position}
      </legend>

      <input type="hidden" name="treatmentRow" value={key} />
      <input type="hidden" name={`effectiveness.${key}`} value={row.effectiveness ?? ""} />

      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-2">
          <Label htmlFor={`treatmentTypeId-${key}`}>Treatment</Label>
          <select
            id={`treatmentTypeId-${key}`}
            name={`treatmentTypeId.${key}`}
            value={row.typeId}
            onChange={(event) => onChange(key, { typeId: event.target.value })}
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

        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(key)}
          >
            <XIcon aria-hidden="true" />
            <span className="sr-only">Remove treatment {position}</span>
          </Button>
        )}
      </div>

      {isMedication && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`medicationName-${key}`}>Medication name</Label>
            <Input
              id={`medicationName-${key}`}
              name={`medicationName.${key}`}
              placeholder="e.g. Ibuprofen"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`dose-${key}`}>Dose</Label>
            <Input id={`dose-${key}`} name={`dose.${key}`} placeholder="e.g. 400mg" />
          </div>
        </div>
      )}

      <DateTimeField
        id={`takenAt-${key}`}
        name={`takenAt.${key}`}
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
        <div
          className="flex flex-wrap gap-1.5"
          role="radiogroup"
          aria-label={`Effectiveness of treatment ${position}`}
        >
          {EFFECTIVENESS_STEPS.map((step) => {
            const selected = row.effectiveness === step.value;
            return (
              <button
                key={step.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() =>
                  onChange(key, { effectiveness: selected ? null : step.value })
                }
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
        <Label htmlFor={`treatment-notes-${key}`}>
          Notes <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea id={`treatment-notes-${key}`} name={`notes.${key}`} rows={2} />
      </div>
    </fieldset>
  );
}
