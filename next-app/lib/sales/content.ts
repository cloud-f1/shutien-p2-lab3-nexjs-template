import { z } from "zod"

import { ctaBindingSchema, salesHeroVariantSchema, salesSectionKeySchema, salesStylePresetSchema } from "@/lib/sales/types"

/**
 * Sales-page content contract (E326).
 *
 * `SalesPageContent` is a Zod schema — not just a TS type — because E332 will
 * back this same shape with DB JSONB content (admin-authored sales pages) and
 * needs runtime validation at that boundary. The route (`app/p/[slug]/`)
 * reads content ONLY through `getSalesPageContent(slug)` below; every section
 * component under `components/marketing/sales/` is pure (props in, no
 * knowledge of where the content came from) so swapping this resolver for a
 * DB-backed one later requires zero changes at the component layer.
 *
 * Shared enums/types (`SalesSectionKey`, `SalesStylePreset`, `SalesHeroVariant`,
 * `SalesCtaBinding`) live in `./types.ts` and are re-exported here so callers
 * only need to import from one place — but section components import them
 * from `./types` directly so they never depend on this config module.
 */

export {
  DEFAULT_SECTION_ORDER,
  salesHeroVariantSchema,
  salesSectionKeySchema,
  salesStylePresetSchema,
  type SalesCtaBinding,
  type SalesHeroVariant,
  type SalesSectionKey,
  type SalesStylePreset,
} from "@/lib/sales/types"

const salesStyleSchema = z.object({
  preset: salesStylePresetSchema,
  heroVariant: salesHeroVariantSchema.optional(),
  /**
   * Sections to render, in order. Omitting a key skips that section entirely
   * (not every product needs all 7 blocks). Defaults to `DEFAULT_SECTION_ORDER`.
   */
  sectionOrder: z.array(salesSectionKeySchema).min(1).optional(),
})

// ---------------------------------------------------------------------------
// Section content
// ---------------------------------------------------------------------------

const heroVideoSchema = z.object({
  src: z.string().optional(),
  poster: z.string().optional(),
  captionsSrc: z.string().optional(),
})

const heroContentSchema = z.object({
  badge: z.string().optional(),
  headline: z.string().min(1),
  subheadline: z.string().min(1),
  trustItems: z.array(z.string()).optional(),
  cta: ctaBindingSchema,
  video: heroVideoSchema.optional(),
})

const painPointsContentSchema = z.object({
  heading: z.string().min(1),
  intro: z.string().optional(),
  items: z.array(z.string().min(1)).min(1),
})

const solutionContentSchema = z.object({
  heading: z.string().min(1),
  description: z.string().min(1),
  bullets: z.array(z.string()).optional(),
  mockupImage: z.string().optional(),
})

const moduleItemSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  outcome: z.string().min(1),
})
const modulesContentSchema = z.object({
  heading: z.string().min(1),
  items: z.array(moduleItemSchema).min(1),
})

const testimonialItemSchema = z.object({
  quote: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
})
const testimonialsContentSchema = z.object({
  heading: z.string().min(1),
  items: z.array(testimonialItemSchema).min(1),
})

const pricingContentSchema = z.object({
  heading: z.string().min(1),
  price: z.number().nonnegative(),
  originalPrice: z.number().nonnegative().optional(),
  currency: z.string().default("TWD"),
  /** ISO datetime string — feeds the countdown timer. */
  deadline: z.string().min(1),
  features: z.array(z.string()).optional(),
  cta: ctaBindingSchema,
})

const riskReversalContentSchema = z.object({
  heading: z.string().min(1),
  guaranteeDays: z.number().int().positive(),
  description: z.string().min(1),
  studentsCount: z.number().int().nonnegative().optional(),
})

const faqItemSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
})
const faqContentSchema = z.object({
  heading: z.string().min(1),
  items: z.array(faqItemSchema).min(1),
})

const metaSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  ogImage: z.string().optional(),
})

// ---------------------------------------------------------------------------
// Top-level schema
// ---------------------------------------------------------------------------

export const salesPageContentSchema = z.object({
  slug: z.string().min(1),
  meta: metaSchema,
  style: salesStyleSchema,
  hero: heroContentSchema,
  painPoints: painPointsContentSchema,
  solution: solutionContentSchema,
  modules: modulesContentSchema,
  testimonials: testimonialsContentSchema,
  pricing: pricingContentSchema,
  riskReversal: riskReversalContentSchema,
  faq: faqContentSchema,
})

export type SalesPageContent = z.infer<typeof salesPageContentSchema>

// ---------------------------------------------------------------------------
// Example config (copy owned here; SKUs/pricing DB records are E327+)
// ---------------------------------------------------------------------------

