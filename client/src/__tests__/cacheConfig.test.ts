import { describe, it, expect } from "vitest";
import { CACHE_TIERS } from "../cacheConfig";

describe("CACHE_TIERS", () => {
  it("has expected tier keys", () => {
    expect(CACHE_TIERS).toHaveProperty("STATIC");
    expect(CACHE_TIERS).toHaveProperty("STANDARD");
    expect(CACHE_TIERS).toHaveProperty("REALTIME");
  });

  it("values match expected defaults", () => {
    expect(CACHE_TIERS.STATIC.staleTime).toBe(5 * 60 * 1000);
    expect(CACHE_TIERS.STATIC.gcTime).toBe(30 * 60 * 1000);
    expect(CACHE_TIERS.STANDARD.staleTime).toBe(30 * 1000);
    expect(CACHE_TIERS.STANDARD.gcTime).toBe(5 * 60 * 1000);
    expect(CACHE_TIERS.REALTIME.staleTime).toBe(5 * 1000);
    expect(CACHE_TIERS.REALTIME.gcTime).toBe(60 * 1000);
  });
});
