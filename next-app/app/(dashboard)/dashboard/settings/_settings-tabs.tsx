"use client"

import { useState } from "react"
import { useTheme } from "next-themes"
import { Check, Monitor, MoonStar, ShieldCheck, Sun } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { ProfileForm } from "./_profile-form"
import { PasswordForm } from "./_password-form"

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
        {connectedProviders.length === 0 ? (
          <p className="text-muted-foreground text-sm">尚未連結任何第三方帳戶。</p>
        ) : (
          <ul className="space-y-2">
            {connectedProviders.map((p) => (
              <li key={p} className="flex items-center justify-between rounded-lg border px-4 py-3">
                <span className="text-sm font-medium capitalize">{p}</span>
                <span className="text-success text-xs">已連結</span>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  )
}
