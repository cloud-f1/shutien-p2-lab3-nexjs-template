"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { useReveal } from "@/hooks/use-reveal"

/**
 * Scroll-reveal wrapper (E260/E261). Children fade + rise into view once.
 * Reduced-motion + no-IO safe via the `.reveal` CSS + useReveal fallback.
 */
export function Reveal({
  children,
  className,
  delayMs = 0,
}: {
  children: ReactNode
  className?: string
  delayMs?: number
}) {
  const { ref, shown } = useReveal<HTMLDivElement>()
  return (
    <div
      ref={ref}
      data-shown={shown}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
      className={cn("reveal", className)}
    >
      {children}
    </div>
  )
}
