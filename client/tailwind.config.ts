import type { Config } from "tailwindcss";

/**
 * Tailwind config — bridged to the 6-theme CSS-variable contract in
 * `src/styles/themes.css`. Every color, radius, font, and shadow utility
 * here resolves to a `var(--token)` so utilities automatically swap when
 * `<html data-theme="...">` changes. Do NOT hardcode hex values here —
 * that would break theme switching.
 *
 * Usage in JSX: `bg-surface text-text-primary border border-border`.
 * See `docs/design/design.md` for the full token map and component recipes.
 */
const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  // Don't reset existing global styles — we coexist with the legacy CSS
  // (page CSS files + common/*.css). Disabling preflight keeps `body`,
  // headings, and form elements rendering as the legacy theme expects.
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "var(--primary)",
          dark: "var(--primary-dark)",
          light: "var(--primary-light)",
          bg: "var(--primary-bg)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          light: "var(--accent-light)",
        },
        success: {
          DEFAULT: "var(--success)",
          light: "var(--success-light)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          light: "var(--warning-light)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          light: "var(--danger-light)",
        },
        bg: "var(--bg)",
        surface: {
          DEFAULT: "var(--surface)",
          2: "var(--surface-2)",
        },
        border: "var(--border)",
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
      },
      borderColor: {
        DEFAULT: "var(--border)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius-md)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
      fontFamily: {
        display: "var(--font-display)",
        head: "var(--font-head)",
        body: "var(--font-body)",
        mono: "var(--font-mono)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-md)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
    },
  },
  plugins: [],
};

export default config;
