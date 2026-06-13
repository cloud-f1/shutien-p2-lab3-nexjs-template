import type { DefaultSession } from "next-auth"
import type { Role } from "@/lib/schema"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: Role
    } & DefaultSession["user"]
  }

  // The object returned by Credentials authorize() / provider profile()
  interface User {
    role?: Role
  }
}

// Extend AdapterUser so DrizzleAdapter's custom columns are typed
declare module "@auth/core/adapters" {
  interface AdapterUser {
    role?: Role
  }
}

// Carry id + role through the JWT (session strategy is "jwt")
declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role?: Role
  }
}
