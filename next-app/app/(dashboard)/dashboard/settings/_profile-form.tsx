"use client"

import { useTransition, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { updateProfileSchema, type UpdateProfileInput } from "@/lib/validations/user"
import { updateProfile } from "@/actions/user"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ProfileFormProps {
  defaultName: string
  defaultImage: string
}

export function ProfileForm({ defaultName, defaultImage }: ProfileFormProps) {
  const [isPending, startTransition] = useTransition()
  const [serverMessage, setServerMessage] = useState<{ type: "error" | "success"; text: string } | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: defaultName, image: defaultImage },
  })

  function onSubmit(data: UpdateProfileInput) {
    setServerMessage(null)
    const fd = new FormData()
    fd.set("name", data.name)
    fd.set("image", data.image ?? "")

    startTransition(async () => {
      try {
        const result = await updateProfile(null, fd)
        if (result?.error) setServerMessage({ type: "error", text: result.error })
        else setServerMessage({ type: "success", text: "個人資料已更新。" })
      } catch {
        setServerMessage({ type: "error", text: "發生錯誤，請再試一次。" })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">顯示名稱</Label>
        <Input id="name" autoComplete="name" {...register("name")} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="image">頭像網址</Label>
        <Input
          id="image"
          type="url"
          placeholder="https://example.com/avatar.png"
          autoComplete="photo"
          {...register("image")}
        />
        {errors.image && <p className="text-xs text-destructive">{errors.image.message}</p>}
      </div>

      {serverMessage && (
        <p className={cn("text-sm", serverMessage.type === "error" ? "text-destructive" : "text-green-600")}>
          {serverMessage.text}
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? "儲存中…" : "儲存變更"}
      </Button>
    </form>
  )
}
