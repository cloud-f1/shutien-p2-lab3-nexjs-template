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
          setServerMessage({ type: "success", text: "Password changed successfully." })
          reset()
        }
      } catch {
        setServerMessage({ type: "error", text: "Something went wrong. Please try again." })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input id="currentPassword" type="password" autoComplete="current-password" {...register("currentPassword")} />
        {errors.currentPassword && <p className="text-xs text-destructive">{errors.currentPassword.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="newPassword">New password</Label>
        <Input id="newPassword" type="password" autoComplete="new-password" {...register("newPassword")} />
        {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input id="confirmPassword" type="password" autoComplete="new-password" {...register("confirmPassword")} />
        {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
      </div>

      {serverMessage && (
        <p className={cn("text-sm", serverMessage.type === "error" ? "text-destructive" : "text-green-600")}>
          {serverMessage.text}
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Updating…" : "Change password"}
      </Button>
    </form>
  )
}
