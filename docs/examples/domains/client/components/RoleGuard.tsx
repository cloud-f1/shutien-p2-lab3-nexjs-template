import type { ReactNode } from "react";
import { useCurrentTeam, hasMinRole } from "../hooks/useCurrentTeam";
import type { TeamRole } from "../schemas/team";

interface RoleGuardProps {
  /** Minimum role required to render children. */
  role: TeamRole;
  /** Content to render when user meets the role requirement. */
  children: ReactNode;
  /** Optional fallback content when the user lacks the required role. */
  fallback?: ReactNode;
}

/**
 * Conditionally renders children based on the user's role in the current team.
 *
 * Usage:
 *   <RoleGuard role="admin">
 *     <button>Manage Members</button>
 *   </RoleGuard>
 */
export function RoleGuard({ role, children, fallback = null }: RoleGuardProps) {
  const { myRole } = useCurrentTeam();

  if (!myRole || !hasMinRole(myRole, role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
