import { describe, expect, it } from "vitest";

import {
  buildExportDocument,
  episodesToCsv,
  exportToJson,
  measurementsToCsv,
  toCsv,
  treatmentsToCsv,
  type ExportableEpisode,
} from "@/lib/export";
import { parseImportFile, validateImportDocument } from "@/lib/import";
import { EXPORT_FORMAT, EXPORT_VERSION } from "@/lib/export-format";

const at = (iso: string) => new Date(iso);

function exportable(overrides: Partial<ExportableEpisode> = {}): ExportableEpisode {
  return {
    id: "e1",
    startedAt: at("2024-03-01T10:00:00Z"),
    endedAt: at("2024-03-01T12:30:00Z"),
    painType: "migraine",
    description: "Behind the left eye",
    notes: null,
    locations: ["Head"],
    characteristics: ["Throbbing"],
    triggers: ["Lack of sleep"],
    symptoms: ["Light sensitivity"],
    measurements: [
      { recordedAt: at("2024-03-01T10:00:00Z"), severity: 4, note: null },
      { recordedAt: at("2024-03-01T11:00:00Z"), severity: 8, note: "peaked" },
      { recordedAt: at("2024-03-01T12:30:00Z"), severity: 2, note: null },
    ],
    treatments: [
      {
        type: "Medication",
        medicationName: "Ibuprofen",
        dose: "400mg",
        takenAt: at("2024-03-01T11:05:00Z"),
        effectiveness: 75,
        notes: null,
      },
    ],
    ...overrides,
  };
}

describe("buildExportDocument", () => {
  it("stamps the format and version so an import can recognise it", () => {
    const document = buildExportDocument([exportable()]);

    expect(document.format).toBe(EXPORT_FORMAT);
    expect(document.version).toBe(EXPORT_VERSION);
    expect(document.episodes).toHaveLength(1);
  });

  it("writes taxonomy as names, so a file can be imported into another account", () => {
    const document = buildExportDocument([exportable()]);
    expect(document.episodes[0].locations).toEqual(["Head"]);
    expect(document.episodes[0].treatments[0].type).toBe("Medication");
  });

  it("serialises dates as ISO strings", () => {
    const document = buildExportDocument([exportable()]);
    expect(document.episodes[0].startedAt).toBe("2024-03-01T10:00:00.000Z");
    expect(document.episodes[0].endedAt).toBe("2024-03-01T12:30:00.000Z");
  });

  it("keeps an ongoing episode's end as null", () => {
    const document = buildExportDocument([exportable({ endedAt: null })]);
    expect(document.episodes[0].endedAt).toBeNull();
  });
});

describe("export then import", () => {
  it("round-trips a full history without losing anything", () => {
    const original = exportable();
    const json = exportToJson([original]);

    const result = parseImportFile(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [restored] = result.episodes;
    expect(restored.startedAt.toISOString()).toBe(original.startedAt.toISOString());
    expect(restored.endedAt?.toISOString()).toBe(original.endedAt?.toISOString());
    expect(restored.painType).toBe("migraine");
    expect(restored.locations).toEqual(["Head"]);
    expect(restored.characteristics).toEqual(["Throbbing"]);
    expect(restored.triggers).toEqual(["Lack of sleep"]);
    expect(restored.symptoms).toEqual(["Light sensitivity"]);
    expect(restored.measurements).toHaveLength(3);
    expect(restored.measurements[1].severity).toBe(8);
    expect(restored.measurements[1].note).toBe("peaked");
    expect(restored.treatments[0].medicationName).toBe("Ibuprofen");
    expect(restored.treatments[0].effectiveness).toBe(75);
  });

  it("summarises what a valid file contains", () => {
    const json = exportToJson([exportable(), exportable({ id: "e2" })]);
    const result = parseImportFile(json);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.summary.episodes).toBe(2);
    expect(result.summary.measurements).toBe(6);
    expect(result.summary.treatments).toBe(2);
    expect(result.summary.taxonomy.locations).toEqual(["Head"]);
  });
});

