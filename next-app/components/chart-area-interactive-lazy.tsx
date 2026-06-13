"use client"

import { Skeleton } from "@/components/ui/skeleton"
import dynamic from "next/dynamic"
import { Suspense } from "react"

// Lazy-load the recharts-heavy chart so it stays out of the initial dashboard
// bundle. ssr: false keeps the chart client-only (it renders below the fold from
// static data), and the Suspense boundary shows a skeleton while it streams in.
const ChartAreaInteractive = dynamic(
  () =>
    import("@/components/chart-area-interactive").then(
      (mod) => mod.ChartAreaInteractive
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[250px] w-full rounded-xl" />,
  }
)

export function ChartAreaInteractiveLazy() {
  return (
    <Suspense fallback={<Skeleton className="h-[250px] w-full rounded-xl" />}>
      <ChartAreaInteractive />
    </Suspense>
  )
}
