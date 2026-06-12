import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "dark" | "indigo" | "navy" | "sage" | "rose" | "forest" | "system";

const VALID_THEMES = new Set<string>([
  "dark",
  "indigo",
  "navy",
  "sage",
  "rose",
  "forest",
  "system",
]);

function resolveTheme(theme: Theme): Exclude<Theme, "system"> {
  if (theme !== "system") return theme;
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "indigo";
}

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: "dark",
      setTheme: (theme) => set({ theme }),
    }),
    { name: "app-theme" },
  ),
);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    // Runtime validation: guard against corrupted localStorage values
    if (!VALID_THEMES.has(theme)) {
      useThemeStore.setState({ theme: "dark" });
      return;
    }
    const resolved = resolveTheme(theme);
    document.documentElement.setAttribute("data-theme", resolved);

    if (theme === "system") {
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) => {
        document.documentElement.setAttribute(
          "data-theme",
          e.matches ? "dark" : "indigo",
        );
      };
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
  }, [theme]);

  return <>{children}</>;
}

export const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "indigo", label: "Indigo" },
  { value: "navy", label: "Navy" },
  { value: "sage", label: "Sage" },
  { value: "rose", label: "Rose" },
  { value: "forest", label: "Forest" },
  { value: "system", label: "System" },
];
