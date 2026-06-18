"use client"

import { useState } from "react"
import { useTheme } from "next-themes"
import { Check, Monitor, MoonStar, ShieldCheck, Sun } from "lucide-react"

import { cn } from "@/lib/utils"
import { providerLabel } from "@/lib/auth-utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { ProfileForm } from "./_profile-form"
import { PasswordForm } from "./_password-form"

// Social providers wired in lib/auth.ts. Shown in the Connected Accounts tab
// with their connection status so users can see every option (Google + GitHub),
// not only the ones already linked.
const SOCIAL_PROVIDERS = ["google", "github"] as const

function ProviderGlyph({ provider }: { provider: string }) {
  if (provider === "github") {
    return (
      <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.2 3.44 9.61 8.21 11.17.6.11.82-.25.82-.56 0-.27-.01-1.01-.02-1.98-3.34.71-4.04-1.58-4.04-1.58-.55-1.36-1.34-1.73-1.34-1.73-1.09-.73.08-.72.08-.72 1.2.08 1.84 1.21 1.84 1.21 1.07 1.79 2.81 1.27 3.5.97.11-.76.42-1.27.76-1.56-2.67-.3-5.47-1.3-5.47-5.78 0-1.28.47-2.32 1.24-3.14-.13-.3-.54-1.52.12-3.16 0 0 1.01-.32 3.3 1.2a11.6 11.6 0 0 1 6.01 0c2.29-1.52 3.29-1.2 3.29-1.2.66 1.64.25 2.86.12 3.16.77.82 1.24 1.86 1.24 3.14 0 4.49-2.81 5.48-5.49 5.77.43.36.81 1.08.81 2.18 0 1.58-.01 2.85-.01 3.24 0 .31.21.68.83.56A12.01 12.01 0 0 0 24 12.29C24 5.78 18.63.5 12 .5z" />
      </svg>
    )
  }
  if (provider === "google") {
    return (
      <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    )
  }
  return null
}

function ThemeOption({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string
  icon: typeof Sun
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-active={active}
      className={cn(
        "flex flex-1 flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors",
        active ? "border-primary bg-primary/5 text-foreground" : "text-muted-foreground hover:bg-muted",
      )}
      aria-pressed={active}
      aria-label={`${label} 主題`}
    >
      <Icon className="size-5" />
      {label}
      {active && <Check className="text-primary size-4" />}
    </button>
  )
}

function Toggle({ label, desc, defaultOn = false }: { label: string; desc: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-muted-foreground text-xs">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => setOn((v) => !v)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full border transition-colors",
          on ? "bg-primary border-transparent" : "bg-secondary",
        )}
      >
        <span
          className={cn(
            "bg-card absolute top-0.5 left-0.5 size-3.5 rounded-full shadow-sm transition-transform",
            on && "translate-x-4",
          )}
        />
      </button>
    </div>
  )
}

export function SettingsTabs({
  defaultName,
  defaultImage,
  connectedProviders,
}: {
  defaultName: string
  defaultImage: string
  connectedProviders: string[]
}) {
  const { theme, setTheme } = useTheme()

  return (
    <Tabs defaultValue="account" className="gap-6">
      <TabsList>
        <TabsTrigger value="account">帳戶</TabsTrigger>
        <TabsTrigger value="appearance">外觀</TabsTrigger>
        <TabsTrigger value="notifications">通知</TabsTrigger>
        <TabsTrigger value="connected">已連結</TabsTrigger>
      </TabsList>

      {/* Account — profile + password stay on the default tab (e2e visibility) */}
      <TabsContent value="account" className="space-y-8">
        <section className="space-y-4">
          <h2 className="text-base font-medium">個人資料</h2>
          <ProfileForm defaultName={defaultName} defaultImage={defaultImage} />
        </section>
        <Separator />
        <section className="space-y-4">
          <h2 className="text-base font-medium">變更密碼</h2>
          <p className="text-muted-foreground text-xs">
            如果您使用 Google 登入請留空；只有設定密碼的帳戶可以使用。
          </p>
          <PasswordForm />
        </section>
        <Separator />
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-base font-medium">
            <ShieldCheck className="text-muted-foreground size-4" /> 兩步驟驗證（2FA）
          </h2>
          <p className="text-muted-foreground text-sm">
            以驗證器 App 增加一層保護。此功能將於後續版本（Phase 62）啟用。
          </p>
          <Button variant="outline" size="sm" disabled>
            啟用 2FA（即將推出）
          </Button>
        </section>
      </TabsContent>

      <TabsContent value="appearance" className="space-y-4">
        <h2 className="text-base font-medium">外觀</h2>
        <p className="text-muted-foreground text-sm">選擇介面主題。</p>
        <div className="flex max-w-md gap-3">
          <ThemeOption label="淺色" icon={Sun} active={theme === "light"} onClick={() => setTheme("light")} />
          <ThemeOption label="深色" icon={MoonStar} active={theme === "dark"} onClick={() => setTheme("dark")} />
          <ThemeOption label="系統" icon={Monitor} active={theme === "system"} onClick={() => setTheme("system")} />
        </div>
      </TabsContent>

      <TabsContent value="notifications" className="max-w-md">
        <h2 className="mb-2 text-base font-medium">通知偏好</h2>
        <div className="divide-y">
          <Toggle label="產品更新" desc="新功能與改善通知" defaultOn />
          <Toggle label="安全性警示" desc="登入與帳戶異動" defaultOn />
          <Toggle label="每週摘要" desc="每週用量回顧" />
        </div>
        <p className="text-muted-foreground mt-3 text-xs">偏好會在後續版本（Phase 62）持久化儲存。</p>
      </TabsContent>

      <TabsContent value="connected" className="max-w-md space-y-3">
        <h2 className="text-base font-medium">已連結帳戶</h2>
        <p className="text-muted-foreground text-sm">透過第三方供應商登入您的帳戶。</p>
        <ul className="space-y-2">
          {SOCIAL_PROVIDERS.map((p) => {
            const connected = connectedProviders.includes(p)
            return (
              <li key={p} className="flex items-center justify-between rounded-lg border px-4 py-3">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <ProviderGlyph provider={p} />
                  {providerLabel(p)}
                </span>
                {connected ? (
                  <span className="text-success text-xs">已連結</span>
                ) : (
                  <span className="text-muted-foreground text-xs">尚未連結</span>
                )}
              </li>
            )
          })}
        </ul>
      </TabsContent>
    </Tabs>
  )
}
