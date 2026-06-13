import { db } from "../lib/db"
import { usersTable } from "../lib/schema"
import bcrypt from "bcryptjs"

async function seed() {
  console.log("🌱 Seeding database...")

  const adminHash = await bcrypt.hash("Admin123!", 12)
  const editorHash = await bcrypt.hash("Editor123!", 12)
  const viewerHash = await bcrypt.hash("Viewer123!", 12)

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
        // Editor — can create/edit/delete items but cannot reach the admin panel.
        name: "Test Editor",
        email: "editor@example.com",
        passwordHash: editorHash,
        emailVerified: new Date(),
        role: "editor",
      },
      {
        // Viewer — read-only. Required for e2e RBAC tests: gives a non-admin row
        // (so the admin role <Select> combobox renders for a non-self user) and
        // a real subject for the non-admin redirect guard test.
        name: "Test Viewer",
        email: "viewer@example.com",
        passwordHash: viewerHash,
        emailVerified: new Date(),
        role: "viewer",
      },
    ])
    .onConflictDoNothing()

  console.log("")
  console.log("✅ Seed complete!")
  console.log("   Admin  → admin@example.com / Admin123!")
  console.log("   Editor → editor@example.com / Editor123!")
  console.log("   Viewer → viewer@example.com / Viewer123!")
  console.log("")
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seed failed:", err)
    process.exit(1)
  })
