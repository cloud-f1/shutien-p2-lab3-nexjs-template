import { z } from "zod"

/**
 * Shared type/enum contracts for the sales-page module (E326), kept separate
 * from `lib/sales/content.ts` (the schema + resolver + example copy) so
 * pure section components under `components/marketing/sales/` can import
 * prop-shape types WITHOUT ever touching the config/resolver module. Grep for
 * `lib/sales/content` under `components/marketing/sales/` should always come
 * back empty.
 */

export const salesSectionKeySchema = z.enum([
  "hero",
  "painPoints",
  "solution",
  "modules",
  "testimonials",
  "pricing",
  "riskReversal",
  "faq",
])
export type SalesSectionKey = z.infer<typeof salesSectionKeySchema>

/** AIDA order per the PRD: Hero → 痛點共鳴 → 解決方案 → 模組大綱 → 見證 → 定價+風險逆轉 → FAQ. */
export const DEFAULT_SECTION_ORDER: SalesSectionKey[] = [
  "hero",
  "painPoints",
  "solution",
  "modules",
  "testimonials",
  "pricing",
  "riskReversal",
  "faq",
]

export const salesStylePresetSchema = z.enum(["bold", "premium", "clean"])
export type SalesStylePreset = z.infer<typeof salesStylePresetSchema>

export const salesHeroVariantSchema = z.enum(["video-left", "video-top", "minimal"])
export type SalesHeroVariant = z.infer<typeof salesHeroVariantSchema>

export const ctaBindingSchema = z.object({
  label: z.string().min(1),
  /** Placeholder link/binding point — real checkout wiring lands in E327. */
  href: z.string().min(1),
})
export type SalesCtaBinding = z.infer<typeof ctaBindingSchema>
