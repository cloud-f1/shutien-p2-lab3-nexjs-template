import { ResendButton } from "./_resend-button"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "驗證您的電子郵件" }

type Props = {
  searchParams: Promise<{ email?: string }>
}

export default async function VerifyEmailPage({ searchParams }: Props) {
  const { email } = await searchParams

  return (
    <div className="text-center">
      <div className="mb-4 text-5xl">📧</div>
      <h1 className="mb-2 text-2xl font-semibold">請檢查您的收件匣</h1>
      <p className="mb-1 text-sm text-muted-foreground">
        我們已將驗證連結寄送至{" "}
        <strong className="text-foreground">{email ?? "您的電子郵件地址"}</strong>。
      </p>
      <p className="mb-6 text-sm text-muted-foreground">
        此連結將於 24 小時後失效。如果沒有看到，請檢查您的垃圾郵件匣。
      </p>

      {email && <ResendButton email={email} />}
    </div>
  )
}
