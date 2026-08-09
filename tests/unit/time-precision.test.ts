import { describe, expect, it } from "vitest";

import { isEarlierMinute, preserveStoredTime } from "@/lib/time-precision";

/**
 * Forms can only express whole minutes. Stored instants carry seconds. These
 * two helpers are what stops that mismatch from refusing perfectly ordinary
 * edits - see the comments in the module for the failure they came from.
 */

const at = (iso: string) => new Date(iso);

describe("preserveStoredTime", () => {
  it("keeps the stored instant when the form posts the same minute", () => {
    const stored = at("2026-08-09T21:20:51.903Z");
    const submitted = at("2026-08-09T21:20:00.000Z");

    // The form could not have shown the 51.903s, so it did not change it.
    expect(preserveStoredTime(submitted, stored)).toEqual(stored);
  });

  it("takes the submitted time when the minute really changed", () => {
    const stored = at("2026-08-09T21:20:51.903Z");
    const submitted = at("2026-08-09T21:21:00.000Z");

    expect(preserveStoredTime(submitted, stored)).toEqual(submitted);
  });

  it("does not treat the same minute of a different hour as unchanged", () => {
    const stored = at("2026-08-09T21:20:51.903Z");
    const submitted = at("2026-08-09T20:20:00.000Z");

    expect(preserveStoredTime(submitted, stored)).toEqual(submitted);
  });

  it("accepts a newly set time when nothing was stored", () => {
    const submitted = at("2026-08-09T21:20:00.000Z");
    expect(preserveStoredTime(submitted, null)).toEqual(submitted);
  });

  it("passes through a cleared time, which reopens an episode", () => {
    expect(preserveStoredTime(null, at("2026-08-09T21:20:51.903Z"))).toBeNull();
  });

  it("leaves a full-precision submission alone when it differs", () => {
    const stored = at("2026-08-09T21:20:51.903Z");
    const submitted = at("2026-08-09T21:22:13.500Z");

    expect(preserveStoredTime(submitted, stored)).toEqual(submitted);
  });
});

describe("isEarlierMinute", () => {
  it("is false for two instants in the same minute", () => {
    expect(
      isEarlierMinute(at("2026-08-09T12:20:00.000Z"), at("2026-08-09T12:20:37.412Z")),
    ).toBe(false);
  });

  it("is false in either direction within a minute", () => {
    expect(
      isEarlierMinute(at("2026-08-09T12:20:59.999Z"), at("2026-08-09T12:20:00.000Z")),
    ).toBe(false);
  });

  it("is true across a minute boundary, however narrow", () => {
    expect(
      isEarlierMinute(at("2026-08-09T12:19:59.999Z"), at("2026-08-09T12:20:00.000Z")),
    ).toBe(true);
  });

  it("is false when the later instant is genuinely later", () => {
    expect(
      isEarlierMinute(at("2026-08-09T12:21:00.000Z"), at("2026-08-09T12:20:00.000Z")),
    ).toBe(false);
  });
});
