import { forwardRef } from "react";
import type { TextareaHTMLAttributes } from "react";
import { getActivePreset } from "./preset";

export interface TextAreaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** When true, applies the invalid styling and sets `aria-invalid`. */
  invalid?: boolean;
}

/**
 * Multi-line text input. Defaults to 4 rows. Spreads `...rest` to the
 * underlying `<textarea>`. Compose with `<FormField>`.
 */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ invalid, rows = 4, className = "", ...rest }, ref) => {
    const p = getActivePreset().textArea;
    const restAriaInvalid = rest["aria-invalid"];
    const ariaInvalid =
      invalid ??
      (restAriaInvalid === true || restAriaInvalid === "true");
    const classes = [p.textarea, ariaInvalid ? p.invalid : "", className]
      .filter(Boolean)
      .join(" ");
    return (
      <textarea
        ref={ref}
        rows={rows}
        {...rest}
        aria-invalid={ariaInvalid || undefined}
        className={classes}
      />
    );
  },
);

TextArea.displayName = "TextArea";
