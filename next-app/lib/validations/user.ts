import { z } from "zod"
import { passwordSchema } from "./auth"

export const updateProfileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  image: z.string().url("Must be a valid URL").optional().or(z.literal("")),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
