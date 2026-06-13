import type { NextAuthConfig } from "next-auth"

// Minimal config for Edge middleware — no adapter, no Node.js-only imports.
// The full config (lib/auth.ts) uses DrizzleAdapter which only works in Node.js runtime.
export const authConfig: NextAuthConfig = {
  trustHost: true,  // required behind reverse proxies and in non-standard port environments
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl
      const isLoggedIn = !!auth?.user

      // Middleware enforces AUTHENTICATION only (coarse gate).
      // It deliberately does NOT check `role`: with the database session
      // strategy (DrizzleAdapter), the Edge token does not carry custom
      // columns like `role`, so an admin check here would be unreliable.
      // AUTHORIZATION for /dashboard/admin is enforced server-side by
      // requireAdmin() in the admin page + every admin Server Action
      // (see lib/permissions.ts) — that is the real, reliable gate.
      if (pathname.startsWith("/dashboard") && !isLoggedIn) {
        return false // Auth.js redirects to signIn page
      }

      return true
    },
  },
}
