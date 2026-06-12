/** React Query cache tier presets. Import these in hooks — never hardcode staleTime. */

export const CACHE_TIERS = {
  /** Rarely changes: user profile, settings. */
  STATIC: {
    staleTime: 5 * 60 * 1000, // 5 min
    gcTime: 30 * 60 * 1000, // 30 min
  },
  /** Standard data: lists, dashboard. */
  STANDARD: {
    staleTime: 30 * 1000, // 30s
    gcTime: 5 * 60 * 1000, // 5 min
  },
  /** Frequently updated: notifications, live data. */
  REALTIME: {
    staleTime: 5 * 1000, // 5s
    gcTime: 60 * 1000, // 1 min
    refetchInterval: 10 * 1000, // 10s
  },
} as const;
