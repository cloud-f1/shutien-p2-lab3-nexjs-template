import { z } from "zod";
import { placeReadSchema } from "./place";

/** Validates a decimal string with up to 10 integer digits and 2 decimal places. */
const decimalString = z
  .string()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, "Must be a valid decimal (up to 2 decimal places)");

export const portfolioCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

export const portfolioReadSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  user_id: z.string().uuid(),
  place_count: z.number().int(),
  total_value: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const portfolioUpdateSchema = z.object({
  name: z.string().max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
});

export const portfolioPlaceCreateSchema = z.object({
  place_id: z.string().uuid(),
  purchase_price: decimalString.default("0.00"),
  current_value: decimalString.default("0.00"),
  notes: z.string().max(1000).optional(),
});

export const portfolioPlaceReadSchema = z.object({
  portfolio_id: z.string().uuid(),
  place_id: z.string().uuid(),
  purchase_price: z.string(),
  current_value: z.string(),
  gain_loss: z.string(),
  notes: z.string().nullable(),
  added_at: z.string(),
  place: placeReadSchema,
});

export const portfolioPlaceUpdateSchema = z.object({
  purchase_price: decimalString.optional(),
  current_value: decimalString.optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const categoryAllocationSchema = z.object({
  category: z.string(),
  count: z.number().int(),
  value: z.string(),
  percentage: z.string(),
});

export const topPerformerSchema = z.object({
  place_id: z.string().uuid(),
  place_name: z.string(),
  purchase_price: z.string(),
  current_value: z.string(),
  gain_loss: z.string(),
  gain_loss_pct: z.string().nullable(),
});

export const portfolioAnalyticsSchema = z.object({
  portfolio_id: z.string().uuid(),
  total_value: z.string(),
  total_purchase: z.string(),
  gain_loss: z.string(),
  gain_loss_pct: z.string().nullable(),
  place_count: z.number().int(),
  category_allocation: z.array(categoryAllocationSchema),
  top_performers: z.array(topPerformerSchema),
});

export const portfolioDetailSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  user_id: z.string().uuid(),
  place_count: z.number().int(),
  total_value: z.string(),
  total_purchase: z.string(),
  gain_loss: z.string(),
  gain_loss_pct: z.string().nullable(),
  places: z.array(portfolioPlaceReadSchema),
  created_at: z.string(),
  updated_at: z.string(),
});

export type PortfolioCreate = z.infer<typeof portfolioCreateSchema>;
export type PortfolioRead = z.infer<typeof portfolioReadSchema>;
export type PortfolioUpdate = z.infer<typeof portfolioUpdateSchema>;
export type PortfolioPlaceCreate = z.infer<typeof portfolioPlaceCreateSchema>;
export type PortfolioPlaceRead = z.infer<typeof portfolioPlaceReadSchema>;
export type PortfolioPlaceUpdate = z.infer<typeof portfolioPlaceUpdateSchema>;
export type PortfolioDetail = z.infer<typeof portfolioDetailSchema>;
export type PortfolioAnalytics = z.infer<typeof portfolioAnalyticsSchema>;
