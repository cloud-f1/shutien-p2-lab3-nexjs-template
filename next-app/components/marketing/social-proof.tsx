"use client"

import { useCountUp } from "@/hooks/use-reveal"

// Brand-neutral placeholder "logos" — swap for your real customer marks.
const LOGOS = ["Acme", "Globex", "Initech", "Umbra", "Hooli", "Stark", "Wayne", "Soylent"]

const STATS: { end: number; decimals?: number; suffix: string; label: string }[] = [
  { end: 10, suffix: "M+", label: "每月處理請求" },
  { end: 99.98, decimals: 2, suffix: "%", label: "可用性" },
  { end: 4200, suffix: "+", label: "開發者使用" },
  { end: 24, suffix: "/7", label: "全天候運行" },
]

function Stat({ end, decimals, suffix, label }: (typeof STATS)[number]) {
  const { ref, display } = useCountUp<HTMLParagraphElement>(end, { decimals })
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <p ref={ref} className="tnum text-3xl font-bold md:text-4xl">
        {display}
        {suffix}
      </p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

export function SocialProof() {
  return (
    <section className="border-y bg-muted/30 py-12">
      <div className="mx-auto max-w-5xl px-4">
        <p className="mb-6 text-center text-sm text-muted-foreground">
          受到各地團隊信賴
        </p>
        <div className="marquee mb-12">
          <div className="marquee-track gap-12 pr-12">
            {[...LOGOS, ...LOGOS].map((name, i) => (
              <span
                key={`${name}-${i}`}
                className="text-xl font-semibold tracking-tight text-muted-foreground/60"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {STATS.map((s) => (
            <Stat key={s.label} {...s} />
          ))}
        </div>
      </div>
    </section>
  )
}
