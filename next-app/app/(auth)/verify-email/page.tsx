import { ResendButton } from "./_resend-button"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Verify Your Email" }

type Props = {
  searchParams: Promise<{ email?: string }>
}

export default async function VerifyEmailPage({ searchParams }: Props) {
  const { email } = await searchParams

  return (
    <div className="text-center">
      <div className="mb-4 text-5xl">📧</div>
      <h1 className="mb-2 text-2xl font-semibold">Check your inbox</h1>
      <p className="mb-1 text-sm text-muted-foreground">
        We sent a verification link to{" "}
        <strong className="text-foreground">{email ?? "your email address"}</strong>.
      </p>
      <p className="mb-6 text-sm text-muted-foreground">
        The link expires in 24 hours. Check your spam folder if you don&apos;t see it.
      </p>

      {email && <ResendButton email={email} />}
    </div>
  )
}
