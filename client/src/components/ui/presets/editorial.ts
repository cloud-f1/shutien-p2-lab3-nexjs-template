/* ============================================================================
 * EDITORIAL PRESET — magazine / publication style.
 *
 * Inspired by NYT-meets-Apple-design: serif display typography, generous
 * whitespace, sharper borders, less rounding, accent-first emphasis. Pairs
 * well with the rose / sage / forest themes for content-heavy SaaS, marketing
 * sites, and editorial dashboards.
 *
 * Inherits from `defaultPreset` (one-direction spread) and only overrides
 * high-visibility slots — buttons, hero, feature grid, card, navbar, footer,
 * prose, tabs, breadcrumb, page container. Other slots fall through to the
 * default look.
 *
 * Usage:
 *   import { setActivePreset, editorialPreset } from "@/components/ui";
 *   setActivePreset(editorialPreset);
 *
 * See `docs/design/PRESET_RECIPES.md` for the cookbook.
 * ============================================================================ */

import type { Preset } from "../preset";
import { defaultPreset } from "../preset";

export const editorialPreset: Preset = {
  ...defaultPreset,
  name: "editorial",

  // Pill-shaped buttons with generous padding; accent (not primary) is the
  // attention color in this preset.
  button: {
    ...defaultPreset.button,
    variants: {
      primary:
        "bg-accent text-bg border-accent hover:bg-accent-light hover:shadow-lg",
      secondary:
        "bg-transparent text-text-primary border-text-primary hover:bg-surface hover:border-accent",
      danger:
        "bg-transparent text-danger border-danger hover:bg-danger-light",
      ghost:
        "bg-transparent text-text-secondary border-transparent hover:bg-surface hover:text-accent",
    },
    sizes: {
      sm: "px-4 py-2 text-xs rounded-full",
      md: "px-7 py-3.5 text-sm rounded-full",
      lg: "px-10 py-5 text-base rounded-full",
    },
  },

  // Generous whitespace; serif title; chevron breadcrumb separator (set below).
  pageContainer: {
    ...defaultPreset.pageContainer,
    header:
      "mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between",
    eyebrow:
      "text-[11px] font-mono uppercase tracking-[0.25em] text-accent",
    title:
      "font-display text-4xl md:text-5xl font-bold text-text-primary mt-3 leading-[1.1] tracking-tight",
    subtitle: "font-body text-base md:text-lg text-text-secondary mt-3 max-w-2xl leading-relaxed",
    body: "space-y-10",
  },

  breadcrumb: {
    ...defaultPreset.breadcrumb,
    shell: "text-xs font-body italic text-text-secondary",
    separatorGlyph: "›",
  },

  // Magazine-style hero: bigger title, more breathing room, accent eyebrow.
  heroSection: {
    ...defaultPreset.heroSection,
    inner:
      "mx-auto w-full max-w-5xl px-4 py-28 md:py-36 md:px-6 text-center",
    eyebrow:
      "inline-block text-[11px] font-mono uppercase tracking-[0.3em] text-accent mb-8",
    title:
      "font-display text-5xl md:text-7xl font-bold leading-[1.02] tracking-tight text-text-primary",
    subtitle:
      "mx-auto mt-8 max-w-2xl font-body text-lg md:text-xl text-text-secondary leading-relaxed",
    actions: "mt-12 flex flex-wrap items-center justify-center gap-4",
    visualWrap: "mt-16",
  },

  // Sharper feature cards — square corners, no shadow on idle, hairline border.
  featureGrid: {
    ...defaultPreset.featureGrid,
    shell: "mx-auto w-full max-w-7xl px-4 py-20 md:px-6",
    grid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6",
    card: [
      "p-8 rounded-none border border-border bg-surface",
      "hover:border-accent transition-colors",
    ].join(" "),
    cardLabel:
      "text-[11px] font-mono uppercase tracking-[0.25em] text-accent mb-4",
    cardTitle: "font-display text-xl font-semibold text-text-primary mb-3 leading-snug",
    cardDesc: "font-body text-sm text-text-secondary leading-relaxed",
  },

  card: {
    ...defaultPreset.card,
    shell: [
      "bg-surface text-text-primary border border-border rounded-none",
      "transition-colors duration-200",
    ].join(" "),
    paddings: { sm: "p-5", md: "p-7", lg: "p-10" },
    title: "font-display text-lg font-semibold text-text-primary tracking-tight",
    subtitle: "font-body text-sm text-text-secondary leading-relaxed",
    header: "border-b border-border pb-4 mb-4",
    footer: "border-t border-border pt-4 mt-4",
  },

  // Editorial nav: serif logo, hairline bottom border, more padding.
  navBar: {
    ...defaultPreset.navBar,
    shell:
      "sticky top-0 z-40 w-full border-b border-border bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/80",
    inner:
      "mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-5 md:px-8",
    logo: "inline-flex items-center gap-2 font-display text-base font-bold tracking-tight text-text-primary hover:text-accent transition-colors",
    cta: [
      "inline-flex items-center gap-1 px-5 py-2.5 rounded-full font-body text-sm font-semibold",
      "bg-accent text-bg border border-accent hover:bg-accent-light hover:shadow-md",
      "transition-colors",
    ].join(" "),
  },

  footer: {
    ...defaultPreset.footer,
    inner:
      "mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-12 md:flex-row md:items-center md:justify-between md:px-8",
    brand: "text-sm font-display italic text-text-secondary",
    brandHandle: "text-text-primary not-italic font-semibold",
  },

  // Magazine-grade prose: bigger leading, more drop, serif everywhere.
  prose: {
    shell: [
      "mx-auto w-full max-w-2xl px-4 py-16 md:px-6",
      "prose-public text-text-primary",
      "[&_h1]:font-display [&_h1]:text-4xl [&_h1]:md:text-5xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:mt-0 [&_h1]:mb-6 [&_h1]:leading-[1.05]",
      "[&_h2]:font-display [&_h2]:text-2xl [&_h2]:md:text-3xl [&_h2]:font-semibold [&_h2]:mt-16 [&_h2]:mb-5",
      "[&_h3]:font-display [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-10 [&_h3]:mb-4",
      "[&_p]:font-display [&_p]:text-lg [&_p]:leading-[1.75] [&_p]:text-text-primary [&_p]:my-6",
      "[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-4 [&_a]:decoration-accent/40 hover:[&_a]:decoration-accent",
      "[&_ul]:my-6 [&_ul]:pl-6 [&_ul]:list-disc [&_ul]:text-text-primary [&_ul]:space-y-3",
      "[&_ol]:my-6 [&_ol]:pl-6 [&_ol]:list-decimal [&_ol]:text-text-primary [&_ol]:space-y-3",
      "[&_li]:leading-relaxed",
      "[&_code]:font-mono [&_code]:text-sm [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-none [&_code]:bg-surface [&_code]:text-accent [&_code]:border [&_code]:border-border",
      "[&_blockquote]:border-l-4 [&_blockquote]:border-accent [&_blockquote]:pl-6 [&_blockquote]:italic [&_blockquote]:text-text-secondary [&_blockquote]:my-8",
      "[&_strong]:text-text-primary [&_strong]:font-semibold",
    ].join(" "),
  },

  // Editorial tabs: more whitespace, accent underline.
  tabs: {
    ...defaultPreset.tabs,
    list: [
      "flex flex-wrap items-center gap-2 border-b border-border",
      "overflow-x-auto",
    ].join(" "),
    trigger: [
      "px-5 py-3 -mb-px border-b-2 border-transparent",
      "font-display text-sm font-semibold tracking-wide",
      "transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
      "disabled:opacity-50 disabled:cursor-not-allowed",
    ].join(" "),
    triggerActive: "border-accent text-text-primary",
    triggerInactive:
      "text-text-secondary hover:text-text-primary hover:border-text-secondary",
  },

  // Editorial pagination: tighter glyphs, accent active state.
  pagination: {
    ...defaultPreset.pagination,
    summary: "text-xs font-display italic text-text-muted",
    button: {
      ...defaultPreset.pagination.button,
      base: "min-w-[36px] h-9 px-3 text-xs font-display border border-border rounded-none transition-colors",
      active: "bg-accent text-bg border-accent",
    },
    prevGlyph: "‹",
    nextGlyph: "›",
  },

  ctaBanner: {
    ...defaultPreset.ctaBanner,
    shell:
      "border-y border-border bg-surface/40 py-20 md:py-24 text-center",
    eyebrow:
      "text-[11px] font-mono uppercase tracking-[0.3em] text-accent mb-6",
    title:
      "font-display text-4xl md:text-5xl font-bold leading-[1.05] tracking-tight text-text-primary",
    subtitle: "mt-5 font-body text-lg text-text-secondary leading-relaxed",
    actions: "mt-10 flex flex-wrap items-center justify-center gap-4",
    note: "mt-8 text-xs font-display italic text-text-muted",
  },

  section: {
    ...defaultPreset.section,
    shell: "py-20 md:py-28",
    label:
      "text-[11px] font-mono uppercase tracking-[0.3em] text-accent mb-5",
    title:
      "font-display text-3xl md:text-5xl font-bold leading-[1.05] tracking-tight text-text-primary",
    lede: "mt-6 max-w-2xl font-display text-lg text-text-secondary leading-relaxed",
    body: "mt-14",
  },
};
