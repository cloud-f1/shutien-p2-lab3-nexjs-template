import { z } from "zod"

export const passwordSchema = z
  .string()
  .min(8, "密碼至少需 8 個字元")
  .regex(/[A-Z]/, "必須包含至少一個大寫字母")
  .regex(/[0-9]/, "必須包含至少一個數字")

export const registerSchema = z.object({
  name: z.string().min(1, "請輸入姓名"),
  email: z.string().email("電子郵件格式不正確"),
  password: passwordSchema,
})

export const loginSchema = z.object({
  email: z.string().email("電子郵件格式不正確"),
  password: z.string().min(1, "請輸入密碼"),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email("電子郵件格式不正確"),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "缺少重設權杖"),
  password: passwordSchema,
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
