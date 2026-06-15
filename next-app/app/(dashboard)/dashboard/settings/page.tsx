import type { Metadata } from "next"
import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { accountsTable } from "@/lib/schema"
import { requireAuth } from "@/lib/permissions"

import { SettingsTabs } from "./_settings-tabs"

export const metadata: Metadata = { title: "帳戶設定" }

export default async function SettingsPage() {
  const session = await requireAuth()
  const { user } = session

  const accounts = await db
    .select({ provider: accountsTable.provider })
    .from(accountsTable)
    .where(eq(accountsTable.userId, user.id))
  const connectedProviders = [...new Set(accounts.map((a) => a.provider))]

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">帳戶設定</h1>
        <p className="text-muted-foreground mt-1 text-sm">管理您的個人資料、安全性與偏好</p>
      </div>
      <SettingsTabs
        defaultName={user.name ?? ""}
        defaultImage={user.image ?? ""}
        connectedProviders={connectedProviders}
      />
    </div>
  )
}
