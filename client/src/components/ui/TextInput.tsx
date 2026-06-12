import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { getActivePreset } from "./preset";

export interface TextInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Override the default `text` input type (e.g. `email`, `url`, `tel`, `search`). */
  type?: "text" | "email" | "url" | "tel" | "search";
  /** When true, applies the invalid styling and sets `aria-invalid`. */
  invalid?: boolean;
}

/**
 * Single-line text input. Spreads `...rest` directly to the underlying
 * `<input>`. Compose with `<FormField>` for label + error scaffolding.
 */
export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ type = "text", invalid, className = "", ...rest }, ref) => {
    const p = getActivePreset().textInput;
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
        type={type}
        {...rest}
        aria-invalid={ariaInvalid || undefined}
        className={classes}
      />
    );
  },
);

TextInput.displayName = "TextInput";
