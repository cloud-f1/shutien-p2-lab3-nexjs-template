import type { Metadata } from "next"
import Link from "next/link"
import { MailCheck, MailX } from "lucide-react"

import { auth } from "@/lib/auth"
import { getInvitationByToken, isInviteValid } from "@/lib/team"
import { Button } from "@/components/ui/button"
import { AcceptInvite } from "./_accept-invite"

export const metadata: Metadata = { title: "團隊邀請" }

const ROLE_LABELS: Record<string, string> = {
  admin: "管理員",
  editor: "編輯者",
  viewer: "檢視者",
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center p-6">
      <div className="rounded-2xl border p-8 text-center">{children}</div>
    </main>
  )
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const invite = await getInvitationByToken(token)

  if (!invite || !isInviteValid(invite, new Date())) {
    return (
      <Shell>
        <MailX className="text-muted-foreground mx-auto mb-3 size-8" />
        <h1 className="text-lg font-semibold">邀請無效或已過期</h1>
        <p className="text-muted-foreground mt-1 text-sm">請向管理員索取新的邀請連結。</p>
        <Button asChild className="mt-6">
          <Link href="/">回首頁</Link>
        </Button>
      </Shell>
    )
  }

  const session = await auth()
  const role = ROLE_LABELS[invite.role] ?? invite.role

  return (
    <Shell>
      <MailCheck className="text-success mx-auto mb-3 size-8" />
      <h1 className="text-lg font-semibold">你被邀請加入團隊</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        以 <span className="font-medium">{invite.email}</span> 加入，角色為 <span className="font-medium">{role}</span>。
      </p>

      {session?.user ? (
        <AcceptInvite token={token} />
      ) : (
        <div className="mt-6 space-y-2">
          <p className="text-muted-foreground text-sm">請先以受邀的電子郵件登入或註冊以接受邀請。</p>
          <div className="flex justify-center gap-2">
            <Button asChild>
              <Link href="/login">登入</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/register">註冊</Link>
            </Button>
          </div>
        </div>
      )}
    </Shell>
  )
}
