"use client"

import { useTransition, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validations/user"
import { changePassword } from "@/actions/user"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function PasswordForm() {
  const [isPending, startTransition] = useTransition()
  const [serverMessage, setServerMessage] = useState<{ type: "error" | "success"; text: string } | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  })

  function onSubmit(data: ChangePasswordInput) {
    setServerMessage(null)
    const fd = new FormData()
    fd.set("currentPassword", data.currentPassword)
    fd.set("newPassword", data.newPassword)
    fd.set("confirmPassword", data.confirmPassword)

    startTransition(async () => {
      try {
        const result = await changePassword(null, fd)
        if (result?.error) {
          setServerMessage({ type: "error", text: result.error })
        } else {
          setServerMessage({ type: "success", text: "密碼已成功變更。" })
          reset()
        }
      } catch {
        setServerMessage({ type: "error", text: "發生錯誤，請再試一次。" })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">目前密碼</Label>
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.currentPassword ? true : undefined}
          aria-describedby={errors.currentPassword ? "currentPassword-error" : undefined}
          {...register("currentPassword")}
        />
        {errors.currentPassword && (
          <p id="currentPassword-error" role="alert" className="text-xs text-destructive">
            {errors.currentPassword.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="newPassword">新密碼</Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={errors.newPassword ? true : undefined}
          aria-describedby={errors.newPassword ? "newPassword-error" : undefined}
          {...register("newPassword")}
        />
        {errors.newPassword && (
          <p id="newPassword-error" role="alert" className="text-xs text-destructive">
            {errors.newPassword.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">確認新密碼</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={errors.confirmPassword ? true : undefined}
          aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p id="confirmPassword-error" role="alert" className="text-xs text-destructive">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      {serverMessage && (
        <p
          role={serverMessage.type === "error" ? "alert" : "status"}
          className={cn("text-sm", serverMessage.type === "error" ? "text-destructive" : "text-green-600")}
        >
          {serverMessage.text}
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "更新中…" : "變更密碼"}
      </Button>
    </form>
  )
}
