import { z } from "zod";
import type { components } from "../api/types";

// OpenAPI-generated types — used with `satisfies` for compile-time drift detection
type ApiPlanRead = components["schemas"]["PlanRead"];
type ApiSubscriptionRead = components["schemas"]["SubscriptionRead"];
type ApiCheckoutSessionCreate = components["schemas"]["CheckoutSessionCreate"];
type ApiCheckoutSessionRead = components["schemas"]["CheckoutSessionRead"];
type ApiPortalSessionCreate = components["schemas"]["PortalSessionCreate"];
type ApiPortalSessionRead = components["schemas"]["PortalSessionRead"];

// ── Enums ───────────────────────────────────────────────────────

export const subscriptionStatusSchema = z.enum([
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "trialing",
  "unpaid",
  "paused",
  "free",
]);

// ── Response Schemas ────────────────────────────────────────────

export const planReadSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  stripe_price_id: z.string(),
  amount: z.number().int(),
  currency: z.string(),
  interval: z.enum(["month", "year"]),
  features: z.record(z.unknown()),
  limits: z.record(z.unknown()).optional(),
  is_active: z.boolean(),
  display_order: z.number().int(),
}) satisfies z.ZodType<ApiPlanRead>;

export const subscriptionReadSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  team_id: z.string().uuid(),
  status: subscriptionStatusSchema,
  plan: planReadSchema,
  stripe_subscription_id: z.string().nullable().optional(),
  stripe_customer_id: z.string().nullable().optional(),
  current_period_start: z.string().nullable().optional(),
  current_period_end: z.string().nullable().optional(),
  cancel_at_period_end: z.boolean(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
}) satisfies z.ZodType<ApiSubscriptionRead>;

// ── Request Schemas ─────────────────────────────────────────────

export const checkoutSessionCreateSchema = z.object({
  team_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  success_url: z.string().url().optional(),
  cancel_url: z.string().url().optional(),
}) satisfies z.ZodType<ApiCheckoutSessionCreate>;

export const checkoutSessionReadSchema = z.object({
  checkout_url: z.string(),
  session_id: z.string(),
}) satisfies z.ZodType<ApiCheckoutSessionRead>;

export const portalSessionCreateSchema = z.object({
  team_id: z.string().uuid(),
  return_url: z.string().url().optional(),
}) satisfies z.ZodType<ApiPortalSessionCreate>;

export const portalSessionReadSchema = z.object({
  portal_url: z.string(),
}) satisfies z.ZodType<ApiPortalSessionRead>;

// ── Inferred Types ──────────────────────────────────────────────

export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;
export type PlanRead = z.infer<typeof planReadSchema>;
export type SubscriptionRead = z.infer<typeof subscriptionReadSchema>;
export type CheckoutSessionCreate = z.infer<typeof checkoutSessionCreateSchema>;
export type CheckoutSessionRead = z.infer<typeof checkoutSessionReadSchema>;
export type PortalSessionCreate = z.infer<typeof portalSessionCreateSchema>;
export type PortalSessionRead = z.infer<typeof portalSessionReadSchema>;
