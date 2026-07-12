import type { SalesStylePreset } from "@/lib/sales/types"

/**
 * Tailwind class bundles per style preset (E326). Every value here is a
 * Tailwind utility built on this template's design tokens (`bg-primary`,
 * `bg-card`, `text-muted-foreground`, …) which already flip between light and
 * dark via CSS variables (see `app/globals.css`) — no raw hex/oklch values,
 * no inline `style=` color overrides. Section components merge these with
 * `cn()`.
 */
export interface SalesStyleTokens {
  /** Applied to the page-level <main>. */
  page: string
  /** Section heading (h2/h1) classes. */
  heading: string
  /** Section body/subheading copy. */
  subheading: string
  /** Base section background (used by most sections). */
  sectionBg: string
  /** Alternate/accent section background (pain points, urgency blocks). */
  sectionBgAlt: string
  /** Card/list-item surface. */
  card: string
  /** Extra classes merged onto primary CTA <Button>. */
  ctaButton: string
  /** Small badge/pill accent (urgency, "limited seats", etc.). */
  badge: string
  /** Inline accent text color. */
  accentText: string
}

const BOLD: SalesStyleTokens = {
  page: "bg-background text-foreground",
  heading: "font-extrabold tracking-tight text-foreground",
  subheading: "text-muted-foreground",
  sectionBg: "bg-background",
  sectionBgAlt: "bg-warning/10 dark:bg-warning/15",
  card: "border-2 border-primary/30 bg-card shadow-md",
  ctaButton: "shine glow-cta bg-primary text-primary-foreground hover:bg-primary/90",
  badge: "bg-destructive text-destructive-foreground",
  accentText: "text-primary",
}

const PREMIUM: SalesStyleTokens = {
  page: "bg-background text-foreground",
  heading: "font-semibold tracking-tight text-foreground",
  subheading: "text-muted-foreground/90",
  sectionBg: "bg-background",
  sectionBgAlt: "bg-muted/40 dark:bg-muted/20",
  card: "border bg-card/80 shadow-lg backdrop-blur-sm",
  ctaButton: "bg-primary text-primary-foreground hover:bg-primary/90",
  badge: "bg-secondary text-secondary-foreground",
  accentText: "text-primary",
}

const CLEAN: SalesStyleTokens = {
  page: "bg-background text-foreground",
  heading: "font-medium tracking-tight text-foreground",
  subheading: "text-muted-foreground",
  sectionBg: "bg-background",
  sectionBgAlt: "bg-muted/20",
  card: "border bg-card shadow-xs",
  ctaButton: "bg-primary text-primary-foreground hover:bg-primary/90",
  badge: "bg-accent text-accent-foreground",
  accentText: "text-foreground",
}

const SALES_STYLE_PRESETS: Record<SalesStylePreset, SalesStyleTokens> = {
  bold: BOLD,
  premium: PREMIUM,
  clean: CLEAN,
}

/** Resolve a preset name to its Tailwind class bundle. Falls back to `clean`. */
export function getSalesStyleTokens(preset: SalesStylePreset): SalesStyleTokens {
  return SALES_STYLE_PRESETS[preset] ?? CLEAN
}
