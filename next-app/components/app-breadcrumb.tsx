"use client"

import { Fragment, useSyncExternalStore } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { NAV_LABELS } from "@/lib/nav"
import { getBreadcrumbLabel, subscribeBreadcrumbLabel } from "@/lib/breadcrumb-label"

// E336 — labels come from lib/nav.ts (NAV_LABELS, derived from NAV_FLAT +
// EXTRA_LABELS for genuinely nav-less routes). Dynamic segments (e.g. a
// library slug or a record-detail id) fall through to the capitalized-segment
// default below UNLESS a page announced a live override (E339 — see
// lib/breadcrumb-label.ts + components/dynamic-breadcrumb-label.tsx, used by
// record-detail pages to show the record's title instead of its raw id).
const defaultLabel = (seg: string) => NAV_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1)

/** Subscribes to the live override for one exact pathname (E339). */
function useBreadcrumbOverride(href: string): string | undefined {
  return useSyncExternalStore(
    subscribeBreadcrumbLabel,
    () => getBreadcrumbLabel(href),
    () => undefined, // server snapshot — no override during SSR
  )
}

function BreadcrumbSegment({ seg, href, isLast }: { seg: string; href: string; isLast: boolean }) {
  const override = useBreadcrumbOverride(href)
  const text = override ?? defaultLabel(seg)
  return isLast ? (
    <BreadcrumbPage>{text}</BreadcrumbPage>
  ) : (
    <BreadcrumbLink asChild>
      <Link href={href}>{text}</Link>
    </BreadcrumbLink>
  )
}

export function AppBreadcrumb() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((seg, i) => {
          const href = "/" + segments.slice(0, i + 1).join("/")
          const isLast = i === segments.length - 1
          return (
            <Fragment key={href}>
              <BreadcrumbItem>
                <BreadcrumbSegment seg={seg} href={href} isLast={isLast} />
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
