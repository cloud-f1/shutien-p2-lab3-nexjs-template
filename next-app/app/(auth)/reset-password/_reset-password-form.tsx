"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"

import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validations/auth"
import { resetPassword } from "@/actions/auth"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token },
  })

  function onValid(data: ResetPasswordInput) {
    setError(null)
    startTransition(async () => {
      const result = await resetPassword(data.token, data.password)
      if (result.error) {
        setError(result.error)
      } else {
        router.push("/login?reset=true")
      }
    })
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">設定新密碼</CardTitle>
        <CardDescription>請輸入您的新密碼。</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <p
            role="alert"
            className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit(onValid)} noValidate>
          <input type="hidden" {...register("token")} />
          <FieldGroup>
            <Field data-invalid={errors.password ? true : undefined}>
              <FieldLabel htmlFor="password">新密碼</FieldLabel>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={
                  errors.password ? "password-error" : "password-hint"
                }
                {...register("password")}
              />
              {errors.password ? (
                <FieldError id="password-error" errors={[errors.password]} />
              ) : (
                <FieldDescription id="password-hint">
                  至少需 8 個字元，並包含 1 個大寫字母與 1 個數字。
                </FieldDescription>
              )}
            </Field>
            <Field>
              <Button type="submit" disabled={isPending}>
                {isPending ? "重設中…" : "重設密碼"}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
