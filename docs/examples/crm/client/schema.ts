import { z } from "zod";
// import type { ContactCreate, ContactRead, ContactUpdate } from "../../api/types";
// ↑ In production, import OpenAPI-generated types and add:
//   satisfies z.ZodType<ContactRead> after each schema for compile-time drift detection.

export const contactCreateSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(320).optional(),
  phone: z.string().max(20).optional(),
  company: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export const contactReadSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  company: z.string().nullable(),
  notes: z.string().nullable(),
  notes_preview: z.string().nullable(),
  user_id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const contactUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().max(320).optional(),
  phone: z.string().max(20).optional(),
  company: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export type ContactCreate = z.infer<typeof contactCreateSchema>;
export type ContactRead = z.infer<typeof contactReadSchema>;
export type ContactUpdate = z.infer<typeof contactUpdateSchema>;
