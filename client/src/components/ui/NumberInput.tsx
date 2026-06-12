import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { getActivePreset } from "./preset";

export interface NumberInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** When true, applies the invalid styling and sets `aria-invalid`. */
  invalid?: boolean;
}

/**
 * Numeric input. Wraps `<input type="number">` — uses native browser spinner.
 * Pass `min`, `max`, `step` via standard HTML attrs.
 */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ invalid, className = "", ...rest }, ref) => {
    const p = getActivePreset().numberInput;
    const restAriaInvalid = rest["aria-invalid"];
    const ariaInvalid =
      invalid ??
      (restAriaInvalid === true || restAriaInvalid === "true");
    const classes = [p.input, ariaInvalid ? p.invalid : "", className]
      .filter(Boolean)
      .join(" ");
    return (
      <input
        ref={ref}
        type="number"
        {...rest}
        aria-invalid={ariaInvalid || undefined}
        className={classes}
      />
    );
  },
);

NumberInput.displayName = "NumberInput";