/**
 * `【】` markers are kept intentionally — this is the PRD's zh-TW 文案範本
 * (copywriting template), not finished ad copy. A real launch swaps these
 * bracketed placeholders for the actual product's copy.
 */
const AI_WRITING_COURSE: SalesPageContent = {
  slug: "ai-writing-course",
  meta: {
    title: "【課程名稱】—— 用 AI 寫作接案，30 天上手",
    description: "【一句話痛點 + 承諾】立即了解課程完整內容與限時優惠。",
  },
  style: {
    preset: "bold",
    heroVariant: "video-top",
    // Full 7-section AIDA flow, default order.
  },
  hero: {
    badge: "限時招生中",
    headline: "【課程名稱】—— 3 天讓你從 0 到能接案的 AI 寫作技能",
    subheadline: "【一句話痛點 + 承諾】：不用再對著空白文件發呆，用 AI workflow 30 分鐘產出一篇能交稿的文章。",
    trustItems: ["【已有 N 位學員完課】", "【滿意度 98%】", "【7 天不滿意全額退費】"],
    cta: { label: "立即搶先報名", href: "/p/ai-writing-course/checkout" },
    video: {
      src: "/sales/ai-writing-course/hook.mp4",
      poster: "/sales/ai-writing-course/hook-poster.jpg",
      captionsSrc: "/sales/ai-writing-course/hook-captions.vtt",
    },
  },
  painPoints: {
    heading: "你是否也正深陷這些困境？",
    intro: "【痛點共鳴段落引言】",
    items: [
      "【痛點 1：症狀與後果 —— 例如「寫一篇文案要花 3 小時，交稿還被退件」】",
      "【痛點 2：例如「不知道怎麼下 AI 指令，產出的內容像機器人」】",
      "【痛點 3：例如「接案價格喊不上去，因為作品集不夠亮眼」】",
      "【痛點 4：例如「想轉職內容行銷，卻不知道從何學起」】",
    ],
  },
  solution: {
    heading: "【解決方案一句話定位】",
    description:
      "【解決方案完整說明】—— 本課程提供一套可複製的 AI 寫作 SOP，從指令設計到成品校對，讓你不用死背技巧也能穩定產出。",
    bullets: ["【方案賣點 1】", "【方案賣點 2】", "【方案賣點 3】"],
  },
  modules: {
    heading: "課程模組大綱",
    items: [
      { title: "模組一：【主題】", content: "【核心內容摘要】", outcome: "【學員將學會 / 帶走的成果】" },
      { title: "模組二：【主題】", content: "【核心內容摘要】", outcome: "【學員將學會 / 帶走的成果】" },
      { title: "模組三：【主題】", content: "【核心內容摘要】", outcome: "【學員將學會 / 帶走的成果】" },
      { title: "模組四：【主題】", content: "【核心內容摘要】", outcome: "【學員將學會 / 帶走的成果】" },
    ],
  },
  testimonials: {
    heading: "學員怎麼說",
    items: [
      { quote: "【學員見證 1 —— 具體成果與轉變】", name: "【學員姓名/暱稱】", role: "【身份/職稱】" },
      { quote: "【學員見證 2 —— 具體成果與轉變】", name: "【學員姓名/暱稱】", role: "【身份/職稱】" },
      { quote: "【學員見證 3 —— 具體成果與轉變】", name: "【學員姓名/暱稱】", role: "【身份/職稱】" },
    ],
  },
  pricing: {
    heading: "限時優惠方案",
    price: 2980,
    originalPrice: 5980,
    currency: "TWD",
    deadline: "2026-08-01T15:59:59.000Z",
    features: ["【完整課程模組】", "【專屬社群陪跑】", "【模板與範例庫】", "【7 天不滿意退費保證】"],
    cta: { label: "立即搶先報名", href: "/p/ai-writing-course/checkout" },
  },
  riskReversal: {
    heading: "30 天無條件退款保證",
    guaranteeDays: 30,
    description: "【風險逆轉說明】—— 上完課覺得不適合，30 天內全額退款，無需理由。",
    studentsCount: 1280,
  },
  faq: {
    heading: "常見問題",
    items: [
      { question: "【常見問題 1】", answer: "【解答 1】" },
      { question: "【常見問題 2】", answer: "【解答 2】" },
      { question: "【常見問題 3】", answer: "【解答 3】" },
    ],
  },
}

/**
 * Second example slug — demonstrates the `premium` preset, a different hero
 * variant, and `sectionOrder` reordering/omission (risk-reversal folded into
 * the pricing narrative instead of its own block).
 */
