/**
 * E281 — Zod-derived OpenAPI contract (drift-proof).
 *
 * The shared Zod schemas in `lib/validations/*` are the single source of truth.
 * This module registers them as named OpenAPI components and documents ONLY the
 * REAL HTTP route handlers under `app/api/**` — never invented endpoints.
 *
 * Contract model (see `info.description`): Server Actions (actions/*.ts) are typed
 * RPC — their contract is TypeScript + the shared Zod schemas, enforced at compile
 * time; this OpenAPI documents the HTTP route-handler surface only. Auth.js routes
 * under /api/auth/[...nextauth] are framework-owned and omitted.
 *
 * IMPORTANT: this module is db-free (no `@/lib/db` import) so it can be unit-tested
 * and built into the standalone bundle without a database connection.
 *
 * Regenerate `docs/openapi.yaml` with `pnpm openapi:generate` — never hand-edit it.
 */

import { z } from "zod"
import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from "@asteasolutions/zod-to-openapi"

import {
  registerSchema,
  loginSchema,
} from "@/lib/validations/auth"
import {
  updateProfileSchema,
  changePasswordSchema,
} from "@/lib/validations/user"
import {
  createItemSchema,
  updateItemSchema,
} from "@/lib/validations/items"

import pkg from "@/package.json" with { type: "json" }

// Extend zod with the `.openapi()` helper exactly ONCE per process.
extendZodWithOpenApi(z)

/**
 * Build a fresh OpenAPI 3.1 document from the registry.
 *
 * Pure + re-callable: a new registry is constructed each call so the same builder
 * backs both the `tsx` generator (→ docs/openapi.yaml) and the GET /api/openapi
 * route (in-memory JSON, standalone-build safe).
 */
