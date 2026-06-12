import { useServiceQuery, useServiceMutation } from "./useService";
import { CACHE_TIERS } from "../cacheConfig";
import { postsService } from "../api/services/posts";
import type { PaginationParams } from "../schemas/common";
import type { PostCreate, PostUpdate } from "../schemas/post";

export function usePostsList(params?: PaginationParams) {
  return useServiceQuery(
    ["posts", params],
    () => postsService.list(params),
    CACHE_TIERS.STANDARD,
  );
}

export function usePostDetail(id: string) {
  return useServiceQuery(
    ["posts", id],
    () => postsService.getById(id),
    CACHE_TIERS.STANDARD,
    { enabled: !!id },
  );
}

export function usePostCreate() {
  return useServiceMutation(
    (data: PostCreate) => postsService.create(data as Record<string, unknown>),
    { invalidateKeys: [["posts"]] },
  );
}

export function usePostUpdate() {
  return useServiceMutation(
    ({ id, data }: { id: string; data: PostUpdate }) =>
      postsService.update(id, data as Record<string, unknown>),
    { invalidateKeys: [["posts"]] },
  );
}

export function usePostDelete() {
  return useServiceMutation(
    (id: string) => postsService.remove(id),
    { invalidateKeys: [["posts"]] },
  );
}
