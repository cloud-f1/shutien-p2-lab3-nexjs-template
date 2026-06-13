"use server"

import { db } from "@/lib/db"
import { usersTable } from "@/lib/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/permissions"
import { unstable_update } from "@/lib/auth"
import { comparePassword, hashPassword } from "@/lib/password"
import { updateProfileSchema, changePasswordSchema } from "@/lib/validations/user"
import type { FormState } from "@/lib/validations/types"

export async function updateProfile(prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireAuth()

  const result = updateProfileSchema.safeParse({
    name: formData.get("name"),
    image: formData.get("image") || "",
  })
  if (!result.success) return { error: result.error.errors[0].message }

  const { name, image } = result.data
  const nextImage = image || null
  await db
    .update(usersTable)
    .set({ name, image: nextImage, updatedAt: new Date() })
    .where(eq(usersTable.id, session.user.id))

  // Push the new name/image into the JWT (trigger==='update' in lib/auth.ts jwt
  // callback) so the sidebar/settings reflect the change without a re-login.
  await unstable_update({ user: { name, image: nextImage } })

  revalidatePath("/dashboard/settings")
  return { success: true }
}

export async function changePassword(prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireAuth()

  const result = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  })
  if (!result.success) return { error: result.error.errors[0].message }

  const { currentPassword, newPassword } = result.data

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.user.id))
  if (!user?.passwordHash) {
    return { error: "OAuth 帳戶無法變更密碼。" }
  }

  const isValid = await comparePassword(currentPassword, user.passwordHash)
  if (!isValid) return { error: "目前密碼錯誤。" }

  const newHash = await hashPassword(newPassword)
  await db
    .update(usersTable)
    .set({ passwordHash: newHash, updatedAt: new Date() })
    .where(eq(usersTable.id, session.user.id))

  revalidatePath("/dashboard/settings")
  return { success: true }
}
