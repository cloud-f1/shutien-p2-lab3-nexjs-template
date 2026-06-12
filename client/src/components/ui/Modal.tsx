import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { getActivePreset } from "./preset";

export type ModalSize = "sm" | "md" | "lg";

export interface ModalProps {
  /** Controlled open state. */
  open: boolean;
  /** Called when the user dismisses (ESC, backdrop, close button). */
  onClose: () => void;
  /** Optional title rendered in the modal header. */
  title?: ReactNode;
  /** Modal body content. */
  children: ReactNode;
  /** Width preset; defaults to `md`. */
  size?: ModalSize;
  /** Close on ESC key (default true). */
  closeOnEsc?: boolean;
  /** Close on backdrop click (default true). */
  closeOnBackdrop?: boolean;
  /** Optional className appended to the dialog shell. */
  className?: string;
}

/**
 * A portal-rendered modal dialog with focus trap, ESC + backdrop dismiss,
 * and ARIA dialog semantics. Composes Preset slots for chrome.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  closeOnEsc = true,
  closeOnBackdrop = true,
  className = "",
}: ModalProps) {
  const { t } = useTranslation("primitives");
  const shellRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Focus trap + ESC handling. The hook restores focus to the trigger on unmount.
  useFocusTrap(shellRef, open, closeOnEsc ? onClose : undefined);

  // Body scroll lock while open.
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const p = getActivePreset().modal;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!closeOnBackdrop) return;
    if (e.target === e.currentTarget) onClose();
  };

  const node = (
    <div
      className={p.backdrop}
      onClick={handleBackdropClick}
      data-testid="modal-backdrop"
    >
      <div
        ref={shellRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={[p.shell, p.sizes[size], className]
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
            aria-label={t("modal.close")}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <div className={p.body}>{children}</div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
