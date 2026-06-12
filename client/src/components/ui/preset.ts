/* ============================================================================
 * UI PRESET — Modular Skin System
 *
 * The design system has TWO orthogonal axes:
 *   1. Theme  — colors, fonts, radii, shadows  (CSS vars in themes.css)
 *   2. Preset — layout density, class strings, glyphs, variant maps  (this file)
 *
 * To swap colors only:   change `<html data-theme="...">` (already wired).
 * To swap the whole skin: ship a new `Preset` and call `setActivePreset(it)`.
 *
 * Every shared primitive in `src/components/ui/` reads from `getActivePreset()`
 * — there are NO inline class strings in the components themselves. That means
 *   - You can replace any subsystem (button / table / breadcrumb / …) without
 *     touching the components.
 *   - Two preset packs can coexist in tests (call `setActivePreset` per test).
 *   - You can keep the default preset and override one slot by spreading:
 *       setActivePreset({ ...defaultPreset, button: { ...defaultPreset.button,
 *         variants: { ...defaultPreset.button.variants, primary: "..." } } });
 *
 * See `docs/design/design.md` § "Swapping the visual preset" for the recipe.
 * ============================================================================ */

import type { ReactNode } from "react";

export interface ButtonPreset {
  base: string;
  variants: {
    primary: string;
    secondary: string;
    danger: string;
    ghost: string;
  };
  sizes: { sm: string; md: string; lg: string };
  spinner: string;
}

export interface TablePreset {
  shell: string;
  toolbar: string;
  toolbarTitle: string;
  toolbarSearchWidth: string;
  scroll: string;
  table: string;
  thead: string;
  th: string;
  tr: string;
  td: string;
  tdMono: string;
  align: { left: string; right: string; center: string };
  state: string;
  rowActionCluster: string;
  rowAction: { default: string; danger: string };
}

export interface PaginationPreset {
  shell: string;
  summary: string;
  list: string;
  button: { base: string; idle: string; active: string; disabled: string };
  ellipsis: string;
  /** Glyph for previous-page button. */
  prevGlyph: ReactNode;
  /** Glyph for next-page button. */
  nextGlyph: ReactNode;
}

export interface BreadcrumbPreset {
  shell: string;
  list: string;
  item: string;
  link: string;
  current: string;
  separator: string;
  separatorGlyph: ReactNode;
}

export interface SearchInputPreset {
  shell: string;
  icon: string;
  iconGlyph: ReactNode;
  input: string;
}

export interface FilterSelectPreset {
  shell: string;
  label: string;
  select: string;
}

export interface FormFieldPreset {
  shell: string;
  label: string;
  required: string;
  hint: string;
  error: string;
}

export interface PageContainerPreset {
  shell: string;
  breadcrumbWrap: string;
  header: string;
  titleColumn: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  actionsWrap: string;
  body: string;
}

/* E168 — public surface preset slots ────────────────────────────────────── */

export interface PublicLayoutPreset {
  shell: string;
  skipNav: string;
  main: string;
}

export interface NavBarPreset {
  shell: string;
  inner: string;
  logo: string;
  logoText: string;
  links: string;
  link: string;
  cta: string;
}

export interface FooterPreset {
  shell: string;
  inner: string;
  brand: string;
  brandHandle: string;
  links: string;
  link: string;
}

export interface HeroSectionPreset {
  shell: string;
  inner: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  actions: string;
  visualWrap: string;
}

export interface FeatureGridPreset {
  shell: string;
  grid: string;
  card: string;
  cardLabel: string;
  cardTitle: string;
  cardDesc: string;
}

export interface SectionPreset {
  shell: string;
  inner: string;
  label: string;
  title: string;
  lede: string;
  body: string;
}

export interface CTABannerPreset {
  shell: string;
  inner: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  actions: string;
  note: string;
}

export interface ProsePreset {
  shell: string;
}

export interface EmptyStatePreset {
  shell: string;
  card: string;
  code: string;
  title: string;
  subtitle: string;
  actions: string;
}

/* E169 — auth surface preset slots ──────────────────────────────────────── */

export interface AuthLayoutPreset {
  /** Outer shell — full viewport, centered card, brand-tinted background. */
  shell: string;
  /** Inner content wrapper — caps width and centers the card. */
  inner: string;
}

export interface AuthCardPreset {
  shell: string;
  logo: string;
  header: string;
  title: string;
  subtitle: string;
  body: string;
  footer: string;
}

export interface DividerLabelPreset {
  shell: string;
  line: string;
  label: string;
}

