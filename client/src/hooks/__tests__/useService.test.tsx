import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { server } from "../../tests/setup";
import { createCrudHandlers } from "../../tests/helpers/createHandlers";
import { createWrapper } from "../../tests/helpers/createWrapper";
import { createService } from "../../api/services/createService";
import { useServiceQuery, useServiceMutation } from "../useService";
import { CACHE_TIERS } from "../../cacheConfig";

// ── Test schema + fixtures ──────────────────────────────────────

const itemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

const FIXTURES = [
  { id: "00000000-0000-0000-0000-000000000001", name: "Alpha" },
  { id: "00000000-0000-0000-0000-000000000002", name: "Beta" },
];

const PATH = "/api/v1/test-items";
const svc = createService(PATH, itemSchema);

beforeEach(() => {
  server.use(...createCrudHandlers(PATH, FIXTURES));
});

// ── Tests ───────────────────────────────────────────────────────

describe("useServiceQuery", () => {
  it("fetches data with the given cache tier", async () => {
    const { result } = renderHook(
      () =>
        useServiceQuery(
          ["test-items"],
          () => svc.list({ page: 1, page_size: 10 }),
          CACHE_TIERS.STANDARD,
        ),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.items).toHaveLength(2);
    expect(result.current.data?.total).toBe(2);
  });

  it("respects enabled option", () => {
    const { result } = renderHook(
      () =>
        useServiceQuery(
          ["test-items-disabled"],
          () => svc.list(),
          CACHE_TIERS.STANDARD,
          { enabled: false },
        ),
      { wrapper: createWrapper() },
    );

    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useServiceMutation", () => {
  it("calls mutator and invalidates specified keys", async () => {
    const { result } = renderHook(
      () =>
        useServiceMutation((data: { name: string }) => svc.create(data), {
          invalidateKeys: [["test-items"]],
        }),
      { wrapper: createWrapper() },
    );

    result.current.mutate({ name: "Gamma" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.name).toBe("Gamma");
    expect(result.current.data?.id).toBeDefined();
  });

  it("calls onSettled callback", async () => {
    let settled = false;

    const { result } = renderHook(
      () =>
        useServiceMutation((data: { name: string }) => svc.create(data), {
          onSettled: () => {
            settled = true;
          },
        }),
      { wrapper: createWrapper() },
    );

    result.current.mutate({ name: "Delta" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(settled).toBe(true);
  });
});
