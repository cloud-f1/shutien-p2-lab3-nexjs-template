import type { ReactNode } from "react";
import { getActivePreset } from "./preset";

export interface AuthLayoutProps {
  children: ReactNode;
  className?: string;
}

/**
 * Centered card on a brand-tinted background. Replaces the bespoke
 * `.auth-shell` markup from `AuthPages.css`. Use as the outermost wrapper
 * for any auth page (sign-in, sign-up, forgot, reset, verify, OAuth callback).
 *
 * Compose with `<AuthCard>` for the inner card chrome.
 */
export function AuthLayout({ children, className = "" }: AuthLayoutProps) {
  const p = getActivePreset().authLayout;
  return (
    <main
      id="main-content"
      className={[p.shell, className].filter(Boolean).join(" ")}
    >
      <div className={p.inner}>{children}</div>
    </main>
  );
}