export interface BannerPreset {
  shell: string;
  icon: string;
  text: string;
  variants: {
    success: string;
    error: string;
    info: string;
    warning: string;
  };
}

/* E173 — form primitive preset slots ────────────────────────────────────── */

export interface TextInputPreset {
  /** Base classes applied to the <input> element. */
  input: string;
  /** Classes applied additively when aria-invalid is true. */
  invalid: string;
}

export interface TextAreaPreset {
  textarea: string;
  invalid: string;
}

export interface NumberInputPreset {
  input: string;
  invalid: string;
}

export interface SelectPreset {
  select: string;
  invalid: string;
}

export interface CheckboxPreset {
  /** Wrapper <label> classes. */
  shell: string;
  /** Native <input type="checkbox"> classes. */
  input: string;
  /** Label-text span classes. */
  label: string;
}

export interface RadioGroupPreset {
  /** Outer wrapper (role=radiogroup). */
  shell: string;
  /** Per-item label wrapper. */
  item: string;
  /** Native <input type="radio"> classes. */
  input: string;
  /** Per-item label-text span classes. */
  label: string;
}

export interface TogglePreset {
  /** Outer button (role=switch). */
  shell: string;
  /** Track / "on" + "off" variant. */
  track: { base: string; on: string; off: string };
  /** Thumb / "on" + "off" variant. */
  thumb: { base: string; on: string; off: string };
  /** Optional label text span. */
  label: string;
}

/* E174 — overlay primitive preset slots ─────────────────────────────────── */

export interface ModalPreset {
  /** Fixed full-viewport backdrop (z-index, dim, flex centering). */
  backdrop: string;
  /** The dialog shell (the actual visible card). */
  shell: string;
  /** Header row containing title + close button. */
  header: string;
  /** Title element classes. */
  title: string;
  /** Body content area (below header). */
  body: string;
  /** Close (✕) button classes. */
  closeButton: string;
  /** Per-size width caps. */
  sizes: { sm: string; md: string; lg: string };
}

export interface DrawerPreset {
  /** Fixed full-viewport backdrop (dim, click-to-close target). */
  backdrop: string;
  /** Sliding panel shell (positioned to a side). */
  shell: string;
  /** Header row containing title + close button. */
  header: string;
  /** Title element classes. */
  title: string;
  /** Body content area below header. */
  body: string;
  /** Close (✕) button classes. */
  closeButton: string;
  /** Per-side anchoring (transform/origin classes). */
  sides: { left: string; right: string };
}

/* E175 — dashboard chrome preset slots ─────────────────────────────────── */

export interface DropdownMenuPreset {
  /** Outer relative wrapper that holds trigger + menu. */
  wrapper: string;
  /** Trigger button base classes. */
  trigger: string;
  /** Menu body shell (positioning + chrome). */
  menu: string;
  /** Applied additively when the menu is open. */
  menuOpen: string;
  /** Applied additively when the menu is closed (e.g. opacity-0 + pointer-events-none). */
  menuClosed: string;
}

export interface NavItemPreset {
  /** Base classes applied to every nav row. */
  base: string;
  /** Applied additively when the nav row matches the active route. */
  active: string;
  /** Leading icon span. */
  icon: string;
  /** Visible label span. */
  label: string;
  /** Wrapper around the trailing badge (typically `<NavBadge>` content). */
  badgeWrap: string;
}

export interface ToastPreset {
  /** Container that stacks toasts in a screen corner (portal target). */
  container: string;
  /** A single toast element shell. */
  shell: string;
  /** Toast message body classes. */
  message: string;
  /** Dismiss button classes. */
  dismissButton: string;
  /** Per-variant chrome (background, text, border). */
  variants: {
    info: string;
    success: string;
    error: string;
    warning: string;
  };
}

/* E178 — layout primitive preset slots ─────────────────────────────────── */

export interface CardPreset {
  /** Outer card shell. */
  shell: string;
  /** Variant overlays (additive). */
  variants: {
    default: string;
    panel: string;
    glow: string;
    subtle: string;
  };
  /** Padding token map. */
  paddings: { sm: string; md: string; lg: string };
  /** `header` slot wrapper (rendered when `header` prop is set). */
  header: string;
  /** Body wrapper. */
  body: string;
  /** `footer` slot wrapper. */
  footer: string;
  /** `<CardHeader>` row layout (title column + actions). */
  headerInline: string;
  /** Title column inside `<CardHeader>`. */
  headerTitleColumn: string;
  /** Actions cluster inside `<CardHeader>`. */
  headerActions: string;
  /** Title element classes. */
  title: string;
  /** Subtitle element classes. */
  subtitle: string;
  /** `<CardFooter>` row layout. */
  footerInline: string;
}

