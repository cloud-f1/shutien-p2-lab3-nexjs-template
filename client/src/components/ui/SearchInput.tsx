import type { InputHTMLAttributes } from "react";
import { useTranslation } from "react-i18next";
import { getActivePreset } from "./preset";

export interface SearchInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value"
> {
  value: string;
  onChange: (value: string) => void;
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className = "",
  ...rest
}: SearchInputProps) {
  const p = getActivePreset().searchInput;
  const { t } = useTranslation("primitives");
  const resolvedPlaceholder = placeholder ?? t("search.placeholder");
  return (
    <div className={[p.shell, className].join(" ")}>
      <span aria-hidden="true" className={p.icon}>
        {p.iconGlyph}
      </span>
      <input
        aria-label={resolvedPlaceholder}
        {...rest}
        type="search"
        role="searchbox"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={resolvedPlaceholder}
        className={p.input}
      />
    </div>
  );
}
