import { verifyEmailToken } from "@/actions/auth"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "電子郵件驗證" }

type Props = {
  searchParams: Promise<{ token?: string }>
}

export default async function VerifyConfirmPage({ searchParams }: Props) {
  const { token } = await searchParams

  if (!token) {
    return <Result success={false} error="缺少驗證權杖。" />
  }

  const result = await verifyEmailToken(token)

  return <Result success={result.success} error={result.error} />
}

function Result({ success, error }: { success: boolean; error?: string }) {
  return (
    <div className="text-center">
      <div className="mb-4 text-5xl">{success ? "✅" : "❌"}</div>
      <h1 className="mb-2 text-2xl font-semibold">
        {success ? "電子郵件已驗證！" : "驗證失敗"}
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {success
          ? "您的電子郵件已驗證，您現在可以登入。"
          : (error ?? "發生錯誤，請再試一次。")}
      </p>
      <Button asChild>
        <Link href={success ? "/login?verified=true" : "/register"}>
          {success ? "登入" : "返回註冊"}
        </Link>
      </Button>
    </div>
  )
}
