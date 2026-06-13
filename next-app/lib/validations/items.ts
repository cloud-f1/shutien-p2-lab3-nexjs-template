import { z } from "zod"

export const createItemSchema = z.object({
  title: z.string().min(1, "請輸入標題").max(255, "標題過長"),
})

export const updateItemSchema = z.object({
  title: z.string().min(1, "請輸入標題").max(255, "標題過長"),
})

export type CreateItemInput = z.infer<typeof createItemSchema>
export type UpdateItemInput = z.infer<typeof updateItemSchema>
