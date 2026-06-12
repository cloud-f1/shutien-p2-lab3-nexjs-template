import { forwardRef } from "react";
import type { ReactNode, SelectHTMLAttributes } from "react";
import { getActivePreset } from "./preset";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Convenience: pass options as an array instead of `<option>` children. */
  options?: SelectOption[];
  /** When true, applies the invalid styling and sets `aria-invalid`. */
  invalid?: boolean;
  /** Standard `<select>` children — used when `options` is not provided. */
  children?: ReactNode;
}

/**
 * Styled native `<select>`. Pass either an `options` array OR `<option>`
 * children. Compose with `<FormField>` for label + error scaffolding.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, invalid, children, className = "", ...rest }, ref) => {
    const p = getActivePreset().select;
    const restAriaInvalid = rest["aria-invalid"];
    const ariaInvalid =
      invalid ??
      (restAriaInvalid === true || restAriaInvalid === "true");
    const classes = [p.select, ariaInvalid ? p.invalid : "", className]
      .filter(Boolean)
      .join(" ");
    return (
      <select
        ref={ref}
        {...rest}
        aria-invalid={ariaInvalid || undefined}
        className={classes}
      >
        {options
          ? options.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
              >
                {opt.label}
              </option>
            ))
          : children}
      </select>
    );
  },
);

Select.displayName = "Select";
