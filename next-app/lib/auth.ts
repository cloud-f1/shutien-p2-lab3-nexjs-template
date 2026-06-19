import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import GitHub from "next-auth/providers/github"
import Credentials from "next-auth/providers/credentials"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "./db"
import { accountsTable, sessionsTable, usersTable, verificationTokensTable } from "./schema"
import type { Role } from "./schema"
import { getUserByEmail, getUserById } from "./queries"
import { comparePassword } from "./password"
import { consumeNonce } from "./pending-2fa"
import { authConfig } from "../auth.config"

export const { auth, handlers, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable,
    accountsTable,
    sessionsTable,
    verificationTokensTable,
  }),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpNonce: { label: "TOTP nonce", type: "text" },
      },
      async authorize(credentials) {
        // ── 2FA completion path (E297) ──────────────────────────────────────
        // After the /login/2fa challenge passes, the verify action mints a
        // single-use nonce (lib/pending-2fa.ts) and signs in with it instead of
        // a password — the password was already verified in loginAction, and the
        // TOTP/backup code was just checked. We exchange the nonce for the user.
        const totpNonce = credentials?.totpNonce as string | undefined
        if (totpNonce) {
          const userId = consumeNonce(totpNonce)
          if (!userId) return null
          const user = await getUserById(userId)
          if (!user || !user.emailVerified || !user.totpEnabled) return null
          return { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role }
        }

        // ── Standard email + password path ──────────────────────────────────
        const email = credentials?.email as string | undefined
        const password = credentials?.password as string | undefined

        if (!email || !password) return null

        const user = await getUserByEmail(email)
        if (!user || !user.passwordHash) return null

        // Hard gate — unconditional regardless of call site.
        // loginAction also checks this for UX messaging; this is the security layer.
        if (!user.emailVerified) return null

        const isValid = await comparePassword(password, user.passwordHash)
        if (!isValid) return null

        // 2FA gate (E297): a user with TOTP enabled must NOT complete the session
        // via raw credentials — loginAction routes them to the /login/2fa
        // challenge, which finishes via the nonce path above. Refusing here is
        // defence in depth in case authorize() is reached directly.
        if (user.totpEnabled) return null

        return { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role }
      },
    }),
  ],
  // JWT sessions are REQUIRED: the Credentials provider cannot create database
  // sessions, so with the DrizzleAdapter's default "database" strategy a
  // credentials login produces no usable session and auth() returns null.
  // JWT also lets the Edge runtime read the session without a DB round-trip.
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      // `user` is only present on sign-in — persist id + role into the token.
      if (user) {
        token.id = user.id
        token.role = (user as { role?: Role }).role ?? "viewer"
      }
      // trigger==='update' fires when unstable_update() is called (e.g. after a
      // profile edit). Merge the new name/image into the token so the JWT cookie
      // reflects the fresh values instead of the sign-in snapshot.
      if (trigger === "update" && session?.user) {
        if (typeof session.user.name === "string") token.name = session.user.name
        if (typeof session.user.image === "string" || session.user.image === null) {
          token.picture = session.user.image
        }
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = (token.role as Role) ?? "viewer"
        // Reflect name/image edits persisted into the token (trigger==='update').
        if (typeof token.name === "string") session.user.name = token.name
        if (typeof token.picture === "string" || token.picture === null) {
          session.user.image = token.picture
        }
      }
      return session
    },
  },
})
