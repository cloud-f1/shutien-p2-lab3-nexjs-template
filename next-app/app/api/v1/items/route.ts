/**
 * E291 — Public REST API for items, authenticated by E267 API keys.
 *
 * This is the FIRST real caller of `verifyApiKey`: the keys minted in the API
 * Keys settings panel now unlock a genuine HTTP surface.
 *
 *   GET  /api/v1/items  → list the key-owner's items   (requires the "read" scope)
 *   POST /api/v1/items  → create an item { title }      (requires the "write" scope)
 *
 * Auth: `Authorization: Bearer sk_<prefix>_<secret>`. `verifyApiKey` resolves the
 * owning userId + the key's scopes (401 if the key is missing/invalid/revoked) and
 * bumps `lastUsedAt`. The scope is enforced per-request (403 otherwise). All queries
 * are scoped to the resolved userId — a key never sees or touches another user's data.
 *
 * The pure bearer-extraction + scope-check logic lives in lib/api-auth-utils (db-free,
 * unit-tested). The DB is dynamically imported so this module stays build-safe.
 */

import { NextRequest, NextResponse } from "next/server"

import { extractBearer, requireScope } from "@/lib/api-auth-utils"
import { createItemSchema } from "@/lib/validations/items"

/**
 * Resolve the bearer key on the request to its owner + scopes.
 * Returns the auth context, or a JSON 401 response to short-circuit with.
 */
async function authenticate(
  request: NextRequest,
): Promise<{ userId: string; scopes: string[] } | NextResponse> {
  const token = extractBearer(request.headers.get("authorization"))
  if (!token) {
    return NextResponse.json({ error: "Missing or malformed Authorization header" }, { status: 401 })
  }

  const { verifyApiKey } = await import("@/lib/api-keys")
  const key = await verifyApiKey(token)
  if (!key) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
  }

  return { userId: key.userId, scopes: key.scopes }
}

// ---------------------------------------------------------------------------
// GET /api/v1/items — list the key-owner's items (scope: read)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const auth = await authenticate(request)
  if (auth instanceof NextResponse) return auth

  const scopeError = requireScope(auth.scopes, "read")
  if (scopeError) {
    return NextResponse.json({ error: scopeError.error }, { status: scopeError.status })
  }

  const { db } = await import("@/lib/db")
  const { itemsTable } = await import("@/lib/schema")
  const { desc, eq } = await import("drizzle-orm")

  const items = await db
    .select({
      id: itemsTable.id,
      title: itemsTable.title,
      createdAt: itemsTable.createdAt,
      updatedAt: itemsTable.updatedAt,
    })
    .from(itemsTable)
    .where(eq(itemsTable.userId, auth.userId))
    .orderBy(desc(itemsTable.createdAt))

  return NextResponse.json({ items })
}

// ---------------------------------------------------------------------------
// POST /api/v1/items — create an item for the key-owner (scope: write)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const auth = await authenticate(request)
  if (auth instanceof NextResponse) return auth

  const scopeError = requireScope(auth.scopes, "write")
  if (scopeError) {
    return NextResponse.json({ error: scopeError.error }, { status: scopeError.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = createItemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 },
    )
  }

  // ── E308 opt-in overage guard (OFF by default — uncomment to enforce) ──────
  // The plumbing is shipped and unit-tested (lib/usage-utils.assertWithinLimit),
  // but enforcement is a per-fork business decision, so this route does NOT hard-
  // block by default. To turn a soft cap into a real 429, uncomment this block:
  //
  //   const { getCurrentMonthUsage } = await import("@/lib/db/queries/usage")
  //   const { getActiveSubscription } = await import("@/lib/billing/queries")
  //   const { getTierByPriceId } = await import("@/lib/billing/pricing")
  //   const { assertWithinLimit } = await import("@/lib/usage-utils")
  //
  //   const [current, active] = await Promise.all([
  //     getCurrentMonthUsage(auth.userId, "api_request"),
  //     getActiveSubscription(auth.userId),
  //   ])
  //   // No live subscription → "free" tier; else resolve the tier from its price id.
  //   const planSlug = active ? (getTierByPriceId(active.plan.providerPriceId)?.slug ?? "free") : "free"
  //   const check = assertWithinLimit(planSlug, "api_request", current, 1)
  //   if (!check.allowed) {
  //     return NextResponse.json({ error: check.reason }, { status: 429 })
  //   }
  // ───────────────────────────────────────────────────────────────────────────

  const { db } = await import("@/lib/db")
  const { itemsTable } = await import("@/lib/schema")

  const [item] = await db
    .insert(itemsTable)
    .values({ title: parsed.data.title.trim(), userId: auth.userId })
    .returning({
      id: itemsTable.id,
      title: itemsTable.title,
      createdAt: itemsTable.createdAt,
      updatedAt: itemsTable.updatedAt,
    })

  // E301 metering demo (fork reference): record one "api_request" unit against
  // the key owner. This route is API-key authed (no session), so it calls the
  // internal lib/usage.ts write path directly with the key-resolved owner id
  // (E346 — the public actions/usage.ts Server Action no longer accepts a
  // caller-supplied userId). Metering is best-effort — wrapped so neither a
  // failed dynamic import nor a write error can ever affect the API response.
  try {
    const { recordUsageFor } = await import("@/lib/usage")
    await recordUsageFor(auth.userId, "api_request", 1)
  } catch {
    // swallow — usage metering must never break the request path
  }

  return NextResponse.json({ item }, { status: 201 })
}

export const dynamic = "force-dynamic"