export interface TabsPreset {
  /** Outer wrapper around list + panels. */
  shell: string;
  /** `role=tablist` row. */
  list: string;
  /** Each `role=tab` button base classes. */
  trigger: string;
  /** Applied additively when the trigger is active. */
  triggerActive: string;
  /** Applied additively when the trigger is inactive. */
  triggerInactive: string;
  /** `role=tabpanel` body classes. */
  panel: string;
}

export interface StackPreset {
  /** Block flex shell (used when `inline=false`). */
  shell: string;
  /** Inline-flex shell (used when `inline=true`). */
  inline: string;
  /** Direction modifier classes. */
  directions: { vertical: string; horizontal: string };
  /** Gap token map. */
  gaps: { sm: string; md: string; lg: string; xl: string };
  /** align-items map. */
  aligns: {
    start: string;
    center: string;
    end: string;
    stretch: string;
    baseline: string;
  };
  /** justify-content map. */
  justifies: {
    start: string;
    center: string;
    end: string;
    between: string;
    around: string;
    evenly: string;
  };
  /** flex-wrap=wrap class. */
  wrap: string;
}

export interface DisclosurePreset {
  /** Outer wrapper (around trigger + panel). */
  shell: string;
  /** Trigger button classes. */
  trigger: string;
  /** Summary text wrapper inside the trigger. */
  summary: string;
  /** Icon span (the +/− glyph). */
  icon: string;
  /** Content panel classes. */
  panel: string;
}

export interface AccordionPreset {
  /** Outer wrapper around all items. */
  shell: string;
  /** Per-item wrapper. */
  item: string;
  /** Trigger button base classes. */
  trigger: string;
  /** Applied additively to the trigger when its item is open. */
  triggerOpen: string;
  /** Summary text wrapper inside the trigger. */
  summary: string;
  /** Icon span (the +/− glyph). */
  icon: string;
  /** Per-item content panel. */
  panel: string;
}

export interface Preset {
  name: string;
  button: ButtonPreset;
  table: TablePreset;
  pagination: PaginationPreset;
  breadcrumb: BreadcrumbPreset;
  searchInput: SearchInputPreset;
  filterSelect: FilterSelectPreset;
  formField: FormFieldPreset;
  pageContainer: PageContainerPreset;
  // E168 — public surface
  publicLayout: PublicLayoutPreset;
  navBar: NavBarPreset;
  footer: FooterPreset;
  heroSection: HeroSectionPreset;
  featureGrid: FeatureGridPreset;
  section: SectionPreset;
  ctaBanner: CTABannerPreset;
  prose: ProsePreset;
  emptyState: EmptyStatePreset;
  // E169 — auth surface
  authLayout: AuthLayoutPreset;
  authCard: AuthCardPreset;
  dividerLabel: DividerLabelPreset;
  banner: BannerPreset;
  // E173 — form primitives
  textInput: TextInputPreset;
  textArea: TextAreaPreset;
  numberInput: NumberInputPreset;
  select: SelectPreset;
  checkbox: CheckboxPreset;
  radioGroup: RadioGroupPreset;
  toggle: TogglePreset;
  // E174 — overlay primitives
  modal: ModalPreset;
  drawer: DrawerPreset;
  toast: ToastPreset;
  // E175 — dashboard chrome primitives
  dropdownMenu: DropdownMenuPreset;
  navItem: NavItemPreset;
  // E178 — layout primitives
  card: CardPreset;
  tabs: TabsPreset;
  stack: StackPreset;
  disclosure: DisclosurePreset;
  accordion: AccordionPreset;
}

/* ─────────────────────────────────────────────────────────────────────────
 * DEFAULT PRESET — the look that ships with this template.
 * Mono labels, generous padding, soft borders. Pairs well with all 6 themes.
 * ───────────────────────────────────────────────────────────────────────── */
