import { describe, expect, it } from "vitest";

import { readTreatmentRows } from "@/lib/treatment-rows";

/**
 * The repeatable treatment form posts one flat `FormData` for several
 * treatments. Getting a field onto the wrong row would attribute a dose to the
 * wrong thing, so the pairing between row keys and field names is worth
 * pinning down.
 */

function form(entries: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      data.append(name, item);
    }
  }
  return data;
}

describe("readTreatmentRows", () => {
  it("keeps each row's fields together", () => {
    const rows = readTreatmentRows(
      form({
        episodeId: "ep1",
        treatmentRow: ["0", "1"],
        "treatmentTypeId.0": "medication",
        "medicationName.0": "Ibuprofen",
        "dose.0": "400mg",
        "effectiveness.0": "75",
        "treatmentTypeId.1": "heat",
        "notes.1": "20 minutes",
      }),
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      treatmentTypeId: "medication",
      medicationName: "Ibuprofen",
      dose: "400mg",
      effectiveness: 75,
    });
    expect(rows[1]).toMatchObject({ treatmentTypeId: "heat", notes: "20 minutes" });
    // Row 1 is not a medication, so it never had these fields on screen.
    expect(rows[1].medicationName).toBeUndefined();
    expect(rows[1].dose).toBeUndefined();
  });

  it("follows the keys, not the positions, when a middle row was removed", () => {
    // The user added three rows, then deleted the second: keys 0 and 2 remain.
    const rows = readTreatmentRows(
      form({
        treatmentRow: ["0", "2"],
        "medicationName.0": "Ibuprofen",
        "dose.0": "400mg",
        "medicationName.2": "Paracetamol",
        "dose.2": "500mg",
      }),
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ medicationName: "Ibuprofen", dose: "400mg" });
    expect(rows[1]).toMatchObject({ medicationName: "Paracetamol", dose: "500mg" });
  });

  it("preserves the order the rows were shown in", () => {
    const rows = readTreatmentRows(
      form({
        treatmentRow: ["7", "3"],
        "medicationName.7": "First",
        "medicationName.3": "Second",
      }),
    );

    expect(rows.map((row) => row.medicationName)).toEqual(["First", "Second"]);
  });

  it("reads a post with no row keys as a single treatment", () => {
    const rows = readTreatmentRows(
      form({ episodeId: "ep1", medicationName: "Ibuprofen", dose: "400mg" }),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ medicationName: "Ibuprofen", dose: "400mg" });
  });

  it("leaves blank fields undefined so the schema decides about them", () => {
    const rows = readTreatmentRows(
      form({ treatmentRow: "0", "treatmentTypeId.0": "", "notes.0": "   " }),
    );

    expect(rows[0].treatmentTypeId).toBeUndefined();
    expect(rows[0].notes).toBeUndefined();
    expect(rows[0].effectiveness).toBeUndefined();
  });

  it("does not let one row's key match another row's field", () => {
    // A stray field for a row that was removed must be ignored entirely.
    const rows = readTreatmentRows(
      form({
        treatmentRow: "0",
        "medicationName.0": "Ibuprofen",
        "medicationName.1": "Deleted row",
      }),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].medicationName).toBe("Ibuprofen");
  });
});
