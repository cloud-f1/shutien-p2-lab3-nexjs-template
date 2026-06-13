import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

// Singleton pattern: reuse the connection across hot reloads in development
const globalForDb = globalThis as unknown as { db: ReturnType<typeof drizzle> | undefined }

function createDb() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error("DATABASE_URL is not set")

  const client = postgres(connectionString, {
    max: process.env.NODE_ENV === "production" ? 10 : 1,
  })

  return drizzle(client, { schema })
}

export const db = globalForDb.db ?? createDb()

if (process.env.NODE_ENV !== "production") globalForDb.db = db
