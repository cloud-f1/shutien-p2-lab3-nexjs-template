import { cn } from "@/lib/utils"

/**
 * Greeting header (E337) — time-of-day greeting + long-form date + an
 * optional secondary stat chip. Server Component (no client JS needed): the
 * greeting is computed from the server's clock for the given IANA timezone,
 * and the date is passed in as a plain ISO string.
 *
 * `formatLongDate` is a named export so its month/year-boundary behavior is
 * directly unit-testable without a DOM.
 */
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"] as const

/** 'YYYY-MM-DD' → "2026 年 12 月 31 日（四）". Parsed as UTC so a caller's
 * server-local "today" never rolls to the wrong calendar day. */
export function formatLongDate(iso: string): string {
  const y = Number(iso.slice(0, 4))
  const m = Number(iso.slice(5, 7))
  const d = Number(iso.slice(8, 10))
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${y} 年 ${m} 月 ${d} 日（${wd}）`
}

function getGreeting(timezone: string): string {
  const hour = parseInt(
    new Date().toLocaleString("en", { timeZone: timezone, hour: "numeric", hour12: false }),
    10,
  )
  if (hour >= 5 && hour < 12) return "早安"
  if (hour >= 12 && hour < 18) return "午安"
  return "晚安"
}

export interface GreetingHeaderProps {
  name: string
  /** 'YYYY-MM-DD' — see `formatLongDate`. */
  today: string
  /** IANA timezone used to compute the greeting. Default "Asia/Taipei". */
  timezone?: string
  /** Secondary stat text shown on desktop only, e.g. "共 12 個項目". */
  statLabel?: string
  className?: string
}

export function GreetingHeader({
  name,
  today,
  timezone = "Asia/Taipei",
  statLabel,
  className,
}: GreetingHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-baseline justify-between gap-2", className)}>
      <div>
        <h1 className="text-xl font-bold md:text-2xl">
          {getGreeting(timezone)}，{name}
        </h1>
        <p className="text-muted-foreground mt-0.5 text-sm">{formatLongDate(today)}</p>
      </div>
      {statLabel && (
        <div className="text-muted-foreground hidden items-center gap-1.5 text-xs md:flex">
          {statLabel}
        </div>
      )}
    </div>
  )
}
