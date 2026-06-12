import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  useImperativeHandle,
} from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { getActivePreset } from "./preset";

export interface DropdownMenuProps {
  /** Trigger element content (button label / avatar / chevron). */
  trigger: ReactNode;
  /** Menu body — typically a column of `<button>` / `<a>` items. */
  children: ReactNode;
  /** Controlled open state. If omitted, the component manages state internally. */
  open?: boolean;
  /** Called when the open state changes (controlled or uncontrolled). */
  onOpenChange?: (open: boolean) => void;
  /** Default open state for uncontrolled usage. */
  defaultOpen?: boolean;
  /** Accessible label applied to the menu region. */
  ariaLabel?: string;
  /** className appended to the trigger button. */
  triggerClassName?: string;
  /** className appended to the menu body. */
  menuClassName?: string;
  /** className for the outer wrapper. */
  className?: string;
  /** Extra props forwarded to the trigger button. */
  triggerProps?: Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "onClick" | "aria-expanded" | "aria-haspopup" | "aria-controls" | "type"
  >;
  /** Close on ESC (default true). */
  closeOnEsc?: boolean;
  /** Close when clicking outside the wrapper (default true). */
  closeOnOutsideClick?: boolean;
}

/**
 * Generic dropdown primitive — trigger + menu body, click-outside dismiss,
 * ESC dismiss, and ARIA wiring (aria-expanded, aria-haspopup, role=menu).
 *
 * Composable: pass any `<button>` / `<Link>` items as children, and the
 * primitive wires up positioning + dismiss behavior. Used by `<UserMenu>`.
 */
export const DropdownMenu = forwardRef<HTMLButtonElement, DropdownMenuProps>(
  function DropdownMenu(
    {
      trigger,
      children,
      open: controlledOpen,
      onOpenChange,
      defaultOpen = false,
      ariaLabel,
      triggerClassName = "",
      menuClassName = "",
      className = "",
      triggerProps,
      closeOnEsc = true,
      closeOnOutsideClick = true,
    },
    ref,
  ) {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : uncontrolledOpen;

    const wrapperRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuId = useId();

    useImperativeHandle(ref, () => triggerRef.current as HTMLButtonElement);

    const setOpen = (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    };

    // Click-outside dismiss.
    useEffect(() => {
      if (!open || !closeOnOutsideClick) return;
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, closeOnOutsideClick]);

    // ESC dismiss.
    useEffect(() => {
      if (!open || !closeOnEsc) return;
      function onKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape") {
          e.stopPropagation();
          setOpen(false);
          // Restore focus to the trigger so keyboard users keep their place.
          triggerRef.current?.focus();
        }
      }
      document.addEventListener("keydown", onKeyDown);
      return () => document.removeEventListener("keydown", onKeyDown);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, closeOnEsc]);

    const p = getActivePreset().dropdownMenu;

    return (
      <div
        ref={wrapperRef}
        className={[p.wrapper, className].filter(Boolean).join(" ")}
        data-open={open ? "true" : "false"}
      >
        <button
          {...triggerProps}
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen(!open)}
          className={[p.trigger, triggerClassName].filter(Boolean).join(" ")}
        >
          {trigger}
        </button>
        <div
          id={menuId}
          role="menu"
          aria-label={ariaLabel}
          className={[p.menu, open ? p.menuOpen : p.menuClosed, menuClassName]
            .filter(Boolean)
            .join(" ")}
          data-testid="dropdown-menu"
          aria-hidden={!open}
        >
          {children}
        </div>
      </div>
    );
  },
);