describe("import validation", () => {
  const valid = {
    format: EXPORT_FORMAT,
    version: 1,
    episodes: [
      {
        startedAt: "2024-03-01T10:00:00.000Z",
        measurements: [{ recordedAt: "2024-03-01T10:00:00.000Z", severity: 5 }],
      },
    ],
  };

  it("accepts a minimal valid document", () => {
    expect(validateImportDocument(valid).ok).toBe(true);
  });

  it("rejects malformed JSON with a readable message", () => {
    const result = parseImportFile("{ not json");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0].message).toMatch(/not valid JSON/i);
  });

  it("rejects a file that is not an export from this app", () => {
    const result = validateImportDocument({ some: "other file" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((issue) => /pain tracker export/i.test(issue.message))).toBe(
      true,
    );
  });

  it("rejects a version newer than this app understands", () => {
    const result = validateImportDocument({ ...valid, version: EXPORT_VERSION + 1 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0].message).toMatch(/newer version/i);
  });

  it("rejects an out-of-range severity and points at the entry", () => {
    const result = validateImportDocument({
      ...valid,
      episodes: [
        {
          startedAt: "2024-03-01T10:00:00.000Z",
          measurements: [{ recordedAt: "2024-03-01T10:00:00.000Z", severity: 42 }],
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0].path).toContain("Episode 1");
  });

  it("rejects an unparseable date", () => {
    const result = validateImportDocument({
      ...valid,
      episodes: [{ startedAt: "the third of never", measurements: [] }],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0].message).toMatch(/not a valid date/i);
  });

  it("rejects an episode that ends before it starts", () => {
    const result = validateImportDocument({
      ...valid,
      episodes: [
        {
          startedAt: "2024-03-01T12:00:00.000Z",
          endedAt: "2024-03-01T10:00:00.000Z",
          measurements: [],
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0].message).toMatch(/before the start/i);
  });

  it("rejects a file with no episodes rather than importing nothing silently", () => {
    const result = validateImportDocument({ ...valid, episodes: [] });
    expect(result.ok).toBe(false);
  });

  it("reports every bad entry, not just the first", () => {
    const result = validateImportDocument({
      ...valid,
      episodes: [
        { startedAt: "nope", measurements: [] },
        { startedAt: "also nope", measurements: [] },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
  });

  it("collapses names that differ only by case onto one entry", () => {
    const result = validateImportDocument({
      ...valid,
      episodes: [
        {
          startedAt: "2024-03-01T10:00:00.000Z",
          locations: ["Lower back", "lower back", "LOWER BACK"],
          measurements: [],
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.episodes[0].locations).toEqual(["Lower back"]);
  });
});

describe("CSV export", () => {
  it("writes a header row and one row per episode", () => {
    const csv = episodesToCsv([exportable()], at("2024-03-02T00:00:00Z"));
    const lines = csv.trim().split("\r\n");

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("episode_id");
    expect(lines[0]).toContain("peak_severity");
  });

  it("includes the derived severities and duration", () => {
    const csv = episodesToCsv([exportable()], at("2024-03-02T00:00:00Z"));

    expect(csv).toContain("9000"); // 2h30m in seconds
    expect(csv).toContain("2h 30m");
    expect(csv).toContain("migraine");
  });

  it("marks ongoing episodes and measures them up to now", () => {
    const csv = episodesToCsv(
      [exportable({ endedAt: null })],
      at("2024-03-01T13:00:00Z"),
    );

    expect(csv).toContain(",yes,");
    expect(csv).toContain("3h");
  });

  it("writes one row per reading in the measurements dataset", () => {
    const csv = measurementsToCsv([exportable()]);
    expect(csv.trim().split("\r\n")).toHaveLength(4);
  });

  it("writes one row per treatment", () => {
    const csv = treatmentsToCsv([exportable()]);
    expect(csv).toContain("Ibuprofen");
    expect(csv).toContain("400mg");
  });

  it("returns an empty string when there is nothing to export", () => {
    expect(episodesToCsv([])).toBe("");
  });
});

describe("toCsv", () => {
  it("quotes cells containing commas, quotes or newlines", () => {
    const csv = toCsv([{ note: 'sharp, "stabbing"\npain' }]);
    expect(csv).toContain('"sharp, ""stabbing""\npain"');
  });

  it("renders null and undefined as empty cells", () => {
    expect(toCsv([{ a: null, b: undefined }])).toBe("a,b\r\n,\r\n");
  });

  it("defuses text a spreadsheet would run as a formula", () => {
    // A note beginning with "=" or "-" must stay text, not become a formula.
    const csv = toCsv([{ note: "=1+1" }, { note: "-tingling" }]);
    expect(csv).toContain("'=1+1");
    expect(csv).toContain("'-tingling");
  });
});
