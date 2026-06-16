import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ResetPasswordForm } from "./_reset-password-form"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "重設密碼",
  description: "設定您的新密碼",
}

type Props = {
  searchParams: Promise<{ token?: string }>
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const session = await auth()
  if (session) redirect("/dashboard")

  const { token } = await searchParams

  if (!token) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">連結無效</CardTitle>
          <CardDescription>缺少重設權杖，請重新申請重設密碼。</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button asChild>
            <Link href="/forgot-password">重新申請</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return <ResetPasswordForm token={token} />
}
