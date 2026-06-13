export default function AuthLoading() {
  return (
    <div className="w-full max-w-sm animate-pulse rounded-xl border bg-card p-8 shadow-sm">
      <div className="mb-6 space-y-2 text-center">
        <div className="mx-auto h-6 w-32 rounded-md bg-muted" />
        <div className="mx-auto h-4 w-48 rounded-md bg-muted" />
      </div>
      <div className="space-y-4">
        <div className="h-10 rounded-md bg-muted" />
        <div className="h-10 rounded-md bg-muted" />
        <div className="h-10 rounded-md bg-muted" />
      </div>
    </div>
  )
}
