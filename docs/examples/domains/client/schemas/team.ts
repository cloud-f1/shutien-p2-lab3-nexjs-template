import { z } from "zod";
import type { components } from "../api/types";

// OpenAPI-generated types — used with `satisfies` for compile-time drift detection
type ApiTeamRead = components["schemas"]["TeamRead"];
type ApiTeamReadWithRole = components["schemas"]["TeamReadWithRole"];
type ApiTeamMemberRead = components["schemas"]["TeamMemberRead"];

// ── Enums ───────────────────────────────────────────────────────

export const teamRoleSchema = z.enum(["viewer", "editor", "admin", "owner"]);

// ── Request Schemas ─────────────────────────────────────────────

export const teamCreateSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
});

export const teamUpdateSchema = z.object({
  name: z.string().max(100).optional(),
  slug: z
    .string()
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
});

export const teamMemberCreateSchema = z.object({
  user_id: z.string().uuid(),
  role: teamRoleSchema,
});

export const teamMemberUpdateSchema = z.object({
  role: teamRoleSchema,
});

// ── Response Schemas ────────────────────────────────────────────

export const teamReadSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  member_count: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
}) satisfies z.ZodType<ApiTeamRead>;

export const teamReadWithRoleSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  member_count: z.number().int(),
  my_role: teamRoleSchema,
  created_at: z.string(),
  updated_at: z.string(),
}) satisfies z.ZodType<ApiTeamReadWithRole>;

const memberUserSummarySchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  display_name: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
});

export const teamMemberReadSchema = z.object({
  id: z.string().uuid(),
  team_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: teamRoleSchema,
  user: memberUserSummarySchema,
  created_at: z.string(),
}) satisfies z.ZodType<ApiTeamMemberRead>;

// ── Inferred Types ──────────────────────────────────────────────

export type TeamRole = z.infer<typeof teamRoleSchema>;
export type TeamCreate = z.infer<typeof teamCreateSchema>;
export type TeamUpdate = z.infer<typeof teamUpdateSchema>;
export type TeamRead = z.infer<typeof teamReadSchema>;
export type TeamReadWithRole = z.infer<typeof teamReadWithRoleSchema>;
export type TeamMemberCreate = z.infer<typeof teamMemberCreateSchema>;
export type TeamMemberUpdate = z.infer<typeof teamMemberUpdateSchema>;
export type TeamMemberRead = z.infer<typeof teamMemberReadSchema>;
