import { z } from "zod";
// import type { PostCreate, PostRead, PostUpdate } from "../../api/types";
// ↑ In production, import OpenAPI-generated types and add:
//   satisfies z.ZodType<PostRead> after each schema for compile-time drift detection.

export const postCreateSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  published: z.boolean().optional().default(false),
  // NOTE: published_at is NOT in create schema — server sets it automatically
});

export const postReadSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  body: z.string(),
  published: z.boolean(),
  published_at: z.string().nullable(),
  user_id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const postUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(10000).optional(),
  published: z.boolean().optional(),
});

export type PostCreate = z.infer<typeof postCreateSchema>;
export type PostRead = z.infer<typeof postReadSchema>;
export type PostUpdate = z.infer<typeof postUpdateSchema>;
