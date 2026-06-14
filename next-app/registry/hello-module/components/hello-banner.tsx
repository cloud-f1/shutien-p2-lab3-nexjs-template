/**
 * hello-banner — smoke-test component for the @saas registry.
 * Installed via: npx shadcn@latest add @saas/hello-module
 */
export function HelloBanner({ message = "Hello from @saas registry!" }: { message?: string }) {
  return (
    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      {message}
    </div>
  )
}
