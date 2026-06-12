# E1: Theme System — Spec

> **Goal**: Add a multi-theme CSS system with 4 themes, ThemeProvider, and system preference detection. Users can paste `themes.css` into any AI tool to generate custom themes.

## Current State

- `globals.css`: dark theme in `:root` + `.light` class override
- Legacy token names: `--bg`, `--amber`, `--white`, `--gray`, `--green`, `--red`, `--border`
- No ThemeProvider, no Zustand persist, no `data-theme` attribute
- Pages use legacy tokens directly: `var(--amber)`, `var(--white)`, etc.

## Design Decision

**Keep legacy variable names** as aliases in each theme. This avoids rewriting every page CSS file. Each theme defines both:
- Standardized tokens (`--primary`, `--text-primary`, `--surface`, etc.)
- Legacy aliases (`--amber`, `--white`, `--bg`, etc.) mapped to theme-appropriate values

## New Files

| File | Purpose |
|------|---------|
| `client/src/styles/themes.css` | 4 themes via `[data-theme]` selectors |
| `client/src/styles/fonts.css` | Font @imports (extracted from globals) |
| `client/src/components/ThemeProvider.tsx` | Zustand persist + `data-theme` + system detection |

## Modified Files

| File | Change |
|------|--------|
| `client/src/styles/globals.css` | Remove `:root` tokens + `.light` class; @import themes.css + fonts.css |
| `client/src/App.tsx` | Wrap with `<ThemeProvider>` |
| `client/src/pages/dashboard/DashboardPage.tsx` | Add theme picker to Settings view |

## Theme Contract (CSS Variable API)

Each `[data-theme]` block defines:

```css
/* Primary & Accent */
--primary, --primary-dark, --primary-light, --primary-bg
--accent, --accent-light

/* Semantic */
--success, --success-light, --warning, --warning-light
--danger, --danger-light

/* Surfaces */
--bg, --surface, --surface-2, --border

/* Text */
--text-primary, --text-secondary, --text-muted

/* Sidebar (for dashboard layout) */
--sidebar-bg, --sidebar-text, --sidebar-active, --sidebar-hover, --sidebar-border

/* Legacy aliases (mapped per theme) */
--bg2, --bg3, --amber, --amber2, --amber-dim
--white, --gray, --gray2, --green, --red, --blue

/* Typography */
--font-display, --font-head, --font-body, --font-mono

/* Border Radius & Shadows */
--radius-sm, --radius-md, --radius-lg
--shadow-sm, --shadow-md, --shadow-lg
```

## 4 Themes

| Theme | Primary | Accent | Sidebar | Vibe |
|-------|---------|--------|---------|------|
| `dark` (default) | `#f0a500` amber | `#ffc233` | Dark (#07070f) | Current template look |
| `indigo` | `#4F46E5` | `#0EA5E9` | Warm white | Professional light |
| `navy` | `#1B3A6B` | `#C9A84C` | Deep navy | Corporate |
| `sage` | `#2D6A4F` | `#E07A5F` | Forest green | Organic |

## ThemeProvider Implementation

```typescript
type Theme = "dark" | "indigo" | "navy" | "sage" | "system";

// Zustand store with localStorage persist
const useThemeStore = create(persist(
  (set) => ({ theme: "dark", setTheme: (t) => set({ theme: t }) }),
  { name: "app-theme" }
));

// Provider: sets data-theme on <html>, listens for system preference
function ThemeProvider({ children }) {
  const theme = useThemeStore(s => s.theme);
  useEffect(() => {
    const resolved = theme === "system"
      ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "indigo")
      : theme;
    document.documentElement.setAttribute("data-theme", resolved);
    // Listen for system changes if "system" selected
  }, [theme]);
  return <>{children}</>;
}
```

## Test Plan

- ThemeProvider renders children
- `setTheme("indigo")` sets `data-theme="indigo"` on `<html>`
- `setTheme("system")` resolves to "dark" or "indigo" based on media query
- Theme persists across re-renders (Zustand persist)
- All existing page tests still pass (legacy vars mapped correctly)

## Acceptance Criteria

- [ ] 4 complete themes in `themes.css`
- [ ] `ThemeProvider.tsx` with Zustand persist + system detection
- [ ] `fonts.css` extracted from globals
- [ ] Legacy variable aliases in every theme
- [ ] Dashboard Settings view has theme picker (5 options)
- [ ] All existing tests pass
- [ ] `globals.css` clean (no inline tokens — only @imports + reset + utilities)
