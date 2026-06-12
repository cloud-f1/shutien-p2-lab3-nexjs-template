import { useState, forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { useTranslation } from "react-i18next";

export interface PasswordFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  showStrength?: boolean;
  error?: string;
  errorId?: string;
  hint?: string;
}

function getStrength(value: string) {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 8) score++;
  if (/[A-Z]/.test(value)) score++;
  if (/[0-9]/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  return score;
}

const strengthLabels = ["", "weak", "fair", "strong", "strong"] as const;
const strengthKeys = [
  "",
  "passwordField.strength.tooShort",
  "passwordField.strength.fair",
  "passwordField.strength.good",
  "passwordField.strength.strong",
] as const;

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ label, showStrength, error, errorId, hint, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const [strength, setStrength] = useState(0);
    const { t } = useTranslation("primitives");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (showStrength) {
        setStrength(getStrength(e.target.value));
      }
      props.onChange?.(e);
    };

    const barClass = (i: number) => {
      if (i >= strength) return "pw-bar";
      return `pw-bar ${strengthLabels[strength]}`;
    };

    return (
      <div className="field field-pw">
        <label htmlFor={props.id}>{label}</label>
        <div className="input-wrap">
          <input
            ref={ref}
            type={visible ? "text" : "password"}
            aria-describedby={error && errorId ? errorId : undefined}
            aria-invalid={error ? true : undefined}
            {...props}
            onChange={handleChange}
          />
          <button
            type="button"
            className="pw-toggle"
            onClick={() => setVisible(!visible)}
            aria-label={visible ? t("passwordField.hide") : t("passwordField.show")}
          >
            {visible ? t("passwordField.hideShort") : t("passwordField.showShort")}
          </button>
        </div>
        {showStrength && (
          <div className="pw-strength">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={barClass(i)} />
            ))}
          </div>
        )}
        {error && (
          <div className="field-hint err" id={errorId}>
            {error}
          </div>
        )}
        {!error && showStrength && strength > 0 && (
          <div
            className={`field-hint ${strength <= 1 ? "err" : strength >= 3 ? "ok" : ""}`}
          >
            {t(strengthKeys[strength])}
          </div>
        )}
        {!error && !showStrength && hint && (
          <div className="field-hint">{hint}</div>
        )}
      </div>
    );
  },
);

PasswordField.displayName = "PasswordField";
