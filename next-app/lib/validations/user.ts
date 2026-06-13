import { z } from "zod"
import { passwordSchema } from "./auth"

export const updateProfileSchema = z.object({
  name: z.string().min(1, "請輸入姓名").max(100),
  image: z
    .string()
    .url("請輸入有效的網址")
    .refine((url) => url.startsWith("https://"), "圖片網址必須使用 https")
    .optional()
    .or(z.literal("")),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "請輸入目前密碼"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "請確認您的新密碼"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "密碼不一致",
    path: ["confirmPassword"],
  })

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
