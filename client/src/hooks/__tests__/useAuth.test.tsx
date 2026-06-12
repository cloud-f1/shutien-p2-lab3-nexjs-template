import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, beforeEach } from "vitest";
import {
  useLogin,
  useRegister,
  useLogout,
  useCurrentUser,
  useForgotPassword,
  useResetPassword,
} from "../useAuth";
import { useAuthStore } from "../../store/authStore";
import { setAccessToken } from "../../api/client";
import { TEST_USER } from "../../tests/handlers/auth";
import type { ReactNode } from "react";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe("useAuth hooks", () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
    setAccessToken(null);
  });

  describe("useLogin", () => {
    it("calls login API and updates auth store on success", async () => {
      const { result } = renderHook(() => useLogin(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        email: "alex@example.com",
        password: "validPass123",
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const state = useAuthStore.getState();
      expect(state.user?.email).toBe("alex@example.com");
      expect(state.isAuthenticated).toBe(true);
    });
  });

  describe("useRegister", () => {
    it("calls register API and updates auth store on success", async () => {
      const { result } = renderHook(() => useRegister(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        email: "new@example.com",
        password: "securePass1",
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const state = useAuthStore.getState();
      expect(state.user?.email).toBe("new@example.com");
      expect(state.isAuthenticated).toBe(true);
    });
  });

  describe("useLogout", () => {
    it("clears store and queries on settle", async () => {
      setAccessToken("test-token");
      useAuthStore.getState().setUser(TEST_USER);

      const { result } = renderHook(() => useLogout(), {
        wrapper: createWrapper(),
      });

      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe("useCurrentUser", () => {
    it("fetches user when token exists", async () => {
      setAccessToken("test-access-token");

      const { result } = renderHook(() => useCurrentUser(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.email).toBe("alex@example.com");
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it("skips fetch when no token", () => {
      const { result } = renderHook(() => useCurrentUser(), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("useForgotPassword", () => {
    it("resolves with message", async () => {
      const { result } = renderHook(() => useForgotPassword(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ email: "alex@example.com" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.message).toContain("reset link");
    });
  });

  describe("useResetPassword", () => {
    it("calls API with token and password", async () => {
      const { result } = renderHook(() => useResetPassword(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        token: "valid-token",
        new_password: "newSecure1",
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.message).toContain("Password reset");
    });
  });
});
