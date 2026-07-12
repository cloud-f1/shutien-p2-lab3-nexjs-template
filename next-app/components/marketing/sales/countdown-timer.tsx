"use client"

import { useEffect, useState } from "react"

import { getRemainingTime, padSegment } from "@/lib/sales/countdown"
import { cn } from "@/lib/utils"

interface CountdownTimerProps {
  /** ISO datetime string the countdown counts down to. */
  deadline: string
  className?: string
  /** Accent classes for the digit chips (merged via cn()). */
  accentClassName?: string
}

const SEGMENTS: { key: "days" | "hours" | "minutes" | "seconds"; label: string }[] = [
  { key: "days", label: "天" },
  { key: "hours", label: "時" },
  { key: "minutes", label: "分" },
  { key: "seconds", label: "秒" },
]

/**
 * Pure "use client" wrapper around `getRemainingTime` (E326). Ticks every
 * second and hides gracefully once the deadline passes — it never resets to
 * a fake future date (no fake-urgency dark pattern).
 */
export function CountdownTimer({ deadline, className, accentClassName }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(() => getRemainingTime(deadline))

  useEffect(() => {
    const tick = () => setRemaining(getRemainingTime(deadline))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [deadline])

  if (remaining.expired) return null

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      role="timer"
      aria-live="polite"
      aria-label="限時優惠倒數"
    >
      {SEGMENTS.map(({ key, label }) => (
        <div key={key} className="flex flex-col items-center gap-0.5">
          <span
            className={cn(
              "tnum rounded-md px-2 py-1 text-lg font-semibold",
              accentClassName ?? "bg-secondary text-secondary-foreground",
            )}
          >
            {padSegment(remaining[key])}
          </span>
          <span className="text-muted-foreground text-xs">{label}</span>
        </div>
      ))}
    </div>
  )
}
