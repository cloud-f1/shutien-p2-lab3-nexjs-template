import { forwardRef, useId, useState } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { getActivePreset } from "./preset";

export interface DisclosureProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Summary content rendered inside the trigger button. */
  summary: ReactNode;
  /** Controlled open state. */
  open?: boolean;
  /** Default open for uncontrolled usage. */
  defaultOpen?: boolean;
  /** Fired when open state changes. */
  onOpenChange?: (open: boolean) => void;
  /** Disable the trigger entirely. */
  disabled?: boolean;
  /** Optional accessible region label for the content. */
  ariaLabel?: string;
  /** className appended to the trigger button. */
  triggerClassName?: string;
  /** className appended to the content panel. */
  panelClassName?: string;
  children?: ReactNode;
}

/**
 * Disclosure — a single collapsible section with a controllable trigger.
 *
 *     <Disclosure summary="What is the refund policy?">
 *       Content shown when expanded.
 *     </Disclosure>
 *
 *     <Disclosure
 *       open={open}
 *       onOpenChange={setOpen}
 *       summary={<span>Toggle me</span>}
 *     >…</Disclosure>
 *
 * ARIA: trigger has `aria-expanded` + `aria-controls` pointing at the panel;
 * panel is `role="region"` with `aria-labelledby` back-pointing.
 */
export const Disclosure = forwardRef<HTMLDivElement, DisclosureProps>(
  function Disclosure(
    {
      summary,
      open: controlledOpen,
      defaultOpen = false,
      onOpenChange,
      disabled = false,
      ariaLabel,
      triggerClassName = "",
      panelClassName = "",
      className = "",
      children,
      ...rest
    },
    ref,
  ) {
    const isControlled = controlledOpen !== undefined;
    const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
    const open = isControlled ? !!controlledOpen : uncontrolledOpen;
    const baseId = useId();
    const triggerId = `${baseId}-trigger`;
    const panelId = `${baseId}-panel`;

    function setOpen(next: boolean) {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    }

    const p = getActivePreset().disclosure;
    const wrapperCls = [p.shell, className].filter(Boolean).join(" ");
    const triggerCls = [p.trigger, triggerClassName].filter(Boolean).join(" ");
    const panelCls = [p.panel, panelClassName].filter(Boolean).join(" ");

    return (
      <div ref={ref} className={wrapperCls} data-open={open} {...rest}>
        <button
          type="button"
          id={triggerId}
          aria-expanded={open}
          aria-controls={panelId}
          disabled={disabled}
          className={triggerCls}
          onClick={() => setOpen(!open)}
        >
          <span className={p.summary}>{summary}</span>
          <span aria-hidden="true" className={p.icon}>
            {open ? "−" : "+"}
          </span>
        </button>
        <div
          id={panelId}
          role="region"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabel ? undefined : triggerId}
          hidden={!open}
          className={panelCls}
        >
          {children}
        </div>
      </div>
    );
  },
);
