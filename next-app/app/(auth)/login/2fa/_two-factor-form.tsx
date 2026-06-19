"use client"

/**
 * E297 — 2FA login challenge. Shown after a password check passes for a
 * TOTP-enabled user. Two modes: a 6-digit authenticator code (default) or a
 * one-time backup code. Both Server Actions complete the session on success and
 * redirect to /dashboard (so a success path returns nothing to render here).
 */
import { useActionState, startTransition, useState } from "react"

import { verifyTotpLogin, useBackupCode } from "@/actions/auth"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function TwoFactorForm() {
  const [mode, setMode] = useState<"totp" | "backup">("totp")
  const [totpState, totpAction, totpPending] = useActionState(verifyTotpLogin, null)
  const [backupState, backupAction, backupPending] = useActionState(useBackupCode, null)

  const [token, setToken] = useState("")
  const [code, setCode] = useState("")

  const error = mode === "totp" ? totpState?.error : backupState?.error

  function submitTotp(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    fd.set("token", token)
    startTransition(() => totpAction(fd))
  }

  function submitBackup(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    fd.set("code", code)
    startTransition(() => backupAction(fd))
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">兩步驟驗證</CardTitle>
        <CardDescription>
          {mode === "totp" ? "請輸入驗證器 App 顯示的 6 位數驗證碼" : "請輸入一組備用碼"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <p
            role="alert"
            className="bg-destructive/10 text-destructive mb-4 rounded-md px-3 py-2 text-sm"
          >
            {error}
          </p>
        )}

        {mode === "totp" ? (
          <form onSubmit={submitTotp} noValidate>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="token">驗證碼</FieldLabel>
                <Input
                  id="token"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  autoFocus
                  value={token}
                  onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
                />
              </Field>
              <Field>
                <Button type="submit" disabled={totpPending || token.length !== 6}>
                  {totpPending ? "驗證中…" : "驗證"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        ) : (
          <form onSubmit={submitBackup} noValidate>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="code">備用碼</FieldLabel>
                <Input
                  id="code"
                  autoComplete="one-time-code"
                  placeholder="xxxx-xxxx"
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </Field>
              <Field>
                <Button type="submit" disabled={backupPending || code.trim().length < 4}>
                  {backupPending ? "驗證中…" : "驗證"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        )}

        <div className="mt-4 text-center text-sm">
          <button
            type="button"
            className="text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setMode((m) => (m === "totp" ? "backup" : "totp"))}
          >
            {mode === "totp" ? "改用備用碼" : "改用驗證器驗證碼"}
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
