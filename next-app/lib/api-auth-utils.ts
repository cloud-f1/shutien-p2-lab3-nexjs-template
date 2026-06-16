// Pure, db-free helpers for the public REST API (E291) — unit-testable in isolation.
//
// These cover the parts of public-API auth that need NO database: pulling the
// bearer token out of an Authorization header and checking a resolved key's
// scopes. The DB-backed verification (prefix lookup + hash compare) stays in
// `lib/api-keys.ts` (`verifyApiKey`); this module is intentionally import-free.

/** The scopes a public API key can grant. */
export type ApiScope = "read" | "write"

/**
 * Extract the raw bearer token from an `Authorization: Bearer <token>` header.
 * Returns null when the header is missing or not a well-formed bearer header.
 *
 * The scheme match is case-insensitive ("Bearer" / "bearer") and tolerant of
 * extra surrounding whitespace; an empty token yields null.
 */
export function extractBearer(authorization: string | null | undefined): string | null {
  if (!authorization) return null
  const m = /^\s*Bearer\s+(.+?)\s*$/i.exec(authorization)
  if (!m) return null
  const token = m[1].trim()
  return token.length > 0 ? token : null
}

/** True when the key's scope list contains the required scope. */
export function hasScope(scopes: readonly string[] | null | undefined, required: ApiScope): boolean {
  return Array.isArray(scopes) && scopes.includes(required)
}

/**
 * Assert a key has the required scope. Returns null when allowed, or a 403
 * error descriptor (message + status) when the scope is missing — so the route
 * handler can turn it straight into a JSON response without branching logic.
 */
export function requireScope(
  scopes: readonly string[] | null | undefined,
  required: ApiScope,
): { error: string; status: 403 } | null {
  return hasScope(scopes, required)
    ? null
    : { error: `Missing required scope: ${required}`, status: 403 }
}
