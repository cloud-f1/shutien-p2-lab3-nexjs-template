import {
  apiClient,
  clearRefreshTimer,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from "./client";
import {
  authResponseSchema,
  messageResponseSchema,
  userSchema,
  sessionInfoSchema,
} from "../schemas/auth";
import type {
  RegisterRequest,
  LoginRequest,
  RefreshRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  UpdateUserRequest,
  AuthResponse,
  MessageResponse,
  User,
  SessionInfo,
} from "../schemas/auth";

/**
 * Auth API — thin typed wrappers around the unified server contract (E161).
 *
 * All three of /auth/register, /auth/jwt/login, and /auth/refresh now return
 * the same `AuthResponse = {user, access_token, refresh_token, token_type, expires_in}`
 * shape, so the client just parses and stores tokens — no composition or
 * post-hoc auto-login required.
 */
export const authApi = {
  /** Register: POST /auth/register (JSON) → AuthResponse (user + tokens). */
  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const res = await apiClient.post("/auth/register", data);
    const result = authResponseSchema.parse(res.data);
    setAccessToken(result.access_token);
    setRefreshToken(result.refresh_token);
    return result;
  },

  /** Login: POST /auth/jwt/login (form-data, username=email) → AuthResponse. */
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const form = new URLSearchParams();
    form.append("username", data.email);
    form.append("password", data.password);

    const res = await apiClient.post("/auth/jwt/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const result = authResponseSchema.parse(res.data);
    setAccessToken(result.access_token);
    setRefreshToken(result.refresh_token);
    return result;
  },

  /** Refresh: POST /auth/refresh → new AuthResponse with rotated tokens. */
  refresh: async (data: RefreshRequest): Promise<AuthResponse> => {
    if (!data.refresh_token) {
      return Promise.reject(new Error("No refresh token available"));
    }
    const res = await apiClient.post("/auth/refresh", data);
    const result = authResponseSchema.parse(res.data);
    setAccessToken(result.access_token);
    setRefreshToken(result.refresh_token);
    return result;
  },

  /** Logout: POST /auth/jwt/logout → 204, then clear tokens. */
  logout: async (): Promise<MessageResponse> => {
    try {
      const refreshToken = getRefreshToken();
      await apiClient.post("/auth/jwt/logout", {
        refresh_token: refreshToken,
      });
    } finally {
      setAccessToken(null);
      setRefreshToken(null);
      clearRefreshTimer();
    }
    return { message: "Logged out" };
  },

  /** Forgot password: always returns 202 (email enumeration prevention). */
  forgotPassword: async (
    data: ForgotPasswordRequest,
  ): Promise<MessageResponse> => {
    await apiClient.post("/auth/forgot-password", data);
    return messageResponseSchema.parse({
      message: "If that email exists, a reset link has been sent.",
    });
  },

  /** Reset password with token. */
  resetPassword: async (
    data: ResetPasswordRequest,
  ): Promise<MessageResponse> => {
    await apiClient.post("/auth/reset-password", {
      token: data.token,
      password: data.new_password,
    });
    return messageResponseSchema.parse({
      message: "Password reset successful.",
    });
  },

  /** Verify email with token. */
  verifyEmail: async (token: string): Promise<MessageResponse> => {
    await apiClient.post("/auth/verify", { token });
    return messageResponseSchema.parse({
      message: "Email verified successfully.",
    });
  },

  getCurrentUser: async (): Promise<User> => {
    const res = await apiClient.get("/users/me");
    return userSchema.parse({
      ...res.data,
      is_superuser: res.data.is_superuser ?? false,
      social_providers: res.data.social_providers ?? [],
    });
  },

  updateCurrentUser: async (data: UpdateUserRequest): Promise<User> => {
    const res = await apiClient.patch("/users/me", data);
    return userSchema.parse({
      ...res.data,
      is_superuser: res.data.is_superuser ?? false,
      social_providers: res.data.social_providers ?? [],
    });
  },

  /**
   * Legacy `/users/me/sessions` — kept for back-compat with older UI that
   * displays the device-info shape. New surfaces use `sessionsApi` against
   * `/auth/sessions` (UserSessionRead shape).
   */
  listSessions: async (): Promise<SessionInfo[]> => {
    const res = await apiClient.get("/users/me/sessions");
    return sessionInfoSchema.array().parse(res.data);
  },

  revokeSession: async (sessionId: string): Promise<MessageResponse> => {
    await apiClient.delete(`/users/me/sessions/${sessionId}`);
    return { message: "Session revoked" };
  },

  /** Delete current user's account permanently (GDPR Art. 17). */
  deleteAccount: async (): Promise<void> => {
    await apiClient.delete("/users/me");
  },

  /** Get Google OAuth authorize URL — redirects to Google. */
  getGoogleAuthUrl: async (): Promise<string> => {
    const res = await apiClient.get("/auth/google/authorize");
    return res.data.authorization_url;
  },

  /** Get GitHub OAuth authorize URL — redirects to GitHub. */
  getGithubAuthUrl: async (): Promise<string> => {
    const res = await apiClient.get("/auth/github/authorize");
    return res.data.authorization_url;
  },
};
