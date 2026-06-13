"use client"

import { useActionState, startTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { registerSchema, type RegisterInput } from "@/lib/validations/auth"
import { registerUser, signInWithGoogle } from "@/actions/auth"
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
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(registerUser, null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  })

  // On valid: dispatch the server action inside a transition so React follows
  // the action's redirect(). On invalid: RHF shows per-field errors, no server hit.
  function onValid(data: RegisterInput) {
    const fd = new FormData()
    fd.set("name", data.name)
    fd.set("email", data.email)
    fd.set("password", data.password)
    startTransition(() => formAction(fd))
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">建立帳戶</CardTitle>
        <CardDescription>在下方輸入您的資訊以建立帳戶</CardDescription>
      </CardHeader>
      <CardContent>
        {state?.error && (
          <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        )}

        <form onSubmit={handleSubmit(onValid)} noValidate>
          <FieldGroup>
            <Field data-invalid={errors.name ? true : undefined}>
              <FieldLabel htmlFor="name">姓名</FieldLabel>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                autoComplete="name"
                aria-invalid={errors.name ? true : undefined}
                {...register("name")}
              />
              <FieldError errors={errors.name ? [errors.name] : undefined} />
            </Field>
            <Field data-invalid={errors.email ? true : undefined}>
              <FieldLabel htmlFor="email">電子郵件</FieldLabel>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                autoComplete="email"
                aria-invalid={errors.email ? true : undefined}
                {...register("email")}
              />
              <FieldError errors={errors.email ? [errors.email] : undefined} />
            </Field>
            <Field data-invalid={errors.password ? true : undefined}>
              <FieldLabel htmlFor="password">密碼</FieldLabel>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                aria-invalid={errors.password ? true : undefined}
                {...register("password")}
              />
              {errors.password ? (
                <FieldError errors={[errors.password]} />
              ) : (
                <FieldDescription>
                  至少需 8 個字元，並包含 1 個大寫字母與 1 個數字。
                </FieldDescription>
              )}
            </Field>
            <Field>
              <Button type="submit" disabled={isPending}>
                {isPending ? "建立帳戶中…" : "建立帳戶"}
              </Button>
            </Field>
          </FieldGroup>
        </form>

        <FieldSeparator className="my-6">或使用以下方式繼續</FieldSeparator>

        <form action={signInWithGoogle}>
          <FieldGroup>
            <Field>
              <Button type="submit" variant="outline" disabled={isPending}>
                <GoogleIcon />
                使用 Google 註冊
              </Button>
              <FieldDescription className="text-center">
                已經有帳戶了？ <Link href="/login">登入</Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

function GoogleIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}
