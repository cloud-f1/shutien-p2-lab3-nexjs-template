import type { ButtonHTMLAttributes, ReactNode } from "react";
import { getActivePreset } from "./preset";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  leftIcon,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const p = getActivePreset().button;
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={[p.base, p.variants[variant], p.sizes[size], className].join(
        " ",
      )}
    >
      {loading ? <span aria-hidden="true" className={p.spinner} /> : leftIcon}
      {children}
    </button>
  );
}
