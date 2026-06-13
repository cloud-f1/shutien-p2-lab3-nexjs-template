"use client"

import { useTransition, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createItemSchema, type CreateItemInput } from "@/lib/validations/items"
import { createItem, updateItem } from "@/actions/items"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface ItemFormProps {
  // When `id` is provided the form edits an existing item; otherwise it creates.
  id?: string
  defaultTitle?: string
  submitLabel: string
}

export function ItemForm({ id, defaultTitle = "", submitLabel }: ItemFormProps) {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateItemInput>({
    resolver: zodResolver(createItemSchema),
    defaultValues: { title: defaultTitle },
  })

  function onSubmit(data: CreateItemInput) {
    setServerError(null)
    const fd = new FormData()
    fd.set("title", data.title)

    startTransition(async () => {
      try {
        // Both actions redirect on success (which throws NEXT_REDIRECT and is
        // re-thrown below); they only return a value when validation fails.
        const result = id
          ? await updateItem(id, null, fd)
          : await createItem(null, fd)
        if (result?.error) setServerError(result.error)
      } catch (err) {
        // Re-throw Next.js navigation signals so the redirect happens.
        if (
          err &&
          typeof err === "object" &&
          "digest" in err &&
          typeof (err as { digest?: string }).digest === "string" &&
          (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
        ) {
          throw err
        }
        setServerError("發生錯誤，請再試一次。")
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="title">標題</Label>
        <Input
          id="title"
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? "title-error" : undefined}
          {...register("title")}
        />
        {errors.title && (
          <p id="title-error" role="alert" className="text-xs text-destructive">
            {errors.title.message}
          </p>
        )}
      </div>

      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "儲存中…" : submitLabel}
        </Button>
        <Button asChild type="button" variant="ghost">
          <Link href="/dashboard/items">取消</Link>
        </Button>
      </div>
    </form>
  )
}
