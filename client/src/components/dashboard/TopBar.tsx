import type { ReactNode } from "react";

export interface TopBarProps {
  /** Left slot — typically a breadcrumb-style indicator. */
  breadcrumbs?: ReactNode;
  /** Right slot — actions, status pills, etc. */
  actions?: ReactNode;
  /** Optional absolutely positioned user-menu slot (rendered below actions). */
  userMenu?: ReactNode;
}

/**
 * Dashboard top header. Pure layout shell — slots in
 * breadcrumbs (left) + actions (right). Keeps legacy class names so
 * existing CSS layout + a11y selectors (`role=banner`) stay valid.
 */
export function TopBar({ breadcrumbs, actions, userMenu }: TopBarProps) {
  return (
    <div className="topbar" role="banner">
      <div className="topbar-left">{breadcrumbs}</div>
      <div className="topbar-right">
        {actions}
        {userMenu}
      </div>
    </div>
  );
}
