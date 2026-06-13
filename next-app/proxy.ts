import NextAuth from "next-auth"
import { authConfig } from "./auth.config"

// Use the lightweight config (no DrizzleAdapter) for Edge middleware.
// The full lib/auth.ts config runs only in Node.js server contexts.
export const { auth: middleware } = NextAuth(authConfig)
export default middleware

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
