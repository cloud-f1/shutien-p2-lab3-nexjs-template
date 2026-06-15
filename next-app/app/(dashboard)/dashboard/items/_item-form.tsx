"use client"

import { useTransition, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { createItemSchema, type CreateItemInput } from "@/lib/validations/items"
import { createItem, updateItem } from "@/actions/items"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

interface ItemFormProps {
  /** When `id` is provided the form edits an existing item; otherwise it creates. */
  id?: string
  defaultTitle?: string
  submitLabel: string
  /** Called after a successful create/update (the dialog closes + refreshes). */
  onSuccess?: () => void
  onCancel?: () => void
}

export function ItemForm({ id, defaultTitle = "", submitLabel, onSuccess, onCancel }: ItemFormProps) {
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
      // Actions return null on success (no redirect — we're in a modal), or
      // { error } on validation/permission failure.
      const result = id ? await updateItem(id, null, fd) : await createItem(null, fd)
      if (result?.error) setServerError(result.error)
      else onSuccess?.()
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="title">標題</Label>
        <Input
          id="title"
          autoFocus
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

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            取消
          </Button>
        )}
        <Button type="submit" disabled={isPending}>
          {isPending ? "儲存中…" : submitLabel}
        </Button>
      </div>
    </form>
  )
}
