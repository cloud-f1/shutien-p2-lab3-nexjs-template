// Pure boolean helpers — safe for both Server and Client Components (no server-only imports)
export function isAdmin(role: string | undefined): boolean {
  return role === "admin"
}

// Editors and admins may create/edit/delete items; viewers are read-only.
export function canEdit(role: string | undefined): boolean {
  return role === "admin" || role === "editor"
}
