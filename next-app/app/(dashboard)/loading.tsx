export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-32 rounded-md bg-muted" />
          <div className="h-4 w-48 rounded-md bg-muted" />
        </div>
        <div className="h-9 w-24 rounded-md bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-28 rounded-xl border bg-card" />
      </div>
      <div className="rounded-xl border bg-card">
        <div className="p-4 border-b">
          <div className="h-5 w-24 rounded-md bg-muted" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-6 py-3">
              <div className="h-4 w-48 rounded-md bg-muted" />
              <div className="h-8 w-16 rounded-md bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
