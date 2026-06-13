import { z } from "zod"

export const createItemSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title is too long"),
})

export const updateItemSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title is too long"),
})

export type CreateItemInput = z.infer<typeof createItemSchema>
export type UpdateItemInput = z.infer<typeof updateItemSchema>