const PREMIUM_MENTORSHIP: SalesPageContent = {
  slug: "premium-mentorship",
  meta: {
    title: "深度陪伴式 AI 產品顧問計畫",
    description: "為技術背景創辦人打造的一對一陪跑計畫，3 個月內把 AI 功能做進你的產品。",
  },
  style: {
    preset: "premium",
    heroVariant: "video-left",
    // Reordered: testimonials pulled up right after the hero (social proof
    // first for a higher-ticket offer); risk-reversal omitted from the
    // render order entirely — content still exists in `riskReversal` below
    // in case a future variant wants it back, but this example demonstrates
    // that omitting a key from sectionOrder skips the section cleanly.
    sectionOrder: ["hero", "testimonials", "painPoints", "solution", "modules", "pricing", "faq"],
  },
  hero: {
    badge: "每期僅收 8 位",
    headline: "深度陪伴式 AI 產品顧問計畫",
    subheadline: "3 個月一對一陪跑，把 AI 功能真正做進你的產品，而不是做一個 demo。",
    trustItems: ["每期限額 8 位", "累計陪跑 40+ 團隊", "平均 6 週內上線第一個 AI 功能"],
    cta: { label: "預約諮詢", href: "/p/premium-mentorship/checkout" },
    video: {
      poster: "/sales/premium-mentorship/hook-poster.jpg",
      captionsSrc: "/sales/premium-mentorship/hook-captions.vtt",
    },
  },
  painPoints: {
    heading: "聽起來很熟悉嗎？",
    items: [
      "團隊想導入 AI，但不知道從哪個功能切入才有效益",
      "做出來的 AI demo 很酷，但沒人敢把它接進正式產品",
      "找不到同時懂工程落地與產品判斷的人一起把關",
    ],
  },
  solution: {
    heading: "不是教你用 AI，而是陪你把 AI 做進產品",
    description: "每週一次深度會議 + 非同步程式碼與架構審查，聚焦在你產品真正需要的那一個 AI 功能。",
    bullets: ["每週 1 對 1 會議", "架構與程式碼審查", "上線後 30 天追蹤"],
  },
  modules: {
    heading: "陪跑計畫大綱",
    items: [
      { title: "第一個月：定位與架構", content: "盤點產品、選定第一個 AI 功能、設計資料與評估流程", outcome: "一份可執行的技術架構文件" },
      { title: "第二個月：實作與整合", content: "每週程式碼審查 + 生產環境整合", outcome: "上線到 production 的 AI 功能" },
      { title: "第三個月：優化與交接", content: "成本/延遲優化、監控與告警、團隊內部教學", outcome: "團隊能獨立維運與迭代" },
    ],
  },
  testimonials: {
    heading: "陪跑團隊怎麼說",
    items: [
      { quote: "三個月內我們把客服工單分類功能做上線，準確率超過內部預期。", name: "陳先生", role: "新創技術長" },
      { quote: "不只是技術指導，更像多了一個懂產品的合夥人幫忙做判斷。", name: "林小姐", role: "產品經理" },
    ],
  },
  pricing: {
    heading: "本期名額",
    price: 168000,
    currency: "TWD",
    deadline: "2026-07-31T15:59:59.000Z",
    features: ["12 週一對一陪跑", "每週會議 + 非同步審查", "上線後 30 天追蹤支援"],
    cta: { label: "預約諮詢", href: "/p/premium-mentorship/checkout" },
  },
  riskReversal: {
    heading: "首次會議不合適，全額退款",
    guaranteeDays: 7,
    description: "第一次深度會議後如果認為不適合，7 天內全額退款。",
    studentsCount: 42,
  },
  faq: {
    heading: "常見問題",
    items: [
      { question: "適合什麼階段的團隊？", answer: "已有正式產品、想把 AI 功能落地到生產環境的技術團隊。" },
      { question: "名額怎麼分配？", answer: "每期僅收 8 位，採申請制，會先安排一次媒合會議。" },
    ],
  },
}

const SALES_PAGE_CONFIG: Record<string, SalesPageContent> = {
  [AI_WRITING_COURSE.slug]: AI_WRITING_COURSE,
  [PREMIUM_MENTORSHIP.slug]: PREMIUM_MENTORSHIP,
}

/**
 * Config-only resolver for sales-page content. Pure (no DB), so it stays
 * unit-testable and is the backward-compatible fallback source. E332's
 * DB-first resolver (`lib/sales/resolver.ts`) calls this when a slug has no
 * `sales_pages` row — every pre-existing config page keeps working unchanged.
 * Section components never import this; only the resolver does.
 */
export function getConfigSalesPageContent(slug: string): SalesPageContent | undefined {
  const raw = SALES_PAGE_CONFIG[slug]
  if (!raw) return undefined
  return salesPageContentSchema.parse(raw)
}

/** All slugs with static config — the config half of `generateStaticParams`. */
export function getConfigSalesPageSlugs(): string[] {
  return Object.keys(SALES_PAGE_CONFIG)
}
