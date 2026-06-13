import { requireAuth } from "@/lib/permissions"
import { ProfileForm } from "./_profile-form"
import { PasswordForm } from "./_password-form"
import { Separator } from "@/components/ui/separator"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "帳戶設定" }

export default async function SettingsPage() {
  const session = await requireAuth()
  const { user } = session

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">帳戶設定</h1>
        <p className="text-sm text-muted-foreground mt-1">管理您的個人資料與安全性</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-base font-medium">個人資料</h2>
        <ProfileForm defaultName={user.name ?? ""} defaultImage={user.image ?? ""} />
      </section>

      <Separator />

      {/* Password section only shown for credentials users (OAuth users have no passwordHash) */}
      <section className="space-y-4">
        <h2 className="text-base font-medium">變更密碼</h2>
        <p className="text-xs text-muted-foreground">
          如果您使用 Google 登入請留空；只有設定密碼的帳戶可以使用。
        </p>
        <PasswordForm />
      </section>
    </div>
  )
}
