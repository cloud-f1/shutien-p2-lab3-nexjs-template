import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useFeatureGate } from "../useFeatureGate";
import { server } from "../../tests/setup";
import { billingHandlers } from "../../tests/handlers/billing";
import { createWrapper } from "../../tests/helpers/createWrapper";

describe("useFeatureGate", () => {
  beforeEach(() => {
    server.use(...billingHandlers);
  });

  it("returns allowed=true when teamId is undefined", () => {
    const { result } = renderHook(
      () => useFeatureGate("analytics", undefined),
      { wrapper: createWrapper() },
    );

    // No teamId → default allowed
    expect(result.current.allowed).toBe(true);
    expect(result.current.limit).toBeNull();
  });

  it("returns allowed based on plan features", async () => {
    const teamId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const { result } = renderHook(
      () => useFeatureGate("basic_access", teamId),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.allowed).toBe(true);
  });

  it("returns limit for numeric plan limits", async () => {
    const teamId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const { result } = renderHook(
      () => useFeatureGate("max_members", teamId),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // The free plan has max_members: 3
    expect(result.current.limit).toBe(3);
  });

  it("returns allowed=true for undefined features (default)", async () => {
    const teamId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const { result } = renderHook(
      () => useFeatureGate("nonexistent_feature", teamId),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.allowed).toBe(true);
    expect(result.current.limit).toBeNull();
  });
});