export function buildOpenApiDocument() {
  const registry = new OpenAPIRegistry()

  // ── Shared Zod schemas → named components ───────────────────────────────────
  // These document the typed-RPC contract that the Server Actions share with the
  // RHF client forms. They are reusable schema components, not HTTP paths.
  const RegisterInput = registry.register(
    "RegisterInput",
    registerSchema.openapi("RegisterInput"),
  )
  const LoginInput = registry.register(
    "LoginInput",
    loginSchema.openapi("LoginInput"),
  )
  registry.register(
    "UpdateProfileInput",
    updateProfileSchema.openapi("UpdateProfileInput"),
  )
  registry.register(
    "ChangePasswordInput",
    changePasswordSchema.openapi("ChangePasswordInput"),
  )
  registry.register(
    "CreateItemInput",
    createItemSchema.openapi("CreateItemInput"),
  )
  registry.register(
    "UpdateItemInput",
    updateItemSchema.openapi("UpdateItemInput"),
  )
  // Reference the shared auth schemas so they are retained as components even
  // though no HTTP path consumes them directly (the contract is documentary).
  void RegisterInput
  void LoginInput

  // Common response schemas ----------------------------------------------------
  const ErrorResponse = z
    .object({ error: z.string() })
    .openapi("ErrorResponse")

  const CronOkResponse = z
    .object({ ok: z.literal(true) })
    .catchall(z.unknown())
    .openapi("CronOkResponse", {
      description:
        "Cron job acknowledgement. Carries job-specific counters (e.g. checked / updated / flagged).",
    })

  // ── Security scheme — CRON_SECRET bearer for cron route handlers ─────────────
  const cronBearer = registry.registerComponent("securitySchemes", "cronBearer", {
    type: "http",
    scheme: "bearer",
    description:
      "CRON_SECRET bearer token. Fails closed (401) when the secret is unset. Sent as `Authorization: Bearer <CRON_SECRET>`.",
  })

  // ── Real HTTP route handlers (app/api/**) ────────────────────────────────────

  // GET /api/health → app/api/health/route.ts
  registry.registerPath({
    method: "get",
    path: "/api/health",
    summary: "Health check",
    description:
      "Returns 200 when the app is running. Used by smoke tests and uptime monitors.",
    tags: ["health"],
    responses: {
      200: {
        description: "Healthy",
        content: {
          "application/json": {
            schema: z
              .object({
                status: z.literal("ok"),
                timestamp: z.string().datetime(),
              })
              .openapi("HealthResponse"),
          },
        },
      },
    },
  })

  // POST /api/billing/stripe/webhook → app/api/billing/stripe/webhook/route.ts
  registry.registerPath({
    method: "post",
    path: "/api/billing/stripe/webhook",
    summary: "Stripe webhook receiver",
    description:
      "Receives raw Stripe webhook events. Verifies the Stripe-Signature header, then processes the event idempotently. The raw provider event JSON is the request body.",
    tags: ["billing"],
    request: {
      headers: z.object({
        "stripe-signature": z
          .string()
          .openapi({ description: "Stripe webhook signature header" }),
      }),
      body: {
        description: "Raw Stripe event payload (verified by signature, not parsed by schema).",
        content: {
          "application/json": {
            schema: z
              .object({})
              .catchall(z.unknown())
              .openapi("StripeEvent", {
                description: "A Stripe.Event object — opaque to this contract.",
              }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Event acknowledged (received, optionally skipped as a duplicate).",
        content: {
          "application/json": {
            schema: z
              .object({
                received: z.literal(true),
                skipped: z.boolean().optional(),
              })
              .openapi("StripeWebhookAck"),
          },
        },
      },
      400: {
        description: "Missing or invalid stripe-signature header.",
        content: { "application/json": { schema: ErrorResponse } },
      },
      500: {
        description: "Internal error — Stripe retries.",
        content: { "application/json": { schema: ErrorResponse } },
      },
    },
  })

  // ECPay callbacks share the x-www-form-urlencoded CheckMacValue shape + text ack.
  const ecpayFormBody = {
    description:
      "ECPay callback — application/x-www-form-urlencoded form with a CheckMacValue (SHA256). Verified, not schema-parsed.",
    content: {
      "application/x-www-form-urlencoded": {
        schema: z
          .object({
            MerchantTradeNo: z.string().optional(),
            RtnCode: z.string().optional(),
            CheckMacValue: z.string().optional(),
          })
          .catchall(z.string())
          .openapi("EcpayCallback"),
      },
    },
  }

  const ecpayAckResponses = {
    200: {
      description: 'ECPay acknowledgement string — exactly "1|OK".',
      content: {
        "text/plain": {
          schema: z.string().openapi("EcpayAck", { example: "1|OK" }),
        },
      },
    },
    400: {
      description: 'Invalid CheckMacValue — "0|CheckMacValue invalid".',
      content: { "text/plain": { schema: z.string() } },
    },
    500: {
      description: 'Config or processing error — "0|Error" (ECPay retries).',
      content: { "text/plain": { schema: z.string() } },
    },
  } as const

  // POST /api/billing/ecpay/return → app/api/billing/ecpay/return/route.ts
  registry.registerPath({
    method: "post",
    path: "/api/billing/ecpay/return",
    summary: "ECPay ReturnURL — first authorization notification",
    description:
      "Receives the FIRST payment notification from ECPay after checkout. Verifies CheckMacValue, then upserts the subscription idempotently.",
    tags: ["billing"],
    request: { body: ecpayFormBody },
    responses: ecpayAckResponses,
  })

  // POST /api/billing/ecpay/period → app/api/billing/ecpay/period/route.ts
  registry.registerPath({
    method: "post",
    path: "/api/billing/ecpay/period",
    summary: "ECPay PeriodReturnURL — recurring cycle notification",
    description:
      "Receives a RECURRING payment notification (2nd cycle onwards), once per successful billing cycle. Verifies CheckMacValue, then advances the subscription period idempotently.",
    tags: ["billing"],
    request: { body: ecpayFormBody },
    responses: ecpayAckResponses,
  })

  // POST /api/billing/ecpay/renew → app/api/billing/ecpay/renew/route.ts (cron)
  registry.registerPath({
    method: "post",
    path: "/api/billing/ecpay/renew",
    summary: "ECPay 定期定額 renewal sweep (cron)",
    description:
      "Cron-callable. Flags ECPay subscriptions whose remaining periods fall below threshold so the UI prompts a rebuild (ECPay has no auto-renew after ExecTimes exhaustion). Requires the CRON_SECRET bearer token.",
    tags: ["billing", "cron"],
    security: [{ [cronBearer.name]: [] }],
    responses: {
      200: {
        description: "Sweep result.",
        content: { "application/json": { schema: CronOkResponse } },
      },
      401: {
        description: "Missing or invalid CRON_SECRET bearer token.",
        content: { "application/json": { schema: ErrorResponse } },
      },
      500: {
        description: "Sweep error.",
        content: {
          "application/json": {
            schema: z
              .object({ ok: z.literal(false), error: z.string() })
              .openapi("CronErrorResponse"),
          },
        },
      },
    },
  })

  // POST /api/billing/reconcile → app/api/billing/reconcile/route.ts (cron)
  registry.registerPath({
    method: "post",
    path: "/api/billing/reconcile",
    summary: "Stripe subscription reconcile (cron)",
    description:
      "Cron-callable drift recovery for a MISSED Stripe webhook: diffs stored subscriptions against Stripe's ground truth and repairs status / period-end / cancel-at. Requires the CRON_SECRET bearer token.",
    tags: ["billing", "cron"],
    security: [{ [cronBearer.name]: [] }],
    responses: {
      200: {
        description: "Reconcile result.",
        content: { "application/json": { schema: CronOkResponse } },
      },
      401: {
        description: "Missing or invalid CRON_SECRET bearer token.",
        content: { "application/json": { schema: ErrorResponse } },
      },
      500: {
        description: "Reconcile error.",
        content: {
          "application/json": {
            schema: z
              .object({ ok: z.literal(false), error: z.string() })
              .openapi("ReconcileErrorResponse"),
          },
        },
      },
    },
  })

  // ── Generate the 3.1 document ────────────────────────────────────────────────
  const generator = new OpenApiGeneratorV31(registry.definitions)

  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "AI App Template API",
      version: pkg.version,
      description:
        "Server Actions (actions/*.ts) are typed RPC — their contract is TypeScript + the shared Zod schemas in lib/validations, enforced at compile time; this OpenAPI documents the HTTP route-handler surface only. Auth.js routes under /api/auth/[...nextauth] are framework-owned and omitted. This file is GENERATED from Zod (the single source of truth) via `pnpm openapi:generate` — never hand-edit it; a smoke drift gate fails if it is stale.",
    },
    servers: [
      { url: "http://localhost:3000", description: "Local development" },
      { url: "https://{host}", description: "Production", variables: { host: { default: "your-domain.com" } } },
    ],
    tags: [
      { name: "health", description: "Health checks" },
      { name: "billing", description: "Payment provider callbacks + cron jobs" },
      { name: "cron", description: "CRON_SECRET-protected scheduled jobs" },
    ],
  })
}
