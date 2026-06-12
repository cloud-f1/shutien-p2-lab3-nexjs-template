import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePlans, useSubscription, useCreateCheckout, useCreatePortal } from "../useBilling";
import { server } from "../../tests/setup";
import {
  billingHandlers,
  PLAN_FIXTURES,
} from "../../tests/handlers/billing";
import { createWrapper } from "../../tests/helpers/createWrapper";

describe("useBilling hooks", () => {
  beforeEach(() => {
    server.use(...billingHandlers);
  });

  describe("usePlans", () => {
    it("returns list of plans", async () => {
      const { result } = renderHook(() => usePlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(PLAN_FIXTURES.length);
      expect(result.current.data![0].slug).toBe("free");
      expect(result.current.data![1].slug).toBe("pro");
    });

    it("includes plan features and limits", async () => {
      const { result } = renderHook(() => usePlans(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      const proPlan = result.current.data!.find((p) => p.slug === "pro");
      expect(proPlan).toBeDefined();
      expect(proPlan!.features.analytics).toBe(true);
      expect(proPlan!.limits?.max_members).toBe(10);
    });
  });

  describe("useSubscription", () => {
    it("returns subscription for a team", async () => {
      const teamId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
      const { result } = renderHook(() => useSubscription(teamId), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.status).toBe("free");
      expect(result.current.data!.plan.slug).toBe("free");
    });

    it("does not fetch when teamId is undefined", () => {
      const { result } = renderHook(() => useSubscription(undefined), {
        wrapper: createWrapper(),
      });
      expect(result.current.isFetching).toBe(false);
    });
  });

  describe("useCreateCheckout", () => {
    it("creates a checkout session", async () => {
      const { result } = renderHook(() => useCreateCheckout(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        team_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        plan_id: "00000000-0000-4000-8000-000000000002",
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.checkout_url).toContain("stripe.com");
    });
  });

  describe("useCreatePortal", () => {
    it("creates a portal session", async () => {
      const { result } = renderHook(() => useCreatePortal(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        team_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data!.portal_url).toContain("stripe.com");
    });
  });
});
