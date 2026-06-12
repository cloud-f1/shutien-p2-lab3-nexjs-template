import type { ReactNode } from "react";
import { getActivePreset } from "./preset";

export interface AuthCardProps {
  /** Optional logo / brand mark rendered above the title. */
  logo?: ReactNode;
  title: ReactNode;
  /** Optional subtitle (e.g. "No account? Sign up"). */
  subtitle?: ReactNode;
  /** Form / body content. */
  children: ReactNode;
  /** Optional footer slot — typically a `<Link>` (e.g. "Back to sign in"). */
  footer?: ReactNode;
  className?: string;
}

/**
 * Card with logo + title + subtitle + body slot + footer link slot.
 * Lives inside an `<AuthLayout>`.
 */
export function AuthCard({
  logo,
  title,
  subtitle,
  children,
  footer,
  className = "",
}: AuthCardProps) {
  const p = getActivePreset().authCard;
  return (
    <div className={[p.shell, className].filter(Boolean).join(" ")}>
      {logo && <div className={p.logo}>{logo}</div>}
      <div className={p.header}>
        <h1 className={p.title}>{title}</h1>
        {subtitle && <p className={p.subtitle}>{subtitle}</p>}
      </div>
      <div className={p.body}>{children}</div>
      {footer && <div className={p.footer}>{footer}</div>}
    </div>
  );
}
