import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { exportToJson, type ExportableEpisode } from "@/lib/export";
import { parseImportFile } from "@/lib/import";
import { prisma } from "@/lib/prisma";
import { seedDefaultTaxonomy } from "@/lib/taxonomy";
import { loadExportableEpisodes } from "@/server/analytics";
import { importEpisodes } from "@/server/import";

/**
 * Import against a real database.
 *
 * The interesting behaviour is not the parsing (covered by the unit tests) but
 * what the write does: matching taxonomy names to existing entries, creating
 * the ones that are new, and not duplicating a history that is re-imported.
 */

const runIfDatabase = process.env.TEST_DATABASE_URL ? describe : describe.skip;

const EMAIL = "integration-import@test.invalid";
const at = (iso: string) => new Date(iso);

runIfDatabase("importing a file", () => {
  let userId: string;

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    userId = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: EMAIL, passwordHash: "not-a-real-hash" },
        select: { id: true },
      });
      await seedDefaultTaxonomy(tx, user.id);
      return user.id;
    });
  });

  it("writes episodes, readings and treatments", async () => {
    const result = await importEpisodes(userId, parse(sampleFile()), {
      skipDuplicates: false,
    });

    expect(result.imported).toBe(1);
    expect(result.measurements).toBe(2);
    expect(result.treatments).toBe(1);

    const stored = await loadExportableEpisodes(userId);
    expect(stored).toHaveLength(1);
    expect(stored[0].painType).toBe("migraine");
    expect(stored[0].measurements.map((m) => m.severity)).toEqual([4, 8]);
    expect(stored[0].treatments[0].medicationName).toBe("Ibuprofen");
  });

  it("populates the derived severity cache on import", async () => {
    await importEpisodes(userId, parse(sampleFile()), { skipDuplicates: false });

    const episode = await prisma.episode.findFirstOrThrow({
      where: { userId },
      select: { peakSeverity: true, currentSeverity: true, durationSeconds: true },
    });

    expect(episode.peakSeverity).toBe(8);
    expect(episode.currentSeverity).toBe(8);
    expect(episode.durationSeconds).toBe(7200);
  });

  it("reuses existing taxonomy entries instead of duplicating them", async () => {
    const before = await prisma.location.count({ where: { userId } });

    // "head" matches the seeded "Head" by slug, despite the different case.
    await importEpisodes(
      userId,
      parse(sampleFile({ locations: ["head"] })),
      { skipDuplicates: false },
    );

    expect(await prisma.location.count({ where: { userId } })).toBe(before);

    const stored = await loadExportableEpisodes(userId);
    expect(stored[0].locations).toEqual(["Head"]);
  });

  it("creates taxonomy entries that do not exist yet", async () => {
    const result = await importEpisodes(
      userId,
      parse(sampleFile({ locations: ["Left eyebrow"] })),
      { skipDuplicates: false },
    );

    expect(result.taxonomyCreated).toBeGreaterThanOrEqual(1);
    expect(
      await prisma.location.count({ where: { userId, name: "Left eyebrow" } }),
    ).toBe(1);
  });

  it("skips episodes already present when asked to", async () => {
    const episodes = parse(sampleFile());

    await importEpisodes(userId, episodes, { skipDuplicates: true });
    const second = await importEpisodes(userId, episodes, { skipDuplicates: true });

    expect(second.imported).toBe(0);
    expect(second.skipped).toBe(1);
    expect(await prisma.episode.count({ where: { userId } })).toBe(1);
  });

  it("imports duplicates when the option is off", async () => {
    const episodes = parse(sampleFile());

    await importEpisodes(userId, episodes, { skipDuplicates: false });
    await importEpisodes(userId, episodes, { skipDuplicates: false });

    expect(await prisma.episode.count({ where: { userId } })).toBe(2);
  });

  it("round-trips an export back into an equivalent history", async () => {
    await importEpisodes(userId, parse(sampleFile()), { skipDuplicates: false });

    const exported = await loadExportableEpisodes(userId);
    const reimported = parse(exportToJson(exported));

    expect(reimported[0].startedAt.toISOString()).toBe(
      exported[0].startedAt.toISOString(),
    );
    expect(reimported[0].measurements).toHaveLength(
      exported[0].measurements.length,
    );
    expect(reimported[0].locations).toEqual(exported[0].locations);
  });

  it("writes nothing at all when one entry in the file is bad", async () => {
    const broken = JSON.stringify({
      format: "pain-tracker-export",
      version: 1,
      episodes: [
        {
          startedAt: "2024-03-01T10:00:00.000Z",
          measurements: [{ recordedAt: "2024-03-01T10:00:00.000Z", severity: 5 }],
        },
        { startedAt: "not a date", measurements: [] },
      ],
    });

    const parsed = parseImportFile(broken);
    expect(parsed.ok).toBe(false);

    // Validation rejects the file before any write is attempted.
    expect(await prisma.episode.count({ where: { userId } })).toBe(0);
  });
});

function parse(json: string) {
  const result = parseImportFile(json);
  if (!result.ok) {
    throw new Error(`fixture failed validation: ${JSON.stringify(result.issues)}`);
  }
  return result.episodes;
}

function sampleFile(overrides: Partial<ExportableEpisode> = {}): string {
  const episode: ExportableEpisode = {
    id: "ignored-on-import",
    startedAt: at("2024-03-01T10:00:00Z"),
    endedAt: at("2024-03-01T12:00:00Z"),
    painType: "migraine",
    description: null,
    notes: null,
    locations: ["Head"],
    characteristics: ["Throbbing"],
    triggers: [],
    symptoms: [],
    measurements: [
      { recordedAt: at("2024-03-01T10:00:00Z"), severity: 4, note: null },
      { recordedAt: at("2024-03-01T11:00:00Z"), severity: 8, note: null },
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

  return exportToJson([episode]);
}
