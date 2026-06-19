/**
 * E309 — Pure row-mapper helpers for export actions.
 *
 * Each mapper converts a DB row to a flat Record<string, unknown> suitable for
 * toCsv() / toJson(). All mappers are synchronous, db-free, and unit-testable.
 *
 * SECURITY: apiKeyToExportRow intentionally omits `hashedKey` — only the stored
 * prefix + metadata is exported. The raw secret is never stored and therefore
 * can never appear here; but we additionally exclude the hash to prevent offline
 * rainbow-table attacks.
 */

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export interface WebhookExportInput {
  id: string
  userId: string
  url: string
  events: string[]
  active: boolean
  createdAt: Date
}

export function webhookToExportRow(row: WebhookExportInput): Record<string, unknown> {
  return {
    id: row.id,
    userId: row.userId,
    url: row.url,
    events: row.events.join("|"),
    active: row.active,
    createdAt: row.createdAt.toISOString(),
  }
}

// ---------------------------------------------------------------------------
// API Keys — secret NEVER exported (prefix + metadata only)
// ---------------------------------------------------------------------------

export interface ApiKeyExportInput {
  id: string
  userId: string
  name: string
  prefix: string
  scopes: string[]
  lastUsedAt: Date | null
  revokedAt: Date | null
  createdAt: Date
  // hashedKey intentionally excluded — never pass it to this mapper
}

export function apiKeyToExportRow(row: ApiKeyExportInput): Record<string, unknown> {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    prefix: `sk_${row.prefix}…`,
    scopes: row.scopes.join("|"),
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : "",
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : "",
    createdAt: row.createdAt.toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Team — members
// ---------------------------------------------------------------------------

export interface TeamMemberExportInput {
  id: string
  name: string | null
  email: string
  role: string
  status: string
  createdAt: Date
}

export function teamMemberToExportRow(row: TeamMemberExportInput): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name ?? "",
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Team — invitations
// ---------------------------------------------------------------------------

export interface InvitationExportInput {
  id: string
  email: string
  role: string
  status: string
  expiresAt: Date
  createdAt: Date
}

export function invitationToExportRow(row: InvitationExportInput): Record<string, unknown> {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }
}
