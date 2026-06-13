import { verifyEmailToken } from "@/actions/auth"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Email Verification" }

type Props = {
  searchParams: Promise<{ token?: string }>
}

export default async function VerifyConfirmPage({ searchParams }: Props) {
  const { token } = await searchParams

  if (!token) {
    return <Result success={false} error="Missing verification token." />
  }

  const result = await verifyEmailToken(token)

  return <Result success={result.success} error={result.error} />
}

function Result({ success, error }: { success: boolean; error?: string }) {
  return (
    <div className="text-center">
      <div className="mb-4 text-5xl">{success ? "✅" : "❌"}</div>
      <h1 className="mb-2 text-2xl font-semibold">
        {success ? "Email verified!" : "Verification failed"}
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {success
          ? "Your email has been verified. You can now sign in."
          : (error ?? "Something went wrong.")}
      </p>
      <Button asChild>
        <Link href={success ? "/login?verified=true" : "/register"}>
          {success ? "Sign In" : "Back to Register"}
        </Link>
      </Button>
    </div>
  )
}
