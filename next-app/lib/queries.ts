import { cache } from "react"
import { db } from "./db"
import { emailVerificationTokensTable, passwordResetTokensTable, usersTable } from "./schema"
import { eq } from "drizzle-orm"

// React.cache() deduplicates calls within a single request (RSC per-request cache)

export const getUserByEmail = cache(async (email: string) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email))
  return user ?? null
})

export const getUserById = cache(async (id: string) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id))
  return user ?? null
})

export const getVerificationToken = cache(async (token: string) => {
  const [record] = await db
    .select()
    .from(emailVerificationTokensTable)
    .where(eq(emailVerificationTokensTable.token, token))
  return record ?? null
})

export const getPasswordResetToken = cache(async (token: string) => {
  const [record] = await db
    .select()
    .from(passwordResetTokensTable)
    .where(eq(passwordResetTokensTable.token, token))
  return record ?? null
})
