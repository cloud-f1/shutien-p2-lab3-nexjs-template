# E140 — Optimistic Updates in Service Factory

> **Size**: M (5 SP) | **Phase**: 36 | **Deps**: useService.ts (E22)

## Goal

Extend the React Query service factory with a `useOptimisticMutation` hook that provides instant UI updates with automatic rollback on server error.

## Design

- Add `useOptimisticMutation<TData, TVariables>` to `client/src/hooks/useService.ts`
- `onMutate`: cancel outgoing refetches, snapshot current cache, apply optimistic update
- `onError`: rollback to snapshot
- `onSettled`: always invalidate queries for eventual consistency
- Caller provides `optimisticUpdate(old, variables)` transform function

## Tests (6)

1. Optimistic update applies immediately before server responds
2. Rollback occurs on mutation error
3. Cache is invalidated after success
4. `onSuccess` callback fires with server data
5. `onError` callback fires after rollback
6. Concurrent mutations cancel outgoing queries
