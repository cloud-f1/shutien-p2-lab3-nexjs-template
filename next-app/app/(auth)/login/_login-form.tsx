"use client"

import { useActionState, startTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { loginSchema, type LoginInput } from "@/lib/validations/auth"
import { loginAction, signInWithGoogle } from "@/actions/auth"
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

interface LoginFormProps {
  verified?: boolean
  urlError?: string
}

// Demo seed accounts (drizzle/seed.ts). One-click sign-in for the template demo.
// Remove this block (and the "Quick demo login" UI below) for a real production app.
const DEMO_ACCOUNTS = [
  { label: "Admin", email: "admin@example.com", password: "Admin123!" },
  { label: "Editor", email: "editor@example.com", password: "Editor123!" },
  { label: "Viewer", email: "viewer@example.com", password: "Viewer123!" },
] as const

export function LoginForm({ verified, urlError }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(loginAction, null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  // RHF validates first; on success dispatch the server action directly.
  // formAction() must run inside a transition (it's a useActionState dispatch)
  // so React follows the action's redirect() to /dashboard.
  function onValid(data: LoginInput) {
    const fd = new FormData()
    fd.set("email", data.email)
    fd.set("password", data.password)
    startTransition(() => formAction(fd))
  }

  // One-click demo sign-in: dispatch the login action with seeded credentials.
  function quickLogin(email: string, password: string) {
    const fd = new FormData()
    fd.set("email", email)
    fd.set("password", password)
    startTransition(() => formAction(fd))
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your account</CardDescription>
      </CardHeader>
      <CardContent>
        {verified && (
          <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
            ✅ Email verified! You can now sign in.
          </p>
        )}
        {(state?.error ?? urlError) && (
          <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state?.error ?? urlError}
          </p>
        )}

        <form onSubmit={handleSubmit(onValid)} noValidate>
          <FieldGroup>
            <Field data-invalid={errors.email ? true : undefined}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
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
              <div className="flex items-center">
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <a
                  href="#"
                  className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                >
                  Forgot your password?
                </a>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                aria-invalid={errors.password ? true : undefined}
                {...register("password")}
              />
              <FieldError
                errors={errors.password ? [errors.password] : undefined}
              />
            </Field>
            <Field>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Signing in…" : "Sign In"}
              </Button>
            </Field>
          </FieldGroup>
        </form>

        <FieldSeparator className="my-6">Quick demo login</FieldSeparator>
        <div className="grid grid-cols-3 gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <Button
              key={account.label}
              type="button"
              variant="secondary"
              size="sm"
              disabled={isPending}
              onClick={() => quickLogin(account.email, account.password)}
            >
              {account.label}
            </Button>
          ))}
        </div>

        <FieldSeparator className="my-6">Or continue with</FieldSeparator>

        <form action={signInWithGoogle}>
          <FieldGroup>
            <Field>
              <Button type="submit" variant="outline" disabled={isPending}>
                <GoogleIcon />
                Continue with Google
              </Button>
              <FieldDescription className="text-center">
                Don&apos;t have an account?{" "}
                <Link href="/register">Sign up</Link>
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