export const defaultPreset: Preset = {
  name: "default",
  button: {
    base: [
      "inline-flex items-center justify-center gap-2 border font-body font-semibold leading-none",
      "transition-colors duration-200 whitespace-nowrap",
      "disabled:opacity-50 disabled:cursor-not-allowed",
    ].join(" "),
    variants: {
      primary:
        "bg-primary text-bg border-primary hover:bg-primary-dark hover:shadow-md",
      secondary:
        "bg-transparent text-text-primary border-border hover:bg-surface hover:border-text-secondary",
      danger: "bg-transparent text-danger border-danger hover:bg-danger-light",
      ghost:
        "bg-transparent text-text-secondary border-transparent hover:bg-surface hover:text-text-primary",
    },
    sizes: {
      sm: "px-3 py-1.5 text-xs rounded-sm",
      md: "px-6 py-3 text-sm rounded",
      lg: "px-8 py-4 text-base rounded-lg",
    },
    spinner:
      "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent",
  },
  table: {
    shell: "bg-surface border border-border rounded-lg overflow-hidden",
    toolbar:
      "flex flex-wrap items-center gap-3 px-4 py-3 border-b border-border",
    toolbarTitle: "font-display text-sm text-text-primary mr-auto",
    toolbarSearchWidth: "w-full sm:w-64",
    scroll: "overflow-x-auto",
    table: "w-full text-sm",
    thead: "bg-surface-2",
    th: "px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-text-secondary",
    tr: "border-t border-border hover:bg-surface-2/60 transition-colors",
    td: "px-4 py-3 text-text-primary",
    tdMono: "font-mono text-xs",
    align: { left: "text-left", right: "text-right", center: "text-center" },
    state: "px-4 py-10 text-center text-xs font-mono text-text-secondary",
    rowActionCluster: "inline-flex items-center gap-2",
    rowAction: {
      // E212: explicit bg-transparent — Tailwind preflight is disabled, so a
      // <button> with no background utility falls through to the UA
      // `buttonface` color (~#efefef), which fails AA contrast under the
      // table's muted text. bg-transparent lets the dark surface show through.
      default: [
        "px-2.5 py-1 text-[11px] font-mono rounded border transition-colors bg-transparent",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "border-border text-text-secondary hover:text-text-primary hover:border-text-secondary hover:bg-surface-2",
      ].join(" "),
      danger: [
        "px-2.5 py-1 text-[11px] font-mono rounded border transition-colors bg-transparent",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "border-border text-text-secondary hover:text-danger hover:border-danger hover:bg-danger-light",
      ].join(" "),
    },
  },
  pagination: {
    shell:
      "flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border",
    summary: "text-xs font-mono text-text-muted",
    list: "flex items-center gap-1",
    button: {
      base: "min-w-[32px] h-8 px-2 text-xs font-mono border border-border rounded transition-colors",
      idle: "bg-surface text-text-secondary hover:text-text-primary hover:border-text-secondary",
      active: "bg-primary text-bg border-primary",
      disabled: "opacity-40 cursor-not-allowed",
    },
    ellipsis: "px-1 text-text-muted",
    prevGlyph: "←",
    nextGlyph: "→",
  },
  breadcrumb: {
    shell: "text-xs font-mono text-text-secondary",
    list: "flex flex-wrap items-center gap-1",
    item: "flex items-center",
    link: "hover:text-text-primary transition-colors",
    current: "text-text-primary",
    separator: "text-text-muted",
    separatorGlyph: "/",
  },
  searchInput: {
    shell: "relative",
    icon: "absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm",
    iconGlyph: "⌕",
    input: [
      "w-full pl-9 pr-3 py-2 text-sm",
      "bg-surface text-text-primary border border-border rounded",
      "placeholder:text-text-muted",
      "focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-bg)]",
      "transition-colors",
    ].join(" "),
  },
  filterSelect: {
    shell: "inline-flex items-center gap-2 text-xs text-text-secondary",
    label: "font-mono uppercase tracking-wider",
    select: [
      "py-2 pl-3 pr-8 text-sm",
      "bg-surface text-text-primary border border-border rounded",
      "focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-bg)]",
      "transition-colors",
    ].join(" "),
  },
  formField: {
    shell: "flex flex-col gap-1.5",
    label: "text-xs font-medium text-text-secondary tracking-wide",
    required: "text-danger ml-0.5",
    hint: "text-xs text-text-muted",
    error: "text-xs text-danger",
  },
  pageContainer: {
    shell: "view-enter",
    breadcrumbWrap: "mb-3",
    header:
      "mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between",
    titleColumn: "min-w-0",
    eyebrow: "text-[11px] font-mono uppercase tracking-wider text-primary",
    title: "font-display text-2xl md:text-3xl font-bold text-text-primary mt-1",
    subtitle: "text-sm text-text-secondary mt-2 max-w-2xl",
    actionsWrap: "flex flex-wrap items-center gap-2",
    body: "space-y-6",
  },
  // E168 — public surface
  publicLayout: {
    shell: "min-h-screen flex flex-col bg-bg text-text-primary",
    skipNav: [
      "sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50",
      "focus:px-3 focus:py-2 focus:bg-primary focus:text-bg focus:rounded",
    ].join(" "),
    main: "flex-1",
  },
  navBar: {
    shell:
      "sticky top-0 z-40 w-full border-b border-border bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/70",
    inner:
      "mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6",
    logo: "inline-flex items-center gap-2 font-display text-sm font-semibold text-text-primary hover:opacity-90 transition-opacity",
    logoText: "tracking-wide",
    links:
      "hidden md:flex items-center gap-1 text-sm font-body text-text-secondary",
    // E212 — explicit text-text-secondary: an unstyled <a> inherits the UA
    // `:link` color (#0000ee), which fails WCAG AA contrast on the dark
    // surfaces. The parent `links` container color does not cascade past the
    // UA link rule, so the anchor itself must carry the token.
    link: "px-3 py-2 rounded text-text-secondary hover:text-text-primary hover:bg-surface transition-colors",
    cta: [
      "inline-flex items-center gap-1 px-4 py-2 rounded font-body text-sm font-semibold",
      "bg-primary text-bg border border-primary hover:bg-primary-dark hover:shadow-md",
      "transition-colors",
    ].join(" "),
  },
  footer: {
    shell: "border-t border-border bg-surface/50",
    inner:
      "mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8 md:flex-row md:items-center md:justify-between md:px-6",
    brand: "text-xs font-mono text-text-secondary",
    brandHandle: "text-text-primary",
    links:
      "flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-mono text-text-secondary",
    link: "hover:text-text-primary transition-colors",
  },
  heroSection: {
    shell: "relative overflow-hidden",
    inner:
      "mx-auto w-full max-w-5xl px-4 py-20 md:py-28 md:px-6 text-center",
    eyebrow:
      "inline-block text-[11px] font-mono uppercase tracking-[0.2em] text-primary mb-6",
    title:
      "font-display text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight text-text-primary",
    subtitle:
      "mx-auto mt-6 max-w-2xl text-base md:text-lg text-text-secondary leading-relaxed",
    actions: "mt-10 flex flex-wrap items-center justify-center gap-3",
    visualWrap: "mt-12",
  },
  featureGrid: {
    shell: "mx-auto w-full max-w-7xl px-4 py-16 md:px-6",
    grid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4",
    card: [
      "p-6 rounded-lg border border-border bg-surface",
      "hover:border-text-secondary hover:shadow-md transition-all",
    ].join(" "),
    cardLabel:
      "text-[11px] font-mono uppercase tracking-wider text-primary mb-3",
    cardTitle: "font-display text-lg font-semibold text-text-primary mb-2",
    cardDesc: "text-sm text-text-secondary leading-relaxed",
  },
  section: {
    shell: "py-16 md:py-20",
    inner: "mx-auto w-full max-w-7xl px-4 md:px-6",
    label:
      "text-[11px] font-mono uppercase tracking-[0.2em] text-primary mb-4",
    title:
      "font-display text-3xl md:text-4xl font-bold leading-tight tracking-tight text-text-primary",
    lede: "mt-4 max-w-2xl text-base text-text-secondary leading-relaxed",
    body: "mt-10",
  },
  ctaBanner: {
    shell:
      "border-y border-border bg-surface/60 py-16 md:py-20 text-center",
    inner: "mx-auto w-full max-w-3xl px-4 md:px-6",
    eyebrow:
      "text-[11px] font-mono uppercase tracking-[0.2em] text-primary mb-4",
    title:
      "font-display text-3xl md:text-4xl font-bold leading-tight tracking-tight text-text-primary",
    subtitle: "mt-4 text-base text-text-secondary leading-relaxed",
    actions: "mt-8 flex flex-wrap items-center justify-center gap-3",
    note: "mt-6 text-xs font-mono text-text-muted",
  },
  prose: {
    shell: [
      "mx-auto w-full max-w-3xl px-4 py-12 md:px-6",
      "prose-public text-text-primary",
      "[&_h1]:font-display [&_h1]:text-3xl [&_h1]:md:text-4xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:mt-0 [&_h1]:mb-4",
      "[&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-12 [&_h2]:mb-4",
      "[&_h3]:font-display [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-8 [&_h3]:mb-3",
      "[&_p]:text-base [&_p]:leading-relaxed [&_p]:text-text-secondary [&_p]:my-4",
      "[&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline",
      "[&_ul]:my-4 [&_ul]:pl-6 [&_ul]:list-disc [&_ul]:text-text-secondary [&_ul]:space-y-2",
      "[&_ol]:my-4 [&_ol]:pl-6 [&_ol]:list-decimal [&_ol]:text-text-secondary [&_ol]:space-y-2",
      "[&_li]:leading-relaxed",
      "[&_code]:font-mono [&_code]:text-xs [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-surface [&_code]:text-text-primary [&_code]:border [&_code]:border-border",
      "[&_strong]:text-text-primary [&_strong]:font-semibold",
    ].join(" "),
  },
  emptyState: {
    shell: "flex min-h-[60vh] items-center justify-center px-4 py-12",
    card: [
      "w-full max-w-md text-center p-12 rounded-lg",
      "border border-border bg-surface",
    ].join(" "),
    code: "font-mono text-6xl font-bold tracking-tighter text-primary mb-2",
    title: "font-display text-2xl font-semibold text-text-primary mb-3",
    subtitle:
      "text-sm text-text-secondary leading-relaxed mb-8",
    actions: "flex flex-wrap items-center justify-center gap-3",
  },
  // E169 — auth surface
  authLayout: {
    shell:
      "min-h-screen w-full flex items-center justify-center bg-bg px-4 py-10",
    inner: "w-full max-w-md",
  },
  authCard: {
    shell:
      "bg-surface border border-border rounded-lg shadow-md p-8 flex flex-col gap-6",
    logo: "flex justify-center",
    header: "flex flex-col gap-2 text-center",
    title: "font-display text-2xl font-bold text-text-primary",
    subtitle: "text-sm text-text-secondary",
    body: "flex flex-col gap-4",
    footer: "text-center text-sm text-text-secondary pt-2 border-t border-border",
  },
  dividerLabel: {
    shell: "flex items-center gap-3 my-2",
    line: "flex-1 h-px bg-border",
    label:
      "text-[11px] font-mono uppercase tracking-wider text-text-muted whitespace-nowrap",
  },
  banner: {
    shell:
      "form-banner show flex items-center gap-2 px-4 py-3 rounded border text-sm",
    icon: "shrink-0 font-bold",
    text: "flex-1",
    variants: {
      success: "bg-success-light border-success text-success",
      error: "bg-danger-light border-danger text-danger",
      info: "bg-primary-bg border-primary text-primary",
      warning: "bg-warning-light border-warning text-warning",
    },
  },
  // E173 — form primitives
  textInput: {
    input: [
      "w-full px-3 py-2 text-sm",
      "bg-surface text-text-primary border border-border rounded",
      "placeholder:text-text-muted",
      "focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-bg)]",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      "transition-colors",
    ].join(" "),
    invalid:
      "border-danger focus:border-danger focus:shadow-[0_0_0_3px_var(--danger-light)]",
  },
  textArea: {
    textarea: [
      "w-full px-3 py-2 text-sm",
      "bg-surface text-text-primary border border-border rounded",
      "placeholder:text-text-muted resize-y",
      "focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-bg)]",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      "transition-colors",
    ].join(" "),
    invalid:
      "border-danger focus:border-danger focus:shadow-[0_0_0_3px_var(--danger-light)]",
  },
  numberInput: {
    input: [
      "w-full px-3 py-2 text-sm",
      "bg-surface text-text-primary border border-border rounded",
      "placeholder:text-text-muted",
      "focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-bg)]",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      "transition-colors",
    ].join(" "),
    invalid:
      "border-danger focus:border-danger focus:shadow-[0_0_0_3px_var(--danger-light)]",
  },
  select: {
    select: [
      "w-full py-2 pl-3 pr-8 text-sm",
      "bg-surface text-text-primary border border-border rounded",
      "focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_var(--primary-bg)]",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      "transition-colors",
    ].join(" "),
    invalid:
      "border-danger focus:border-danger focus:shadow-[0_0_0_3px_var(--danger-light)]",
  },
  checkbox: {
    shell: "inline-flex items-center gap-2 cursor-pointer select-none",
    input: [
      "h-4 w-4 rounded border border-border bg-surface",
      "accent-primary",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      "transition-colors",
    ].join(" "),
    label: "text-sm text-text-primary",
  },
  radioGroup: {
    shell: "flex flex-col gap-2",
    item: "inline-flex items-center gap-2 cursor-pointer select-none",
    input: [
      "h-4 w-4 border border-border bg-surface accent-primary",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      "transition-colors",
    ].join(" "),
    label: "text-sm text-text-primary",
  },
  toggle: {
    shell: [
      "inline-flex items-center gap-2.5 cursor-pointer select-none",
      "disabled:opacity-50 disabled:cursor-not-allowed",
    ].join(" "),
    track: {
      base: [
        "relative inline-block w-10 h-[22px] rounded-full border",
        "transition-colors duration-200",
      ].join(" "),
      on: "bg-primary border-primary",
      off: "bg-surface-2 border-border",
    },
    thumb: {
      base: [
        "absolute top-[2px] left-[2px] h-4 w-4 rounded-full",
        "transition-transform duration-200",
      ].join(" "),
      on: "translate-x-[18px] bg-bg",
      off: "translate-x-0 bg-text-primary",
    },
    label: "text-sm text-text-primary",
  },
  // E174 — overlay primitives
  modal: {
    backdrop: [
      "fixed inset-0 z-50 flex items-center justify-center px-4 py-6",
      "bg-black/60 backdrop-blur-sm",
    ].join(" "),
    shell: [
      "relative w-full max-h-[90vh] overflow-y-auto",
      "bg-surface text-text-primary border border-border rounded-lg shadow-xl",
      "flex flex-col",
    ].join(" "),
    header: [
      "flex items-start justify-between gap-3",
      "px-6 pt-5 pb-3 border-b border-border",
    ].join(" "),
    title: "font-display text-lg font-semibold text-text-primary",
    body: "px-6 py-5",
    closeButton: [
      "shrink-0 inline-flex items-center justify-center h-8 w-8 rounded",
      "text-text-secondary hover:text-text-primary hover:bg-surface-2",
      "transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
    ].join(" "),
    sizes: {
      sm: "max-w-sm",
      md: "max-w-md",
      lg: "max-w-2xl",
    },
  },
  drawer: {
    backdrop: "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
    shell: [
      "fixed top-0 bottom-0 z-50 w-full max-w-md",
      "bg-surface text-text-primary border-border shadow-xl",
      "flex flex-col",
    ].join(" "),
    header: [
      "flex items-start justify-between gap-3",
      "px-6 pt-5 pb-3 border-b border-border",
    ].join(" "),
    title: "font-display text-lg font-semibold text-text-primary",
    body: "flex-1 overflow-y-auto px-6 py-5",
    closeButton: [
      "shrink-0 inline-flex items-center justify-center h-8 w-8 rounded",
      "text-text-secondary hover:text-text-primary hover:bg-surface-2",
      "transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
    ].join(" "),
    sides: {
      left: "left-0 border-r",
      right: "right-0 border-l",
    },
  },
  toast: {
    container: [
      "fixed bottom-4 right-4 z-50",
      "flex flex-col gap-2 items-end",
      "pointer-events-none",
    ].join(" "),
    shell: [
      "pointer-events-auto",
      "min-w-[240px] max-w-sm",
      "flex items-start gap-3 px-4 py-3 rounded border shadow-md",
      "text-sm",
    ].join(" "),
    message: "flex-1 leading-snug",
    dismissButton: [
      "shrink-0 inline-flex items-center justify-center h-6 w-6 rounded",
      "text-current/70 hover:text-current hover:bg-black/10",
      "transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
    ].join(" "),
    variants: {
      info: "bg-primary-bg border-primary text-primary",
      success: "bg-success-light border-success text-success",
      error: "bg-danger-light border-danger text-danger",
      warning: "bg-warning-light border-warning text-warning",
    },
  },
  // E175 — dashboard chrome primitives
  dropdownMenu: {
    wrapper: "relative",
    trigger: [
      "inline-flex items-center gap-2 cursor-pointer",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
    ].join(" "),
    menu: [
      "absolute z-50 min-w-[180px]",
      "bg-surface-2 border border-border rounded-md shadow-lg overflow-hidden",
      "transition-[opacity,transform] duration-150 ease-out",
    ].join(" "),
    menuOpen: "opacity-100 translate-y-0 pointer-events-auto",
    menuClosed: "opacity-0 translate-y-2 pointer-events-none",
  },
  navItem: {
    // NOTE: in the default skin we let DashboardLayout.css drive the
    // visuals via the legacy `.nav-item` / `.active` / `.nav-icon`
    // classes (preserves dashboard-smoke + a11y test selectors).
    // Forks that want a Tailwind-only chrome can override this slot.
    base: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
    active: "",
    icon: "",
    label: "",
    badgeWrap: "",
  },
  // E178 — layout primitives
  card: {
    shell: [
      "bg-surface text-text-primary border border-border rounded-lg",
      "transition-colors duration-200",
    ].join(" "),
    variants: {
      default: "",
      panel: "bg-surface/60",
      glow: "shadow-md hover:shadow-lg",
      subtle: "border-transparent bg-surface/40",
    },
    paddings: { sm: "p-3", md: "p-5", lg: "p-7" },
    header: "border-b border-border pb-3 mb-3",
    body: "",
    footer: "border-t border-border pt-3 mt-3",
    headerInline: "flex items-start justify-between gap-3",
    headerTitleColumn: "min-w-0 flex flex-col gap-1",
    headerActions: "shrink-0 inline-flex items-center gap-2",
    title: "font-display text-base font-semibold text-text-primary",
    subtitle: "text-xs text-text-secondary",
    footerInline: "flex flex-wrap items-center justify-end gap-2",
  },
  tabs: {
    shell: "flex flex-col gap-4",
    list: [
      "flex flex-wrap items-center gap-1 border-b border-border",
      "overflow-x-auto",
    ].join(" "),
    trigger: [
      "px-3 py-2 -mb-px border-b-2 border-transparent",
      "font-body text-sm font-medium",
      "transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      "disabled:opacity-50 disabled:cursor-not-allowed",
    ].join(" "),
    triggerActive: "border-primary text-text-primary",
    triggerInactive:
      "text-text-secondary hover:text-text-primary hover:border-text-secondary",
    panel: [
      "outline-none",
      "focus-visible:ring-2 focus-visible:ring-primary rounded",
    ].join(" "),
  },
  stack: {
    shell: "flex",
    inline: "inline-flex",
    directions: { vertical: "flex-col", horizontal: "flex-row" },
    gaps: { sm: "gap-2", md: "gap-4", lg: "gap-6", xl: "gap-8" },
    aligns: {
      start: "items-start",
      center: "items-center",
      end: "items-end",
      stretch: "items-stretch",
      baseline: "items-baseline",
    },
    justifies: {
      start: "justify-start",
      center: "justify-center",
      end: "justify-end",
      between: "justify-between",
      around: "justify-around",
      evenly: "justify-evenly",
    },
    wrap: "flex-wrap",
  },
  disclosure: {
    shell: "border border-border rounded-md bg-surface",
    trigger: [
      "w-full flex items-center justify-between gap-3",
      "px-4 py-3 text-left",
      "font-body text-sm font-medium text-text-primary",
      "transition-colors hover:bg-surface-2",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      "disabled:opacity-50 disabled:cursor-not-allowed",
    ].join(" "),
    summary: "flex-1 min-w-0",
    icon: "shrink-0 font-mono text-text-secondary",
    panel: "px-4 pb-4 pt-1 text-sm text-text-secondary",
  },
  accordion: {
    shell: "flex flex-col divide-y divide-border border border-border rounded-md bg-surface",
    item: "",
    trigger: [
      "w-full flex items-center justify-between gap-3",
      "px-4 py-3 text-left",
      "font-body text-sm font-medium text-text-primary",
      "transition-colors hover:bg-surface-2",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      "disabled:opacity-50 disabled:cursor-not-allowed",
    ].join(" "),
    triggerOpen: "bg-surface-2",
    summary: "flex-1 min-w-0",
    icon: "shrink-0 font-mono text-text-secondary",
    panel: "px-4 pb-4 pt-1 text-sm text-text-secondary",
  },
};

