import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { CACHE_TIERS } from "../cacheConfig";

// ── Optimistic Mutation Types ──────────────────────────────────

interface OptimisticMutationOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  queryKey: QueryKey;
  /** Transform the cache optimistically before the server responds */
  optimisticUpdate: (old: TData[] | undefined, variables: TVariables) => TData[];
  /** Optional: called on success with server response */
  onSuccess?: (data: TData) => void;
  /** Optional: called on error after rollback */
  onError?: (error: unknown) => void;
}

type CacheTier = (typeof CACHE_TIERS)[keyof typeof CACHE_TIERS];

/**
 * Generic query hook — wraps useQuery with cache tier presets.
 *
 * Usage:
 *   const { data } = useServiceQuery(["places", params], () => svc.list(params));
 *   const { data } = useServiceQuery(["place", id], () => svc.getById(id), CACHE_TIERS.STATIC);
 */
export function useServiceQuery<TData>(
  key: QueryKey,
  fetcher: () => Promise<TData>,
  tier: CacheTier = CACHE_TIERS.STANDARD,
  options?: Omit<UseQueryOptions<TData>, "queryKey" | "queryFn">,
) {
  return useQuery<TData>({
    queryKey: key,
    queryFn: fetcher,
    ...tier,
    ...options,
  });
}

/**
 * Generic mutation hook — wraps useMutation with automatic cache invalidation.
 *
 * Invalidation fires on `onSettled` (not `onSuccess`) so caches refresh
 * even on error, preventing stale optimistic data from lingering.
 *
 * Usage:
 *   const create = useServiceMutation(svc.create, { invalidateKeys: [["places"]] });
 *   create.mutate({ name: "New Place" });
 */
export function useServiceMutation<TData, TVariables>(
  mutator: (vars: TVariables) => Promise<TData>,
  options?: {
    invalidateKeys?: QueryKey[];
    removeKeys?: QueryKey[];
  } & Omit<UseMutationOptions<TData, Error, TVariables>, "mutationFn">,
) {
  const qc = useQueryClient();
  const { invalidateKeys, removeKeys, ...mutationOptions } = options ?? {};

  return useMutation<TData, Error, TVariables>({
    mutationFn: mutator,
    ...mutationOptions,
    onSettled: (...args) => {
      invalidateKeys?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      removeKeys?.forEach((k) => qc.removeQueries({ queryKey: k }));
      mutationOptions.onSettled?.(...args);
    },
  });
}

/**
 * Optimistic mutation hook — instant UI update with automatic rollback on error.
 *
 * Flow:
 *   1. Cancel outgoing refetches for the query key
 *   2. Snapshot current cache data
 *   3. Apply optimistic update via caller-provided transform
 *   4. On error → rollback to snapshot
 *   5. On settled → invalidate queries for eventual consistency
 *
 * Usage:
 *   const remove = useOptimisticMutation({
 *     mutationFn: (id: string) => svc.remove(id),
 *     queryKey: ["places"],
 *     optimisticUpdate: (old, id) => (old ?? []).filter(p => p.id !== id),
 *   });
 */
export function useOptimisticMutation<TData, TVariables>({
  mutationFn,
  queryKey,
  optimisticUpdate,
  onSuccess,
  onError,
}: OptimisticMutationOptions<TData, TVariables>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (variables: TVariables) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey });

      // Snapshot current data for rollback
      const previousData = queryClient.getQueryData<TData[]>(queryKey);

      // Optimistically update the cache
      queryClient.setQueryData<TData[]>(queryKey, (old) =>
        optimisticUpdate(old, variables),
      );

      return { previousData };
    },
    onError: (error, _variables, context) => {
      // Rollback to snapshot on error
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      onError?.(error);
    },
    onSuccess: (data) => {
      onSuccess?.(data);
    },
    onSettled: () => {
      // Always refetch to ensure server consistency
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
