import { z } from "zod";
import type { components } from "../api/types";

// OpenAPI-generated types — used with `satisfies` for compile-time drift detection
type ApiUserRead = components["schemas"]["UserRead"];
type ApiBearerResponse = components["schemas"]["BearerResponse"];
type ApiAuthResponse = components["schemas"]["AuthResponse"];
type ApiUserSessionRead = components["schemas"]["UserSessionRead"];
type ApiSessionRead = components["schemas"]["SessionRead"];
type ApiHealthResponse = components["schemas"]["HealthResponse"];

// ── Request Schemas ──────────────────────────────────────────────

export const registerRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  display_name: z.string().max(100).optional(),
});

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const refreshRequestSchema = z.object({
  refresh_token: z.string(),
});

export const forgotPasswordRequestSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordRequestSchema = z.object({
  token: z.string(),
  new_password: z.string().min(8).max(128),
});

export const updateUserRequestSchema = z.object({
  display_name: z.string().max(100).optional(),
  avatar_url: z.string().url().optional(),
});

// ── Response Schemas ─────────────────────────────────────────────

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  display_name: z.string().nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  is_verified: z.boolean(),
  is_active: z.boolean(),
  is_superuser: z.boolean(),
  social_providers: z.array(z.enum(["google", "apple"])),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
}) satisfies z.ZodType<ApiUserRead>;

export const tokenPairSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.enum(["bearer"]),
  expires_in: z.number().int(),
}) satisfies z.ZodType<ApiBearerResponse>;

/**
 * Unified auth payload (E161). Returned by /auth/register, /auth/jwt/login,
 * and /auth/refresh — all three now share this exact shape server-side.
 * Replaces the legacy nested `{user, tokens}` adapter shape.
 */
export const authResponseSchema = z.object({
  user: userSchema,
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.enum(["bearer"]),
  expires_in: z.number().int(),
}) satisfies z.ZodType<ApiAuthResponse>;

/** Active session row from the /auth/sessions store (E161). */
export const userSessionReadSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  last_used_at: z.string().datetime(),
  ip: z.string().nullable().optional(),
  user_agent: z.string().nullable().optional(),
}) satisfies z.ZodType<ApiUserSessionRead>;

export const errorDetailSchema = z.object({
  code: z.string(),
  message: z.string(),
  field: z.string().optional(),
});

export const errorResponseSchema = z.object({
  error: errorDetailSchema,
});

export const sessionInfoSchema = z.object({
  id: z.string().uuid(),
  device_info: z.string(),
  ip_address: z.string().nullable(),
  created_at: z.string().datetime(),
  last_used_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  is_current: z.boolean(),
}) satisfies z.ZodType<ApiSessionRead>;

export { messageResponseSchema } from "./common";

export const healthResponseSchema = z.object({
  status: z.enum(["ok", "healthy", "degraded"]),
  version: z.string().optional(),
  database: z.enum(["connected", "disconnected"]).optional(),
}) satisfies z.ZodType<ApiHealthResponse>;

// ── Inferred Types ───────────────────────────────────────────────

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;
export type User = z.infer<typeof userSchema>;
export type TokenPair = z.infer<typeof tokenPairSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type UserSessionRead = z.infer<typeof userSessionReadSchema>;
export type ErrorDetail = z.infer<typeof errorDetailSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type SessionInfo = z.infer<typeof sessionInfoSchema>;
export type { MessageResponse } from "./common";
export type HealthResponse = z.infer<typeof healthResponseSchema>;