/* ─────────────────────────────────────────────────────────────────────────
 * Brand presets — extracted into `presets/` (E179) so each lives in its
 * own file and can be picked up à la carte.
 *
 * NOT re-exported from this file to avoid a circular import: the primitive
 * components (Button.tsx etc.) import `getActivePreset` from "./preset"; if
 * `preset.ts` re-exported `presets/compact.ts` and `compact.ts` imported
 * `defaultPreset` from "../preset", the brand-preset module would init
 * before `defaultPreset` was assigned.
 *
 * Public consumers should import brand presets from the barrel:
 *
 *     import { compactPreset, editorialPreset, densePreset } from "@/components/ui";
 *
 * Conventions for new presets:
 *   - Spread one direction (compact spreads default, dense spreads compact)
 *   - Land in `presets/<name>.ts`
 *   - Re-export from `index.ts` barrel
 *   - Document in `docs/design/PRESET_RECIPES.md`
 * ───────────────────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────────────────
 * Active preset — module-level. `getActivePreset()` is called by every
 * primitive on render (cheap — just an object read).
 * Swap at app boot, in tests, or ad-hoc:
 *
 *     import { setActivePreset, compactPreset } from "@/components/ui";
 *     setActivePreset(compactPreset);
 *
 * Or merge slots:
 *
 *     setActivePreset({
 *       ...defaultPreset,
 *       breadcrumb: { ...defaultPreset.breadcrumb, separatorGlyph: "›" },
 *     });
 * ───────────────────────────────────────────────────────────────────────── */
let active: Preset = defaultPreset;

export function getActivePreset(): Preset {
  return active;
}

export function setActivePreset(preset: Preset): void {
  active = preset;
}

export function resetActivePreset(): void {
  active = defaultPreset;
}
