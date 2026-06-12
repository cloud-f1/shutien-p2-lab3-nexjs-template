import type { ReactNode } from "react";
import { getActivePreset } from "./preset";

export type BannerVariant = "success" | "error" | "info" | "warning";

export interface BannerProps {
  variant: BannerVariant;
  children?: ReactNode;
  /**
   * Legacy prop — when provided, used as the banner content. Prefer passing
   * children. Kept for back-compat with the old `<FormBanner>` API.
   */
  message?: string;
  /**
   * Legacy prop — when explicitly false, the banner renders nothing. Kept
   * for back-compat with the old `<FormBanner>` API. Defaults to true.
   */
  visible?: boolean;
  className?: string;
}

const ICONS: Record<BannerVariant, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
  warning: "⚠",
};

export function Banner({
  variant,
  children,
  message,
  visible = true,
  className = "",
}: BannerProps) {
  if (!visible) return null;
  const p = getActivePreset().banner;
  const content = children ?? message;

  // Legacy class name (success / error / info / warning) is appended so
  // pre-existing CSS selectors and tests targeting `.success` / `.error`
  // continue to resolve while we migrate consumers off `<FormBanner>`.
  return (
    <div
      className={[p.shell, p.variants[variant], variant, className]
        .filter(Boolean)
        .join(" ")}
      role="alert"
      aria-live="polite"
    >
      <span className={[p.icon, "banner-icon"].join(" ")} aria-hidden="true">
        {ICONS[variant]}
      </span>
      <span className={[p.text, "banner-text"].join(" ")}>{content}</span>
    </div>
  );
}
