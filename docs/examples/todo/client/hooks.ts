import { useServiceQuery, useServiceMutation } from "./useService";
import { CACHE_TIERS } from "../cacheConfig";
import { tasksService } from "../api/services/tasks";
import type { PaginationParams } from "../schemas/common";
import type { TaskCreate, TaskUpdate, TaskBatchUpdate } from "../schemas/task";
import { apiClient } from "../api/client";

export function useTasksList(params?: PaginationParams) {
  return useServiceQuery(
    ["tasks", params],
    () => tasksService.list(params),
    CACHE_TIERS.STANDARD,
  );
}

export function useTaskDetail(id: string) {
  return useServiceQuery(
    ["tasks", id],
    () => tasksService.getById(id),
    CACHE_TIERS.STANDARD,
    { enabled: !!id },
  );
}

export function useTaskCreate() {
  return useServiceMutation(
    (data: TaskCreate) => tasksService.create(data as Record<string, unknown>),
    { invalidateKeys: [["tasks"]] },
  );
}

export function useTaskUpdate() {
  return useServiceMutation(
    ({ id, data }: { id: string; data: TaskUpdate }) =>
      tasksService.update(id, data as Record<string, unknown>),
    { invalidateKeys: [["tasks"]] },
  );
}

export function useTaskDelete() {
  return useServiceMutation(
    (id: string) => tasksService.remove(id),
    { invalidateKeys: [["tasks"]] },
  );
}

// ── Todo-specific: batch update hook ──
export function useTaskBatchUpdate() {
  return useServiceMutation(
    (data: TaskBatchUpdate) =>
      apiClient.patch("/tasks/batch", data).then((r) => r.data),
    { invalidateKeys: [["tasks"]] },
  );
}
