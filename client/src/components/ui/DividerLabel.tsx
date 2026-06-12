import type { ReactNode } from "react";
import { getActivePreset } from "./preset";

export interface DividerLabelProps {
  children: ReactNode;
  className?: string;
}

/**
 * Horizontal rule with a centered label, e.g. "or sign in with".
 * Renders as `<div role="separator">` so screen readers announce a
 * separation, and the label remains visible/copyable text content.
 */
export function DividerLabel({ children, className = "" }: DividerLabelProps) {
  const p = getActivePreset().dividerLabel;
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={[p.shell, className].filter(Boolean).join(" ")}
    >
      <span className={p.line} aria-hidden="true" />
      <span className={p.label}>{children}</span>
      <span className={p.line} aria-hidden="true" />
    </div>
  );
}
