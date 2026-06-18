// Shared metadata for OAuth providers — keep UI labels consistent across the
// auth pages and the Settings "Connected Accounts" tab. The DrizzleAdapter
// stores the lowercase provider id (e.g. "google", "github") on accountsTable;
// map those ids to a human-readable display name here.

export const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  github: "GitHub",
  credentials: "電子郵件",
}

/**
 * Human-readable display name for a stored provider id.
 * Falls back to a Title-cased version of the raw id for unknown providers.
 */
export function providerLabel(provider: string): string {
  return (
    PROVIDER_LABELS[provider.toLowerCase()] ??
    provider.charAt(0).toUpperCase() + provider.slice(1)
  )
}
