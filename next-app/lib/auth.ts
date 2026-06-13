import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import { db } from "./db"
import { accountsTable, sessionsTable, usersTable, verificationTokensTable } from "./schema"
import type { Role } from "./schema"
import { getUserByEmail } from "./queries"
import { comparePassword } from "./password"
import { authConfig } from "../auth.config"

export const { auth, handlers, signIn, signOut } = NextAuth({
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
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
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
    async jwt({ token, user }) {
      // `user` is only present on sign-in — persist id + role into the token.
      if (user) {
        token.id = user.id
        token.role = (user as { role?: Role }).role ?? "viewer"
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = (token.role as Role) ?? "viewer"
      }
      return session
    },
  },
})
