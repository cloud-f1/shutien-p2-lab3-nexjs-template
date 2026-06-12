import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { getActivePreset } from "./preset";

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Label rendered next to the checkbox. */
  label?: ReactNode;
  /** Optional class for the outer wrapper `<label>`. */
  wrapperClassName?: string;
}

/**
 * Native `<input type="checkbox">` paired with a label. forwardRefs the
 * input itself so react-hook-form `register("...")` works as expected.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className = "", wrapperClassName = "", ...rest }, ref) => {
    const p = getActivePreset().checkbox;
    const wrapClasses = [p.shell, wrapperClassName].filter(Boolean).join(" ");
    const inputClasses = [p.input, className].filter(Boolean).join(" ");
    return (
      <label className={wrapClasses}>
        <input ref={ref} type="checkbox" {...rest} className={inputClasses} />
        {label !== undefined && label !== null && (
          <span className={p.label}>{label}</span>
        )}
      </label>
    );
  },
);

Checkbox.displayName = "Checkbox";
