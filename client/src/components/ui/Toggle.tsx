import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { getActivePreset } from "./preset";

export interface ToggleProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "type" | "onChange" | "value"
  > {
  /** Whether the toggle is on. */
  checked: boolean;
  /** Called with the new `checked` state when the user activates the switch. */
  onCheckedChange?: (checked: boolean) => void;
  /** Optional inline label rendered next to the switch. */
  label?: ReactNode;
}

/**
 * On/off switch — `<button role="switch" aria-checked>`. NOT a checkbox:
 * UX semantics differ (switches express direct mode changes; checkboxes
 * express a list of selections). Provide an accessible name via `label`
 * or `aria-label`.
 */
export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
  (
    {
      checked,
      onCheckedChange,
      label,
      disabled,
      className = "",
      onClick,
      ...rest
    },
    ref,
  ) => {
    const p = getActivePreset().toggle;
    const trackClasses = [
      p.track.base,
      checked ? p.track.on : p.track.off,
    ]
      .filter(Boolean)
      .join(" ");
    const thumbClasses = [
      p.thumb.base,
      checked ? p.thumb.on : p.thumb.off,
    ]
      .filter(Boolean)
      .join(" ");
    const shellClasses = [p.shell, className].filter(Boolean).join(" ");

    return (
      <button
        ref={ref}
        {...rest}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={(e) => {
          onCheckedChange?.(!checked);
          onClick?.(e);
        }}
        className={shellClasses}
      >
        <span aria-hidden="true" className={trackClasses}>
          <span className={thumbClasses} />
        </span>
        {label !== undefined && label !== null && (
          <span className={p.label}>{label}</span>
        )}
      </button>
    );
  },
);

Toggle.displayName = "Toggle";
