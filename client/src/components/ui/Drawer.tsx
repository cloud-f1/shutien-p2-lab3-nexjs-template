import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { getActivePreset } from "./preset";

export type DrawerSide = "left" | "right";

export interface DrawerProps {
  /** Controlled open state. */
  open: boolean;
  /** Called when the user dismisses (ESC, backdrop, close button). */
  onClose: () => void;
  /** Optional title rendered in the drawer header. */
  title?: ReactNode;
  /** Drawer body content. */
  children: ReactNode;
  /** Edge to anchor to (default `right`). */
  side?: DrawerSide;
  /** Close on ESC key (default true). */
  closeOnEsc?: boolean;
  /** Close on backdrop click (default true). */
  closeOnBackdrop?: boolean;
  /** Optional className appended to the panel shell. */
  className?: string;
}

/**
 * A side-anchored drawer panel — same dismiss patterns as `<Modal>` but
 * slides in from `left` or `right` instead of centering.
 */
export function Drawer({
  open,
  onClose,
  title,
  children,
  side = "right",
  closeOnEsc = true,
  closeOnBackdrop = true,
  className = "",
}: DrawerProps) {
  const { t } = useTranslation("primitives");
  const shellRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useFocusTrap(shellRef, open, closeOnEsc ? onClose : undefined);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const p = getActivePreset().drawer;

  const handleBackdropClick = () => {
    if (closeOnBackdrop) onClose();
  };

  const node = (
    <>
      <div
        className={p.backdrop}
        onClick={handleBackdropClick}
        data-testid="drawer-backdrop"
      />
      <div
        ref={shellRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={[p.shell, p.sides[side], className]
          .filter(Boolean)
          .join(" ")}
      >
        <div className={p.header}>
          {title ? (
            <h2 id={titleId} className={p.title}>
              {title}
            </h2>
          ) : (
            <span aria-hidden="true" />
          )}
          <button
            type="button"
            className={p.closeButton}
            onClick={onClose}
            aria-label={t("drawer.close")}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <div className={p.body}>{children}</div>
      </div>
    </>
  );

  return createPortal(node, document.body);
}
