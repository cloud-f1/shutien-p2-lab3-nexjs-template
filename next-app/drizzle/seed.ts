import { db } from "../lib/db"
import { usersTable } from "../lib/schema"
import bcrypt from "bcryptjs"

async function seed() {
  console.log("🌱 Seeding database...")

  const adminHash = await bcrypt.hash("Admin123!", 12)
  const userHash = await bcrypt.hash("User123!", 12)

  await db
    .insert(usersTable)
    .values([
      {
        name: "Test Admin",
        email: "admin@example.com",
        passwordHash: adminHash,
        emailVerified: new Date(),
        role: "admin",
      },
      {
        // Non-admin user — required for e2e admin-panel tests:
        // gives a non-self row (so the role <Select> combobox renders)
        // and a real subject for the non-admin redirect guard test.
        name: "Test User",
        email: "user@example.com",
        passwordHash: userHash,
        emailVerified: new Date(),
        role: "user",
      },
    ])
    .onConflictDoNothing()

  console.log("")
  console.log("✅ Seed complete!")
  console.log("   Admin → admin@example.com / Admin123!")
  console.log("   User  → user@example.com / User123!")
  console.log("")
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seed failed:", err)
    process.exit(1)
  })
