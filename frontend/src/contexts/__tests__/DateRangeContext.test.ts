import { describe, expect, it } from "vitest";
import { DATE_RANGE_STORAGE_KEY, restoreRange } from "../DateRangeContext";
import { computeRange } from "../../lib/dates";

function storage(value: string | null) {
  return { getItem: () => value };
}

describe("restoreRange", () => {
  it("falls back to the last 30 days when nothing is stored", () => {
    expect(restoreRange(undefined)).toEqual(computeRange("last30"));
    expect(restoreRange(storage(null))).toEqual(computeRange("last30"));
  });

  it("recomputes relative presets from today instead of trusting stored dates", () => {
    const restored = restoreRange(storage(JSON.stringify({ key: "last7", start: "2000-01-01", end: "2000-01-07" })));
    expect(restored).toEqual(computeRange("last7"));
  });

  it("keeps explicit custom ranges", () => {
    const restored = restoreRange(storage(JSON.stringify({ key: "custom", start: "2026-01-01", end: "2026-01-31" })));
    expect(restored.key).toBe("custom");
    expect(restored.start).toBe("2026-01-01");
    expect(restored.end).toBe("2026-01-31");
  });

  it("ignores corrupt or inverted stored values", () => {
    expect(restoreRange(storage("{not json"))).toEqual(computeRange("last30"));
    expect(restoreRange(storage(JSON.stringify({ key: "nope" })))).toEqual(computeRange("last30"));
    expect(restoreRange(storage(JSON.stringify({ key: "custom", start: "2026-02-01", end: "2026-01-01" })))).toEqual(computeRange("last30"));
  });

  it("uses a stable storage key", () => {
    expect(DATE_RANGE_STORAGE_KEY).toBe("nexora.dateRange");
  });
});
