import type { ReactNode } from "react";
import { getActivePreset } from "./preset";

export interface RadioOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps {
  /** Shared `name` attribute for all radio inputs in the group. */
  name: string;
  /** Currently selected value (controlled). */
  value?: string;
  /** Called with the selected value when the user picks a different option. */
  onChange?: (value: string) => void;
  /** Group options. */
  options: RadioOption[];
  /** Disables every radio in the group. */
  disabled?: boolean;
  /** Accessible label for the group (radiogroup role needs a name). */
  "aria-label"?: string;
  /** Alternative: id of an external element labelling the group. */
  "aria-labelledby"?: string;
  /** Optional class on the outer wrapper. */
  className?: string;
}

/**
 * Wrapper that renders N `<input type="radio">` items sharing a `name`.
 * Compose with `<FormField>` for label + error scaffolding (FormField's
 * label can describe the group, error state surfaces below).
 */
export function RadioGroup({
  name,
  value,
  onChange,
  options,
  disabled,
  className = "",
  ...aria
}: RadioGroupProps) {
  const p = getActivePreset().radioGroup;
  const wrapClasses = [p.shell, className].filter(Boolean).join(" ");
  return (
    <div
      role="radiogroup"
      aria-label={aria["aria-label"]}
      aria-labelledby={aria["aria-labelledby"]}
      className={wrapClasses}
    >
      {options.map((opt) => (
        <label key={opt.value} className={p.item}>
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            disabled={disabled || opt.disabled}
            onChange={(e) => onChange?.(e.target.value)}
            className={p.input}
          />
          <span className={p.label}>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}
