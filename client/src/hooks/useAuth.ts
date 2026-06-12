import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { authApi } from "../api/auth";
import { getAccessToken } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { CACHE_TIERS } from "../cacheConfig";
import type { LoginRequest, RegisterRequest } from "../schemas/auth";

/**
 * Detect the backend's reuse-detection signal. Server returns
 * 401 with `{detail: "SESSION_REVOKED"}` (or {code: "SESSION_REVOKED"})
 * when a refresh token is replayed after rotation — the entire family
 * has been revoked and the client must re-authenticate immediately
 * without retrying the refresh.
 */
function isSessionRevoked(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    response?: { data?: { detail?: unknown; code?: unknown } };
  };
  const detail = e.response?.data?.detail;
  const code = e.response?.data?.code;
  return detail === "SESSION_REVOKED" || code === "SESSION_REVOKED";
}

export function useLogin() {
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LoginRequest) => authApi.login(data),
    onSuccess: (res) => {
      // Server returns unified AuthResponse — user is at the top level (E161).
      setUser(res.user);
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
  });
}

export function useRegister() {
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: (data: RegisterRequest) => authApi.register(data),
    onSuccess: (res) => {
      // Backend now returns tokens on register (E161) — no auto-login workaround.
      setUser(res.user);
    },
  });
}

export function useLogout() {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      logout();
      queryClient.clear();
      navigate("/signin");
    },
  });
}

export function useCurrentUser() {
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      try {
        const user = await authApi.getCurrentUser();
        setUser(user);
        return user;
      } catch (err) {
        // Refresh-reuse → server revoked the family. Force logout, no retry.
        if (isSessionRevoked(err)) {
          logout();
          queryClient.clear();
          navigate("/signin", { replace: true });
        }
        throw err;
      }
    },
    enabled: !!getAccessToken(),
    retry: (failureCount, err) => (isSessionRevoked(err) ? false : failureCount < 1),
    ...CACHE_TIERS.STATIC,
  });
}

export function useDeleteAccount() {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.deleteAccount(),
    onSuccess: () => {
      logout();
      queryClient.clear();
      navigate("/signin");
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: authApi.forgotPassword,
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: authApi.resetPassword,
  });
}

export { isSessionRevoked };
