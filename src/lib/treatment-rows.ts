import { list, number, text } from "@/lib/form-data";

/**
 * Reads the repeatable treatment form out of `FormData`.
 *
 * Several treatments can be recorded in one submission, so each row's fields
 * carry that row's key: `dose.3`, `dose.7`. Keys rather than positions matter -
 * with positions, removing the middle row would renumber the rows after it and
 * could carry one treatment's dose onto another.
 *
 * The row keys are listed in `treatmentRow`, in the order they appear on
 * screen. A submission without any is read as a single unnumbered row, which
 * keeps a plain one-treatment post working.
 *
 * This does no validation: `addTreatmentsSchema` decides what is acceptable.
 */
export function readTreatmentRows(formData: FormData) {
  const keys = list(formData, "treatmentRow");

  return keys.length > 0
    ? keys.map((key) => readRow(formData, `.${key}`))
    : [readRow(formData, "")];
}

export function readRow(formData: FormData, suffix: string) {
  return {
    treatmentTypeId: text(formData, `treatmentTypeId${suffix}`),
    medicationName: text(formData, `medicationName${suffix}`),
    dose: text(formData, `dose${suffix}`),
    takenAt: text(formData, `takenAt${suffix}`),
    effectiveness: number(formData, `effectiveness${suffix}`),
    notes: text(formData, `notes${suffix}`),
  };
}
