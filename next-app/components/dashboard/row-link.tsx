import type { ReactNode } from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"

/**
 * Row link (E337) — the a11y foundation every dashboard-widget "whole card /
 * whole row is clickable" pattern goes through. Wraps `children` in a real
 * `<Link>` (not a `<div role="link" onClick>`) so it is keyboard-focusable
 * and Enter-activatable for free, with no client JS required — a Server
 * Component like the rest of this kit.
 *
 * Because the anchor IS the interactive element, `children` must never
 * contain another interactive element (button/link/input) — nested
 * interactive controls break screen-reader semantics and native keyboard
 * handling. Every widget in this kit that uses `RowLink` composes plain
 * `<div>`/`<span>` content inside it.
 */
export interface RowLinkProps {
  href: string
  /** Accessible name for the whole row/card — required since children are usually a dense visual layout, not a text label. */
  ariaLabel: string
  children: ReactNode
  className?: string
}

export function RowLink({ href, ariaLabel, children, className }: RowLinkProps) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={cn(
        "block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      {children}
    </Link>
  )
}
