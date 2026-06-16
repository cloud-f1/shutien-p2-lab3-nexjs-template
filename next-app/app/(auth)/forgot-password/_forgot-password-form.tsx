"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"

import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations/auth"
import { requestPasswordReset } from "@/actions/auth"
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

export function ForgotPasswordForm() {
  const [isPending, startTransition] = useTransition()
  const [sent, setSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  // Non-enumerating: the action always succeeds, so we show the same confirmation
  // regardless of whether the email is registered.
  function onValid(data: ForgotPasswordInput) {
    startTransition(async () => {
      await requestPasswordReset(data.email)
      setSent(true)
    })
  }

  if (sent) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">請檢查您的收件匣</CardTitle>
          <CardDescription>
            如果該電子郵件已註冊，我們已寄出重設密碼的連結。此連結將於 1 小時後失效。
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button asChild variant="outline">
            <Link href="/login">返回登入</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">忘記密碼？</CardTitle>
        <CardDescription>輸入您的電子郵件，我們將寄送重設密碼的連結。</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onValid)} noValidate>
          <FieldGroup>
            <Field data-invalid={errors.email ? true : undefined}>
              <FieldLabel htmlFor="email">電子郵件</FieldLabel>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                autoComplete="email"
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? "email-error" : undefined}
                {...register("email")}
              />
              <FieldError
                id="email-error"
                errors={errors.email ? [errors.email] : undefined}
              />
            </Field>
            <Field>
              <Button type="submit" disabled={isPending}>
                {isPending ? "寄送中…" : "寄送重設連結"}
              </Button>
              <FieldDescription className="text-center">
                想起來了？ <Link href="/login">返回登入</Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
