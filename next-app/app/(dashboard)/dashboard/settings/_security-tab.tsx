"use client"

/**
 * E297 — Security tab: enable/disable TOTP 2FA.
 *
 * Enable flow: setupTotp() returns a secret + QR data URI → user scans, enters a
 * code → verifyTotpSetup() flips it on and returns one-time backup codes (shown
 * once). Disable flow: a ConfirmDialog with a required current TOTP code.
 */
import { useState, useTransition } from "react"
import { Copy, ShieldCheck } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { setupTotp, verifyTotpSetup, disableTotp, regenerateBackupCodes } from "@/actions/user"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ConfirmDialog } from "@/components/confirm-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type SetupData = { secret: string; qrDataUri: string }

export function SecurityTab({ totpEnabled }: { totpEnabled: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [setupData, setSetupData] = useState<SetupData | null>(null)
  const [setupOpen, setSetupOpen] = useState(false)
  const [token, setToken] = useState("")
  const [setupError, setSetupError] = useState<string | null>(null)

  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)

  const [disableOpen, setDisableOpen] = useState(false)
  const [disableToken, setDisableToken] = useState("")

  // E310 — regenerate backup codes (requires a valid current TOTP code)
  const [regenOpen, setRegenOpen] = useState(false)
  const [regenToken, setRegenToken] = useState("")

  function beginSetup() {
    setSetupError(null)
    startTransition(async () => {
      const res = await setupTotp()
      if ("error" in res && res.error) {
        setSetupError(res.error)
        return
      }
      setSetupData({ secret: res.secret!, qrDataUri: res.qrDataUri! })
      setToken("")
      setSetupOpen(true)
    })
  }

  function confirmSetup() {
    setSetupError(null)
    const fd = new FormData()
    fd.set("token", token)
    startTransition(async () => {
      const res = await verifyTotpSetup(null, fd)
      if (!res.success) {
        setSetupError(res.error)
        return
      }
      setSetupOpen(false)
      setSetupData(null)
      setBackupCodes(res.backupCodes)
      router.refresh()
    })
  }

  async function confirmDisable(): Promise<{ error?: string } | void> {
    const fd = new FormData()
    fd.set("token", disableToken)
    const res = await disableTotp(null, fd)
    if (res?.error) return { error: res.error }
    setDisableToken("")
    router.refresh()
  }

  async function confirmRegenerate(): Promise<{ error?: string } | void> {
    const fd = new FormData()
    fd.set("token", regenToken)
    const res = await regenerateBackupCodes(null, fd)
    if (!res.success) return { error: res.error }
    setRegenToken("")
    setBackupCodes(res.backupCodes)
    router.refresh()
  }

  function copyCodes() {
    if (backupCodes) navigator.clipboard?.writeText(backupCodes.join("\n"))
  }

  return (
    <section className="max-w-md space-y-4">
      <h2 className="flex items-center gap-2 text-base font-medium">
        <ShieldCheck className="text-muted-foreground size-4" /> 兩步驟驗證（2FA）
      </h2>
      <p className="text-muted-foreground text-sm">
        以驗證器 App（如 Google Authenticator、1Password）為您的帳戶增加一層保護。
      </p>

      <div className="flex items-center justify-between rounded-lg border px-4 py-3">
        <span className="text-sm font-medium">
          狀態：
          {totpEnabled ? (
            <span className="text-success ml-1">已啟用</span>
          ) : (
            <span className="text-muted-foreground ml-1">尚未啟用</span>
          )}
        </span>
        {totpEnabled ? (
          <Button variant="outline" size="sm" onClick={() => setDisableOpen(true)}>
            停用 2FA
          </Button>
        ) : (
          <Button size="sm" onClick={beginSetup} disabled={pending}>
            {pending ? "處理中…" : "啟用 2FA"}
          </Button>
        )}
      </div>

      {/* Backup codes — self-service regeneration (E310). Only when 2FA is on. */}
      {totpEnabled && (
        <div className="flex items-center justify-between rounded-lg border px-4 py-3">
          <div>
            <p className="text-sm font-medium">備用碼</p>
            <p className="text-muted-foreground text-xs">
              重新產生一組新的一次性備用碼。舊的備用碼將失效。
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setRegenOpen(true)}>
            重新產生
          </Button>
        </div>
      )}

      {!setupOpen && setupError && (
        <p role="alert" className="text-destructive text-sm">
          {setupError}
        </p>
      )}

      {/* Setup modal — QR + verify code */}
      <Dialog open={setupOpen} onOpenChange={(o) => !pending && setSetupOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>設定兩步驟驗證</DialogTitle>
            <DialogDescription>
              使用驗證器 App 掃描下方 QR code，然後輸入產生的 6 位數驗證碼。
            </DialogDescription>
          </DialogHeader>

          {setupData && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <Image
                  src={setupData.qrDataUri}
                  alt="2FA QR code"
                  width={180}
                  height={180}
                  unoptimized
                  className="rounded-md border"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">無法掃描？手動輸入金鑰：</Label>
                <code className="bg-muted block rounded px-2 py-1 text-center text-xs break-all">
                  {setupData.secret}
                </code>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="totp-setup-token">驗證碼</Label>
                <Input
                  id="totp-setup-token"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={token}
                  onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              {setupError && (
                <p role="alert" className="text-destructive text-sm">
                  {setupError}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSetupOpen(false)} disabled={pending}>
              取消
            </Button>
            <Button onClick={confirmSetup} disabled={pending || token.length !== 6}>
              {pending ? "驗證中…" : "啟用"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backup codes — shown once after enabling */}
      <Dialog open={backupCodes !== null} onOpenChange={(o) => !o && setBackupCodes(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>備用碼</DialogTitle>
            <DialogDescription>
              請妥善保存這些一次性備用碼。當您無法使用驗證器 App 時可用來登入，每組只能使用一次。此畫面僅顯示一次。
            </DialogDescription>
          </DialogHeader>
          {backupCodes && (
            <div className="bg-muted grid grid-cols-2 gap-2 rounded-md p-4 font-mono text-sm">
              {backupCodes.map((c) => (
                <span key={c} className="text-center">
                  {c}
                </span>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={copyCodes} className={cn("gap-2")}>
              <Copy className="size-4" /> 複製
            </Button>
            <Button onClick={() => setBackupCodes(null)}>我已儲存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable — ConfirmDialog with a required current code */}
      <ConfirmDialog
        open={disableOpen}
        onOpenChange={(o) => {
          setDisableOpen(o)
          if (!o) setDisableToken("")
        }}
        title="停用兩步驟驗證"
        description={
          <span className="space-y-2">
            <span className="block">輸入目前的驗證碼以確認停用。停用後您的帳戶將失去這層保護。</span>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={disableToken}
              onChange={(e) => setDisableToken(e.target.value.replace(/\D/g, ""))}
            />
          </span>
        }
        confirmLabel="停用"
        destructive
        onConfirm={confirmDisable}
      />

      {/* Regenerate backup codes — ConfirmDialog with a required current code */}
      <ConfirmDialog
        open={regenOpen}
        onOpenChange={(o) => {
          setRegenOpen(o)
          if (!o) setRegenToken("")
        }}
        title="重新產生備用碼"
        description={
          <span className="space-y-2">
            <span className="block">
              輸入目前的驗證碼以確認。產生新備用碼後，先前的備用碼將立即失效。
            </span>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={regenToken}
              onChange={(e) => setRegenToken(e.target.value.replace(/\D/g, ""))}
            />
          </span>
        }
        confirmLabel="重新產生"
        onConfirm={confirmRegenerate}
      />
    </section>
  )
}
