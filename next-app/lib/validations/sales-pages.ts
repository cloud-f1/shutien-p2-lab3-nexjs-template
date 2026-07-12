import { z } from "zod"

import { salesPageContentSchema } from "@/lib/sales/content"
import { SALES_PAGE_RENDER_MODES, SALES_PAGE_STATUSES } from "@/lib/schema/sales"

/**
 * Shared Zod contract for the sales-page admin CRUD (E332). The `content` field
 * reuses the E326 `salesPageContentSchema` verbatim — one contract validates
 * both the public renderer's input AND every DB write, so bad payloads can never
 * reach the JSONB column.
 */

/** URL-safe slug: lower-case letters, digits, hyphens. */
export const salesPageSlugSchema = z
  .string()
  .min(1, "請輸入網址代稱 (slug)")
  .max(255, "網址代稱過長")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "網址代稱僅能包含小寫字母、數字與連字號")

export const salesPageStatusSchema = z.enum(SALES_PAGE_STATUSES)
export const salesPageRenderModeSchema = z.enum(SALES_PAGE_RENDER_MODES)

export const createSalesPageSchema = z.object({
  slug: salesPageSlugSchema,
  /** Linked E327 product; empty string / null / omitted all normalise to null. */
  productId: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.string().uuid("產品 ID 格式錯誤").nullable(),
  ),
  renderMode: salesPageRenderModeSchema.default("structured"),
  status: salesPageStatusSchema.default("draft"),
  content: salesPageContentSchema,
})

export const updateSalesPageSchema = createSalesPageSchema.extend({
  id: z.string().uuid("ID 格式錯誤"),
})

export const deleteSalesPageSchema = z.object({
  id: z.string().uuid("ID 格式錯誤"),
})

export const setSalesPageStatusSchema = z.object({
  id: z.string().uuid("ID 格式錯誤"),
  status: salesPageStatusSchema,
})

export const previewSalesPageSchema = z.object({
  id: z.string().uuid("ID 格式錯誤"),
})

export type CreateSalesPageInput = z.input<typeof createSalesPageSchema>
export type UpdateSalesPageInput = z.input<typeof updateSalesPageSchema>

/**
 * Client form schema — same fields, but `productId` is a plain string ("" = none)
 * so it binds directly to a `<Select>`; the client maps "" → null before calling
 * the action (which re-validates via {@link createSalesPageSchema}, the server
 * authority). Kept resolver-friendly (no top-level preprocess/transform) so
 * react-hook-form's value type stays clean.
 */
export const salesPageFormSchema = z.object({
  slug: salesPageSlugSchema,
  productId: z.string(),
  renderMode: salesPageRenderModeSchema,
  status: salesPageStatusSchema,
  content: salesPageContentSchema,
})

export type SalesPageFormValues = z.infer<typeof salesPageFormSchema>
