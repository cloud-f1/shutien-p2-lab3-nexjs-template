import { APP_NAME } from "@/lib/branding"
import { resolveAppInstanceId } from "@/lib/app-identity"

/**
 * Read the identity at request time, not at build time. Without this a route
 * handler with no dynamic API usage can be prerendered, which would freeze both
 * `timestamp` and `appInstanceId` into the build output.
 */
export const dynamic = "force-dynamic"

/**
 * Liveness probe + app-instance identity (E357).
 *
 * `appInstanceId` is what lets a test runner prove it is talking to THIS
 * checkout and not to another app — or another fork of this template — that
 * happens to hold the same port. See `lib/app-identity.ts` for why the id is
 * derived from the project path rather than from any config value (a fresh fork
 * has an identical name, version, title and `/api/health` shape).
 *
 * The id is an opaque digest: it identifies, it does not disclose. `appName` is
 * diagnostics only — it is already public in the UI and is deliberately NOT
 * used for identity, because an un-rebranded fork reports the same one.
 */
export async function GET() {
  return Response.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    appInstanceId: resolveAppInstanceId(),
    appName: APP_NAME,
  })
}
