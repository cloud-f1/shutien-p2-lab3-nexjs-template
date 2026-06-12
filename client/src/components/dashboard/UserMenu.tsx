import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCurrentUser, useLogout } from "../../hooks/useAuth";

/**
 * Dashboard sidebar-footer user menu. Renders the avatar/name button
 * and a dropdown with account/legal/sign-out items.
 *
 * NOTE: We deliberately keep the legacy DOM structure (sidebar-user-wrap
 * + user-dropdown + dropdown-item classes) so that existing
 * a11y assertions on `.dropdown-icon` and the dashboard CSS sidebar
 * positioning continue to apply. The behavior layer (open/close,
 * outside click, ESC) is the part that gets cleaner via the
 * `<DropdownMenu>` primitive in component-state semantics — but
 * because the dropdown lives in absolute-positioned sidebar chrome,
 * we keep a thin local implementation rather than re-portal'ing.
 */
export function UserMenu() {
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const [open, setOpen] = useState(false);

  const displayName =
    user?.display_name || user?.email?.split("@")[0] || "User";
  const initials = displayName.charAt(0).toUpperCase();

  const wrapperRef = useRef<HTMLDivElement>(null);

  // Click-outside dismiss — same behavior as the original DashboardLayout
  // and the `<DropdownMenu>` primitive.
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (
        e.target instanceof Node &&
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  // ESC dismiss.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="sidebar-user-wrap" ref={wrapperRef}>
      <div
        className={`user-dropdown ${open ? "show" : ""}`}
        role="menu"
        aria-label="User menu"
        aria-hidden={!open}
      >
        <div className="dropdown-header">
          <div className="dropdown-email">{user?.email || "..."}</div>
          <div className="dropdown-handle">
            @{user?.email?.split("@")[0] || "user"}
          </div>
        </div>
        <button
          type="button"
          className="dropdown-item"
          onClick={() => {
            navigate("/dashboard/settings");
            setOpen(false);
          }}
        >
          <span className="dropdown-icon" aria-hidden="true">
            {"⚙"}
          </span>{" "}
          Settings
        </button>
        <Link
          className="dropdown-item"
          to="/terms"
          target="_blank"
          rel="noopener"
        >
          <span className="dropdown-icon" aria-hidden="true">
            {"📄"}
          </span>{" "}
          Terms of Service
        </Link>
        <Link
          className="dropdown-item"
          to="/privacy"
          target="_blank"
          rel="noopener"
        >
          <span className="dropdown-icon" aria-hidden="true">
            {"🔒"}
          </span>{" "}
          Privacy Policy
        </Link>
        <button
          type="button"
          className="dropdown-item danger"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
          <span className="dropdown-icon" aria-hidden="true">
            {"→"}
          </span>{" "}
          {logout.isPending ? "Signing out..." : "Sign Out"}
        </button>
      </div>

      <button
        type="button"
        className={`sidebar-user ${open ? "open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`User menu for ${displayName}`}
      >
        <div className="user-avatar" aria-hidden="true">
          {initials}
        </div>
        <div className="user-info">
          <div className="user-name">{displayName}</div>
          <div className="user-plan">Pro</div>
        </div>
        <span className="user-chevron" aria-hidden="true">
          {"▲"}
        </span>
      </button>
    </div>
  );
}
