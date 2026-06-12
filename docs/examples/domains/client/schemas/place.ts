import { z } from "zod";

export const placeCreateSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  category: z.string().max(50).optional(),
});

export const placeReadSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  address: z.string().nullable(),
  description: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  category: z.string().nullable(),
  user_id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const placeUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z.string().max(500).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  category: z.string().max(50).nullable().optional(),
});

export type PlaceCreate = z.infer<typeof placeCreateSchema>;
export type PlaceRead = z.infer<typeof placeReadSchema>;
export type PlaceUpdate = z.infer<typeof placeUpdateSchema>;
