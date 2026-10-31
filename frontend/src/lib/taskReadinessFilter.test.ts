import { describe, expect, it } from "vitest";
import {
  EFFORT_FILTER_NONE,
  matchesEffortFilter,
  matchesReadinessFilter,
} from "./taskReadinessFilter";
import type { Task } from "../types/models";

type T = Pick<Task, "effort" | "isBlocked" | "availableFrom" | "dateCertainty">;
const base: T = {
  effort: null,
  isBlocked: false,
  availableFrom: null,
  dateCertainty: "EXACT",
};
const now = new Date("2026-10-31T12:00:00Z");

describe("matchesEffortFilter", () => {
  it("empty filter matches everything", () => {
    expect(matchesEffortFilter({ effort: null }, "")).toBe(true);
    expect(matchesEffortFilter({ effort: "HEAVY" }, "")).toBe(true);
  });
  it("matches an exact effort", () => {
    expect(matchesEffortFilter({ effort: "HEAVY" }, "HEAVY")).toBe(true);
    expect(matchesEffortFilter({ effort: "LIGHT" }, "HEAVY")).toBe(false);
  });
  it("NONE matches tasks without effort (also undefined)", () => {
    expect(matchesEffortFilter({ effort: null }, EFFORT_FILTER_NONE)).toBe(
      true,
    );
    expect(matchesEffortFilter({}, EFFORT_FILTER_NONE)).toBe(true);
    expect(matchesEffortFilter({ effort: "LIGHT" }, EFFORT_FILTER_NONE)).toBe(
      false,
    );
  });
});

describe("matchesReadinessFilter", () => {
  it("empty or unknown filter matches everything", () => {
    expect(matchesReadinessFilter({ ...base, isBlocked: true }, "", now)).toBe(
      true,
    );
    expect(
      matchesReadinessFilter({ ...base, isBlocked: true }, "bogus", now),
    ).toBe(true);
  });
  it("locked: blocked by hand or opening in the future", () => {
    expect(
      matchesReadinessFilter({ ...base, isBlocked: true }, "locked", now),
    ).toBe(true);
    expect(
      matchesReadinessFilter(
        { ...base, availableFrom: "2026-11-10T00:00:00Z" },
        "locked",
        now,
      ),
    ).toBe(true);
    expect(
      matchesReadinessFilter(
        { ...base, availableFrom: "2026-10-01T00:00:00Z" },
        "locked",
        now,
      ),
    ).toBe(false);
    expect(matchesReadinessFilter(base, "locked", now)).toBe(false);
  });
  it("dateTbd: unknown or surprise dates only", () => {
    expect(
      matchesReadinessFilter(
        { ...base, dateCertainty: "UNKNOWN" },
        "dateTbd",
        now,
      ),
    ).toBe(true);
    expect(
      matchesReadinessFilter(
        { ...base, dateCertainty: "SURPRISE" },
        "dateTbd",
        now,
      ),
    ).toBe(true);
    expect(
      matchesReadinessFilter(
        { ...base, dateCertainty: "APPROXIMATE" },
        "dateTbd",
        now,
      ),
    ).toBe(false);
    expect(matchesReadinessFilter(base, "dateTbd", now)).toBe(false);
  });
  it("ready: can start and has a real deadline", () => {
    expect(matchesReadinessFilter(base, "ready", now)).toBe(true);
    expect(
      matchesReadinessFilter({ ...base, isBlocked: true }, "ready", now),
    ).toBe(false);
    expect(
      matchesReadinessFilter(
        { ...base, dateCertainty: "UNKNOWN" },
        "ready",
        now,
      ),
    ).toBe(false);
  });
});
