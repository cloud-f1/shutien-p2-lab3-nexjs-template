import { z } from "zod";

// ── Shared Schemas ──────────────────────────────────────────────

/** Paginated list wrapper — reusable for any resource list endpoint. */
export const paginatedResponseSchema = <T extends z.ZodTypeAny>(
  itemSchema: T,
) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int().min(0),
    page: z.number().int().positive(),
    page_size: z.number().int().positive(),
    pages: z.number().int().min(0),
  });

/** Standard query params for paginated endpoints. */
export const paginationParamsSchema = z.object({
  page: z.number().int().positive().default(1),
  page_size: z.number().int().positive().max(100).default(20),
});

/** API error shape as returned by FastAPI / fastapi-users. */
export const apiErrorSchema = z.object({
  detail: z.union([
    z.string(),
    z.array(
      z.object({
        loc: z.array(z.union([z.string(), z.number()])),
        msg: z.string(),
        type: z.string(),
      }),
    ),
  ]),
});

/** Simple message envelope — used by many mutation responses. */
export const messageResponseSchema = z.object({
  message: z.string(),
});

// ── Inferred Types ──────────────────────────────────────────────

export type PaginationParams = z.infer<typeof paginationParamsSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type MessageResponse = z.infer<typeof messageResponseSchema>;

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}
