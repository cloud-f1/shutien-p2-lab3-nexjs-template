/**
 * E299 — Programmatic CSV export of the API-key-owner's items.
 *
 *   GET /api/v1/export/items
 *
 * Auth: `Authorization: Bearer <api-key>` — the same bearer auth used by
 * `GET /api/v1/items`. `verifyApiKey` resolves the owning userId + scopes and
 * bumps `lastUsedAt`; 401 is returned if the key is missing, invalid, or revoked.
 * The "read" scope is required (403 otherwise).
 *
 * Response: CSV attachment with `Content-Disposition: attachment; filename="..."`.
 */

import { NextRequest, NextResponse } from "next/server"

import { extractBearer, requireScope } from "@/lib/api-auth-utils"
import { toCsv } from "@/lib/export-utils"

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
// GET /api/v1/export/items — download the key-owner's items as CSV (scope: read)
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

  const rows = items.map((item) => ({
    id: item.id,
    title: item.title,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }))

  const csv = toCsv(rows, ["id", "title", "createdAt", "updatedAt"])
  const filename = `items-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}

export const dynamic = "force-dynamic"
