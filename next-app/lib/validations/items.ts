import { z } from "zod"

export const createItemSchema = z.object({
  title: z.string().min(1, "請輸入標題").max(255, "標題過長"),
})

// E348 — the single validation contract for updating an item's title. Used
// directly by `updateItem()` in actions/items.ts via `.safeParse()` (the same
// pattern actions/user.ts already uses for updateProfileSchema/changePasswordSchema).
// Previously this schema had NO real caller: `updateItem()` used a separately
// hand-rolled `validateItemTitle()` (lib/items-utils.ts) that happened to enforce
// the same min/max but also trimmed the raw FormData value first and mapped
// non-string/null input (FormData.get() can return string | File | null) to a
// friendly message — behavior this schema didn't replicate on its own. The
// `invalid_type_error` below covers the non-string/null case; the caller trims
// before calling `.safeParse()` so the min/max checks see the same value
// `validateItemTitle()` used to check, preserving the exact accept/reject
// boundary and error text (see docs/epics/e348-update-item-contract-drift.md).
export const updateItemSchema = z.object({
  title: z
    .string({ invalid_type_error: "請輸入標題" })
    .min(1, "請輸入標題")
    .max(255, "標題過長（最多 255 個字元）。"),
})

export type CreateItemInput = z.infer<typeof createItemSchema>
export type UpdateItemInput = z.infer<typeof updateItemSchema>
