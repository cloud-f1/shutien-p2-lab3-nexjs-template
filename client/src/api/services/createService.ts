import type { AxiosRequestConfig } from "axios";
import type { z } from "zod";
import { apiClient } from "../client";
import { paginatedResponseSchema } from "../../schemas/common";
import type { PaginatedResponse, PaginationParams } from "../../schemas/common";

/**
 * Generic CRUD service factory.
 *
 * Every response is validated through a Zod schema before returning —
 * catches backend schema drift at runtime before it reaches components.
 *
 * Usage:
 *   const placesService = createService("/api/v1/places", placeSchema);
 *   const places = await placesService.list({ page: 1, page_size: 20 });
 *   const place  = await placesService.getById("uuid");
 */
export function createService<T>(basePath: string, schema: z.ZodType<T>) {
  return {
    /** GET basePath — returns paginated list. */
    list: async (
      params?: PaginationParams,
      config?: AxiosRequestConfig,
    ): Promise<PaginatedResponse<T>> => {
      const res = await apiClient.get(basePath, { params, ...config });
      // Assertion is safe: data is Zod-validated, but generic inference
      // doesn't align with the PaginatedResponse<T> interface.
      return paginatedResponseSchema(schema).parse(
        res.data,
      ) as PaginatedResponse<T>;
    },

    /** GET basePath — returns raw array (non-paginated endpoints). */
    listAll: async (
      params?: Record<string, unknown>,
      config?: AxiosRequestConfig,
    ): Promise<T[]> => {
      const res = await apiClient.get(basePath, { params, ...config });
      return schema.array().parse(res.data);
    },

    /** GET basePath/:id — returns single item. */
    getById: async (id: string, config?: AxiosRequestConfig): Promise<T> => {
      const res = await apiClient.get(`${basePath}/${id}`, config);
      return schema.parse(res.data);
    },

    /** POST basePath — creates and returns the new item. */
    create: async (
      data: Record<string, unknown>,
      config?: AxiosRequestConfig,
    ): Promise<T> => {
      const res = await apiClient.post(basePath, data, config);
      return schema.parse(res.data);
    },

    /** PATCH basePath/:id — partial update, returns updated item. */
    update: async (
      id: string,
      data: Record<string, unknown>,
      config?: AxiosRequestConfig,
    ): Promise<T> => {
      const res = await apiClient.patch(`${basePath}/${id}`, data, config);
      return schema.parse(res.data);
    },

    /** DELETE basePath/:id — returns void. */
    remove: async (id: string, config?: AxiosRequestConfig): Promise<void> => {
      await apiClient.delete(`${basePath}/${id}`, config);
    },
  };
}
