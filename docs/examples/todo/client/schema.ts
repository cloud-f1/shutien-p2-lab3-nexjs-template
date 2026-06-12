import { z } from "zod";
// import type { TaskCreate, TaskRead, TaskUpdate } from "../../api/types";
// ↑ In production, import OpenAPI-generated types and add:
//   satisfies z.ZodType<TaskRead> after each schema for compile-time drift detection.

export const taskCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  completed: z.boolean().optional().default(false),
  due_date: z.string().optional(),
  priority: z.number().int().min(0).max(2).optional().default(0),
});

export const taskReadSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  completed: z.boolean(),
  due_date: z.string().nullable(),
  priority: z.number().int(),
  is_overdue: z.boolean(),
  user_id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const taskUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  completed: z.boolean().optional(),
  due_date: z.string().optional(),
  priority: z.number().int().min(0).max(2).optional(),
});

export const taskBatchUpdateSchema = z.object({
  task_ids: z.array(z.string().uuid()).min(1).max(100),
  completed: z.boolean(),
});

export type TaskCreate = z.infer<typeof taskCreateSchema>;
export type TaskRead = z.infer<typeof taskReadSchema>;
export type TaskUpdate = z.infer<typeof taskUpdateSchema>;
export type TaskBatchUpdate = z.infer<typeof taskBatchUpdateSchema>;
