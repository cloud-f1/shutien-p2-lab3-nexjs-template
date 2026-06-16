/**
 * HTTP security headers applied to every route via next.config.ts.
 *
 * FORKER NOTE: This list is intentionally pragmatic so the app works
 * out-of-the-box with Next.js (inline hydration scripts) and Tailwind CSS
 * (inline styles). Tighten these values progressively once you understand
 * your own asset/API topology:
 *
 *   - Remove 'unsafe-inline' from script-src once you add nonce-based CSP
 *     (requires Next.js middleware + streaming config).
 *   - Remove 'unsafe-eval' from script-src once you no longer need it
 *     (Next.js dev mode uses eval; production builds do not).
 *   - Narrow connect-src / frame-src to only the domains you actually use.
 */

export type SecurityHeader = {
  key: string
  value: string
}

/**
 * Content-Security-Policy directive list.
 *
 * Built as an array of strings and joined with "; " so each directive is
 * easy to read, comment, and extend individually.
 */
const CSP_DIRECTIVES = [
  // Only load resources from the same origin by default.
  "default-src 'self'",

  // Next.js requires 'unsafe-inline' for inline scripts and 'unsafe-eval'
  // in development (HMR).  Production standalone builds still use
  // inline hydration chunks, so both flags stay here until you adopt nonces.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",

  // Tailwind CSS v4 inlines critical styles; 'unsafe-inline' is required.
  "style-src 'self' 'unsafe-inline'",

  // Allow images from same origin, base64 data URIs, and blob: URLs
  // (used by next/image and browser-generated previews).
  "img-src 'self' data: blob:",

  // Google Fonts or self-hosted fonts may use data: URIs.
  "font-src 'self' data:",

  // Stripe JS SDK and your own API.  Add other API hostnames here.
  "connect-src 'self' https://api.stripe.com",

  // Stripe payment iframes.
  "frame-src https://js.stripe.com https://checkout.stripe.com",

  // Disallow <base> tag hijacking.
  "base-uri 'self'",

  // Only allow form submissions to same origin.
  "form-action 'self'",

  // Block all plugin content (Flash, etc.).
  "object-src 'none'",
].join("; ")

/**
 * Full list of security headers to add to every HTTP response.
 *
 * Import this const in next.config.ts and spread it into the `headers()`
 * return value.
 */
export const SECURITY_HEADERS: SecurityHeader[] = [
  // Force HTTPS for 2 years, include sub-domains, opt into preload list.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },

  // Prevent browsers from MIME-sniffing the Content-Type.
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },

  // Block the page from being embedded in an <iframe> on another origin.
  {
    key: "X-Frame-Options",
    value: "DENY",
  },

  // Only send the origin (no path) as the Referer on cross-origin requests.
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },

  // Let the browser pre-resolve DNS for linked resources (perf + privacy OK).
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },

  // Disable hardware features that the app does not use.
  // Forkers: add/remove features as needed.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },

  // Pragmatic CSP — see CSP_DIRECTIVES above for per-directive comments.
  {
    key: "Content-Security-Policy",
    value: CSP_DIRECTIVES,
  },
]
