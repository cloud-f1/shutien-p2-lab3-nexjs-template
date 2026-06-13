// Pure boolean helper — safe for both Server and Client Components (no server-only imports)
export function isAdmin(role: string | undefined): boolean {
  return role === "admin"
}
