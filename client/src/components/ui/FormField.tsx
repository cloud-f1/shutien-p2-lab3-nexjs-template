import type { ReactNode } from "react";
import { getActivePreset } from "./preset";

export interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className = "",
}: FormFieldProps) {
  const p = getActivePreset().formField;
  const errorId = error ? `${htmlFor}-error` : undefined;
  const hintId = hint && !error ? `${htmlFor}-hint` : undefined;
  const describedBy = errorId ?? hintId;

  return (
    <div className={[p.shell, className].join(" ")}>
      <label htmlFor={htmlFor} className={p.label}>
        {label}
        {required && (
          <span aria-hidden="true" className={p.required}>
            *
          </span>
        )}
      </label>
      <div data-describedby={describedBy}>{children}</div>
      {hint && !error && (
        <p id={hintId} className={p.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className={p.error}>
          {error}
        </p>
      )}
    </div>
  );
}
