import { requireAuth } from "@/lib/permissions"
import { ProfileForm } from "./_profile-form"
import { PasswordForm } from "./_password-form"
import { Separator } from "@/components/ui/separator"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Account Settings" }

export default async function SettingsPage() {
  const session = await requireAuth()
  const { user } = session

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Account Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your profile and security</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-base font-medium">Profile</h2>
        <ProfileForm defaultName={user.name ?? ""} defaultImage={user.image ?? ""} />
      </section>

      <Separator />

      {/* Password section only shown for credentials users (OAuth users have no passwordHash) */}
      <section className="space-y-4">
        <h2 className="text-base font-medium">Change Password</h2>
        <p className="text-xs text-muted-foreground">
          Leave blank if you signed in with Google. Only accounts with a password can use this.
        </p>
        <PasswordForm />
      </section>
    </div>
  )
}
