import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { getActivePreset } from "./preset";

export interface PublicLayoutProps {
  /** Optional top navigation. Pass `<NavBar>` or any ReactNode. */
  nav?: ReactNode;
  /** Optional site footer. Pass `<Footer>` or any ReactNode. */
  footer?: ReactNode;
  /** Main element id. Used by skip-links elsewhere in the app. */
  mainId?: string;
  /**
   * Render an internal skip-link before the nav. Defaults to false because
   * the surrounding App typically renders its own global `<SkipNav>` —
   * enable this when composing `PublicLayout` outside that wrapper.
   */
  withSkipLink?: boolean;
  /** Skip-link label. Defaults to the translated `publicLayout.skipToContent`
   * key (`"Skip to main content"` in EN, `"跳至主要內容"` in zh-TW). */
  skipLabel?: string;
  /** Page content rendered inside `<main>`. */
  children: ReactNode;
}

/**
 * Outer shell for every public-facing page (landing, getting-started,
 * legal, 404). Provides an optional top nav, a `<main>` landmark, and
 * an optional footer. All visual classes live on the `publicLayout`
 * preset slot.
 */
export function PublicLayout({
  nav,
  footer,
  mainId = "main-content",
  withSkipLink = false,
  skipLabel,
  children,
}: PublicLayoutProps) {
  const p = getActivePreset().publicLayout;
  const { t } = useTranslation("primitives");
  const resolvedSkipLabel = skipLabel ?? t("publicLayout.skipToContent");

  return (
    <div className={p.shell}>
      {withSkipLink && (
        <a href={`#${mainId}`} className={p.skipNav}>
          {resolvedSkipLabel}
        </a>
      )}
      {nav}
      <main id={mainId} className={p.main}>
        {children}
      </main>
      {footer}
    </div>
  );
}
