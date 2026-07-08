// @saas/sentry-pii — beforeSend PII scrubber (E325).
//
// Ported from a fork's ID-masking Sentry scrubber, generalized: masks emails,
// bearer/API tokens, JWTs, and secret-looking `key=value` pairs — plus an OPT-IN list
// of "ID-like" regexes (badge numbers, ticket ids, ...) the consumer supplies for their
// own domain — instead of a single hardcoded pattern.
//
// PURE — no `@sentry/nextjs` import, no side effects — so it is independently
// unit-testable and idempotent (scrubbing an already-scrubbed event is a no-op).
// Compose this into the template's EXISTING env-gated Sentry init
// (`next-app/instrumentation.ts`, E293) via `beforeSend` / `beforeSendTransaction` —
// see the install-sentry-pii skill. Do NOT create a second `Sentry.init()` call.

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const EMAIL_MASK = "[REDACTED_EMAIL]"

const BEARER_RE = /\bBearer\s+[A-Za-z0-9._-]+/gi
const JWT_RE = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g
// `api_key=...`, `secret: "..."`, `token=...`, `password: '...'`, etc.
const SECRET_KV_RE =
  /\b((?:api[_-]?key|secret|token|password|passwd|auth)\s*[:=]\s*)("?)([^"'\s,}]+)\2/gi
const TOKEN_MASK = "[REDACTED_TOKEN]"

/** Default replacement for a matched `idPatterns` entry. */
const DEFAULT_ID_MASK = "[REDACTED_ID]"

export interface ScrubOptions {
  /**
   * Extra regexes considered "ID-like" for your domain (badge numbers, ticket ids,
   * order numbers, ...) and masked with `idMask`. Opt-in — empty by default, since a
   * one-size-fits-all ID shape does not exist across products. Each regex MUST use the
   * global flag (`/.../g`).
   */
  idPatterns?: RegExp[]
  /** Replacement token for matches of `idPatterns`. Default `"[REDACTED_ID]"`. */
  idMask?: string
}

function maskString(value: string, options: ScrubOptions): string {
  let out = value.replace(EMAIL_RE, EMAIL_MASK)
  out = out.replace(BEARER_RE, `Bearer ${TOKEN_MASK}`)
  out = out.replace(JWT_RE, TOKEN_MASK)
  out = out.replace(SECRET_KV_RE, (_match, prefix: string, quote: string) => `${prefix}${quote}${TOKEN_MASK}${quote}`)

  const idMask = options.idMask ?? DEFAULT_ID_MASK
  for (const pattern of options.idPatterns ?? []) {
    out = out.replace(pattern, idMask)
  }
  return out
}

/** Mask PII in a single string using the same rules `scrubEvent` applies per-field. */
export function maskPii(value: string, options: ScrubOptions = {}): string {
  return maskString(value, options)
}

/**
 * A loose Sentry event shape (only the fields this module touches, all optional, no
 * index signature) — this lets Sentry's real `ErrorEvent`/`TransactionEvent` types be
 * passed in structurally without importing `@sentry/nextjs` here.
 */
export interface ScrubbableEvent {
  message?: unknown
  transaction?: unknown
  request?: {
    data?: unknown
    cookies?: unknown
    headers?: unknown
    query_string?: unknown
    url?: unknown
  }
  user?: unknown
  exception?: {
    values?: Array<{ value?: unknown }>
  }
  logentry?: { message?: unknown }
}

function stripAuthorizationHeaders(headers: unknown, options: ScrubOptions): unknown {
  if (!headers || typeof headers !== "object") return headers
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (key.toLowerCase() === "authorization" || key.toLowerCase() === "cookie") continue
    out[key] = typeof value === "string" ? maskString(value, options) : value
  }
  return out
}

/**
 * Scrub a single Sentry event in place and return it (or `null` if `event` was
 * nullish). Never drops an event — this module masks, it does not filter; wire
 * event-dropping decisions (e.g. `sampleRate`) in `Sentry.init()` separately.
 */
export function scrubEvent<E extends ScrubbableEvent>(
  event: E | null | undefined,
  options: ScrubOptions = {},
): E | null {
  if (!event) return event ?? null

  if (typeof event.message === "string") {
    event.message = maskString(event.message, options)
  }
  if (typeof event.transaction === "string") {
    event.transaction = maskString(event.transaction, options)
  }

  if (event.logentry && typeof event.logentry === "object") {
    if (typeof event.logentry.message === "string") {
      event.logentry.message = maskString(event.logentry.message, options)
    }
  }

  if (event.request && typeof event.request === "object") {
    const req = event.request
    // Request body / cookies may hold arbitrary user-submitted or session data — drop
    // entirely rather than attempt to mask an unbounded shape.
    delete req.data
    delete req.cookies
    if ("headers" in req) {
      req.headers = stripAuthorizationHeaders(req.headers, options)
    }
    if (typeof req.url === "string") req.url = maskString(req.url, options)
    if (typeof req.query_string === "string") req.query_string = maskString(req.query_string, options)
  }

  // Drop Sentry's user context outright rather than mask it — it commonly carries an
  // email/ip/id combination that re-identifies the person even after field masking.
  if ("user" in event) {
    delete event.user
  }

  if (event.exception && typeof event.exception === "object") {
    const values = event.exception.values
    if (Array.isArray(values)) {
      for (const value of values) {
        if (value && typeof value.value === "string") {
          value.value = maskString(value.value, options)
        }
      }
    }
  }

  return event
}

/** Build a `beforeSend`-compatible function bound to fixed `ScrubOptions`. */
export function createBeforeSend(options: ScrubOptions = {}) {
  return function beforeSend<E extends ScrubbableEvent>(event: E | null | undefined): E | null {
    return scrubEvent(event, options)
  }
}

/** Default scrubber with no custom `idPatterns` — pass directly as `Sentry.init({ beforeSend })`. */
export const beforeSend = createBeforeSend()
/** Same rules apply to transaction events. */
export const beforeSendTransaction = beforeSend
