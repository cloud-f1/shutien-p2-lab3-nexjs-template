/**
 * Sentry SDK initialization for the React client (E159 Part 1c).
 *
 * Single entry point: {@link initSentry}. Called once from `main.tsx`
 * BEFORE the React tree mounts so early render errors are captured.
 *
 * Behaviour:
 *
 * - Reads `import.meta.env.VITE_SENTRY_DSN` (baked at build time by Vite).
 * - Reads `import.meta.env.VITE_GIT_SHA` for the Sentry `release` tag so
 *   stack traces deep-link back to the exact commit.
 * - Production + missing DSN → `console.warn` (does NOT throw). Unlike the
 *   server, an SPA must not refuse to render just because observability
 *   is absent — the user still needs the app.
 * - Dev / test with empty DSN → silent no-op.
 * - Sample rates: 10% in production, 100% in dev.
 * - `sendDefaultPii: false` — GDPR-safe default; opt-in only.
 */

import * as Sentry from "@sentry/react";

/** Initialise Sentry for the browser client. Idempotent — safe to call once. */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  const isProd = import.meta.env.PROD;
  const mode = import.meta.env.MODE as string;
  const release = (import.meta.env.VITE_GIT_SHA as string | undefined) || "unknown";

  if (!dsn) {
    if (isProd) {
      // Production without a DSN is almost always a deploy mistake. Warn loudly
      // but do not throw — the app still has to render for end users.
      // eslint-disable-next-line no-console
      console.warn(
        "[observability] VITE_SENTRY_DSN is empty in a production build. " +
          "Set it in Zeabur (or your platform) BEFORE the client build runs.",
      );
    }
    return; // dev/test or missing prod DSN: silent no-op
  }

  Sentry.init({
    dsn,
    environment: mode,
    release,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: isProd ? 0.1 : 1.0,
    sendDefaultPii: false,
  });
}
