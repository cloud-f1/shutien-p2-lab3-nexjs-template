"use client"

/**
 * E339 — announces a record's title to `<AppBreadcrumb>` for the current
 * route. Render this once from a record-detail page's client child (see
 * `app/(dashboard)/dashboard/items/[id]/_detail/header.tsx`) with the
 * record's title; renders nothing itself.
 */
import { useEffect } from "react"
import { usePathname } from "next/navigation"

import { clearBreadcrumbLabel, setBreadcrumbLabel } from "@/lib/breadcrumb-label"

export function DynamicBreadcrumbLabel({ label }: { label: string }) {
  const pathname = usePathname()

  useEffect(() => {
    setBreadcrumbLabel(pathname, label)
    return () => clearBreadcrumbLabel(pathname)
  }, [pathname, label])

  return null
}
