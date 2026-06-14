/**
 * hello-utils — smoke-test lib file for the @saas registry.
 * Installed via: npx shadcn@latest add @saas/hello-module
 */

/** Returns a greeting string. */
export function greet(name: string): string {
  return `Hello, ${name}! Welcome to the @saas registry.`
}
