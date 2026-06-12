import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { server } from "../../tests/setup";
import { createWrapper } from "../../tests/helpers/createWrapper";
import { useOptimisticMutation } from "../useService";
import { useQueryClient, useQuery } from "@tanstack/react-query";

// ── Fixtures ───────────────────────────────────────────────────

interface Item {
  id: string;
  name: string;
}

const FIXTURES: Item[] = [
  { id: "00000000-0000-0000-0000-000000000001", name: "Alpha" },
  { id: "00000000-0000-0000-0000-000000000002", name: "Beta" },
];

const BASE = "http://localhost:8080";
const PATH = "/api/v1/optimistic-items";
const QUERY_KEY = ["optimistic-items"];

// ── Helper: hook that seeds cache then exposes optimistic mutation ──

function useTestSetup(opts?: {
  onSuccess?: (data: Item) => void;
  onError?: (error: unknown) => void;
}) {
  const queryClient = useQueryClient();

  // Seed the cache with fixtures
  const query = useQuery<Item[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch(`${BASE}${PATH}`);
      return res.json() as Promise<Item[]>;
    },
    retry: false,
  });

  const mutation = useOptimisticMutation<Item, { id: string; name: string }>({
    mutationFn: async (vars) => {
      const res = await fetch(`${BASE}${PATH}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      });
      if (!res.ok) throw new Error("Server error");
      return res.json() as Promise<Item>;
    },
    queryKey: QUERY_KEY,
    optimisticUpdate: (old, vars) => [
      ...(old ?? []),
      { id: vars.id, name: vars.name },
    ],
    onSuccess: opts?.onSuccess,
    onError: opts?.onError,
  });

  return { query, mutation, queryClient };
}

// ── MSW handlers ───────────────────────────────────────────────

beforeEach(() => {
  server.use(
    http.get(`${BASE}${PATH}`, () => HttpResponse.json(FIXTURES)),
    http.post(`${BASE}${PATH}`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(body, { status: 201 });
    }),
  );
});

// ── Tests ──────────────────────────────────────────────────────

describe("useOptimisticMutation", () => {
  it("applies optimistic update immediately before server responds", async () => {
    // Use a delayed server response so we can observe the optimistic state
    server.use(
      http.post(`${BASE}${PATH}`, async ({ request }) => {
        await delay(200);
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(body, { status: 201 });
      }),
    );

    const wrapper = createWrapper();
    const { result } = renderHook(() => useTestSetup(), { wrapper });

    // Wait for initial query to load
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    expect(result.current.query.data).toHaveLength(2);

    // Trigger mutation — cache should update immediately
    act(() => {
      result.current.mutation.mutate({
        id: "00000000-0000-0000-0000-000000000003",
        name: "Gamma",
      });
    });

    // Optimistic data should appear before server responds
    await waitFor(() => {
      const cached = result.current.queryClient.getQueryData<Item[]>(QUERY_KEY);
      expect(cached).toHaveLength(3);
      expect(cached?.[2]?.name).toBe("Gamma");
    });
  });

  it("rolls back on mutation error", async () => {
    server.use(
      http.post(`${BASE}${PATH}`, () =>
        HttpResponse.json({ detail: "fail" }, { status: 500 }),
      ),
    );

    const wrapper = createWrapper();
    const { result } = renderHook(() => useTestSetup(), { wrapper });

    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));

    act(() => {
      result.current.mutation.mutate({
        id: "00000000-0000-0000-0000-000000000099",
        name: "Bad",
      });
    });

    // After error, cache should rollback to original 2 items
    await waitFor(() => expect(result.current.mutation.isError).toBe(true));

    const cached = result.current.queryClient.getQueryData<Item[]>(QUERY_KEY);
    // After rollback + invalidation, should be back to fixtures
    expect(cached).toHaveLength(2);
  });

  it("invalidates cache after success", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTestSetup(), { wrapper });

    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));

    const invalidateSpy = vi.spyOn(
      result.current.queryClient,
      "invalidateQueries",
    );

    act(() => {
      result.current.mutation.mutate({
        id: "00000000-0000-0000-0000-000000000004",
        name: "Delta",
      });
    });

    await waitFor(() => expect(result.current.mutation.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: QUERY_KEY }),
    );

    invalidateSpy.mockRestore();
  });

  it("calls onSuccess callback with server data", async () => {
    const onSuccess = vi.fn();
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTestSetup({ onSuccess }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));

    act(() => {
      result.current.mutation.mutate({
        id: "00000000-0000-0000-0000-000000000005",
        name: "Echo",
      });
    });

    await waitFor(() => expect(result.current.mutation.isSuccess).toBe(true));

    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Echo" }),
    );
  });

  it("calls onError callback after rollback", async () => {
    server.use(
      http.post(`${BASE}${PATH}`, () =>
        HttpResponse.json({ detail: "fail" }, { status: 500 }),
      ),
    );

    const onError = vi.fn();
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTestSetup({ onError }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));

    act(() => {
      result.current.mutation.mutate({
        id: "00000000-0000-0000-0000-000000000099",
        name: "Fail",
      });
    });

    await waitFor(() => expect(result.current.mutation.isError).toBe(true));

    expect(onError).toHaveBeenCalledWith(expect.any(Error));

    // Verify rollback happened before onError
    const cached = result.current.queryClient.getQueryData<Item[]>(QUERY_KEY);
    expect(cached).toHaveLength(2);
  });

  it("cancels outgoing queries on mutate", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useTestSetup(), { wrapper });

    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));

    const cancelSpy = vi.spyOn(result.current.queryClient, "cancelQueries");

    act(() => {
      result.current.mutation.mutate({
        id: "00000000-0000-0000-0000-000000000006",
        name: "Foxtrot",
      });
    });

    await waitFor(() => {
      expect(cancelSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: QUERY_KEY }),
      );
    });

    cancelSpy.mockRestore();
  });
});
