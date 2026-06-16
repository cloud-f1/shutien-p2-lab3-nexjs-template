/**
 * Shared Drizzle schema — split by domain (E275) for navigability. Every consumer
 * imports `@/lib/schema` (this barrel), so call sites are unchanged. drizzle-kit
 * reads this file (see drizzle.config.ts) and unions all re-exported tables/enums.
 */
export * from "./auth"
export * from "./items"
export * from "./billing"
export * from "./system"
