/* ============================================================================
 * COMPACT PRESET — denser tables, smaller padding, smaller buttons.
 *
 * Demonstrates that the preset axis is real: import + setActivePreset.
 * Inherits everything from `defaultPreset` and overrides only the slots that
 * need to be denser. Stay one-direction (compact spreads from default — never
 * the other way around) so the dependency arrow is unambiguous.
 *
 * Extracted from `preset.ts` in E179 to keep the central interface file
 * focused on type definitions + the canonical `defaultPreset`.
 * ============================================================================ */

import type { Preset } from "../preset";
import { defaultPreset } from "../preset";

export const compactPreset: Preset = {
  ...defaultPreset,
  name: "compact",
  button: {
    ...defaultPreset.button,
    sizes: {
      sm: "px-2 py-1 text-[11px] rounded-sm",
      md: "px-4 py-2 text-xs rounded",
      lg: "px-5 py-2.5 text-sm rounded",
    },
  },
  table: {
    ...defaultPreset.table,
    toolbar:
      "flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border",
    th: "px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-text-secondary",
    td: "px-3 py-2 text-text-primary",
    state: "px-3 py-6 text-center text-xs font-mono text-text-secondary",
  },
  pagination: {
    ...defaultPreset.pagination,
    shell:
      "flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-border",
    button: {
      ...defaultPreset.pagination.button,
      base: "min-w-[28px] h-7 px-2 text-[11px] font-mono border border-border rounded transition-colors",
    },
  },
  pageContainer: {
    ...defaultPreset.pageContainer,
    header:
      "mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between",
    title: "font-display text-xl md:text-2xl font-bold text-text-primary mt-1",
    body: "space-y-4",
  },
  // E173 — denser form primitives
  textInput: {
    ...defaultPreset.textInput,
    input: [
      "w-full px-2.5 py-1.5 text-xs",
      "bg-surface text-text-primary border border-border rounded",
      "placeholder:text-text-muted",
      "focus:outline-none focus:border-primary focus:shadow-[0_0_0_2px_var(--primary-bg)]",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      "transition-colors",
    ].join(" "),
  },
  textArea: {
    ...defaultPreset.textArea,
    textarea: [
      "w-full px-2.5 py-1.5 text-xs",
      "bg-surface text-text-primary border border-border rounded",
      "placeholder:text-text-muted resize-y",
      "focus:outline-none focus:border-primary focus:shadow-[0_0_0_2px_var(--primary-bg)]",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      "transition-colors",
    ].join(" "),
  },
  numberInput: {
    ...defaultPreset.numberInput,
    input: [
      "w-full px-2.5 py-1.5 text-xs",
      "bg-surface text-text-primary border border-border rounded",
      "focus:outline-none focus:border-primary focus:shadow-[0_0_0_2px_var(--primary-bg)]",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      "transition-colors",
    ].join(" "),
  },
  select: {
    ...defaultPreset.select,
    select: [
      "w-full py-1.5 pl-2.5 pr-7 text-xs",
      "bg-surface text-text-primary border border-border rounded",
      "focus:outline-none focus:border-primary focus:shadow-[0_0_0_2px_var(--primary-bg)]",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      "transition-colors",
    ].join(" "),
  },
  checkbox: {
    ...defaultPreset.checkbox,
    label: "text-xs text-text-primary",
  },
  radioGroup: {
    ...defaultPreset.radioGroup,
    shell: "flex flex-col gap-1.5",
    label: "text-xs text-text-primary",
  },
  toggle: {
    ...defaultPreset.toggle,
    track: {
      ...defaultPreset.toggle.track,
      base: [
        "relative inline-block w-8 h-[18px] rounded-full border",
        "transition-colors duration-200",
      ].join(" "),
    },
    thumb: {
      ...defaultPreset.toggle.thumb,
      base: [
        "absolute top-[2px] left-[2px] h-3 w-3 rounded-full",
        "transition-transform duration-200",
      ].join(" "),
      on: "translate-x-[14px] bg-bg",
    },
    label: "text-xs text-text-primary",
  },
  // E174 — denser overlay primitives
  modal: {
    ...defaultPreset.modal,
    header: [
      "flex items-start justify-between gap-2",
      "px-4 pt-3 pb-2 border-b border-border",
    ].join(" "),
    title: "font-display text-base font-semibold text-text-primary",
    body: "px-4 py-3",
  },
  drawer: {
    ...defaultPreset.drawer,
    header: [
      "flex items-start justify-between gap-2",
      "px-4 pt-3 pb-2 border-b border-border",
    ].join(" "),
    title: "font-display text-base font-semibold text-text-primary",
    body: "flex-1 overflow-y-auto px-4 py-3",
  },
  toast: {
    ...defaultPreset.toast,
    shell: [
      "pointer-events-auto",
      "min-w-[200px] max-w-xs",
      "flex items-start gap-2 px-3 py-2 rounded border shadow-md",
      "text-xs",
    ].join(" "),
  },
  // E175 — denser dashboard chrome (compact ships denser Tailwind utility
  // classes additively; the legacy CSS still drives base layout).
  navItem: {
    ...defaultPreset.navItem,
    base: [
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      "[&]:px-2 [&]:py-1 [&]:text-xs",
    ].join(" "),
  },
  // E178 — denser layout primitives
  card: {
    ...defaultPreset.card,
    paddings: { sm: "p-2", md: "p-3", lg: "p-5" },
    header: "border-b border-border pb-2 mb-2",
    footer: "border-t border-border pt-2 mt-2",
    title: "font-display text-sm font-semibold text-text-primary",
  },
  tabs: {
    ...defaultPreset.tabs,
    trigger: [
      "px-2 py-1.5 -mb-px border-b-2 border-transparent",
      "font-body text-xs font-medium",
      "transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      "disabled:opacity-50 disabled:cursor-not-allowed",
    ].join(" "),
  },
  stack: {
    ...defaultPreset.stack,
    gaps: { sm: "gap-1", md: "gap-2", lg: "gap-4", xl: "gap-6" },
  },
  disclosure: {
    ...defaultPreset.disclosure,
    trigger: [
      "w-full flex items-center justify-between gap-2",
      "px-3 py-2 text-left",
      "font-body text-xs font-medium text-text-primary",
      "transition-colors hover:bg-surface-2",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      "disabled:opacity-50 disabled:cursor-not-allowed",
    ].join(" "),
    panel: "px-3 pb-3 pt-1 text-xs text-text-secondary",
  },
  accordion: {
    ...defaultPreset.accordion,
    trigger: [
      "w-full flex items-center justify-between gap-2",
      "px-3 py-2 text-left",
      "font-body text-xs font-medium text-text-primary",
      "transition-colors hover:bg-surface-2",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      "disabled:opacity-50 disabled:cursor-not-allowed",
    ].join(" "),
    panel: "px-3 pb-3 pt-1 text-xs text-text-secondary",
  },
};
