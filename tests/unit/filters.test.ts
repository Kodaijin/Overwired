import { describe, expect, it } from "vitest";

import {
  buildEpisodeWhere,
  episodeFilterToSearchParams,
  hasActiveFilters,
  parseEpisodeFilter,
} from "@/lib/filters";

const USER = "user-1";

describe("parseEpisodeFilter", () => {
  it("returns safe defaults for an empty query", () => {
    const filter = parseEpisodeFilter({});

    expect(filter.status).toBe("all");
    expect(filter.page).toBe(1);
    expect(filter.from).toBeNull();
    expect(filter.locationIds).toEqual([]);
  });

  it("reads every supported parameter", () => {
    const filter = parseEpisodeFilter({
      from: "2024-01-01",
      to: "2024-02-01",
      status: "active",
      minSeverity: "3",
      maxSeverity: "9",
      painType: "migraine",
      q: "burning",
      page: "2",
    });

    expect(filter.status).toBe("active");
    expect(filter.minSeverity).toBe(3);
    expect(filter.maxSeverity).toBe(9);
    expect(filter.painType).toBe("migraine");
    expect(filter.search).toBe("burning");
    expect(filter.page).toBe(2);
    expect(filter.from).toBeInstanceOf(Date);
  });

  it("accepts repeated keys and comma-separated lists for id filters", () => {
    expect(parseEpisodeFilter({ loc: ["a", "b"] }).locationIds).toEqual(["a", "b"]);
    expect(parseEpisodeFilter({ loc: "a,b,c" }).locationIds).toEqual(["a", "b", "c"]);
  });

  it("falls back to defaults instead of throwing on junk input", () => {
    // A stale bookmark must not produce an error page.
    const filter = parseEpisodeFilter({
      from: "not-a-date",
      status: "bogus",
      minSeverity: "99",
      page: "-4",
    });

    expect(filter.from).toBeNull();
    expect(filter.status).toBe("all");
    expect(filter.minSeverity).toBeNull();
    expect(filter.page).toBe(1);
  });

  it("reads a URLSearchParams the same way as a plain object", () => {
    const params = new URLSearchParams();
    params.append("loc", "a");
    params.append("loc", "b");
    params.set("status", "completed");

    const filter = parseEpisodeFilter(params);
    expect(filter.locationIds).toEqual(["a", "b"]);
    expect(filter.status).toBe("completed");
  });
});

describe("episodeFilterToSearchParams", () => {
  it("omits everything left at its default", () => {
    const params = episodeFilterToSearchParams(parseEpisodeFilter({}));
    expect(params.toString()).toBe("");
  });

  it("round-trips a populated filter", () => {
    const original = parseEpisodeFilter({
      status: "active",
      minSeverity: "4",
      q: "sharp",
      loc: "a,b",
      page: "3",
    });

    const restored = parseEpisodeFilter(episodeFilterToSearchParams(original));

    expect(restored.status).toBe("active");
    expect(restored.minSeverity).toBe(4);
    expect(restored.search).toBe("sharp");
    expect(restored.locationIds).toEqual(["a", "b"]);
    expect(restored.page).toBe(3);
  });
});

describe("buildEpisodeWhere", () => {
  it("always scopes to the requesting user", () => {
    const where = buildEpisodeWhere(USER, parseEpisodeFilter({}));
    expect(where.userId).toBe(USER);
  });

  it("adds no conditions when nothing is filtered", () => {
    const where = buildEpisodeWhere(USER, parseEpisodeFilter({}));
    expect(where.AND).toBeUndefined();
  });

  it("matches ongoing episodes that started before the range", () => {
    // Overlap, not containment - a long episode still counts as happening
    // during the window it runs through.
    const where = buildEpisodeWhere(USER, parseEpisodeFilter({ from: "2024-03-01" }));
    const conditions = where.AND as Record<string, unknown>[];

    expect(conditions).toContainEqual({
      OR: [{ endedAt: null }, { endedAt: { gte: expect.any(Date) } }],
    });
  });

  it("extends the `to` bound to the end of that day", () => {
    const where = buildEpisodeWhere(USER, parseEpisodeFilter({ to: "2024-03-01" }));
    const conditions = where.AND as { startedAt?: { lte: Date } }[];
    const bound = conditions.find((c) => c.startedAt)?.startedAt?.lte;

    expect(bound?.getHours()).toBe(23);
    expect(bound?.getMinutes()).toBe(59);
  });

  it("filters ongoing and completed episodes", () => {
    const activeWhere = buildEpisodeWhere(USER, parseEpisodeFilter({ status: "active" }));
    expect(activeWhere.AND).toContainEqual({ endedAt: null });

    const doneWhere = buildEpisodeWhere(USER, parseEpisodeFilter({ status: "completed" }));
    expect(doneWhere.AND).toContainEqual({ endedAt: { not: null } });
  });

  it("filters severity on the episode's peak", () => {
    const where = buildEpisodeWhere(
      USER,
      parseEpisodeFilter({ minSeverity: "7", maxSeverity: "9" }),
    );

    expect(where.AND).toContainEqual({ peakSeverity: { gte: 7 } });
    expect(where.AND).toContainEqual({ peakSeverity: { lte: 9 } });
  });

  it("ORs values inside a category and ANDs across categories", () => {
    const where = buildEpisodeWhere(
      USER,
      parseEpisodeFilter({ loc: "a,b", trig: "t1" }),
    );

    expect(where.AND).toContainEqual({
      locations: { some: { locationId: { in: ["a", "b"] } } },
    });
    expect(where.AND).toContainEqual({
      triggers: { some: { triggerId: { in: ["t1"] } } },
    });
    expect((where.AND as unknown[]).length).toBe(2);
  });

  it("searches description, notes and label case-insensitively", () => {
    const where = buildEpisodeWhere(USER, parseEpisodeFilter({ q: "Burning" }));
    expect(where.AND).toContainEqual({
      OR: [
        { description: { contains: "Burning", mode: "insensitive" } },
        { notes: { contains: "Burning", mode: "insensitive" } },
        { painType: { contains: "Burning", mode: "insensitive" } },
      ],
    });
  });

  it("combines several filters at once", () => {
    const where = buildEpisodeWhere(
      USER,
      parseEpisodeFilter({
        from: "2024-01-01",
        status: "completed",
        minSeverity: "5",
        loc: "a",
        q: "ache",
      }),
    );

    expect((where.AND as unknown[]).length).toBe(5);
  });
});

describe("hasActiveFilters", () => {
  it("is false for the default filter and true once anything is set", () => {
    expect(hasActiveFilters(parseEpisodeFilter({}))).toBe(false);
    expect(hasActiveFilters(parseEpisodeFilter({ q: "x" }))).toBe(true);
    expect(hasActiveFilters(parseEpisodeFilter({ status: "active" }))).toBe(true);
    expect(hasActiveFilters(parseEpisodeFilter({ loc: "a" }))).toBe(true);
  });

  it("ignores pagination", () => {
    expect(hasActiveFilters(parseEpisodeFilter({ page: "3" }))).toBe(false);
  });
});
