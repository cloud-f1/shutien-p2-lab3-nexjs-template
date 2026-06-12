/* ============================================================================
 * DENSE PRESET — Bloomberg-terminal style.
 *
 * Tighter than `compactPreset` — aimed at data-heavy admin SaaS where you want
 * to fit twice the rows per viewport: trading dashboards, ops consoles,
 * analytics tools. Key differences from compact:
 *   - Mono-everywhere typography (smaller, monospaced labels)
 *   - Sharper corners (rounded-sm / rounded-none everywhere)
 *   - Tightest table padding (px-2 py-1)
 *   - Smaller font sizes across labels and inputs
 *
 * Inherits from `compactPreset` (which inherits from default), so any slot
 * not deliberately overridden falls through to compact, then default.
 *
 * Usage:
 *   import { setActivePreset, densePreset } from "@/components/ui";
 *   setActivePreset(densePreset);
 *
 * See `docs/design/PRESET_RECIPES.md` for the cookbook.
 * ============================================================================ */

import type { Preset } from "../preset";
import { compactPreset } from "./compact";

export const densePreset: Preset = {
  ...compactPreset,
  name: "dense",

  // Tightest button padding, mono labels, sharp corners.
  button: {
    ...compactPreset.button,
    base: [
      "inline-flex items-center justify-center gap-1.5 border font-mono font-semibold leading-none uppercase tracking-wider",
      "transition-colors duration-150 whitespace-nowrap",
      "disabled:opacity-50 disabled:cursor-not-allowed",
    ].join(" "),
    sizes: {
      sm: "px-1.5 py-0.5 text-[10px] rounded-sm",
      md: "px-3 py-1 text-[11px] rounded-sm",
      lg: "px-4 py-1.5 text-xs rounded-sm",
    },
  },

  // Bloomberg-grade table density: 2px padding, mono everywhere, no row hover
  // bleed. State row also tightened.
  table: {
    ...compactPreset.table,
    shell: "bg-surface border border-border rounded-sm overflow-hidden",
    toolbar:
      "flex flex-wrap items-center gap-2 px-2 py-1.5 border-b border-border",
    toolbarTitle: "font-mono text-[11px] uppercase tracking-wider text-text-primary mr-auto",
    table: "w-full text-[11px]",
    th: "px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-text-secondary",
    td: "px-2 py-1 font-mono text-text-primary",
    tdMono: "font-mono text-[10px]",
    state: "px-2 py-4 text-center text-[11px] font-mono text-text-secondary",
    rowAction: {
      default: [
        "px-1.5 py-0.5 text-[10px] font-mono rounded-sm border transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "border-border text-text-secondary hover:text-text-primary hover:border-text-secondary hover:bg-surface-2",
      ].join(" "),
      danger: [
        "px-1.5 py-0.5 text-[10px] font-mono rounded-sm border transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "border-border text-text-secondary hover:text-danger hover:border-danger hover:bg-danger-light",
      ].join(" "),
    },
  },

  pagination: {
    ...compactPreset.pagination,
    shell:
      "flex flex-wrap items-center justify-between gap-2 px-2 py-1.5 border-t border-border",
    summary: "text-[10px] font-mono text-text-muted",
    button: {
      ...compactPreset.pagination.button,
      base: "min-w-[24px] h-6 px-1.5 text-[10px] font-mono border border-border rounded-sm transition-colors",
    },
  },

  pageContainer: {
    ...compactPreset.pageContainer,
    header:
      "mb-3 flex flex-col gap-1.5 md:flex-row md:items-end md:justify-between",
    eyebrow:
      "text-[10px] font-mono uppercase tracking-wider text-primary",
    title: "font-mono text-base md:text-lg font-bold uppercase tracking-wider text-text-primary mt-0.5",
    subtitle: "text-xs text-text-secondary mt-1 max-w-2xl",
    body: "space-y-3",
  },

  breadcrumb: {
    ...compactPreset.breadcrumb,
    shell: "text-[10px] font-mono text-text-secondary",
  },

  searchInput: {
    ...compactPreset.searchInput,
    input: [
      "w-full pl-7 pr-2 py-1.5 text-xs font-mono",
      "bg-surface text-text-primary border border-border rounded-sm",
      "placeholder:text-text-muted",
      "focus:outline-none focus:border-primary focus:shadow-[0_0_0_2px_var(--primary-bg)]",
      "transition-colors",
    ].join(" "),
  },

  filterSelect: {
    ...compactPreset.filterSelect,
    label: "font-mono text-[10px] uppercase tracking-wider",
    select: [
      "py-1 pl-2 pr-6 text-xs font-mono",
      "bg-surface text-text-primary border border-border rounded-sm",
      "focus:outline-none focus:border-primary focus:shadow-[0_0_0_2px_var(--primary-bg)]",
      "transition-colors",
    ].join(" "),
  },

  formField: {
    ...compactPreset.formField,
    label: "text-[10px] font-mono uppercase tracking-wider text-text-secondary",
    hint: "text-[10px] font-mono text-text-muted",
    error: "text-[10px] font-mono text-danger",
  },

  // Form primitives — denser than compact, monospaced.
  textInput: {
    ...compactPreset.textInput,
    input: [
      "w-full px-2 py-1 text-xs font-mono",
      "bg-surface text-text-primary border border-border rounded-sm",
      "placeholder:text-text-muted",
      "focus:outline-none focus:border-primary focus:shadow-[0_0_0_2px_var(--primary-bg)]",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      "transition-colors",
    ].join(" "),
  },
  textArea: {
    ...compactPreset.textArea,
    textarea: [
      "w-full px-2 py-1 text-xs font-mono",
      "bg-surface text-text-primary border border-border rounded-sm",
      "placeholder:text-text-muted resize-y",
      "focus:outline-none focus:border-primary focus:shadow-[0_0_0_2px_var(--primary-bg)]",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      "transition-colors",
    ].join(" "),
  },
  numberInput: {
    ...compactPreset.numberInput,
    input: [
      "w-full px-2 py-1 text-xs font-mono text-right",
      "bg-surface text-text-primary border border-border rounded-sm",
      "focus:outline-none focus:border-primary focus:shadow-[0_0_0_2px_var(--primary-bg)]",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      "transition-colors",
    ].join(" "),
  },
  select: {
    ...compactPreset.select,
    select: [
      "w-full py-1 pl-2 pr-6 text-xs font-mono",
      "bg-surface text-text-primary border border-border rounded-sm",
      "focus:outline-none focus:border-primary focus:shadow-[0_0_0_2px_var(--primary-bg)]",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      "transition-colors",
    ].join(" "),
  },

  // Sharper card corners, denser padding.
  card: {
    ...compactPreset.card,
    shell: [
      "bg-surface text-text-primary border border-border rounded-sm",
      "transition-colors duration-150",
    ].join(" "),
    paddings: { sm: "p-1.5", md: "p-2", lg: "p-3" },
    header: "border-b border-border pb-1.5 mb-1.5",
    footer: "border-t border-border pt-1.5 mt-1.5",
    title: "font-mono text-xs font-bold uppercase tracking-wider text-text-primary",
    subtitle: "text-[10px] text-text-secondary",
  },

  // Tabs — minimal padding, mono.
  tabs: {
    ...compactPreset.tabs,
    trigger: [
      "px-1.5 py-1 -mb-px border-b-2 border-transparent",
      "font-mono text-[10px] font-medium uppercase tracking-wider",
      "transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      "disabled:opacity-50 disabled:cursor-not-allowed",
    ].join(" "),
  },

  // Stack — even tighter gaps.
  stack: {
    ...compactPreset.stack,
    gaps: { sm: "gap-0.5", md: "gap-1", lg: "gap-2", xl: "gap-3" },
  },

  // Toast — smaller and mono.
  toast: {
    ...compactPreset.toast,
    shell: [
      "pointer-events-auto",
      "min-w-[180px] max-w-xs",
      "flex items-start gap-1.5 px-2 py-1.5 rounded-sm border shadow",
      "text-[11px] font-mono",
    ].join(" "),
  },

  // NavItem — minimal padding.
  navItem: {
    ...compactPreset.navItem,
    base: [
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      "[&]:px-1.5 [&]:py-0.5 [&]:text-[10px] [&]:uppercase [&]:tracking-wider [&]:font-mono",
    ].join(" "),
  },
};
